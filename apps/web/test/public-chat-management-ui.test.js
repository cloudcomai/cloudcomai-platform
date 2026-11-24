import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const panel = read('../src/components/PublicChatManagePanel.jsx');
const app = read('../src/App.jsx');
const canvas = read('../src/components/ChatCanvas.jsx');
const styles = read('../src/styles.css');

test('Public Chat Manage drawer is wired only into the web Public Chats action', () => {
  assert.match(canvas, /isPublicChat\s*=\s*selectedChat\?\.type === 'public'/);
  assert.match(canvas, /setModal\('manage_public_chat'\)/);
  assert.match(app, /import PublicChatManagePanel from '\.\/components\/PublicChatManagePanel'/);
  assert.match(app, /modal === 'manage_public_chat' \? <PublicChatManagePanel/);
  assert.match(app, /<PublicChatManagePanel selectedChat=\{selectedChat\} user=\{user\}/);
});

test('Public Chat management includes Info, Members, Reports, Permissions and Settings', () => {
  for (const label of ['Info', 'Members', 'Reports', 'Permissions', 'Settings']) assert.ok(panel.includes("label: '" + label + "'"));
  assert.match(panel, /Manage Public Chat/);
  assert.match(panel, /Room Members/);
  assert.match(panel, /Community Reports/);
});

test('Report User and public-room moderation actions use the existing public-chat API', () => {
  assert.match(panel, /action: 'report'/);
  assert.match(panel, /reported_user_id/);
  assert.match(panel, /Submit Report/);
  assert.match(panel, /action: 'moderation'/);
  assert.match(panel, /moderation_action: moderationAction/);
  assert.match(panel, /action: 'unhide-user'/);
  assert.match(panel, /action: 'reports'/);
  assert.match(panel, /action: 'hidden-users'/);
});

test('Public Chat management never uses Group-only permission APIs and preserves responsive scrolling', () => {
  assert.doesNotMatch(panel, /getGroupAttachmentAccess|GROUP_MEMBERS|GROUP_ATTACHMENT_ACCESS/);
  assert.match(styles, /\.public-chat-manage-panel\{[^}]*height:100dvh[^}]*overflow:hidden/s);
  assert.match(styles, /\.public-chat-manage-body\{[^}]*overflow-y:auto/s);
  assert.match(styles, /@media\(max-width:850px\)/);
  assert.match(styles, /@media\(max-width:520px\)/);
});
