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
  assert.match(members, /platformApi\.grantGroupAttachmentAccess\(selectedChat\.id, Number\(durationHours\)\)/);
  assert.match(members, /platformApi\.revokeGroupAttachmentAccess\(selectedChat\.id\)/);
  assert.match(members, /platformApi\.grantGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /platformApi\.revokeGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /Search members by name or User ID/);
  assert.match(members, /can_forward/);
  assert.match(members, /cannot_forward/);
  assert.match(members, /Allow everyone for 24 hours/);
  assert.match(members, /Allow everyone for 48 hours/);
  assert.match(members, /Revoke group-wide access/);
  assert.match(members, /!ownsGroup \? <div className="group-access-owner-note"/);
  assert.match(members, /group-wide-access-panel/);
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


test('web Group Management exposes a wide member dashboard and responsive role controls', () => {
  assert.match(members, /group-management-page/);
  assert.match(members, /group-management-summary-card/);
  assert.match(members, /group-management-columns/);
  assert.match(members, /All \(' \+ currentMembers\.length/);
  assert.match(members, /Make owner/);
  assert.match(members, /Make admin/);
  assert.match(members, /Remove member/);
  assert.match(members, /window\.confirm\(isSelf/);
  assert.match(members, /adminLimitReached/);
  assert.match(members, /setSuccess\(/);
});

test('group-wide 24h and 48h actions grant the selected duration even when access is already active', () => {
  assert.match(members, /if \(scope === 'group'\)/);
  assert.match(members, /if \(durationHours\) await platformApi\.grantGroupAttachmentAccess/);
  assert.match(members, /else await platformApi\.revokeGroupAttachmentAccess/);
  assert.match(members, /formatRemaining\(groupGrant\.expires_at, clockNow\)/);
  assert.match(members, /activeIndividualGrantCount/);
});

test('web Manage Group page hides chat panels without unmounting their React components', () => {
  assert.match(app, /group-management-active/);
  assert.match(app, /modal === 'manage_members' \? <GroupMembershipModal type="manage_members"/);
  assert.match(designSystem, /\.group-management-active>\.chats-directory/);
  assert.match(designSystem, /\.group-management-active>\.chat-interaction-canvas/);
  assert.match(designSystem, /grid-template-columns:260px minmax\(0,1fr\)/);
  assert.match(designSystem, /grid-template-columns:minmax\(0,\.95fr\) minmax\(420px,1\.15fr\)/);
});
