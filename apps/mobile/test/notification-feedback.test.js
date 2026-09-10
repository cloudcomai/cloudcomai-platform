import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotifyWithFeedback } from '../src/services/notificationFeedback.js';

test('message notification requests sound/vibration feedback when enabled', () => {
  const notification = { request: { content: { data: { category: 'message' } } } };
  assert.equal(shouldNotifyWithFeedback(notification, { enabled: true, message: true }), true);
});

test('disabled or system notifications do not request chat feedback', () => {
  const system = { request: { content: { data: { category: 'system' } } } };
  const message = { request: { content: { data: { category: 'message' } } } };
  assert.equal(shouldNotifyWithFeedback(system, { enabled: true, system: true }), false);
  assert.equal(shouldNotifyWithFeedback(message, { enabled: true, message: false }), false);
  assert.equal(shouldNotifyWithFeedback(message, { enabled: false, message: true }), false);
});
