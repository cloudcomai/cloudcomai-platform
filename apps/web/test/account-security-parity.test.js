import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const privacy = await readFile(new URL('../src/components/PrivacyAccountPanel.jsx', import.meta.url), 'utf8');
const profile = await readFile(new URL('../src/components/WebMobileParity.jsx', import.meta.url), 'utf8');
const canvas = await readFile(new URL('../src/components/ChatCanvas.jsx', import.meta.url), 'utf8');

test('web Privacy & Account exposes encrypted cloud backup settings and actions', () => {
  for (const method of [
    'getAccountBackupStatus',
    'updateAccountBackupSettings',
    'createAccountBackup',
    'restoreAccountBackup',
  ]) assert.match(privacy, new RegExp('privacyApi\\.' + method));
  for (const setting of ['automatic_frequency', 'include_videos', 'wifi_only']) assert.match(privacy, new RegExp(setting));
  assert.match(privacy, /email_verified/);
  assert.match(privacy, /restore_available/);
  assert.match(privacy, /window\\.confirm/);
});

test('web user profile exposes Trusted User enable and disable controls', () => {
  assert.match(profile, /platformApi\\.trustUser/);
  assert.match(profile, /platformApi\\.untrustUser/);
  assert.match(profile, /Trusted User/);
  assert.match(profile, /trusted_user/);
});

test('private chat header continues to render the recipient avatar', () => {
  assert.match(canvas, /chatAvatarSrc && !chatAvatarFailed/);
  assert.match(canvas, /mediaUrl\\('user', privateUserId\\)/);
  assert.match(canvas, /selectedChat\\.other_user_id/);
});
