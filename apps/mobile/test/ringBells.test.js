import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_BELLS_EXPIRY_HOURS, RING_BELLS_EXPIRY_MS, getRingBellsExpiry, isRingBellsActive, ringBellsRemainingLabel } from '../src/utils/ringBells.js';

test('Ring Bells expire after exactly 36 hours', () => {
  const created = Date.parse('2026-09-13T10:00:00Z');
  assert.equal(RING_BELLS_EXPIRY_HOURS, 36);
  assert.equal(RING_BELLS_EXPIRY_MS, 36 * 60 * 60 * 1000);
  assert.equal(getRingBellsExpiry('2026-09-13T10:00:00Z'), created + RING_BELLS_EXPIRY_MS);
});

test('Ring Bells remain active before expiry and inactive at expiry', () => {
  const expiry = Date.parse('2026-09-14T22:00:00Z');
  assert.equal(isRingBellsActive('2026-09-14T21:59:59Z', expiry - 2000), true);
  assert.equal(isRingBellsActive('2026-09-14T22:00:00Z', expiry), false);
  assert.equal(isRingBellsActive('2026-09-14T22:00:01Z', expiry), true);
});


test('Ring Bells interpret MySQL UTC and explicit offsets consistently', () => {
  const now = Date.parse('2026-09-15T10:00:00Z');
  for (const expiry of ['2026-09-15 12:00:00', '2026-09-15T12:00:00Z', '2026-09-15T17:30:00+05:30']) {
    assert.equal(isRingBellsActive(expiry, now), true);
    assert.equal(ringBellsRemainingLabel(expiry, now), '2h 0m left');
    assert.equal(isRingBellsActive(expiry, now + 7200000), false);
    assert.equal(ringBellsRemainingLabel(expiry, now + 7200000), 'Expired');
  }
  assert.equal(ringBellsRemainingLabel('invalid', now), 'Expired');
  assert.equal(isRingBellsActive(null, now), false);
});
