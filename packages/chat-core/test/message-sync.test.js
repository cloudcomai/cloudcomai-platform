import test from 'node:test';
import assert from 'node:assert/strict';
import { createPollingMessageTransport, mergeMessageBatch } from '../src/index.js';

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
