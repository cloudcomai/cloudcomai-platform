const DEFAULT_RESUME_GRACE_MS = 1500;

let activeExternalActivities = 0;
let suppressResumeLockUntil = 0;

export function beginAppLockExternalActivity({
  now = Date.now,
  graceMs = DEFAULT_RESUME_GRACE_MS,
} = {}) {
  activeExternalActivities += 1;
  let finished = false;

  return () => {
    if (finished) return;
    finished = true;
    activeExternalActivities = Math.max(0, activeExternalActivities - 1);
    suppressResumeLockUntil = Math.max(suppressResumeLockUntil, now() + graceMs);
  };
}

export async function withAppLockExternalActivity(operation, options) {
  const finish = beginAppLockExternalActivity(options);
  try {
    return await operation();
  } finally {
    finish();
  }
}

export function isAppLockResumeSuppressed(now = Date.now()) {
  return activeExternalActivities > 0 || now < suppressResumeLockUntil;
}

export function resetAppLockActivityForTests() {
  activeExternalActivities = 0;
  suppressResumeLockUntil = 0;
}
