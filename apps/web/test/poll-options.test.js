import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePollOptions } from '../src/utils/pollOptions.js';

test('a synchronized poll replaces a local vote result when another member votes', () => {
  const original = [{ id: 1, votes: 0, selected: false }];
  const localVote = { sourceOptions: original, options: [{ id: 1, votes: 1, selected: true }] };
  assert.equal(resolvePollOptions(original, localVote), localVote.options);
  const synchronized = [{ id: 1, votes: 2, selected: true }];
  assert.equal(resolvePollOptions(synchronized, localVote), synchronized);
  assert.equal(resolvePollOptions(original), original);
  assert.deepEqual(resolvePollOptions(null), []);
  assert.deepEqual(resolvePollOptions(), []);
});
