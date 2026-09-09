import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileImageCacheKey } from '../src/utils/profileImage.js';

test('builds a stable cache key from a server version and a unique nonce', () => {
  assert.equal(buildProfileImageCacheKey('2026-09-09T12:00:00Z', 12345), '2026-09-09T12:00:00Z-12345');
});

test('uses a current fallback when the server has no image version', () => {
  assert.equal(buildProfileImageCacheKey('', 12345), 'current-12345');
  assert.equal(buildProfileImageCacheKey(null, 12345), 'current-12345');
});
