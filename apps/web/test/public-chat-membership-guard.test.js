import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const canvas = read('../src/components/ChatCanvas.jsx');
const directory = read('../src/components/ChatDirectory.jsx');

test('web Public Chat rows cannot open an active conversation before joining', () => {
  assert.match(app, /const isJoined = Boolean\(selectedRowItem\.joined \|\| selectedRowItem\.is_member \|\| selectedRowItem\.is_joined\)/);
  assert.match(app, /if \(!isJoined\) \{[\s\S]*?setSelectedChat\(null\)[\s\S]*?setMessages\(\[\]\)/);
});

test('web URL restoration rejects an unjoined Public Chat room', () => {
  assert.match(app, /const isJoinedPublicRoom = Boolean\(chat\.joined \|\| chat\.is_member \|\| chat\.is_joined\)/);
  assert.match(app, /if \(isPublic && !isJoinedPublicRoom\)/);
  assert.match(app, /setActiveTab\('public'\);[\s\S]*?setSelectedChat\(null\)/);
});

test('web send handler independently blocks messages to unjoined Public Chat rooms', () => {
  assert.match(app, /if \(\(selectedChat\.type === 'public' \|\| selectedChat\.isPublic\) && !\(selectedChat\.joined \|\| selectedChat\.is_member \|\| selectedChat\.is_joined\)\)/);
  assert.match(app, /await messaging\.enqueue\(\{ chat_id: selectedChat\.id/);
});

test('web Public Chat composer and send button are disabled unless the user is joined', () => {
  assert.match(canvas, /const publicRoomJoined = !\(selectedChat\?\.type === 'public' \|\| selectedChat\?\.isPublic\) \|\| Boolean\(selectedChat\?\.joined \|\| selectedChat\?\.is_member \|\| selectedChat\?\.is_joined\)/);
  assert.match(canvas, /disabled=\{sending \|\| !selectedChat \|\| selectedChat\.blocked \|\| !publicRoomJoined\}/);
  assert.match(canvas, /selectedChat\.blocked \|\| !publicRoomJoined/);
});

test('joining and leaving controls remain wired to the existing Public Chat actions', () => {
  assert.match(directory, /onJoinPublicChat/);
  assert.match(directory, /onLeavePublicChat/);
  assert.match(app, /await platformApi\.joinPublicChat\(roomId\)/);
  assert.match(app, /await platformApi\.leavePublicChat\(roomId\)/);
});
