// Serialize read receipts so a slow response cannot move a client's count backwards.
export function createReadTracker({ send, onRead = () => {}, onError = () => {} }) {
  let acknowledged = 0;
  let desired = 0;
  let inFlight = null;
  let disposed = false;
  return {
    mark(messageId) {
      if (disposed || !Number.isSafeInteger(messageId) || messageId < 1) return Promise.resolve();
      desired = Math.max(desired, messageId);
      if (inFlight || desired <= acknowledged) return inFlight || Promise.resolve();
      inFlight = Promise.resolve().then(async () => {
        while (!disposed && desired > acknowledged) {
          const through = desired;
          const result = await send(through);
          acknowledged = through;
          if (!disposed) onRead(result);
        }
      }).catch(error => { if (!disposed) onError(error); }).finally(() => { inFlight = null; });
      return inFlight;
    },
    dispose() { disposed = true; },
  };
}

export function pollDateExpiry(value, now = new Date()) {
  if (!value?.trim()) return undefined;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Enter an expiry date as YYYY-MM-DD, or leave it blank for 30 days.');
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date <= now) {
    throw new Error('Choose a valid expiry date in the future.');
  }
  return date.toISOString();
}
