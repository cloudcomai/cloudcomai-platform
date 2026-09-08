import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');

test('mobile uploads use React Native FormData instead of Expo FormDataPart upload API', () => {
  assert.match(platformSource, /new FormDataCtor\(\)/);
  assert.match(platformSource, /form\.append\(fieldName, \{/);
  assert.match(platformSource, /body: formData/);
  assert.doesNotMatch(platformSource, /UploadType\.MULTIPART/);
});

test('mobile media upload preserves video MIME metadata and filename', () => {
  assert.match(platformSource, /name: normalized\.name/);
  assert.match(platformSource, /type: normalized\.mimeType/);
  assert.match(platformSource, /original_filename: parameters\.original_filename \|\| normalized\.name/);
});
