import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../src/components/UserProfileModal.js', import.meta.url);

test('user profile picture opens a dedicated large preview modal', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /const \[imagePreviewVisible, setImagePreviewVisible\] = useState\(false\);/);
  assert.match(source, /setImagePreviewVisible\(true\)/);
  assert.match(source, /accessibilityLabel=\{canPreviewImage \? `View \$\{name\}'s profile picture` : undefined\}/);
  assert.match(source, /visible=\{imagePreviewVisible\}/);
  assert.match(source, /accessibilityLabel="Close profile picture preview"/);
  assert.match(source, /style=\{styles\.previewImage\}/);
  assert.match(source, /resizeMode="contain"/);
});
