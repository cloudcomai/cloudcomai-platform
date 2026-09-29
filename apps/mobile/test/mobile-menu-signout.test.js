import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const menu = fs.readFileSync(new URL('../src/components/MobileMenu.js', import.meta.url), 'utf8');

test('main mobile menu exposes sign out and confirms before logout', () => {
  assert.match(menu, /accessibilityLabel="Sign out"/);
  assert.match(menu, /Alert\.alert\('Sign out\?/);
  assert.match(menu, /onLogout\?\.\(\)/);
  assert.match(menu, /Log out of this CloudComAI account/);
});
