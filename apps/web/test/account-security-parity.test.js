import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(relative, import.meta.url), 'utf8');
const [privacy, profile, canvas, app, lockGate, lockSettings, lockService] = await Promise.all([
  read('../src/components/PrivacyAccountPanel.jsx'),
  read('../src/components/WebMobileParity.jsx'),
  read('../src/components/ChatCanvas.jsx'),
  read('../src/App.jsx'),
  read('../src/components/WebAppLockGate.jsx'),
  read('../src/components/WebAppLockSettings.jsx'),
  read('../src/services/webAppLock.js'),
]);

test('Web App Lock requires a confirmed 4–6 digit PIN and verifies before disabling', () => {
  assert.match(lockSettings, /pin !== confirmPin/);
  assert.match(lockSettings, /saveWebAppLockPin/);
  assert.match(lockSettings, /disableWebAppLock/);
  assert.match(lockSettings, /Current App Lock PIN/);
  assert.match(lockService, /verifyWebAppLockPin\(userId, pin\)/);
});

test('Web App Lock stores only a salted PBKDF2 verifier, never a plaintext PIN', () => {
  assert.match(lockService, /PBKDF2/);
  assert.match(lockService, /SHA-256/);
  assert.match(lockService, /600000/);
  assert.match(lockService, /crypto\.getRandomValues/);
  assert.match(lockService, /salt: saltHex, hash, iterations/);
  assert.doesNotMatch(lockService, /localStorage\.setItem\([^,]+,\s*pin/);
  assert.match(lockSettings, /not equivalent to native secure storage|not a hardware-backed secret store/i);
});

test('Web App Lock rejects incorrect PINs and supports correct PIN verification', () => {
  assert.match(lockService, /export async function verifyWebAppLockPin/);
  assert.match(lockService, /return difference === 0/);
  assert.match(lockGate, /Incorrect PIN/);
  assert.match(lockGate, /verifyWebAppLockPin\(userId, pin\)/);
});

test('Web App Lock covers refresh, visibility and browser lifecycle events', () => {
  assert.match(lockGate, /readWebAppLockConfig\(userId\)/);
  assert.match(lockGate, /visibilitychange/);
  assert.match(lockGate, /pagehide/);
  assert.match(lockGate, /pageshow/);
  assert.match(lockGate, /cloudcomai\.web\.app-lock\./);
  assert.match(app, /<WebAppLockGate userId=\{user\?\.id\} \/>/);
});

test('Web Privacy & Account loads cloud backup status and exposes supported settings/actions', () => {
  for (const method of [
    'getAccountBackupStatus',
    'updateAccountBackupSettings',
    'createAccountBackup',
    'restoreAccountBackup',
  ]) assert.ok(privacy.includes('privacyApi.' + method));
  for (const setting of ['automatic_frequency', 'include_videos', 'wifi_only']) assert.match(privacy, new RegExp(setting));
  assert.match(privacy, /setBackupLoading\(false\)/);
  assert.match(privacy, /email_verified/);
  assert.match(privacy, /restore_available/);
  assert.match(privacy, /window\.confirm/);
  assert.match(privacy, /backupRequestRef\.current/);
  assert.match(privacy, /await refreshBackupStatus\(\)/);
  assert.match(privacy, /navigator\.connection/);
});

test('Web Cloud Restore reports API-provided counts and handles unavailable backups', () => {
  assert.match(privacy, /restored\.chats != null/);
  assert.match(privacy, /restored\.messages != null/);
  assert.match(privacy, /!backup\.restore_available/);
  assert.match(privacy, /expired/);
  assert.match(privacy, /Unable to restore cloud backup/);
});

test('Web profile loads Trusted User state and protects add/remove requests', () => {
  assert.match(profile, /trusted_user/);
  assert.match(profile, /platformApi\.trustUser/);
  assert.match(profile, /platformApi\.untrustUser/);
  assert.match(profile, /window\.confirm/);
  assert.match(profile, /trustRequestRef\.current/);
  assert.match(profile, /profileRelationship === 'self'/);
  assert.match(profile, /profileRelationship === 'blocked'/);
  assert.match(profile, /status !== 'blocked'/);
});

test('Private chat recipient avatar remains implemented', () => {
  assert.match(canvas, /chatAvatarSrc && !chatAvatarFailed/);
  assert.match(canvas, /mediaUrl\('user', privateUserId\)/);
  assert.match(canvas, /selectedChat\.other_user_id/);
});
