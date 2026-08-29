const messageId = message => Number(message?.id || 0);

export const mergeMessageBatch = (current, incoming) => {
  const existing = Array.isArray(current) ? current : [];
  const batch = Array.isArray(incoming) ? incoming : [];
  if (batch.length === 0) {
    return { messages: existing, cursor: existing.reduce((max, item) => Math.max(max, messageId(item)), 0), changed: false };
  }

  const byId = new Map(existing.map(item => [messageId(item), item]));
  let changed = false;
  batch.forEach(item => {
    const id = messageId(item);
    if (!id) return;
    if (byId.get(id) !== item) changed = true;
    byId.set(id, item);
  });
  const messages = [...byId.values()].sort((a, b) => messageId(a) - messageId(b));
  return {
    messages,
    cursor: messages.reduce((max, item) => Math.max(max, messageId(item)), 0),
    changed,
  };
};

export const createPollingMessageTransport = ({
  fetchMessages,
  getCursor,
  onMessages,
  onError = () => {},
  intervalMs = 3000,
  visibilitySource = globalThis.document,
  scheduler = globalThis,
}) => {
  if (typeof fetchMessages !== 'function' || typeof getCursor !== 'function' || typeof onMessages !== 'function') {
    throw new TypeError('fetchMessages, getCursor, and onMessages are required');
  }

  const delay = Math.max(1000, Number(intervalMs) || 3000);
  let running = false;
  let inFlight = false;
  let timerId = null;
  let controller = null;

  const clearTimer = () => {
    if (timerId !== null) scheduler.clearTimeout(timerId);
    timerId = null;
  };

  const schedule = () => {
    clearTimer();
    if (running) timerId = scheduler.setTimeout(tick, delay);
  };

  const tick = async () => {
    clearTimer();
    if (!running) return;
    if (inFlight) return;
    if (visibilitySource?.visibilityState === 'hidden') {
      schedule();
      return;
    }

    inFlight = true;
    controller = new AbortController();
    try {
      const messages = await fetchMessages(getCursor(), { signal: controller.signal });
      if (running && Array.isArray(messages) && messages.length > 0) onMessages(messages);
    } catch (error) {
      if (running && error?.name !== 'AbortError') onError(error);
    } finally {
      inFlight = false;
      controller = null;
      schedule();
    }
  };

  const handleVisibility = () => {
    if (visibilitySource?.visibilityState !== 'hidden' && running) tick();
  };

  return {
    start() {
      if (running) return;
      running = true;
      visibilitySource?.addEventListener?.('visibilitychange', handleVisibility);
      tick();
    },
    stop() {
      running = false;
      clearTimer();
      controller?.abort();
      controller = null;
      visibilitySource?.removeEventListener?.('visibilitychange', handleVisibility);
    },
  };
};
