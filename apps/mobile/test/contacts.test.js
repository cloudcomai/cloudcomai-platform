import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMobileContacts, requestPhoneContactSync } from '../src/utils/contacts.js';

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

test('declining disclosure performs no permission request, contact read or upload', async () => {
  const api = { syncPhoneContacts() { assert.fail('must not upload'); } };
  const module = { Contact: { requestPermissionsAsync() { assert.fail('must not request OS access'); } } };
  assert.deepEqual(await requestPhoneContactSync(api, async () => false, module), { granted: false, count: 0, cancelled: true });
  assert.equal((await requestPhoneContactSync(api, null, module)).cancelled, true);
});

test('affirmative disclosure precedes OS permission, read and upload; denial stops access', async () => {
  for (const granted of [true, false]) {
    const calls = [];
    const module = { ContactField: { FULL_NAME: 'name', EMAILS: 'emails', PHONES: 'phones' }, Contact: {
      async requestPermissionsAsync() { calls.push('permission'); return { granted }; },
      async getAllDetails() { calls.push('read'); return [{ fullName: 'Friend', emails: [{ email: 'friend@example.com' }], phones: [{ number: '+1234567890' }] }]; },
    } };
    const api = { async syncPhoneContacts(contacts) { calls.push('upload'); assert.deepEqual(contacts, [{ name: 'Friend', email: 'friend@example.com', phone: '+1234567890' }]); } };
    const result = await requestPhoneContactSync(api, async () => { calls.push('disclosure'); return true; }, module);
    assert.equal(result.granted, granted);
    assert.deepEqual(calls, granted ? ['disclosure', 'permission', 'read', 'upload'] : ['disclosure', 'permission']);
  }
});

test('ordinary list refresh does not upload phone contacts', async () => {
  const api = createApi({ connected: false });
  api.syncPhoneContacts = () => assert.fail('must not upload on list refresh');
  await loadMobileContacts(api);
  assert.deepEqual(api.calls, ['status', ['list', 1, 500]]);
});

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
