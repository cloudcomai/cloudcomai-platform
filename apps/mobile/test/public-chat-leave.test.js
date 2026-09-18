import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, '../src/components/PublicChatsList.js'), 'utf8');
const app = fs.readFileSync(path.join(here, '../App.js'), 'utf8');
const api = fs.readFileSync(path.join(here, '../../../packages/api-client/src/cloudcomai-api.js'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../backend/api-contract.json'), 'utf8'));
const handler = fs.readFileSync(path.join(here, '../../../backend/api/public_chats.php'), 'utf8');

test('public chat browser provides full-screen layout, live search, expandable favorites and scrolling', () => {
  assert.match(component, /flex: 1, minHeight: 0/);
  assert.match(component, /Search room, city, (?:language, )?category or keyword/);
  assert.match(component, /onChangeText=\{setQuery\}/);
  assert.match(component, /favoritesOpen/);
  assert.match(component, /accessibilityState=\{\{ expanded: favoritesOpen \}\}/);
  assert.match(component, /favoritesList/);
  assert.match(component, /nestedScrollEnabled/);
  assert.match(component, /roomListContent/);
  assert.match(component, /showsVerticalScrollIndicator=\{false\}/);
  assert.match(component, /searchableRoomText/);
  assert.match(component, /leaveRoom\s*=\s*room\s*=>/);
  assert.match(component, /platformApi\.leavePublicChat\(Number\(room\.id\)\)/);
  assert.match(component, /style:\s*'destructive'/);
  assert.match(component, /onOpenChat\?\.\(\{.*type: 'public'/s);
});

test('public chats remain a first-class section in the home navigation', () => {
  assert.match(app, /PublicChatsList/);
  assert.match(app, /section === 'public' \? <PublicChatsList/);
  assert.match(app, /\['public','Public Chats'\]/);
});

test('mobile API client and backend contract expose public chat search, favorites and leave', () => {
  assert.match(api, /leavePublicChat\(roomId, options = \{\}\)/);
  assert.match(api, /listPublicChats\(options = \{\}\)/);
  assert.match(contract.routes['v1/public-chats'].handler, /public_chats\.php/);
  assert.ok(contract.routes['v1/public-chats'].methods.includes('DELETE'));
  assert.match(handler, /\$method === 'DELETE'/);
  assert.match(handler, /status='removed'/);
  assert.match(handler, /notifications_muted=1/);
  assert.match(handler, /c\.name LIKE/);
  assert.match(handler, /favorites/);
});
