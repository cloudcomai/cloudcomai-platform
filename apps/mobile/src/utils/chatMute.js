export const CHAT_MUTE_DURATIONS = Object.freeze({
  '10_hours': 10 * 60 * 60 * 1000,
  '1_week': 7 * 24 * 60 * 60 * 1000,
  '2_weeks': 14 * 24 * 60 * 60 * 1000,
  always: null,
});

export const CHAT_MUTE_OPTIONS = Object.freeze([
  { key: '10_hours', label: '10 hours' },
  { key: '1_week', label: '1 week' },
  { key: '2_weeks', label: '2 weeks' },
  { key: 'always', label: 'Always' },
]);

export function isChatMuted(state, now = Date.now()) {
  if (!state?.muted) return false;
  if (!state.muted_until) return true;
  const timestamp = new Date(String(state.muted_until).replace(' ', 'T') + 'Z').getTime();
  return Number.isFinite(timestamp) && timestamp > now;
}
