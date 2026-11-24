import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const members = fs.readFileSync(new URL('../src/components/GroupMembershipModal.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/web-design-system.css', import.meta.url), 'utf8');

test('Manage Group renders as a full-page scrollable workspace instead of a narrow modal', () => {
  assert.match(members, /className=\{isManagePage \? 'group-management-page'/);
  assert.match(members, /group-management-topbar/);
  assert.match(members, /group-management-summary-card/);
  assert.match(members, /group-management-columns/);
  assert.match(styles, /\.group-management-page\{[^}]*height:100vh[^}]*overflow-y:auto/s);
  assert.match(styles, /\.group-management-columns\{display:grid;grid-template-columns:minmax\(0,\.95fr\) minmax\(420px,1\.15fr\)/);
  assert.match(styles, /@media\(max-width:1150px\)/);
  assert.match(styles, /@media\(max-width:640px\)/);
});

test('Add-member dialog retains its existing scrollable modal layout', () => {
  assert.match(members, /modal-backdrop group-management-modal-backdrop/);
  assert.match(members, /modal-content-card group-management-modal/);
  assert.match(styles, /\.group-management-modal\{[^}]*max-height:calc\(100dvh - 48px\)[^}]*overflow-y:auto/s);
});
