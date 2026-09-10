import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptIncomingCall, createInitialCallState, endCall, getCallHistoryEntry, markCallActive, markCallFailed, markMissedCall, markTimedOut, startOutgoingCall, switchCamera, toggleCamera, toggleMute, toggleSpeaker, CALL_STATES } from '../src/services/callSession.js';

test('private outgoing call moves through connecting to active', () => {
  const outgoing = startOutgoingCall({ callId: 'c1', chatId: 10, type: 'audio', participants: [2] });
  assert.equal(outgoing.state, CALL_STATES.OUTGOING);
  assert.equal(markCallActive(acceptIncomingCall(outgoing)).state, CALL_STATES.ACTIVE);
});

test('call controls toggle without mutating state', () => {
  const initial = { ...startOutgoingCall({ callId: 'c1', chatId: 10, type: 'video' }), state: CALL_STATES.ACTIVE };
  assert.equal(toggleMute(initial).muted, true);
  assert.equal(toggleCamera(initial).cameraEnabled, false);
  assert.equal(toggleSpeaker(initial).speakerEnabled, false);
  assert.equal(switchCamera(initial).cameraFacing, 'back');
  assert.equal(initial.muted, false);
});

test('missed, timeout, failure, end and history are explicit', () => {
  const initial = startOutgoingCall({ callId: 'c2', chatId: 11, type: 'audio' });
  assert.equal(markMissedCall(initial).state, CALL_STATES.MISSED);
  assert.equal(markTimedOut(initial).state, CALL_STATES.TIMED_OUT);
  assert.equal(markCallFailed(initial, 'permission denied').error, 'permission denied');
  assert.equal(endCall(initial).state, CALL_STATES.ENDED);
  assert.equal(getCallHistoryEntry(initial, { startedAt: '2026-09-10T10:00:00Z', endedAt: '2026-09-10T10:01:00Z', durationSeconds: 60 }).durationSeconds, 60);
  assert.equal(createInitialCallState().state, CALL_STATES.IDLE);
});
