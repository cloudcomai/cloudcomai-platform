export function buildProfileImageCacheKey(version, nonce = Date.now()) {
  return `${version || 'current'}-${nonce}`;
}
