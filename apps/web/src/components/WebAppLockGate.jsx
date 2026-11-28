import React, { useEffect, useState } from 'react';
import { readWebAppLockConfig, verifyWebAppLockPin } from '../services/webAppLock';

export default function WebAppLockGate({ userId }) {
  const [enabled, setEnabled] = useState(() => Boolean(readWebAppLockConfig(userId)));
  const [locked, setLocked] = useState(() => Boolean(readWebAppLockConfig(userId)));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const syncConfig = () => {
      const nextEnabled = Boolean(readWebAppLockConfig(userId));
      setEnabled(nextEnabled);
      if (nextEnabled) setLocked(true);
      else { setLocked(false); setPin(''); setError(''); }
    };
    syncConfig();
    window.addEventListener('cloudcomai:web-app-lock-changed', syncConfig);
    const lock = () => { if (readWebAppLockConfig(userId)) { setLocked(true); setPin(''); setError(''); } };
    const onVisibility = () => { if (document.visibilityState === 'hidden') lock(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', lock);
    window.addEventListener('pageshow', event => { if (event.persisted) lock(); });
    return () => {
      window.removeEventListener('cloudcomai:web-app-lock-changed', syncConfig);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', lock);
    };
  }, [userId]);

  const unlock = async event => {
    event?.preventDefault?.();
    if (busy || !/^\\d{4,6}$/.test(pin)) return;
    setBusy(true);
    setError('');
    try {
      if (await verifyWebAppLockPin(userId, pin)) {
        setLocked(false);
        setPin('');
      } else {
        setPin('');
        setError('Incorrect PIN. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!userId || !enabled || !locked) return null;
  return <div role="dialog" aria-modal="true" aria-label="CloudComAI App Lock" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0b1220' }}>
    <form onSubmit={unlock} style={{ width: '100%', maxWidth: 380, padding: 28, borderRadius: 18, background: '#fff', color: '#172033', textAlign: 'center', boxShadow: '0 24px 80px #0006' }}>
      <div aria-hidden="true" style={{ fontSize: 34, marginBottom: 12 }}>🔒</div>
      <h2 style={{ margin: '0 0 8px' }}>CloudComAI locked</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Enter your App Lock PIN to continue.</p>
      <input autoFocus type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,6}" maxLength={6} value={pin} onChange={event => setPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} aria-label="App Lock PIN" placeholder="4–6 digit PIN" style={{ width: '100%', boxSizing: 'border-box', padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 20, textAlign: 'center', letterSpacing: 6 }} />
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <button type="submit" disabled={busy || !/^\\d{4,6}$/.test(pin)} style={{ width: '100%', marginTop: 16, padding: 13, border: 0, borderRadius: 10, background: '#3157d5', color: '#fff', fontWeight: 700 }}>{busy ? 'Verifying…' : 'Unlock'}</button>
      <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, marginTop: 18 }}>Browser App Lock is an additional privacy barrier, not equivalent to native secure storage. Anyone controlling this browser profile may be able to bypass or remove it.</p>
    </form>
  </div>;
}
