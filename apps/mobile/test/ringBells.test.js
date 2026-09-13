import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_BELLS_EXPIRY_HOURS, RING_BELLS_EXPIRY_MS, getRingBellsExpiry, isRingBellsActive } from '../src/utils/ringBells.js';

test('Ring Bells expire after exactly 36 hours', () => {
  const created = Date.parse('2026-09-13T10:00:00Z');
  assert.equal(RING_BELLS_EXPIRY_HOURS, 36);
  assert.equal(RING_BELLS_EXPIRY_MS, 36 * 60 * 60 * 1000);
  assert.equal(getRingBellsExpiry('2026-09-13T10:00:00Z'), created + RING_BELLS_EXPIRY_MS);
});

test('Ring Bells remain active before expiry and inactive at expiry', () => {
  const created = Date.parse('2026-09-13T10:00:00Z');
  const expiry = created + RING_BELLS_EXPIRY_MS;
  assert.equal(isRingBellsActive('2026-09-14T21:59:59Z'), true);
  assert.equal(isRingBellsActive('2026-09-14T22:00:00Z'), false);
  assert.equal(isRingBellsActive('2026-09-14T22:00:01Z'), false);
});
