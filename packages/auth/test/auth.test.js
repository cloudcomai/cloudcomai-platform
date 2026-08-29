import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSessionManager, createMemoryStorage } from '../src/index.js';

test('stores, reads, and clears a session', async () => {
  const manager = createAuthSessionManager({ storage: createMemoryStorage() });
  const session = { token: 'abc', user: { id: 1, name: 'CloudComAI User' } };
  await manager.setSession(session);
  assert.deepEqual(await manager.getSession(), session);
  assert.equal(await manager.getToken(), 'abc');
  await manager.clearSession();
  assert.equal(await manager.getSession(), null);
});

test('rejects incomplete sessions', async () => {
  const manager = createAuthSessionManager({ storage: createMemoryStorage() });
  await assert.rejects(() => manager.setSession({ token: 'abc' }), TypeError);
});
