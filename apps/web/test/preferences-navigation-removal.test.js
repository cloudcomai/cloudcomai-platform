import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const directory = read('../src/components/ChatDirectory.jsx');
const sidebar = read('../src/components/Sidebar.jsx');

test('web chat directory does not render the Your Preferences strip or preference chips', () => {
  assert.doesNotMatch(directory, /Your preferences|directory-preferences|topInterests|onEditPreferences/);
});

test('web sidebar does not expose the Edit Preferences shortcut', () => {
  assert.doesNotMatch(sidebar, /Edit Preferences|setScreen\('interests'\)/);
});

test('web Messages and Search controls remain available after removing preferences', () => {
  assert.match(directory, /activeTab === 'chats' \? 'Messages'/);
  assert.match(directory, /placeholder="Search\.\.\."/);
  assert.match(directory, /filter-pill-row/);
  assert.match(directory, /filteredChats\.map/);
});

test('web public chats and other navigation remain available', () => {
  assert.match(sidebar, /activeTab === 'public'/);
  assert.match(sidebar, /setModal\('moments'\)/);
  assert.match(sidebar, /setModal\('settings'\)/);
});
