import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudComAiApi } from '../src/index.js';

const recorder = () => {
  const calls = [];
  const client = {};
  for (const method of ['get', 'post', 'put', 'delete']) {
    client[method] = async (...args) => {
      calls.push({ method, args });
      return { data: {}, status: 200, headers: new Headers() };
    };
  }
  client.request = () => {};
  return { client, calls };
};

test('maps friend relationship lookup to the authenticated user profile', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.getFriendRelationship(17);
  assert.deepEqual(calls[0], {
    method: 'get',
    args: ['v1/friend-requests', { query: { user_id: 17 } }],
  });
});

test('maps send and recipient response actions without creating a friendship client-side', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.sendFriendRequest(17);
  await api.respondToFriendRequest(41, 'accept');
  await api.respondToFriendRequest(42, 'decline');
  await api.respondToFriendRequest(43, 'block');
  assert.deepEqual(calls, [
    { method: 'post', args: ['v1/friend-requests', { action: 'send', user_id: 17 }, {}] },
    { method: 'post', args: ['v1/friend-requests', { action: 'accept', request_id: 41 }, {}] },
    { method: 'post', args: ['v1/friend-requests', { action: 'decline', request_id: 42 }, {}] },
    { method: 'post', args: ['v1/friend-requests', { action: 'block', request_id: 43 }, {}] },
  ]);
});
