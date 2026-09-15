import { parseMessageTimestamp } from '@cloudcomai/chat-core';

export const RING_BELLS_EXPIRY_HOURS = 36;
export const RING_BELLS_EXPIRY_MS = RING_BELLS_EXPIRY_HOURS * 60 * 60 * 1000;

export function getRingBellsExpiry(createdAt) {
  const created = createdAt ? parseMessageTimestamp(createdAt).getTime() : NaN;
  return Number.isFinite(created) ? created + RING_BELLS_EXPIRY_MS : NaN;
}

export function isRingBellsActive(expiresAt, now = Date.now()) {
  const expiry = expiresAt ? parseMessageTimestamp(expiresAt).getTime() : NaN;
  return Number.isFinite(expiry) && expiry > now;
}

export function ringBellsRemainingLabel(expiresAt, now = Date.now()) {
  const remaining = expiresAt ? parseMessageTimestamp(expiresAt).getTime() - now : NaN;
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Expired';
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`;
}
