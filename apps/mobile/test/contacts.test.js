import assert from 'node:assert/strict';
import { loadMobileContacts } from '../src/utils/contacts.js';

const createApi = ({ connected = true, syncError = null, contacts = [] } = {}) => {
  const calls = [];
  return {
    calls,
    async getGoogleStatus() {
      calls.push('status');
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

const registered = [{ registered_user_id: 42, display_name: 'Alice' }];
const api = createApi({ contacts: registered });
assert.deepEqual(await loadMobileContacts(api), registered);
assert.deepEqual(api.calls, ['status', 'sync', ['list', 1, 500]]);

const notConnected = createApi({ connected: false, contacts: registered });
assert.deepEqual(await loadMobileContacts(notConnected), registered);
assert.deepEqual(notConnected.calls, ['status', ['list', 1, 500]]);

const syncUnavailable = createApi({ connected: true, syncError: 'Google unavailable', contacts: registered });
assert.deepEqual(await loadMobileContacts(syncUnavailable), registered);
assert.deepEqual(syncUnavailable.calls, ['status', 'sync', ['list', 1, 500]]);

const statusUnavailable = createApi({ contacts: registered });
statusUnavailable.getGoogleStatus = async () => {
  statusUnavailable.calls.push('status');
  throw new Error('status unavailable');
};
assert.deepEqual(await loadMobileContacts(statusUnavailable), registered);
assert.deepEqual(statusUnavailable.calls, ['status', ['list', 1, 500]]);

echo = console.log;
echo('Mobile contacts loading tests passed');
