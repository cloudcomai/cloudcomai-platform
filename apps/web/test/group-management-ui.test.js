import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const members = read('../src/components/GroupMembershipModal.jsx');
const editor = read('../src/components/GroupEditModal.jsx');
const app = read('../src/App.jsx');

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
