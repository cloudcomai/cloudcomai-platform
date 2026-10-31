import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPMENT_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from '../src/utils/apiBaseUrl.js';

test('uses the CloudComAI production API when a production build has no override', () => {
  assert.equal(resolveApiBaseUrl(), 'https://www.cloudcomai.com/apiapp/api');
  assert.equal(resolveApiBaseUrl(), PRODUCTION_API_BASE_URL);
});

test('keeps the development fallback isolated to development builds', () => {
  assert.equal(resolveApiBaseUrl({ isDevelopment: true }), DEVELOPMENT_API_BASE_URL);
});

test('uses an explicit production API URL and removes trailing slashes', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'https://www.cloudcomai.com/apiapp/api///' }),
    'https://www.cloudcomai.com/apiapp/api',
  );
});

test('rejects insecure, local, and development hosts in production', () => {
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
