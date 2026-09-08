import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginAppLockExternalActivity,
  isAppLockResumeSuppressed,
  resetAppLockActivityForTests,
  withAppLockExternalActivity,
} from '../src/utils/appLockActivity.js';

test.beforeEach(() => resetAppLockActivityForTests());

test('suppresses resume locking while a system picker is active and during its return grace period', () => {
  let now = 1000;
  const finish = beginAppLockExternalActivity({ now: () => now, graceMs: 500 });
  assert.equal(isAppLockResumeSuppressed(now), true);
  finish();
  assert.equal(isAppLockResumeSuppressed(1499), true);
  assert.equal(isAppLockResumeSuppressed(1500), false);
});

test('keeps resume locking suppressed until nested external activities finish', () => {
  const finishFirst = beginAppLockExternalActivity({ now: () => 100, graceMs: 20 });
  const finishSecond = beginAppLockExternalActivity({ now: () => 200, graceMs: 20 });
  finishFirst();
  assert.equal(isAppLockResumeSuppressed(1000), true);
  finishSecond();
  assert.equal(isAppLockResumeSuppressed(219), true);
  assert.equal(isAppLockResumeSuppressed(220), false);
});

test('always releases suppression when a picker operation fails', async () => {
  let now = 500;
  await assert.rejects(
    withAppLockExternalActivity(async () => { throw new Error('picker failed'); }, { now: () => now, graceMs: 100 }),
    /picker failed/,
  );
  assert.equal(isAppLockResumeSuppressed(599), true);
  assert.equal(isAppLockResumeSuppressed(600), false);
});
