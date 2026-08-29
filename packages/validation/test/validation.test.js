import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdult,
  validateMessage,
  validatePoll,
  validateRegistration,
} from '../src/index.js';

test('calculates adult status using the birthday boundary', () => {
  const today = new Date('2026-08-29T00:00:00Z');
  assert.equal(isAdult('2008-08-29', today), true);
  assert.equal(isAdult('2008-08-30', today), false);
});

test('validates registration fields', () => {
  const result = validateRegistration(
    {
      name: 'CloudComAI User',
      email: 'user@example.com',
      mobile: '+91 9876543210',
      password: 'Secure123',
      dob: '1990-01-01',
      gender: 'Male',
    },
    new Date('2026-08-29T00:00:00Z'),
  );
  assert.equal(result.valid, true);
});

test('requires text or an attachment for a message', () => {
  assert.equal(validateMessage({ text: 'Hello' }).valid, true);
  assert.equal(validateMessage({ text: '   ' }).valid, false);
});

test('requires a question and at least two poll options', () => {
  assert.equal(validatePoll({ question: 'Choose', options: ['One', 'Two'] }).valid, true);
  assert.equal(validatePoll({ question: 'Choose', options: ['One'] }).valid, false);
});
