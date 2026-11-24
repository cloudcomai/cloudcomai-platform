import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const panel = read('../src/components/PublicChatManagePanel.jsx');
const app = read('../src/App.jsx');
const canvas = read('../src/components/ChatCanvas.jsx');
const styles = read('../src/styles.css');

test('Public Chat Manage drawer is wired to the existing web Public Chats action', () => {
  assert.match(canvas, /isPublicChat\s*=\s*selectedChat\?\.type === 'public'/);
  assert.match(canvas, /setModal\('manage_public_chat'\)/);
  assert.match(app, /import PublicChatManagePanel from '\.\/components\/PublicChatManagePanel'/);
  assert.match(app, /modal === 'manage_public_chat' \? <PublicChatManagePanel/);
});

test('Public Chat management exposes the requested Info, Members, Permissions and Settings sections', () => {
  for (const label of ['Info', 'Members', 'Permissions', 'Settings']) assert.ok(panel.includes("label: '" + label + "'"));
  assert.match(panel, /Manage Public Chat/);
  assert.match(panel, /Room Members/);
  assert.match(panel, /Online Users/);
  assert.match(panel, /Total Joined/);
});

test('Public Chat management reads membership from the public-room API and never calls group-only permission APIs', () => {
  assert.match(panel, /platformApi\.getPublicChatManage\(Number\(selectedChat\.id\)\)/);
  assert.doesNotMatch(panel, /getGroupAttachmentAccess|GROUP_MEMBERS|GROUP_ATTACHMENT_ACCESS/);
});

test('Public Chat management drawer is scrollable and responsive on narrow web viewports', () => {
  assert.match(styles, /\.public-chat-manage-panel\{[^}]*height:100dvh[^}]*overflow:hidden/s);
  assert.match(styles, /\.public-chat-manage-body\{[^}]*overflow-y:auto/s);
  assert.match(styles, /@media\(max-width:850px\)/);
  assert.match(styles, /@media\(max-width:520px\)/);
});
