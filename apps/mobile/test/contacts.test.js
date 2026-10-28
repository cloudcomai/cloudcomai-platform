import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMobileContacts, requestPhoneContactSync, syncPhoneContacts } from '../src/utils/contacts.js';

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
  assert.deepEqual(await loadMobileContacts(api, 1, 500), contacts);
  assert.deepEqual(api.calls, ['status', 'sync', ['list', 1, 500]]);
});

test('uses the saved contact snapshot when disconnected or sync/status is unavailable', async () => {
  const contacts = [{ registered_user_id: 42, display_name: 'Alice' }];
  for (const api of [
    createApi({ connected: false, contacts }),
    createApi({ syncError: 'offline', contacts }),
    createApi({ statusError: 'offline', contacts }),
  ]) assert.deepEqual(await loadMobileContacts(api, 1, 500), contacts);
});

test('phone contact sync uses the Expo module-level permission API', async () => {
  let permissionRequested = false;
  let uploaded = null;
  const module = {
    ContactField: { FULL_NAME: 'name', EMAILS: 'emails', PHONES: 'phones' },
    requestPermissionsAsync: async () => { permissionRequested = true; return { granted: true }; },
    Contact: { getAllDetails: async () => [{ fullName: 'Sam Example', emails: [{ email: 'sam@example.com' }], phones: [{ number: '+91 9876543210' }] }] },
  };
  const result = await syncPhoneContacts({ syncPhoneContacts: async contacts => { uploaded = contacts; } }, module);
  assert.equal(permissionRequested, true);
  assert.equal(result.granted, true);
  assert.equal(result.count, 1);
  assert.deepEqual(uploaded, [{ name: 'Sam Example', email: 'sam@example.com', phone: '+91 9876543210' }]);
});

test('loading contacts does not upload device contacts automatically', async () => {
  let uploaded = false;
  const api = createApi({ connected: false, contacts: [{ registered_user_id: 12 }] });
  api.syncPhoneContacts = async () => { uploaded = true; };
  assert.deepEqual(await loadMobileContacts(api, 1, 500), [{ registered_user_id: 12 }]);
  assert.equal(uploaded, false);
});

test('phone contact sync requires explicit disclosure confirmation', async () => {
  let requested = false;
  let uploaded = false;
  const module = { requestPermissionsAsync: async () => { requested = true; return { granted: true }; } };
  const api = { syncPhoneContacts: async () => { uploaded = true; } };
  const result = await requestPhoneContactSync(api, async () => false, module);
  assert.equal(result.cancelled, true);
  assert.equal(requested, false);
  assert.equal(uploaded, false);
});
