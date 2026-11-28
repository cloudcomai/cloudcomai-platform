import React, { useState } from 'react';
import { disableWebAppLock, readWebAppLockConfig, saveWebAppLockPin } from '../services/webAppLock';

export default function WebAppLockSettings({ userId }) {
  const [enabled, setEnabled] = useState(() => Boolean(readWebAppLockConfig(userId)));
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const enable = async event => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (!/^\\d{4,6}$/.test(pin)) { setError('Use a 4 to 6 digit PIN.'); return; }
    if (pin !== confirmPin) { setError('PIN confirmation does not match.'); return; }
    setBusy(true);
    try {
      await saveWebAppLockPin(userId, pin);
      setEnabled(true); setPin(''); setConfirmPin('');
      setMessage('App Lock enabled. The app will lock when this browser session is refreshed or hidden.');
    } catch (saveError) { setError(saveError.message || 'Unable to enable App Lock.'); }
    finally { setBusy(false); }
  };

  const disable = async event => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const removed = await disableWebAppLock(userId, currentPin);
      if (!removed) { setError('Incorrect PIN. App Lock remains enabled.'); setCurrentPin(''); return; }
      setEnabled(false); setCurrentPin('');
      setMessage('App Lock disabled.');
    } catch (disableError) { setError(disableError.message || 'Unable to disable App Lock.'); }
    finally { setBusy(false); }
  };

  return <section className="privacy-section">
    <h4>App Lock</h4>
    <p className="privacy-footnote">Protect this browser session with a 4–6 digit PIN. The PIN is not stored; a salted PBKDF2-SHA-256 verifier is stored in this browser profile.</p>
    {enabled ? <form onSubmit={disable}>
      <p role="status">App Lock is enabled.</p>
      <label className="privacy-toggle-row"><span><strong>Current PIN</strong><small>Verify your PIN before disabling App Lock.</small></span><input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" maxLength={6} value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} aria-label="Current App Lock PIN" /></label>
      <button type="submit" disabled={busy || !/^\\d{4,6}$/.test(currentPin)}>{busy ? 'Please wait…' : 'Disable App Lock'}</button>
    </form> : <form onSubmit={enable}>
      <label className="privacy-toggle-row"><span><strong>Create PIN</strong></span><input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" maxLength={6} value={pin} onChange={event => setPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} aria-label="Create App Lock PIN" /></label>
      <label className="privacy-toggle-row"><span><strong>Confirm PIN</strong></span><input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" maxLength={6} value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\\D/g, '').slice(0, 6))} aria-label="Confirm App Lock PIN" /></label>
      <button type="submit" disabled={busy || !/^\\d{4,6}$/.test(pin) || !/^\\d{4,6}$/.test(confirmPin)}>{busy ? 'Please wait…' : 'Enable App Lock'}</button>
    </form>}
    {error && <p role="alert" className="privacy-error">{error}</p>}
    {message && <p role="status" className="privacy-footnote">{message}</p>}
    <p className="privacy-footnote">Security limitation: browser storage is not a hardware-backed secret store. A person with control of this browser profile or developer tools may remove the verifier or bypass the UI. Use device-level security for sensitive protection.</p>
  </section>;
}
