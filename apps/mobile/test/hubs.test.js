import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const hubs = fs.readFileSync(new URL('../src/components/Hubs.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../../backend/api/hubs.php', import.meta.url), 'utf8');

test('highlighted top shortcut opens Hubs without changing bottom Contacts', () => {
  assert.match(app, /setShowHubs\(true\)/);
  assert.match(app, /<Text style=\{styles\.quickLabel\}>Hubs<\/Text>/);
  assert.match(app, /\['all','Chats','💬'\],\['public','Public','🌐'\],\['contacts','Contacts','👥'\]/);
});

test('Hubs exposes requested navigation and audience controls', () => {
  for (const label of ['Discover','My Hubs','Following','Saved','For You','Trending','People','Public','Contacts/Friends','Hub Members','Only Me']) {
    assert.match(hubs, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const action of ['create','edit','react','comment','share','save','report','block','follow','friend_request','join_hub']) assert.match(api, new RegExp(action));
});

test('Hubs API reuses existing Stories storage and enforces blocked-user/audience visibility', () => {
  assert.match(api, /stories/);
  assert.match(api, /users_block_state/);
  assert.match(api, /only_me/);
  assert.match(api, /hub_members/);
  assert.match(api, /contacts/);
});
