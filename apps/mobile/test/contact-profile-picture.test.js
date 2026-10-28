import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('contact rows display the profile image URL supplied by the contacts API', async () => {
  const source = await readFile(new URL('../src/components/MobileDashboardLists.js', import.meta.url), 'utf8');

  assert.ok(source.includes("{item.photo_url ? <Image source={{uri:item.photo_url}} style={styles.avatarImage}/> : null}"));
  assert.ok(!source.includes("mediaUrl('user', item.registered_user_id, item.image_version)"));
});
