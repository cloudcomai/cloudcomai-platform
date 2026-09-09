import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatMessageTimestamp } from '@cloudcomai/chat-core';
import { platformApi } from '../services/platform';

export default function AccountToolsPanel({ mode, close, onOpenChat, onSessionRotated, onLogout, onUnsave }) {
  const saved = mode === 'saved_messages';
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async before => {
    setLoading(true); setError('');
    try {
      const { data } = saved ? await platformApi.listSavedMessages({ query: { before_id: before } }) : await platformApi.listSessions();
      const incoming = saved ? data.messages || [] : data.sessions || [];
      setItems(current => before ? [...current, ...incoming.filter(item => !current.some(old => old.saved_id === item.saved_id))] : incoming);
      setCursor(data.next_before_id || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [saved]);
  useEffect(() => { load(); }, [load]);
  const perform = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const revoke = item => {
    if (!window.confirm(item.current ? 'Sign out of this device?' : 'Sign out this device? It will need to sign in again.')) return;
    perform(async () => {
      if (item.current) { await onLogout(); return; }
      await platformApi.revokeSession(item.id);
      setItems(current => current.filter(entry => entry.id !== item.id));
    });
  };
  return <div className="modal-content-card account-tools-panel">
    <div className="privacy-panel-heading"><h3>{saved ? 'Saved messages' : 'Devices & sessions'}</h3><button onClick={close} aria-label="Close"><X size={20} /></button></div>
    <p className="privacy-footnote">{saved ? 'Save a message from its actions to find it here. Expired or deleted messages are removed from this list.' : 'Review active sign-ins. Signing out other devices also invalidates older sign-ins that have not recently been used.'}</p>
    {error && <p className="privacy-error" role="alert">{error}</p>}
    <button onClick={() => load()} disabled={loading || busy}>Refresh</button>
    {loading && <p role="status">Loading…</p>}
    {!loading && !items.length && <p>{saved ? 'No saved messages yet.' : 'No active sessions found.'}</p>}
    {items.map(item => <article key={saved ? item.saved_id : item.id} className="account-tool-row">
      <div className="account-tool-details"><strong>{saved ? item.chat_name || item.sender_name || 'Conversation' : item.current ? 'This device' : 'Signed-in device'}</strong>
        <p>{saved ? item.type === 'text' ? item.body : item.poll?.question || `[${item.type} message]` : item.device_label || 'Device details unavailable'}</p>
        <small>{saved ? `Saved ${formatMessageTimestamp(item.saved_at)}` : `Last active ${formatMessageTimestamp(item.last_seen_at)}`}</small>
      </div>
      <div className="account-tool-actions">{saved ? <><button disabled={busy} onClick={() => perform(async () => { await onOpenChat(Number(item.chat_id)); close(); })}>Open chat</button><button disabled={busy} onClick={() => perform(async () => { await platformApi.unsaveMessage(item.id); onUnsave?.(item.id); setItems(current => current.filter(entry => entry.id !== item.id)); })}>Unsave</button></> : <button disabled={busy} onClick={() => revoke(item)}>Sign out</button>}</div>
    </article>)}
    {saved && cursor && <button disabled={loading || busy} onClick={() => load(cursor)}>Load more</button>}
    {!saved && <button className="privacy-backup-button" disabled={busy || loading} onClick={() => {
      if (!window.confirm('Sign out all other devices? You will stay signed in here.')) return;
      perform(async () => { const { data } = await platformApi.revokeOtherSessions(); await onSessionRotated(data); await load(); });
    }}>Sign out all other devices</button>}
  </div>;
}
