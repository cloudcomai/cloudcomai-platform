import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const community = read('../src/components/WebCommunityPanels.jsx');
const app = read('../src/App.jsx');
const canvas = read('../src/components/ChatCanvas.jsx');
const styles = read('../src/styles.css');

test('web public chat Manage action is available in the selected public room header', () => {
  assert.match(canvas, /const isPublicChat = selectedChat\?\.type === 'public' \|\| selectedChat\?\.isPublic/);
  assert.match(canvas, /setModal\('manage_public_chat'\)/);
  assert.match(canvas, /aria-label="Manage public chat"/);
  assert.match(app, /modal === 'manage_public_chat' \? <PublicChatManagementPanel/);
});

test('public room header and room cards identify public rooms as Live, not Offline', () => {
  assert.match(canvas, /isPublicChat \? 'Live'/);
  assert.match(community, /public-room-live-indicator/);
  assert.match(community, /Live room/);
  assert.match(styles, /\.public-room-live-indicator\{color:#16a34a/);
});

test('web public chat management mirrors mobile Online Users and friend relationship actions', () => {
  assert.match(community, /export function PublicChatManagementPanel/);
  assert.match(community, /platformApi\.getPublicChatManage/);
  assert.match(community, /platformApi\.sendFriendRequest/);
  assert.match(community, /platformApi\.respondToFriendRequest/);
  assert.match(community, /Online Users/);
  assert.match(community, /Add as Friend/);
  assert.match(community, /Request Sent/);
  assert.match(community, /Friend/);
});

test('web public chat management mirrors mobile report, hidden-user and leave-room actions', () => {
  assert.match(community, /platformApi\.reportPublicChatUser/);
  assert.match(community, /platformApi\.getPublicChatHiddenUsers/);
  assert.match(community, /platformApi\.unhidePublicChatUser/);
  assert.match(community, /platformApi\.leavePublicChat/);
  assert.match(community, /Report User/);
  assert.match(community, /Hidden Users/);
  assert.match(community, /Leave Chat \/ Leave Room/);
  assert.match(community, /incident_key: 'user:'/);
});

test('public chat management uses server-backed actions and accessible responsive controls', () => {
  assert.match(community, /role="dialog"/);
  assert.match(community, /aria-modal="true"/);
  assert.match(community, /role="alert"/);
  assert.match(community, /role="status"/);
  assert.match(styles, /\.public-manage-dialog/);
  assert.match(styles, /@media\(max-width:700px\)\{\.public-manage-backdrop/);
});

test('leaving a public room clears only the selected public conversation after API success', () => {
  assert.match(app, /await platformApi\.leavePublicChat\(roomId\)/);
  assert.match(app, /setSelectedChat\(null\)/);
  assert.match(app, /setChats\(current => current\.filter\(chat => Number\(chat\.id\) !== roomId\)\)/);
});
