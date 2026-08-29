import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/index.js';

test('adds query parameters and a bearer token', async () => {
  let captured;
  const client = new ApiClient({
    baseUrl: 'https://example.test/api/',
    tokenProvider: () => 'token-123',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  await client.get('v1/messages', { query: { chat_id: 7, after_id: 12 } });
  assert.equal(captured.url, 'https://example.test/api/v1/messages?chat_id=7&after_id=12');
  assert.equal(captured.options.headers.get('Authorization'), 'Bearer token-123');
});

test('serializes JSON request bodies', async () => {
  let captured;
  const client = new ApiClient({
    baseUrl: 'https://example.test/api/',
    fetchImpl: async (_url, options) => {
      captured = options;
      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const result = await client.post('v1/messages', { chat_id: 2, text: 'Hello' });
  assert.equal(captured.body, '{"chat_id":2,"text":"Hello"}');
  assert.equal(captured.headers.get('Content-Type'), 'application/json');
  assert.equal(result.status, 201);
});

test('normalizes API errors', async () => {
  const client = new ApiClient({
    baseUrl: 'https://example.test/api/',
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
  });
  await assert.rejects(
    () => client.post('v1/auth/login', {}, { auth: false }),
    (error) =>
      error instanceof ApiError &&
      error.status === 401 &&
      error.message === 'Invalid credentials',
  );
});

test('notifies the session layer after an authenticated 401', async () => {
  let unauthorizedCalls = 0;
  const client = new ApiClient({
    baseUrl: 'https://example.test/api/',
    tokenProvider: () => 'expired-token',
    onUnauthorized: async () => {
      unauthorizedCalls += 1;
    },
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  await assert.rejects(() => client.get('v1/chats'), ApiError);
  assert.equal(unauthorizedCalls, 1);
});
