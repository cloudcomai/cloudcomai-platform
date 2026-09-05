import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWebApiBaseUrl } from '../src/services/apiBaseUrl.js';

test('uses a same-origin API path when no override is configured', () => {
  assert.equal(
    resolveWebApiBaseUrl('', 'https://cloudcomai.freedev.app'),
    'https://cloudcomai.freedev.app/apiapp/api',
  );
});

test('keeps the API on the exact hostname used to open the web app', () => {
  assert.equal(
    resolveWebApiBaseUrl('/apiapp/api', 'https://www.cloudcomai.freedev.app'),
    'https://www.cloudcomai.freedev.app/apiapp/api',
  );
});

test('supports an explicit absolute URL for local development', () => {
  assert.equal(
    resolveWebApiBaseUrl('http://localhost:8080/api', 'http://localhost:5173'),
    'http://localhost:8080/api',
  );
});

test('rejects non-HTTP API protocols', () => {
  assert.throws(
    () => resolveWebApiBaseUrl('javascript:alert(1)', 'https://cloudcomai.freedev.app'),
    /HTTP or HTTPS/,
  );
});
