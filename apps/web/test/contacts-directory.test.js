import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/ChatDirectory.jsx', import.meta.url), 'utf8');

test('empty web contacts list offers a way to connect or sync Google Contacts', () => {
  assert.match(source, /None of your synced contacts are registered on CloudComAI yet\./);
  assert.match(source, /Connect or sync Google Contacts/);
  assert.match(source, /setModal\('google_contacts'\)/);
});

test('web contact list still loads registered contacts from the authenticated contacts API', () => {
  assert.match(source, /platformApi\.listContacts\(page, 500\)/);
  assert.match(source, /contact\.registered_user_id/);
});
