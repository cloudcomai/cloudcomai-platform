import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../src/utils/apiBaseUrl.js';

test('requires an explicitly configured API URL', () => {
  assert.throws(() => resolveApiBaseUrl(), /VITE_API_BASE_URL is required/);
  assert.throws(() => resolveApiBaseUrl({ configuredUrl: '   ' }), /VITE_API_BASE_URL is required/);
});

test('uses the configured production API URL and removes trailing slashes', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'https://www.cloudcomai.com/apiapp/api///' }),
    'https://www.cloudcomai.com/apiapp/api',
  );
});

test('rejects insecure, local, and development hosts', () => {
  for (const configuredUrl of [
    'http://www.cloudcomai.com/api',
    'http://localhost:8080/api',
    'https://localhost/api',
    'https://cloudcomai.freedev.app/apiapp/api',
    'https://freedev.app/api',
    '/api',
  ]) {
    assert.throws(() => resolveApiBaseUrl({ configuredUrl }), TypeError);
  }
});

test('rejects query strings and fragments in API base URLs', () => {
  assert.throws(
    () => resolveApiBaseUrl({ configuredUrl: 'https://www.cloudcomai.com/api?debug=1' }),
    /query string or fragment/,
  );
});
