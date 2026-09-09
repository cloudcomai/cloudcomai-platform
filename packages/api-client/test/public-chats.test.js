import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudComAiApi } from '../src/index.js';

test('lists public city chat rooms', async () => {
  let captured;
  const api = createCloudComAiApi({
    request: async (...args) => {
      captured = args;
      return { data: { rooms: [] }, status: 200 };
    },
    get: async (...args) => {
      captured = args;
      return { data: { rooms: [] }, status: 200 };
    },
  });

  const result = await api.listPublicChats();
  assert.deepEqual(result.data.rooms, []);
  assert.equal(captured[0], 'v1/public-chats');
});

test('joins a public city chat room', async () => {
  let captured;
  const api = createCloudComAiApi({
    request: async () => ({ data: {}, status: 200 }),
    post: async (...args) => {
      captured = args;
      return { data: { chat: { id: 42, type: 'public', name: 'Hyderabad' } }, status: 200 };
    },
  });

  const result = await api.joinPublicChat(42);
  assert.equal(result.data.chat.id, 42);
  assert.equal(captured[0], 'v1/public-chats');
  assert.deepEqual(captured[1], { room_id: 42 });
});
