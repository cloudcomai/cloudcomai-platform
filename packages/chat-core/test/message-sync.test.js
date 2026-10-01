import test from 'node:test';
import assert from 'node:assert/strict';
import { createPollingMessageTransport, formatMessageTimestamp, mergeMessageBatch, parseMessageTimestamp, parseSharedLocation } from '../src/index.js';

test('merges incremental messages by ID in chronological order', () => {
  const result = mergeMessageBatch([{ id: 2 }, { id: 4, body: 'old' }], [{ id: 3 }, { id: 4, body: 'edited' }, { id: 5 }]);
  assert.deepEqual(result.messages.map(item => item.id), [2, 3, 4, 5]);
  assert.equal(result.messages[2].body, 'edited');
  assert.equal(result.cursor, 5);
});

test('polling uses the current cursor and does not overlap requests', async () => {
  const scheduled = [];
  const scheduler = {
    setTimeout(callback) { scheduled.push(callback); return scheduled.length; },
    clearTimeout() {},
  };
  let cursor = 7;
  let resolveFetch;
  const calls = [];
  const transport = createPollingMessageTransport({
    fetchMessages(afterId) {
      calls.push(afterId);
      return new Promise(resolve => { resolveFetch = resolve; });
    },
    getCursor: () => cursor,
    onMessages(messages) { cursor = messages.at(-1).id; },
    scheduler,
    visibilitySource: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  });

  transport.start();
  assert.deepEqual(calls, [7]);
  assert.equal(scheduled.length, 0);
  resolveFetch([{ id: 8 }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scheduled.length, 1);
  transport.stop();
});

test('polling skips network work while the page is hidden', async () => {
  const scheduled = [];
  const visibility = { visibilityState: 'hidden', addEventListener() {}, removeEventListener() {} };
  let calls = 0;
  const transport = createPollingMessageTransport({
    fetchMessages: async () => { calls += 1; return []; },
    getCursor: () => 0,
    onMessages() {},
    scheduler: { setTimeout(callback) { scheduled.push(callback); return 1; }, clearTimeout() {} },
    visibilitySource: visibility,
  });
  transport.start();
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.equal(scheduled.length, 1);
  transport.stop();
});

test('treats database timestamps without offsets as UTC', () => {
  assert.equal(parseMessageTimestamp('2026-09-06 12:30:00').toISOString(), '2026-09-06T12:30:00.000Z');
});

test('formats today, yesterday, earlier dates, and previous years', () => {
  const options = { now: '2026-09-06T18:00:00Z', locale: 'en-US', timeZone: 'UTC' };
  assert.equal(formatMessageTimestamp('2026-09-06 12:30:00', options), '12:30 PM');
  assert.equal(formatMessageTimestamp('2026-09-05 12:30:00', options), 'Yesterday, 12:30 PM');
  assert.equal(formatMessageTimestamp('2026-08-30 12:30:00', options), 'Aug 30, 12:30 PM');
  assert.equal(formatMessageTimestamp('2025-12-31 12:30:00', options), 'Dec 31, 2025, 12:30 PM');
});

test('deletion-only updates remove content and quoted replies without moving the cursor backwards', () => {
  const current = [{ id: 1, body: 'removed' }, { id: 2, body: 'reply', reply_to_message_id: 1, reply_to_text: 'removed', reply_to_sender_name: 'Alice' }, { id: 3, body: 'last' }];
  const result = mergeMessageBatch(current, { messages: [], removed_ids: [1, 3] });
  assert.equal(result.changed, true);
  assert.equal(result.cursor, 3);
  assert.deepEqual(result.messages, [{ id: 2, body: 'reply', reply_to_message_id: 1, reply_to_text: null, reply_to_sender_name: null }]);
});

test('a removed message cannot be reintroduced by the same response', () => {
  const result = mergeMessageBatch([{ id: 1 }], { messages: [{ id: 1, body: 'stale' }, { id: 2, body: 'new' }], removed_ids: ['1'] });
  assert.deepEqual(result.messages, [{ id: 2, body: 'new' }]);
  assert.equal(mergeMessageBatch(result.messages, [{ id: 2, body: 'new' }]).changed, false);
});

test('polling delivers empty synchronization envelopes so empty chats and deletions are handled', async () => {
  const response = { messages: [], removed_ids: [9], screenshot_alerts: [] };
  let received;
  const transport = createPollingMessageTransport({
    getCursor: () => 9, fetchMessages: async () => response, onMessages: data => { received = data; },
    scheduler: { setTimeout() { return 1; }, clearTimeout() {} }, visibilitySource: null,
  });
  transport.start();
  await Promise.resolve(); await Promise.resolve();
  transport.stop();
  assert.equal(received, response);
});

test('location links validate coordinates and never trust a supplied URL', () => {
  assert.equal(parseSharedLocation('bad json'), null);
  assert.equal(parseSharedLocation({ latitude: 91, longitude: 0 }), null);
  assert.equal(parseSharedLocation({ latitude: '0', longitude: 0 }), null);
  assert.equal(parseSharedLocation({ latitude: NaN, longitude: 0 }), null);
  assert.equal(parseSharedLocation({ latitude: 0, longitude: -180, url: 'javascript:alert(1)' }).url, 'https://www.google.com/maps/search/?api=1&query=0%2C-180');
});
