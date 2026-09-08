import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadTracker, pollDateExpiry } from '../src/index.js';

test('read receipts coalesce incoming messages while preserving order', async () => {
  let release;
  const calls = [];
  const tracker = createReadTracker({ send: async id => { calls.push(id); if (id === 2) await new Promise(resolve => { release = resolve; }); } });
  const first = tracker.mark(2);
  await Promise.resolve();
  tracker.mark(4); tracker.mark(3);
  release(); await first;
  await tracker.mark(3);
  assert.deepEqual(calls, [2, 4]);
});
test('failed receipts retry and disposed chat ignores late response', async () => {
  let attempts = 0;
  let updates = 0;
  const tracker = createReadTracker({ send: async () => { if (++attempts === 1) throw new Error('offline'); }, onRead: () => updates++ });
  await tracker.mark(3); await tracker.mark(3);
  tracker.dispose(); await tracker.mark(4);
  assert.equal(attempts, 2); assert.equal(updates, 1);
});
test('poll dates validate the calendar and use local end of day', () => {
  const now = new Date(2026, 8, 8, 12);
  assert.equal(pollDateExpiry('', now), undefined);
  assert.equal(pollDateExpiry('2026-09-09', now), new Date(2026, 8, 9, 23, 59, 59).toISOString());
  for (const value of ['2026-02-30', '2026-09-07', '2026-9-9', 'invalid']) assert.throws(() => pollDateExpiry(value, now));
});
