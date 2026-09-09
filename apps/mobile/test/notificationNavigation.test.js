import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenNotification, getNotificationChatId } from '../src/utils/notificationNavigation.js';

test('extracts a valid chat id from notification data', () => {
  assert.equal(getNotificationChatId({ data: { chat_id: '42' } }), 42);
  assert.equal(canOpenNotification({ data: { chat_id: 42 } }), true);
});

test('rejects notifications without a usable conversation id', () => {
  assert.equal(getNotificationChatId({ data: {} }), null);
  assert.equal(getNotificationChatId({ data: { chat_id: 'not-a-number' } }), null);
  assert.equal(getNotificationChatId({ data: { chat_id: 0 } }), null);
  assert.equal(canOpenNotification({ title: 'A notification' }), false);
});
