import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformSource = await readFile(new URL('../src/services/platform.js', import.meta.url), 'utf8');
const ringBellsSource = await readFile(new URL('../src/components/RingBellsStatus.js', import.meta.url), 'utf8');


test('mobile uploads use native FormData Blob parts instead of unsupported object parts', () => {
  assert.match(platformSource, /new FormDataCtor\(\)/);
  assert.match(platformSource, /const\s+blob\s*=\s*await\s+response\.blob\(\)/);
  assert.match(platformSource, /blob\.slice\(0,\s*blob\.size,\s*normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName,\s*typedBlob,\s*normalized\.name\)/);
  assert.match(platformSource, /body:\s*formData/);
  assert.doesNotMatch(platformSource, /UploadType\.MULTIPART/);
  assert.doesNotMatch(platformSource, /form\.append\(fieldName,\s*\{\s*uri:/);
});

test('mobile media upload preserves MIME metadata and filename', () => {
  assert.match(platformSource, /blob\.type\s*===\s*normalized\.mimeType/);
  assert.match(platformSource, /blob\.slice\(0,\s*blob\.size,\s*normalized\.mimeType\)/);
  assert.match(platformSource, /form\.append\(fieldName,\s*typedBlob,\s*normalized\.name\)/);
  assert.match(platformSource, /original_filename:\s*parameters\.original_filename\s*\|\|\s*normalized\.name/);
});

test('Ring Bell media posting uses the shared upload route and exposes retry/success states', () => {
  assert.match(ringBellsSource, /ApiRoute\.STORY_MEDIA_UPLOAD/);
  assert.match(ringBellsSource, /maxBytes:\s*50\s*\*\s*1024\s*\*\s*1024/);
  assert.match(ringBellsSource, /Media posted successfully\./);
  assert.match(ringBellsSource, /Retry upload/);
  assert.match(ringBellsSource, /mediaPostError/);
  assert.match(ringBellsSource, /upload\?\.data\?\.filename/);
});