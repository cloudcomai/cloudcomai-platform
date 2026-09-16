import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationChannelId,
  notificationPreview,
  shouldSuppressSameChat,
} from '../src/services/notificationPolicy.js';

test('Android message alert channel matches sound/vibration combinations', () => {
  assert.equal(notificationChannelId(DEFAULT_NOTIFICATION_PREFERENCES), 'messages_alerts_v2');
  assert.equal(notificationChannelId({ ...DEFAULT_NOTIFICATION_PREFERENCES, sound: true, vibration: false }), 'messages_sound_v2');
  assert.equal(notificationChannelId({ ...DEFAULT_NOTIFICATION_PREFERENCES, sound: false, vibration: true }), 'messages_vibration_v2');
  assert.equal(notificationChannelId({ ...DEFAULT_NOTIFICATION_PREFERENCES, sound: false, vibration: false }), 'messages_silent_v2');
});

test('message preview never exposes text when disabled and maps media types safely', () => {
  assert.equal(notificationPreview('text', 'This is private', false), 'New message');
  assert.equal(notificationPreview('image', 'https://private.example/photo', true), 'Photo');
  assert.equal(notificationPreview('video', 'private-url', true), 'Video');
  assert.equal(notificationPreview('voice', 'private-url', true), 'Voice message');
  assert.equal(notificationPreview('file', 'private-url', true), 'File');
  assert.equal(notificationPreview('other', 'private-url', true), 'Attachment');
  assert.equal(notificationPreview('text', 'A'.repeat(200), true).length, 120);
});

test('same active chat suppresses only foreground message notifications', () => {
  assert.equal(shouldSuppressSameChat({ appState: 'active', activeChatId: 42, notificationChatId: 42, category: 'message' }), true);
  assert.equal(shouldSuppressSameChat({ appState: 'active', activeChatId: 42, notificationChatId: 43, category: 'message' }), false);
  assert.equal(shouldSuppressSameChat({ appState: 'background', activeChatId: 42, notificationChatId: 42, category: 'message' }), false);
  assert.equal(shouldSuppressSameChat({ appState: 'active', activeChatId: 42, notificationChatId: 42, category: 'system' }), false);
});
