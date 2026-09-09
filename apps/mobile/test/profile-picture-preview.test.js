import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../src/components/UserProfileModal.js', import.meta.url);

test('user profile picture opens a dedicated large preview modal', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.ok(source.includes('const [imagePreviewVisible, setImagePreviewVisible] = useState(false);'));
  assert.ok(source.includes('setImagePreviewVisible(true)'));
  assert.ok(source.includes("profile picture` : undefined"));
  assert.ok(source.includes('visible={imagePreviewVisible}'));
  assert.ok(source.includes('Close profile picture preview'));
  assert.ok(source.includes('style={styles.previewImage}'));
  assert.ok(source.includes('resizeMode="contain"'));
});
