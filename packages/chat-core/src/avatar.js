const AVATAR_PALETTE = Object.freeze([
  { backgroundColor: '#dbeafe', textColor: '#1e40af' },
  { backgroundColor: '#dcfce7', textColor: '#166534' },
  { backgroundColor: '#fce7f3', textColor: '#9d174d' },
  { backgroundColor: '#fef3c7', textColor: '#92400e' },
  { backgroundColor: '#ede9fe', textColor: '#5b21b6' },
  { backgroundColor: '#cffafe', textColor: '#155e75' },
  { backgroundColor: '#ffedd5', textColor: '#9a3412' },
  { backgroundColor: '#e2e8f0', textColor: '#334155' },
]);

const firstLetter = value => {
  const text = String(value || '').trim();
  if (!text) return '';
  return Array.from(text).find(character => /\p{L}/u.test(character)) || '';
};

export const getAvatarInitial = (displayName, username) =>
  (firstLetter(displayName) || firstLetter(username) || 'U').toUpperCase();

export const getAvatarPalette = uniqueUserId => {
  const key = String(uniqueUserId ?? '').trim() || 'cloudcomai-user';
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 31) + key.charCodeAt(index)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};
