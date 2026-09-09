// A durable, account-scoped text outbox. The server enforces the same client ID
// on retries, including a response lost after the message was committed.
export function createMessagingStore({ userId, storage, send, onDelivered = () => {}, now = Date.now, makeId = () => `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}` }) {
  if (!userId) throw new Error('An account is required for local messages.');
  const key = `cloudcomai.messages.${userId}`;
  let state = { drafts: {}, outbox: [] };
  let serial = Promise.resolve();
  let flushing = null;
  let active = true;
  let controller = null;
  const listeners = new Set();
  const snapshot = () => structuredCopy(state);
  const emit = () => { for (const listener of listeners) listener(snapshot()); };
  const read = async () => {
    const raw = await storage.getItem(key);
    if (!raw) return { drafts: {}, outbox: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.outbox) || !parsed.drafts || typeof parsed.drafts !== 'object') throw new Error('Saved local messages could not be read.');
    return parsed;
  };
  const change = operation => {
    const run = async () => {
      const next = await read();
      const before = JSON.stringify(next);
      const result = operation(next);
      const after = JSON.stringify(next);
      if (after !== before) await storage.setItem(key, after);
      const changed = JSON.stringify(state) !== after;
      state = next; if (changed) emit();
      return result;
    };
    const result = serial.then(() => storage.withLock ? storage.withLock(key, run) : run());
    serial = result.catch(() => {});
    return result;
  };
  const store = {
    async load() {
      await change(next => { for (const item of next.outbox) if (item.status === 'sending') item.status = 'queued'; });
      return snapshot();
    },
    snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    saveDraft(chatId, text) {
      return change(next => { if (text) next.drafts[String(chatId)] = text; else delete next.drafts[String(chatId)]; });
    },
    enqueue(input) {
      if (!String(input.body || '').trim() || !Number(input.chat_id)) return Promise.reject(new Error('A chat and message are required.'));
      if (String(input.body).length > 15000) return Promise.reject(new Error('Messages must be 15,000 characters or fewer.'));
      const item = { id: makeId(), payload: { chat_id: Number(input.chat_id), body: String(input.body).trim(), reply_to_message_id: input.reply_to_message_id || null }, status: 'queued', attempts: 0, nextAttemptAt: 0, createdAt: new Date(now()).toISOString(), error: '' };
      return change(next => { next.outbox.push(item); delete next.drafts[String(input.chat_id)]; return structuredCopy(item); });
    },
    acknowledge(messages) {
      const ids = new Set((messages || []).map(item => item.client_message_id).filter(Boolean));
      if (!ids.size) return Promise.resolve();
      return change(next => { next.outbox = next.outbox.filter(item => !ids.has(item.id)); });
    },
    retry(id) { return change(next => { const item = next.outbox.find(item => item.id === id); if (item && item.status !== 'sending') { item.status = 'queued'; item.nextAttemptAt = 0; item.error = ''; } }); },
    remove(id) { return change(next => { next.outbox = next.outbox.filter(item => item.id !== id || item.status === 'sending'); }); },
    start() { active = true; },
    stop() { active = false; controller?.abort(); },
    flush() {
      if (!active || flushing) return flushing || Promise.resolve();
      flushing = Promise.resolve().then(async () => {
        while (active) {
          let selected;
          await change(next => {
            const blockedChats = new Set();
            selected = next.outbox.find(item => {
              const blocked = blockedChats.has(item.payload.chat_id);
              blockedChats.add(item.payload.chat_id);
              return !blocked && item.status === 'queued' && item.nextAttemptAt <= now();
            });
            if (selected) { selected.status = 'sending'; selected.attempts++; selected = structuredCopy(selected); }
          });
          if (!selected) return;
          if (!active) { await change(next => { const item = next.outbox.find(item => item.id === selected.id); if (item) item.status = 'queued'; }); return; }
          controller = new AbortController();
          try {
            const response = await send({ ...selected.payload, client_message_id: selected.id }, { signal: controller.signal });
            const message = response?.data?.message || response?.message;
            if (!message?.id) throw new Error('The server did not confirm this message.');
            await change(next => { next.outbox = next.outbox.filter(item => item.id !== selected.id); });
            if (active) onDelivered(message);
          } catch (error) {
            await change(next => {
              const item = next.outbox.find(item => item.id === selected.id);
              if (!item) return;
              const status = Number(error.status || 0);
              item.status = status >= 400 && status < 500 && ![401,408,429].includes(status) ? 'failed' : 'queued';
              item.error = error.message || 'Waiting for connection';
              item.nextAttemptAt = now() + Math.min(60000, 2000 * (2 ** Math.min(item.attempts, 5)));
            });
          } finally { controller = null; }
        }
      }).finally(() => { flushing = null; });
      return flushing;
    },
  };
  return store;
}

function structuredCopy(value) { return JSON.parse(JSON.stringify(value)); }
