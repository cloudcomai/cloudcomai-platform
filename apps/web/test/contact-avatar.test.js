import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/ChatDirectory.jsx', import.meta.url), 'utf8');

test('web contacts use the existing user media endpoint and image version', () => {
  assert.match(source, /mediaUrl\('user', registeredUserId\)/);
  assert.match(source, /contact\.image_version/);
});

test('web contacts fall back to a stable user-ID alphabet avatar after image failure', () => {
  assert.match(source, /getAvatarPalette\(contact\.registered_user_id/);
  assert.match(source, /getAvatarInitial\\(contact\\.display_name/);
  assert.match(source, /onError=\{\(\) => markImageFailed\(imageKey\)\}/);
});
