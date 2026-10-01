import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('src/components/MobileMenu.js'), 'utf8');

test('mobile poll shortcut uses group-only multi-group creation with four default options', () => {
  assert.match(source, /openMenu\('poll'\)/);
  assert.match(source, /platformApi\.listChats\('group'\)/);
  assert.doesNotMatch(source, /platformApi\.listChats\('private'\)/);
  assert.match(source, /MIN_POLL_OPTIONS = 3/);
  assert.match(source, /DEFAULT_POLL_OPTION_FIELDS = 4/);
  assert.match(source, /MAX_POLL_OPTIONS = 6/);
  assert.match(source, /chat_ids: pollGroupIds/);
  assert.match(source, /cleanOptions\.length < MIN_POLL_OPTIONS/);
  assert.match(source, /Please enter at least 3 poll options\./);
  assert.match(source, /pollDateExpiry\(pollExpiry\)/);
});
