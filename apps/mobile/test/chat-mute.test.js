import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_MUTE_DURATIONS, CHAT_MUTE_OPTIONS, isChatMuted } from '../src/utils/chatMute.js';

test('exposes the four requested mute durations', () => {
  assert.deepEqual(CHAT_MUTE_OPTIONS.map(option => option.label), ['10 hours', '1 week', '2 weeks', 'Always']);
  assert.equal(CHAT_MUTE_DURATIONS['10_hours'], 10 * 60 * 60 * 1000);
  assert.equal(CHAT_MUTE_DURATIONS['1_week'], 7 * 24 * 60 * 60 * 1000);
  assert.equal(CHAT_MUTE_DURATIONS['2_weeks'], 14 * 24 * 60 * 60 * 1000);
  assert.equal(CHAT_MUTE_DURATIONS.always, null);
});

test('timed mute expires without affecting other chats', () => {
  const now = Date.parse('2026-09-10T10:00:00Z');
  assert.equal(isChatMuted({ muted: true, muted_until: '2026-09-10 10:30:00' }, now), true);
  assert.equal(isChatMuted({ muted: true, muted_until: '2026-09-10 09:59:59' }, now), false);
  assert.equal(isChatMuted({ muted: false, muted_until: '2026-09-11 10:00:00' }, now), false);
  assert.equal(isChatMuted({ muted: true, muted_until: null }, now), true);
});
