export const CALL_TYPES = Object.freeze({ AUDIO: 'audio', VIDEO: 'video' });
export const CALL_STATES = Object.freeze({ IDLE: 'idle', OUTGOING: 'outgoing', RINGING: 'ringing', CONNECTING: 'connecting', ACTIVE: 'active', ENDED: 'ended', MISSED: 'missed', FAILED: 'failed', TIMED_OUT: 'timed_out' });
export const DEFAULT_RING_TIMEOUT_MS = 30_000;

export const createInitialCallState = () => ({
  state: CALL_STATES.IDLE,
  type: null,
  callId: null,
  chatId: null,
  participants: [],
  muted: false,
  cameraEnabled: true,
  speakerEnabled: true,
  cameraFacing: 'front',
  error: null,
});

export const startOutgoingCall = ({ callId, chatId, type, participants = [] }) => ({
  ...createInitialCallState(),
  state: CALL_STATES.OUTGOING,
  callId,
  chatId,
  type,
  participants,
});

export const acceptIncomingCall = state => ({ ...state, state: CALL_STATES.CONNECTING, error: null });
export const markCallActive = state => ({ ...state, state: CALL_STATES.ACTIVE, error: null });
export const toggleMute = state => ({ ...state, muted: !state.muted });
export const toggleCamera = state => ({ ...state, cameraEnabled: !state.cameraEnabled });
export const toggleSpeaker = state => ({ ...state, speakerEnabled: !state.speakerEnabled });
export const switchCamera = state => ({ ...state, cameraFacing: state.cameraFacing === 'front' ? 'back' : 'front' });
export const markMissedCall = state => ({ ...state, state: CALL_STATES.MISSED });
export const markTimedOut = state => ({ ...state, state: CALL_STATES.TIMED_OUT });
export const markCallFailed = (state, error) => ({ ...state, state: CALL_STATES.FAILED, error: error || 'Call failed.' });
export const endCall = state => ({ ...state, state: CALL_STATES.ENDED });

export const getCallHistoryEntry = (state, { startedAt, endedAt, durationSeconds = 0 } = {}) => ({
  callId: state.callId,
  chatId: state.chatId,
  type: state.type,
  state: state.state,
  participants: state.participants,
  startedAt: startedAt || null,
  endedAt: endedAt || null,
  durationSeconds,
});
