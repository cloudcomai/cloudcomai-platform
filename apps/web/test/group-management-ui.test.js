import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const members = read('../src/components/GroupMembershipModal.jsx');
const editor = read('../src/components/GroupEditModal.jsx');
const app = read('../src/App.jsx');
const directory = read('../src/components/ChatDirectory.jsx');
const designSystem = read('../src/web-design-system.css');

test('web group member rows render versioned profile images with avatar fallback', () => {
  assert.match(members, /mediaUrl\('user', m\.user_id \|\| m\.id\)/);
  assert.match(members, /m\.image_version/);
  assert.match(members, /getAvatarInitial\(m\.name,m\.username\)/);
});

test('web add-member picker loads saved contacts and only offers registered non-members', () => {
  assert.match(members, /platformApi\.listContacts\(1, 500\)/);
  assert.match(members, /Number\(c\.registered_user_id\) > 0/);
  assert.match(members, /currentMembers\.some/);
  assert.match(members, /Choose from your contacts/);
});

test('web group editor loads and saves description only for the owner', () => {
  assert.match(editor, /group\?\.group_description/);
  assert.match(editor, /group_description: description\.trim\(\)/);
  assert.match(editor, /disabled=\{loading \|\| !isOwner\}/);
  assert.match(app, /GroupEditModal group=\{selectedChat\} user=\{user\}/);
});


test('web group management exposes owner-only group-wide and individual attachment access', () => {
  assert.match(members, /platformApi\.getGroupAttachmentAccess\(selectedChat\.id\)/);
  assert.match(members, /platformApi\.grantGroupAttachmentAccess\(selectedChat\.id, Number\(durationHours \|\| 24\)\)/);
  assert.match(members, /platformApi\.revokeGroupAttachmentAccess\(selectedChat\.id\)/);
  assert.match(members, /platformApi\.grantGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /platformApi\.revokeGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /Search members by name or User ID/);
  assert.match(members, /can_forward/);
  assert.match(members, /cannot_forward/);
  assert.match(members, /Allow everyone for 24 hours/);
  assert.match(members, /Allow everyone for 48 hours/);
  assert.match(members, /Revoke group-wide access/);
  assert.match(members, /ownsGroup && <section className="web-member-permissions"/);
});

test('web group composer keeps attachment and recording controls available with multipart-safe uploads', () => {
  const composer = read('../src/components/ChatCanvas.jsx');
  const attachments = read('../src/components/AttachmentControls.jsx');
  const media = read('../src/components/MediaMessageControls.jsx');
  const apiClient = read('../../../packages/api-client/src/api-client.js');
  assert.match(composer, /<AttachmentControls selectedChat=\{selectedChat\}/);
  assert.match(composer, /<MediaMessageControls key=\{selectedChat\?\.id\}/);
  assert.match(attachments, /ApiRoute\.UPLOAD_ATTACHMENT/);
  assert.match(attachments, /ALLOWED_EXTENSIONS/);
  assert.match(media, /window\.MediaRecorder/);
  assert.match(media, /getUserMedia/);
  assert.match(media, /message_type/);
  assert.match(apiClient, /Object\.prototype\.toString\.call\(body\) === '\[object FormData\]'/);
});

test('web group editor refreshes the latest description from the existing groups API', () => {
  assert.match(editor, /platformApi\.listGroups\(\)/);
  assert.match(editor, /latest\.group_description/);
});

test('web group conversation avatars use readable initials when the group image is unavailable', () => {
  assert.match(directory, /getAvatarInitial\(chat\.name, chat\.username\)/);
  assert.match(directory, /getAvatarPalette\(chat\.id \|\| chat\.name\)/);
  assert.match(directory, /conversation-name-group/);
  assert.match(designSystem, /conversation-name-group/);
});


test('web Manage Group uses a wide scrollable desktop modal without nested member-list scroll traps', () => {
  assert.match(members, /group-manage-backdrop/);
  assert.match(members, /group-manage-modal/);
  assert.match(members, /group-manage-member-list/);
  assert.match(designSystem, /\.group-manage-modal\{width:min\(1180px/);
  assert.match(designSystem, /\.group-manage-modal \.web-member-permissions-list\{max-height:min\(340px,42dvh\)!important;min-height:0;overflow-y:auto!important/);
  assert.match(designSystem, /overscroll-behavior-y:auto;scrollbar-gutter:stable/);
  assert.match(designSystem, /\.group-manage-modal\{width:min\(1180px,[^}]*overflow-y:auto/);
  assert.match(designSystem, /\.group-manage-backdrop\{align-items:flex-start/);
});
