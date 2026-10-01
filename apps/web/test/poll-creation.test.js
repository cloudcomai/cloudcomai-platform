import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_POLL_OPTIONS,
  DEFAULT_POLL_OPTION_FIELDS,
  MAX_POLL_OPTIONS,
  cleanPollOptions,
  canCreatePoll,
} from '../src/utils/pollCreation.js';

test('poll creation requires at least one group and three non-empty options', () => {
  assert.equal(MIN_POLL_OPTIONS, 3);
  assert.equal(DEFAULT_POLL_OPTION_FIELDS, 4);
  assert.equal(MAX_POLL_OPTIONS, 6);
  assert.equal(canCreatePoll({ question: 'Question', groupIds: [1], options: ['Yes'] }), false);
  assert.equal(canCreatePoll({ question: 'Question', groupIds: [1], options: ['Yes', 'No'] }), false);
  assert.equal(canCreatePoll({ question: 'Question', groupIds: [1], options: ['Yes', 'No', 'Maybe'] }), true);
  assert.equal(canCreatePoll({ question: 'Question', groupIds: [1], options: ['Yes', 'No', 'Maybe', ''] }), true);
  assert.equal(canCreatePoll({ question: 'Question', groupIds: [], options: ['Yes', 'No', 'Maybe'] }), false);
  assert.equal(canCreatePoll({ question: '   ', groupIds: [1], options: ['Yes', 'No', 'Maybe'] }), false);
});

test('poll options are trimmed, blank entries removed, and duplicates collapsed', () => {
  assert.deepEqual(
    cleanPollOptions([' Yes ', 'No', '', '  Maybe  ', 'No']),
    ['Yes', 'No', 'Maybe']
  );
});
