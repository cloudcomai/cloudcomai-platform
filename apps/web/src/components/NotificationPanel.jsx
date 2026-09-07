import React, { useEffect, useState } from 'react';

const KEY = 'cloudcomai.notification.preferences';
const DEFAULTS = { enabled: true, message: true, group: true, attachment: true, system: true };
const labels = [['enabled', 'Enable notifications'], ['message', 'Private messages'], ['group', 'Group messages'], ['attachment', 'Attachments'], ['system', 'System alerts']];

export default function NotificationPanel({ apiBridge, close, onUnreadChange }) {
  const [view, setView] = useState('inbox');
  const [preferences, setPreferences] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; } });
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    apiBridge('v1/notifications', { method: 'GET', query: { limit: 50 } }).then(data => {
      const count = Number(data.unread_count || 0);
      setNotifications(data.notifications || []);
      setUnread(count);
      onUnreadChange?.(count);
    }).catch(() => {});
  }, [apiBridge, onUnreadChange]);

  const update = next => {
    const value = { ...preferences, ...next };
    setPreferences(value);
    localStorage.setItem(KEY, JSON.stringify(value));
  };

  const markRead = async item => {
    if (item.read_at) return;
    await apiBridge('v1/notifications/read', { method: 'POST', body: JSON.stringify({ notification_ids: [Number(item.id)] }) });
    setNotifications(items => items.map(entry => Number(entry.id) === Number(item.id) ? { ...entry, read_at: new Date().toISOString() } : entry));
    const next = Math.max(0, unread - 1);
    setUnread(next);
    onUnreadChange?.(next);
  };

  const markAllRead = async () => {
    await apiBridge('v1/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) });
    setNotifications(items => items.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnread(0);
    onUnreadChange?.(0);
  };

  return <div className="modal-backdrop"><div className="modal-content-card notification-window" role="dialog" aria-modal="true" aria-label="Notifications">
    <div className="notification-header"><div><h3>Notifications</h3><p>{unread} unread</p></div><button onClick={close} aria-label="Close notifications">×</button></div>
    <div className="notification-tabs">
      <button className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>Inbox {unread > 0 ? `(${unread})` : ''}</button>
      <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Notification settings</button>
    </div>

    {view === 'settings' ? <section className="notification-settings-view">
      <h4>Enable / disable notifications</h4>
      <p className="notification-help">Choose which notifications CloudComAI can show on this browser. Muting an individual chat is available from that chat header.</p>
      <div className="notification-setting-list">{labels.map(([key, label]) => <label key={key} className="notification-setting-row"><span>{label}</span><input type="checkbox" checked={Boolean(preferences[key])} onChange={event => update({ [key]: event.target.checked })} /></label>)}</div>
    </section> : <section className="notification-inbox-view">
      <div className="notification-inbox-toolbar"><span>Recent notifications</span><button className="primary" onClick={markAllRead} disabled={!unread}>Mark all read</button></div>
      <div className="notification-list">{notifications.map(item => <button key={item.id} className={`notification-item ${item.read_at ? 'read' : 'unread'}`} onClick={() => markRead(item)}>
        <span className="notification-status-dot" aria-label={item.read_at ? 'Read' : 'Unread'} />
        <span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{item.created_at}</small></span>
        <span className="notification-state">{item.read_at ? 'Read' : 'New'}</span>
      </button>)}{!notifications.length && <p className="notification-empty">No notifications yet.</p>}</div>
    </section>}
  </div></div>;
}
