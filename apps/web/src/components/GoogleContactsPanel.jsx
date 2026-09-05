import React, { useCallback, useEffect, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { Check, ChevronRight, Contact, RefreshCw, X } from 'lucide-react';

export default function GoogleContactsPanel({ apiBridge, close }) {
  const [status, setStatus] = useState({ connected: false, email: null, contact_count: 0, last_contacts_sync_at: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const data = await apiBridge(ApiRoute.GOOGLE_STATUS, { method: 'GET' });
    setStatus(data);
    return data;
  }, [apiBridge]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Unable to load Google Contacts.');
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleGoogleMessage = event => {
      if (event.origin !== window.location.origin || event.data?.type !== 'cloudcomai-google') return;
      setConnecting(false);
      load();
    };
    window.addEventListener('message', handleGoogleMessage);
    return () => window.removeEventListener('message', handleGoogleMessage);
  }, [load]);

  const connectGoogle = async () => {
    setConnecting(true);
    setError('');
    try {
      const data = await apiBridge(ApiRoute.GOOGLE_CONNECT, { method: 'GET' });
      if (!data.authorization_url) throw new Error('Google authorization URL was not returned.');
      const popup = window.open(data.authorization_url, 'cloudcomai-google', 'width=520,height=700,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes');
      if (!popup) {
        setConnecting(false);
        throw new Error('Please allow pop-ups for CloudComAI to connect Google.');
      }
      popup.focus();
    } catch (err) {
      setConnecting(false);
      setError(err.message || 'Unable to start Google connection.');
    }
  };

  const syncContacts = async () => {
    setSyncing(true);
    setError('');
    try {
      await apiBridge(ApiRoute.GOOGLE_SYNC, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message || 'Unable to synchronize Google Contacts.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-content-card" style={{ width: 'min(620px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Google Contacts</h3>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Connect Google to keep your CloudComAI contacts synchronized.</p>
        </div>
        <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-light)' }} aria-label="Close Google Contacts">
          <X size={20} />
        </button>
      </div>

      {error && <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: '9px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '12px' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Google Contacts…</div>
      ) : !status.connected ? (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '22px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--bg-directory)', color: 'var(--primary-color)' }}><Contact size={24} /></div>
          <strong style={{ display: 'block', marginBottom: '6px' }}>Connect your Google Contacts</strong>
          <p style={{ margin: '0 auto 16px', maxWidth: 430, fontSize: '12px', lineHeight: 1.5, color: 'var(--text-muted)' }}>CloudComAI will only request read-only access to your Google Contacts. Your Gmail messages are not requested.</p>
          <button type="button" onClick={connectGoogle} disabled={connecting} style={primaryButtonStyle}>{connecting ? 'Opening Google…' : 'Connect Google'}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '14px' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--bg-directory)', color: 'var(--primary-color)' }}><Check size={19} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>Google connected</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{status.email || 'Google account'}</span></div>
            <button type="button" onClick={syncContacts} disabled={syncing} style={secondaryButtonStyle}><RefreshCw size={15} />{syncing ? 'Syncing…' : 'Sync now'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
            <div style={statCardStyle}><span>Contacts synced</span><strong>{status.contact_count ?? 0}</strong></div>
            <div style={statCardStyle}><span>Last sync</span><strong>{formatSyncDate(status.last_contacts_sync_at)}</strong></div>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Contact size={20} style={{ color: 'var(--primary-color)', flex: '0 0 auto' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Registered contacts appear in People & Contacts</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>Only contacts that match an active CloudComAI account by email or phone are displayed there. Other imported contacts remain hidden.</span>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={close} style={secondaryButtonStyle}>Close <ChevronRight size={15} /></button></div>
    </div>
  );
}

function formatSyncDate(value) {
  if (!value) return 'Never';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

const primaryButtonStyle = { border: 'none', borderRadius: '9px', padding: '10px 16px', background: 'var(--primary-color)', color: '#fff', fontWeight: 600, cursor: 'pointer' };
const secondaryButtonStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const statCardStyle = { display: 'flex', flexDirection: 'column', gap: '4px', padding: '11px 12px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-primary)' };
