import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const sidebar = read('../src/components/Sidebar.jsx');
const directory = read('../src/components/ChatDirectory.jsx');
const canvas = read('../src/components/ChatCanvas.jsx');
const parity = read('../src/components/WebMobileParity.jsx');
const manage = read('../src/components/PublicChatManagePanel.jsx');

test('Public Chats is a first-class web navigation tab and loads public rooms into the directory', () => {
  assert.match(sidebar, /activeTab === 'public'/);
  assert.match(app, /activeTab === 'public'/);
  assert.match(app, /platformApi\.listPublicChats\(\)/);
  assert.match(app, /#app\/public/);
  assert.match(directory, /Public Chat Rooms/);
  assert.match(directory, /selectedChat\?\.id === chat\.id/);
});

test('Public Chat member rows use existing user images and open profile details', () => {
  assert.match(manage, /mediaUrl\('user', member\.id\)/);
  assert.match(manage, /setProfileUserId\(Number\(member\.id\)\)/);
  assert.match(manage, /Report User/);
  assert.match(parity, /platformApi\.getUserProfile\(userId\)/);
});

test('Web profile popup supports existing friend request states and self-protection', () => {
  assert.match(parity, /sendFriendRequest\(userId\)/);
  assert.match(parity, /act\('cancel'\)/);
  assert.match(parity, /act\('accept'\)/);
  assert.match(parity, /act\('decline'\)/);
  assert.match(parity, /Number\(userId\) === Number\(currentUserId\)/);
});

test('Private chat header uses the selected participant avatar and enlarged image popup', () => {
  assert.match(canvas, /other_user_id \|\| selectedChat\?\.user_id/);
  assert.match(canvas, /ProfileImageDialog/);
  assert.match(canvas, /setProfileImageOpen\(true\)/);
});

test('Chat-specific theme selector is not rendered in the web chat header', () => {
  assert.doesNotMatch(canvas, /<ChatThemeControl/);
});

test('Public Chat management and existing message controls remain wired', () => {
  assert.match(canvas, /setModal\('manage_public_chat'\)/);
  assert.match(canvas, /onSendMessage/);
  assert.match(canvas, /AttachmentControls/);
  assert.match(manage, /platformApi\.reportPublicChatUser/);
});
