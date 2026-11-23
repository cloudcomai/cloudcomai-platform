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


test('web group management exposes owner-only individual attachment grants and member search', () => {
  assert.match(members, /platformApi\.getGroupAttachmentAccess\(selectedChat\.id\)/);
  assert.match(members, /platformApi\.grantGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /platformApi\.revokeGroupMemberAttachmentAccess\(selectedChat\.id, Number\(memberId\)\)/);
  assert.match(members, /Search members by name or User ID/);
  assert.match(members, /Filter member attachment permissions/);
  assert.match(members, /Grant download/);
  assert.match(members, /Revoke download/);
  assert.match(members, /ownsGroup && <section className="web-member-permissions"/);
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
