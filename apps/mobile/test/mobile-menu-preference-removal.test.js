import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileMenuPath = path.resolve(__dirname, '../src/components/MobileMenu.js');
const source = fs.readFileSync(mobileMenuPath, 'utf8');

test('mobile menu does not expose the removed Preference option', () => {
  assert.doesNotMatch(source, /\['Preferences',/);
  assert.doesNotMatch(source, /screen === ['"]preferences['"]/);
  assert.doesNotMatch(source, /loadPreferences/);
  assert.doesNotMatch(source, /savePreferences/);
  assert.doesNotMatch(source, /preferencesText/);
  assert.doesNotMatch(source, /preferencesLoaded/);

  for (const menuLabel of ['Profile', 'Start private chat', 'Create group', 'Create poll', 'Settings', 'Sync contacts']) {
    assert.match(source, new RegExp(`\\['${menuLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}',`));
  }
});
