import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.resolve(__dirname, '../App.js'), 'utf8');
const menuSource = fs.readFileSync(path.resolve(__dirname, '../src/components/MobileMenu.js'), 'utf8');
const profileSource = fs.readFileSync(path.resolve(__dirname, '../src/components/UserProfileModal.js'), 'utf8');

test('mobile chat and group avatars show initials only when the image fails', () => {
  assert.ok(appSource.includes('failedAvatarIds.has'));
  assert.ok(appSource.includes('setFailedAvatarIds'));
  assert.ok(appSource.includes('onError={() => setFailedAvatarIds'));
});

test('mobile profile/menu avatar shows the initial only when the image fails', () => {
  assert.ok(menuSource.includes('onError={() => setProfileImageFailed(true)}'));
  assert.ok(menuSource.includes(': <Text style={styles.profilePhotoFallback}>'));
});

test('View Profile avatar shows the initial only when the image fails', () => {
  assert.ok(profileSource.includes('onError={() => setImageFailed(true)}'));
  assert.ok(profileSource.includes('? <Image source={{ uri: imageSource }} style={styles.avatarImage} onError={() => setImageFailed(true)} /> : <Text style={styles.avatarFallback}>'));
});
