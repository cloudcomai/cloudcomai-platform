import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const members = fs.readFileSync(new URL('../src/components/GroupMembershipModal.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/web-design-system.css', import.meta.url), 'utf8');

test('Manage Group scrolls as one dialog without attachment list covering members', () => {
  assert.match(members, /modal-backdrop group-management-modal-backdrop/);
  assert.match(members, /modal-content-card group-management-modal/);
  assert.match(members, /Active Group Participants/);
  assert.match(members, /Group attachment access/);
  assert.match(styles, /\.group-management-modal\{[^}]*max-height:calc\(100dvh - 48px\)[^}]*overflow-y:auto/s);
  assert.match(styles, /\.group-management-modal \.web-member-permissions-list\{max-height:none;overflow:visible\}/);
  assert.match(styles, /\.group-management-modal-backdrop\{align-items:flex-start;overflow-y:auto/);
});
