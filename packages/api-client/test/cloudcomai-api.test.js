import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudComAiApi, ApiClient } from '../src/index.js';

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

test('password recovery uses public POST routes without a saved session or URL credentials', async () => {
  const requests = [];
  const api = new CloudComAiApi(new ApiClient({
    baseUrl: 'https://example.test/apiapp/api/',
    tokenProvider: () => assert.fail('Recovery must not read the saved login session'),
    onUnauthorized: () => assert.fail('A public recovery error must not clear another session'),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ message: requests.length === 1 ? 'Check your email' : 'Link expired' }), {
        status: requests.length === 1 ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }));
  await api.forgotPassword('alice@example.test');
  await assert.rejects(api.resetPassword('private-reset-token', 'private-password'), /Link expired/);
  assert.equal(requests[0].url, 'https://example.test/apiapp/api/v1/auth/forgot-password');
  assert.equal(requests[1].url, 'https://example.test/apiapp/api/v1/auth/reset-password');
  assert.deepEqual(JSON.parse(requests[1].options.body), { token: 'private-reset-token', password: 'private-password' });
  for (const { options } of requests) {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.has('Authorization'), false);
  }
});

test('maps incremental message retrieval to the PHP contract', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.listMessages(8, 42);
  assert.deepEqual(calls[0], { method: 'get', args: ['v1/messages', { query: { chat_id: 8, after_id: 42 } }] });
});

test('maps private-chat creation to target_user_id', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.createPrivateChat(17);
  assert.deepEqual(calls[0], { method: 'post', args: ['v1/chats', { type: 'private', target_user_id: 17 }, {}] });
});

test('maps another user profile to an authenticated id query', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.getUserProfile(17);
  assert.deepEqual(calls[0], { method: 'get', args: ['v1/users/profile', { query: { id: 17 } }] });
});

test('maps poll voting to the vote action', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.voteInPoll(4, 9);
  assert.deepEqual(calls[0], { method: 'post', args: ['v1/polls', { poll_id: 4, option_id: 9 }, { query: { action: 'vote' } }] });
});

test('maps per-user chat deletion to the chats route', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.deleteChat(23);
  assert.deepEqual(calls[0], { method: 'delete', args: ['v1/chats', { query: { id: 23 } }] });
});

test('maps preferences and invitations without exposing PHP routes', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.updatePreferences(['Private Chats', 'Technology']);
  await api.previewInvitation('invite-token');
  await api.acceptInvitation('invite-token');
  assert.deepEqual(calls, [
    { method: 'put', args: ['v1/users/preferences', { interests: ['Private Chats', 'Technology'] }, {}] },
    { method: 'get', args: ['v1/invitations/join', { auth: false, query: { token: 'invite-token' } }] },
    { method: 'post', args: ['v1/invitations/join', { token: 'invite-token' }, {}] },
  ]);
});

test('maps privacy, message deletion, search, location, screenshot, and local export routes', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.updatePrivacySettings({ hide_online_status: true });
  await api.blockContact(17);
  await api.unblockContact(17);
  await api.searchMessages(8, 'launch');
  await api.deleteMessage(42, 'everyone');
  await api.shareLocation(8, 17.385, 78.4867, 'Current location');
  await api.reportScreenshot(8);
  await api.downloadAccountBackup({ responseType: 'blob' });
  assert.deepEqual(calls, [
    { method: 'put', args: ['v1/users/privacy', { hide_online_status: true }, {}] },
    { method: 'post', args: ['v1/users/privacy', { user_id: 17 }, {}] },
    { method: 'delete', args: ['v1/users/privacy', { query: { user_id: 17 } }] },
    { method: 'get', args: ['v1/messages', { query: { chat_id: 8, after_id: 0, q: 'launch' } }] },
    { method: 'delete', args: ['v1/messages', { query: { id: 42, scope: 'everyone' } }] },
    { method: 'post', args: ['v1/messages', { chat_id: 8, type: 'location', latitude: 17.385, longitude: 78.4867, label: 'Current location' }, {}] },
    { method: 'post', args: ['v1/security/screenshot', { chat_id: 8 }, {}] },
    { method: 'get', args: ['v1/users/backup', { responseType: 'blob', query: { export: '1' } }] },
  ]);
});

test('maps cloud backup settings, backup, and restore separately from local export', async () => {
  const { client, calls } = recorder();
  const api = new CloudComAiApi(client);
  await api.getAccountBackupStatus();
  await api.updateAccountBackupSettings({ automatic_frequency: 'weekly', include_videos: true, wifi_only: true });
  await api.createAccountBackup({ include_videos: true });
  await api.restoreAccountBackup();
  assert.deepEqual(calls, [
    { method: 'get', args: ['v1/users/backup', {}] },
    { method: 'put', args: ['v1/users/backup', { automatic_frequency: 'weekly', include_videos: true, wifi_only: true }, {}] },
    { method: 'post', args: ['v1/users/backup', { action: 'backup', include_videos: true }, {}] },
    { method: 'post', args: ['v1/users/backup', { action: 'restore' }, {}] },
  ]);
});
