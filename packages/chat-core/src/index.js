const messageId = message => Number(message?.id || 0);

export const parseSharedLocation = body => {
  try {
    const location = typeof body === 'string' ? JSON.parse(body) : body;
    const { latitude, longitude } = location || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { latitude, longitude, label: String(location.label || 'Shared location'), url: `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}` };
  } catch { return null; }
};

const MYSQL_UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/;

export const parseMessageTimestamp = value => {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== 'string') return new Date(value);
  const trimmed = value.trim();
  const mysqlUtcMatch = trimmed.match(MYSQL_UTC_TIMESTAMP);
  return new Date(mysqlUtcMatch ? `${mysqlUtcMatch[1]}T${mysqlUtcMatch[2]}Z` : trimmed);
};

const calendarParts = (date, locale, timeZone) => {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
};

export const formatMessageTimestamp = (value, options = {}) => {
  if (!value) return 'Just now';
  const date = parseMessageTimestamp(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const now = options.now ? parseMessageTimestamp(options.now) : new Date();
  const locale = options.locale;
  const timeZone = options.timeZone;
  const messageDay = calendarParts(date, locale, timeZone);
  const currentDay = calendarParts(now, locale, timeZone);
  const messageDayNumber = Date.UTC(messageDay.year, messageDay.month - 1, messageDay.day) / 86400000;
  const currentDayNumber = Date.UTC(currentDay.year, currentDay.month - 1, currentDay.day) / 86400000;
  const dayDifference = currentDayNumber - messageDayNumber;
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone,
  }).format(date);

  if (dayDifference === 0) return time;
  if (dayDifference === 1) return `Yesterday, ${time}`;

  const includeYear = messageDay.year !== currentDay.year;
  const calendarDate = new Intl.DateTimeFormat(locale, {
    month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}), timeZone,
  }).format(date);
  return `${calendarDate}, ${time}`;
};

export const mergeMessageBatch = (current, incoming, removedIds = []) => {
  const existing = Array.isArray(current) ? current : [];
  const batch = Array.isArray(incoming) ? incoming : (incoming?.messages || []);
  const removed = new Set((incoming?.removed_ids || removedIds).map(Number));
  if (batch.length === 0 && removed.size === 0) {
    return { messages: existing, cursor: existing.reduce((max, item) => Math.max(max, messageId(item)), 0), changed: false };
  }

  const byId = new Map(existing.filter(item => !removed.has(messageId(item))).map(item => [messageId(item), item]));
  let changed = byId.size !== existing.length;
  batch.forEach(item => {
    const id = messageId(item);
    if (!id || removed.has(id)) return;
    if (JSON.stringify(byId.get(id)) === JSON.stringify(item)) return;
    changed = true;
    byId.set(id, item);
  });
  const messages = [...byId.values()].map(item => {
    if (!removed.has(Number(item.reply_to_message_id)) || !item.reply_to_text) return item;
    changed = true;
    return { ...item, reply_to_text: null, reply_to_sender_name: null };
  }).sort((a, b) => messageId(a) - messageId(b));
  return {
    messages,
    cursor: [...existing, ...batch].reduce((max, item) => Math.max(max, messageId(item)), 0),
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
      if (running && (Array.isArray(messages) || Array.isArray(messages?.messages))) onMessages(messages);
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
