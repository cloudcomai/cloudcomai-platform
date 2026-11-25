import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canvas = await readFile(new URL('../src/components/ChatCanvas.jsx', import.meta.url), 'utf8');
const parity = await readFile(new URL('../src/components/WebMobileParity.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('web exposes mobile message actions', () => {
  assert.match(canvas, /ForwardMessageDialog/);
  assert.match(canvas, /MessageReadStatusDialog/);
  assert.match(canvas, /aria-label="Forward message"/);
  assert.match(canvas, /aria-label="Message info"/);
  assert.match(parity, /platformApi\.forwardMessage/);
  assert.match(parity, /platformApi\.getMessageReadStatus/);
});

test('web exposes mobile profile and friend relationship flow', () => {
  assert.match(canvas, /UserProfileDialog/);
  assert.match(parity, /platformApi\.getUserProfile/);
  assert.match(parity, /platformApi\.getFriendRelationship/);
  assert.match(parity, /platformApi\.sendFriendRequest/);
});

test('web removes the chat-specific theme selector while preserving theme styles', () => {
  assert.doesNotMatch(canvas, /<ChatThemeControl/);
  assert.match(parity, /cloudcomai\.web\.chat-theme/);
  for (const theme of ['ocean','forest','sunset','midnight']) assert.match(styles, new RegExp(`data-chat-theme="${theme}"`));
});

test('web exposes Moments, public chats and saved messages', async () => {
  const moments = await readFile(new URL('../src/components/MomentsPanel.jsx', import.meta.url), 'utf8');
  const community = await readFile(new URL('../src/components/WebCommunityPanels.jsx', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

  assert.match(moments, /platformApi\.listStories/);
  assert.match(moments, /platformApi\.createStory/);
  assert.match(moments, /platformApi\.replyToStory/);
  assert.match(moments, /platformApi\.deleteStory/);
  assert.match(community, /platformApi\.listPublicChats/);
  assert.match(community, /platformApi\.joinPublicChat/);
  assert.match(community, /platformApi\.leavePublicChat/);
  assert.match(sidebar, /setModal\('moments'\)/);
  assert.match(sidebar, /activeTab === 'public'/);
  assert.match(sidebar, /setModal\('saved_messages'\)/);
  assert.doesNotMatch(sidebar, /setModal\('ring_bells'\)/);
});
test('web public chat room entry opens the selected room and dismisses the picker', async () => {
  const community = await readFile(new URL('../src/components/WebCommunityPanels.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(community, /await platformApi\.joinPublicChat\(roomId\)/);
  assert.match(community, /await onOpenChat\?\.\(roomId\)/);
  assert.match(community, /onClick=\{\(\) => void openRoom\(room\)\}/);
  assert.match(app, /onOpenChat=\{async id => \{ await openExistingChat\(id\); setModal\(null\); \}\}/);
  assert.match(app, /const isPublic = chat\.type === 'public' \|\| chat\.isPublic/);
});


test('web Public Chat Rooms directory restores Join and Leave controls with joined and online counts', async () => {
  const directory = await readFile(new URL('../src/components/ChatDirectory.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(directory, /onJoinPublicChat, onLeavePublicChat/);
  assert.match(directory, /Number\(chat\.joined_count \|\| 0\).*Joined/);
  assert.match(directory, /onJoinPublicChat\)/);
  assert.match(directory, /onLeavePublicChat\)/);
  assert.match(directory, /isJoined\s*\?/);
  assert.match(app, /platformApi\.joinPublicChat\(roomId\)/);
  assert.match(app, /platformApi\.leavePublicChat\(roomId\)/);
  assert.match(app, /onJoinPublicChat=\{handleJoinPublicRoomFromDirectory\}/);
  assert.match(app, /onLeavePublicChat=\{handleLeavePublicRoomFromDirectory\}/);
  assert.match(styles, /\.public-room-directory-actions/);
});
