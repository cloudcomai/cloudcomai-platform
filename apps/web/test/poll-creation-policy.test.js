import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const modal = fs.readFileSync(new URL('../src/components/PollModal.jsx', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../../../backend/api/polls.php', import.meta.url), 'utf8');

test('poll creation is restricted to group chats and 2-4 options', () => {
  // Public and private chats are both excluded; only group is accepted.
  assert.match(modal, /selectedChat\.type !== 'group'/);
  assert.match(modal, /Polls are available only in group chats/);
  assert.doesNotMatch(modal, /chatType === 'group' \|\| chatType === 'public'/);
  assert.match(modal, /options\.length >= 4/);
  assert.match(modal, /cleanOptions\.length < 2 \|\| cleanOptions\.length > 4/);
  assert.match(modal, /2 to 4 different options/);
  assert.match(backend, /\$chatRow\['type'\] !== 'group'/);
  assert.match(backend, /count\(\$cleanOptions\) < 2 \|\| count\(\$cleanOptions\) > 4/);
});
