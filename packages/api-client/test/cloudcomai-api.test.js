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

test('maps incremental message retrieval to the PHP contract', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.listMessages(8, 42);
  assert.deepEqual(calls[0], {
    method: 'get',
    args: ['v1/messages', { query: { chat_id: 8, after_id: 42 } }],
  });
});

test('maps private-chat creation to target_user_id', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.createPrivateChat(17);
  assert.deepEqual(calls[0], {
    method: 'post',
    args: ['v1/chats', { type: 'private', target_user_id: 17 }, {}],
  });
});

test('maps poll voting to the vote action', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.voteInPoll(4, 9);
  assert.deepEqual(calls[0], {
    method: 'post',
    args: ['v1/polls', { poll_id: 4, option_id: 9 }, { query: { action: 'vote' } }],
  });
});

test('maps per-user chat deletion to the chats route', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.deleteChat(23);
  assert.deepEqual(calls[0], {
    method: 'delete',
    args: ['v1/chats', { query: { id: 23 } }],
  });
});

test('maps preferences and invitations without exposing PHP routes', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.updatePreferences(['Private Chats', 'Technology']);
  await api.previewInvitation('invite-token');
  await api.acceptInvitation('invite-token');
  assert.deepEqual(calls, [
    {
      method: 'put',
      args: ['v1/users/preferences', { interests: ['Private Chats', 'Technology'] }, {}],
    },
    {
      method: 'get',
      args: ['v1/invitations/join', { auth: false, query: { token: 'invite-token' } }],
    },
    {
      method: 'post',
      args: ['v1/invitations/join', { token: 'invite-token' }, {}],
    },
  ]);
});
