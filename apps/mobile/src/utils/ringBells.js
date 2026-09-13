export const RING_BELLS_EXPIRY_HOURS = 36;
export const RING_BELLS_EXPIRY_MS = RING_BELLS_EXPIRY_HOURS * 60 * 60 * 1000;

export function getRingBellsExpiry(createdAt, now = Date.now()) {
  const normalized = String(createdAt || '').includes('T') ? String(createdAt) : String(createdAt || '').replace(' ', 'T');
  const created = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(created) ? created + RING_BELLS_EXPIRY_MS : NaN;
}

export function isRingBellsActive(expiresAt, now = Date.now()) {
  const normalized = String(expiresAt || '').includes('T') ? String(expiresAt) : String(expiresAt || '').replace(' ', 'T');
  const expiry = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(expiry) && expiry > now;
}
