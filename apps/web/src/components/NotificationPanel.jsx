import React, { useCallback, useEffect, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';

const DEFAULTS = { enabled: true, message: true, group: true, attachment: true, system: true };
const labels = [['enabled', 'Enable push notifications'], ['message', 'Private messages'], ['group', 'Group messages'], ['attachment', 'Attachments'], ['system', 'System alerts']];

export default function NotificationPanel({ apiBridge, close, onUnreadChange, onOpenChat }) {
  const [view, setView] = useState('inbox');
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [notifications, setNotifications] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [mentionsUnread, setMentionsUnread] = useState(0);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const updateCount = useCallback(value => { const count = Number(value || 0); setUnread(count); onUnreadChange?.(count); }, [onUnreadChange]);
  const load = useCallback(async () => {
    try {
      const data = await apiBridge('v1/notifications', { method: 'GET', query: { limit: 100 } });
      setNotifications(data.notifications || []); updateCount(data.unread_count);
    } catch (e) { setError(e.message || 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }, [apiBridge, updateCount]);
  useEffect(() => {
    load();
    apiBridge('v1/notifications/preferences', { method: 'GET' }).then(data => setPreferences(data.preferences)).catch(e => setError(e.message));
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, 15000);
    return () => clearInterval(timer);
  }, [load, apiBridge]);
  const loadMentions = useCallback(async () => {
    try {
      const data = await apiBridge(ApiRoute.MENTIONS, { method: 'GET', query: { limit: 100 } });
      setMentions(data.mentions || []);
      setMentionsUnread(Number(data.unread_count || 0));
    } catch (e) { setError(e.message || 'Unable to load mentions.'); }
    finally { setLoading(false); }
  }, [apiBridge]);
  useEffect(() => { if (view === 'mentions') loadMentions(); }, [view, loadMentions]);
  useEffect(() => { if (view !== 'mentions') return undefined; const timer = setInterval(() => { if (document.visibilityState !== 'hidden') loadMentions(); }, 15000); return () => clearInterval(timer); }, [view, loadMentions]);

  const run = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e.message || 'Unable to update notifications.'); }
    finally { setBusy(false); }
  };
  const mark = async (item, read = true) => {
    const data = await apiBridge('v1/notifications/read', { method: 'POST', body: JSON.stringify(item ? { notification_ids: [Number(item.id)], read } : { all: true }) });
    updateCount(data.unread_count);
    await load();
  };
  return <div className="modal-backdrop"><div className="modal-content-card notification-window" role="dialog" aria-modal="true" aria-label="Notifications">
    <div className="notification-header"><div><h3>Notifications</h3><p>{unread} unread</p></div><button onClick={close} aria-label="Close notifications">×</button></div>
    <div className="notification-tabs">
      <button className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>Inbox</button>
      <button className={view === 'mentions' ? 'active' : ''} onClick={() => setView('mentions')}>Mentions{mentionsUnread ? ` (${mentionsUnread})` : ''}</button>
      <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Notification settings</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {view === 'mentions' ? <section className="notification-inbox-view">
      <div className="notification-inbox-toolbar"><span>Messages that mention you</span><button disabled={busy} onClick={() => run(async () => { await loadMentions(); })}>Refresh</button></div>
      <div className="notification-list">{mentions.map(item => <button key={item.mention_id} disabled={busy} className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => run(async () => { await apiBridge(ApiRoute.MENTIONS, { method: 'POST', body: JSON.stringify({ action: 'open', mention_id: Number(item.mention_id) }) }); await onOpenChat?.(Number(item.chat_id), Number(item.message_id)); close(); })}>
        <span className="notification-status-dot" aria-label={item.read_at ? 'Read' : 'Unread'} /><span className="notification-copy"><strong>{item.sender_name || 'A member'} mentioned you in {item.chat_name || 'a chat'}</strong><span>{item.message_body || 'Mentioned you in a message'}</span><small>{item.message_created_at || item.created_at}</small></span>
      </button>)}{!mentions.length && <p className="notification-empty">{loading ? 'Loading mentions…' : 'No mentions yet.'}</p>}</div>
    </section> : view === 'settings' ? <section className="notification-settings-view">
      <p className="notification-help">Push preferences apply to your account on every device. Your inbox remains available.</p>
      <div className="notification-setting-list">{labels.map(([key, label]) => <label key={key} className="notification-setting-row"><span>{label}</span><input type="checkbox" disabled={busy} checked={Boolean(preferences[key])} onChange={event => { const checked = event.target.checked; run(async () => { const data = await apiBridge('v1/notifications/preferences', { method: 'PUT', body: JSON.stringify({ [key]: checked }) }); setPreferences(data.preferences); }); }} /></label>)}</div>
    </section> : <section className="notification-inbox-view">
      <div className="notification-inbox-toolbar"><span>Recent notifications</span><button className="primary" onClick={() => run(() => mark())} disabled={busy || !unread}>Mark all read</button></div>
      <div className="notification-list">{notifications.map(item => <div key={item.id}>
        <button disabled={busy} className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => run(async () => { if (!item.read_at) await mark(item); if (item.data?.chat_id) { await onOpenChat?.(Number(item.data.chat_id), Number(item.data.message_id || 0)); close(); } })}>
          <span className="notification-status-dot" aria-label={item.read_at ? 'Read' : 'Unread'} />
          <span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{item.created_at}</small></span>
        </button>
        <button disabled={busy} onClick={() => run(() => mark(item, Boolean(item.read_at)))}>{item.read_at ? 'Mark unread' : 'Mark read'}</button>
      </div>)}{!notifications.length && <p className="notification-empty">{loading ? 'Loading notifications…' : 'No notifications yet.'}</p>}</div>
    </section>}
  </div></div>;
}
