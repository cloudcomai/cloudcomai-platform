import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const avatar = fs.readFileSync(new URL('../src/components/ContactAvatar.js', import.meta.url), 'utf8');
const contacts = fs.readFileSync(new URL('../src/components/MobileDashboardLists.js', import.meta.url), 'utf8');

test('mobile contact avatar uses the shared stable palette and username fallback', () => {
  assert.match(avatar, /getAvatarPalette\(userId \|\| username \|\| name\)/);
  assert.match(avatar, /getAvatarInitial\(name, username\)/);
});

test('mobile contact avatar covers the circle and falls back after image errors', () => {
  assert.match(avatar, /resizeMode="cover"/);
  assert.match(avatar, /onError=\{\(\) => setFailedUri\(imageUri\)\}/);
  assert.match(avatar, /failedUri !== imageUri/);
});

test('mobile contacts use the existing media URL when photo_url is absent', () => {
  assert.match(contacts, /item\.photo_url \|\| \(userId \? mediaUrl\('user',userId,item\.image_version \|\| ''\)/);
});
