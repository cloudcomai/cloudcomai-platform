import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/components/PublicChatsList.js', import.meta.url),'utf8');

test('public chats exposes collapsible city and language sections', () => {
  assert.match(source,/Public Chat Rooms/);
  assert.match(source,/Language Chat Rooms/);
  assert.match(source,/LayoutAnimation\.configureNext/);
  assert.match(source,/Search room, city, language, category or keyword/);
  assert.match(source,/room\.room_type === 'language'/);
});

test('language room list is backed by the shared public-room renderer', () => {
  assert.match(source,/data=\{languageRooms\}/);
  assert.match(source,/renderItem=\{renderRoom\}/);
  assert.match(source,/platformApi\.joinPublicChat/);
  assert.match(source,/onOpenChat\?\.\(\{ \.\.\.\(data\.chat/);
});
