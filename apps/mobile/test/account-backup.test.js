import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../../packages/api-client/src/cloudcomai-api.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/components/PrivacySettings.js', import.meta.url), 'utf8');
const contract = fs.readFileSync(new URL('../../backend/api-contract.json', import.meta.url), 'utf8');

test('mobile account backup exposes cloud backup and restore API methods', () => {
  assert.match(api, /getAccountBackupStatus/);
  assert.match(api, /updateAccountBackupSettings/);
  assert.match(api, /createAccountBackup/);
  assert.match(api, /restoreAccountBackup/);
  assert.match(contract, /v1\/users\/backup/);
  assert.match(contract, /"GET", "POST", "PUT"/);
});

test('account backup UI separates cloud backup from JSON export', () => {
  for (const label of ['Chat Backup', 'BACK UP NOW', 'Automatic backup', 'Daily', 'Weekly', 'Monthly', 'Include videos', 'Backup over Wi-Fi only', 'Restore backup', 'Export account data']) assert.match(ui, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(ui, /Preparing backup/);
  assert.match(ui, /Uploading encrypted backup/);
  assert.match(ui, /Backup completed/);
});
