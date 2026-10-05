import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/MobileMenu.js'), 'utf8');

test('private chat search explains exact identifiers and shows an empty result state', () => {
  assert.ok(source.includes('>Search</Text>'));
  assert.ok(source.includes('accessibilityLabel="Search private chat by name, full email, 10-digit mobile or User ID"'));
  assert.ok(source.includes('placeholder="Name, full email, 10-digit mobile or User ID"'));
  assert.ok(source.includes('No results found.'));
  assert.ok(source.includes('userSearchCompleted && userResults.length === 0'));
});
