export const MIN_POLL_OPTIONS = 3;
export const DEFAULT_POLL_OPTION_FIELDS = 4;
export const MAX_POLL_OPTIONS = 6;

export const cleanPollOptions = options => [...new Set(
  (Array.isArray(options) ? options : [])
    .map(option => String(option ?? '').trim())
    .filter(Boolean)
)];

export const canCreatePoll = ({ question, groupIds, options }) =>
  Boolean(String(question ?? '').trim()) &&
  Array.isArray(groupIds) &&
  groupIds.length > 0 &&
  cleanPollOptions(options).length >= MIN_POLL_OPTIONS;
