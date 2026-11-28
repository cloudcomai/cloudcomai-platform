import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const screen = fs.readFileSync(new URL('../src/components/CreatorClicksScreen.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../../../packages/api-client/src/cloudcomai-api.js', import.meta.url), 'utf8');

test('Mobile exposes separate owner-only post and channel deletion confirmations', () => {
  assert.match(screen, /Delete Post/);
  assert.match(screen, /Delete Channel/);
  assert.match(screen, /Only this selected post will be deleted/);
  assert.match(screen, /CloudComAI account, login, chats, contacts and Moments will remain unchanged/);
  assert.match(screen, /Number\(post\.creator_id\) !== Number\(user\?\.id\)/);
  assert.match(screen, /Number\(profile\?\.user_id\) !== Number\(user\?\.id\)/);
  assert.match(client, /deleteCreatorClick\(postId/);
  assert.match(client, /deleteCreatorClicksChannel/);
});
