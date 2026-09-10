import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');

test('mobile uploads use native FormData Blob parts instead of unsupported object parts', () => {
  assert.match(platformSource, /new FormDataCtor\(\)/);
  assert.match(platformSource, /const blob = await response\.blob\(\)/);
  assert.match(platformSource, /blob\.slice\(0, blob\.size, normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName, typedBlob, normalized\.name\)/);
  assert.match(platformSource, /body: formData/);
  assert.doesNotMatch(platformSource, /UploadType\.MULTIPART/);
  assert.doesNotMatch(platformSource, /form\.append\(fieldName, \{\s*uri:/);
});

test('mobile media upload preserves MIME metadata and filename', () => {
  assert.match(platformSource, /blob\.type === normalized\.mimeType/);
  assert.match(platformSource, /blob\.slice\(0, blob\.size, normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName, typedBlob, normalized\.name\)/);
  assert.match(platformSource, /original_filename: parameters\.original_filename \|\| normalized\.name/);
});
