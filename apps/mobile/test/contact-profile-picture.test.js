import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('contact rows resolve registered-user profile images when the contact source has no photo URL', async () => {
  const source = await readFile(new URL('../src/components/MobileDashboardLists.js', import.meta.url), 'utf8');

  assert.ok(source.includes("import { mediaUrl, platformApi } from '../services/platform';"));
  assert.ok(source.includes("item.photo_url || (item.registered_user_id ? mediaUrl('user', item.registered_user_id, item.image_version) : null)"));
});
