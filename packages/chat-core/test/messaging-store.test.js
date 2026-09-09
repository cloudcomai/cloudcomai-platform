import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessagingStore } from '../src/index.js';
const memory = () => { const data = new Map(); return { getItem: async key => data.get(key) || null, setItem: async (key, value) => data.set(key, value) }; };

test('offline sends and drafts survive restart and retry the same key', async () => {
  const storage = memory();
  const sent = [];
  const create = send => createMessagingStore({ userId: 1, storage, send, makeId: () => 'stable-client-key' });
  const first = create(async input => { sent.push(input.client_message_id); throw new Error('lost response'); });
  await first.load(); await first.saveDraft(3, 'Hello 😀');
  assert.equal(first.snapshot().drafts[3], 'Hello 😀');
  await first.enqueue({ chat_id: 3, body: 'Hello 😀' }); await first.flush();
  const next = create(async input => { sent.push(input.client_message_id); return { message: { id: 7, ...input } }; });
  await next.load();
  assert.equal(next.snapshot().drafts[3], undefined);
  assert.equal(next.snapshot().outbox.length, 1);
  await next.retry('stable-client-key'); await next.flush();
  assert.deepEqual(sent, ['stable-client-key', 'stable-client-key']);
  assert.equal(next.snapshot().outbox.length, 0);
});
test('permanent failures block later messages in the same chat until handled', async () => {
  const storage = memory(); let id = 0; const calls = [];
  const store = createMessagingStore({ userId: 1, storage, makeId: () => `key-${++id}`, send: async input => { calls.push(input.body); if (input.body === 'bad') throw Object.assign(new Error('blocked'), { status: 403 }); return { message: { id: 1 } }; } });
  await store.load(); await store.enqueue({ chat_id: 1, body: 'bad' }); await store.enqueue({ chat_id: 1, body: 'later' }); await store.enqueue({ chat_id: 2, body: 'another chat' });
  await Promise.all([store.flush(), store.flush()]);
  assert.deepEqual(calls, ['bad', 'another chat']);
  assert.equal(store.snapshot().outbox[0].status, 'failed');
  await store.remove('key-1'); await store.flush();
  assert.deepEqual(calls, ['bad', 'another chat', 'later']);
});
test('account isolation and logout stop unsent work', async () => {
  const storage = memory(); let count = 0;
  const first = createMessagingStore({ userId: 1, storage, send: async () => { count++; } });
  await first.load(); await first.enqueue({ chat_id: 4, body: 'Private draft' }); first.stop(); await first.flush();
  const second = createMessagingStore({ userId: 2, storage, send: async () => {} });
  await second.load(); assert.equal(second.snapshot().outbox.length, 0); assert.equal(count, 0);
});
test('storage failure keeps the draft and never sends an unpersisted message', async () => {
  let reject = false; const storage = memory(); const original = storage.setItem;
  storage.setItem = async (...args) => { if (reject) throw new Error('storage full'); return original(...args); };
  const store = createMessagingStore({ userId: 1, storage, send: async () => assert.fail('must not send') });
  await store.load(); await store.saveDraft(1, 'Keep me'); reject = true;
  await assert.rejects(store.enqueue({ chat_id: 1, body: 'Keep me' }));
  assert.equal(store.snapshot().drafts[1], 'Keep me');
});
test('a synchronized message clears an outbox item after a lost response', async () => {
  const store = createMessagingStore({ userId: 1, storage: memory(), send: async () => {} });
  await store.load(); const item = await store.enqueue({ chat_id: 1, body: 'Confirmed by polling' });
  await store.acknowledge([{ id: 12, client_message_id: item.id }]);
  assert.equal(store.snapshot().outbox.length, 0);
});
