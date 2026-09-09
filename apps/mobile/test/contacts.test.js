import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMobileContacts } from '../src/utils/contacts.js';

const createApi = ({ connected = true, syncError = null, contacts = [], statusError = null } = {}) => {
  const calls = [];
  return {
    calls,
    async getGoogleStatus() {
      calls.push('status');
      if (statusError) throw new Error(statusError);
      return { data: { connected } };
    },
    async syncGoogleContacts() {
      calls.push('sync');
      if (syncError) throw new Error(syncError);
      return { data: { contact_count: contacts.length } };
    },
    async listContacts(page, pageSize) {
      calls.push(['list', page, pageSize]);
      return { data: { contacts } };
    },
  };
};

test('refreshes Google contacts before reading the local snapshot when connected', async () => {
  const contacts = [{ registered_user_id: 42, display_name: 'Alice' }];
  const api = createApi({ contacts });
  assert.deepEqual(await loadMobileContacts(api), contacts);
  assert.deepEqual(api.calls, ['status', 'sync', ['list', 1, 500]]);
});

test('uses the saved contact snapshot when disconnected or sync/status is unavailable', async () => {
  const contacts = [{ registered_user_id: 42, display_name: 'Alice' }];
  for (const api of [
    createApi({ connected: false, contacts }),
    createApi({ syncError: 'offline', contacts }),
    createApi({ statusError: 'offline', contacts }),
  ]) assert.deepEqual(await loadMobileContacts(api), contacts);
});
