import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvatarInitial, getAvatarPalette } from '../src/avatar.js';

test('uses the first letter of the display name', () => {
  assert.equal(getAvatarInitial('Naveen Kumar', 'naveen'), 'N');
});

test('falls back to username and then a safe default', () => {
  assert.equal(getAvatarInitial('', 'clouduser'), 'C');
  assert.equal(getAvatarInitial('', ''), 'U');
});

test('supports non-Latin display names', () => {
  assert.equal(getAvatarInitial('తెలుగు User', 'user'), 'త');
});

test('returns a stable palette for the same unique user ID', () => {
  assert.deepEqual(getAvatarPalette(12345), getAvatarPalette('12345'));
  assert.deepEqual(getAvatarPalette('user-abc'), getAvatarPalette('user-abc'));
});

test('different user IDs can receive different palette entries', () => {
  const palettes = new Set(['user-1', 'user-2', 'user-3', 'user-4'].map(id => JSON.stringify(getAvatarPalette(id))));
  assert.ok(palettes.size > 1);
});
