import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('mobile home labels an empty private chat as a private conversation', () => {
  assert.match(app, /item\.preview \|\| \(item\.isGroup \? 'Group conversation' : 'Private conversation'\)/);
  assert.doesNotMatch(app, /item\.preview \|\| \(item\.isGroup \? 'Group conversation' : 'No messages yet'\)/);
});
