import React, { useEffect, useState } from 'react';

const KEY = 'cloudcomai.notification.preferences';
const DEFAULTS = { enabled: true, message: true, group: true, attachment: true, system: true };
const labels = [['enabled', 'Push notifications'], ['message', 'Messages'], ['group', 'Groups'], ['attachment', 'Attachments'], ['system', 'System']];

export default function NotificationPanel({ apiBridge, close }) {
  const [preferences, setPreferences] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; } });
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  useEffect(() => { apiBridge('v1/notifications', { method: 'GET', query: { limit: 50 } }).then(data => { setNotifications(data.notifications || []); setUnread(data.unread_count || 0); }).catch(() => {}); }, [apiBridge]);
  const update = next => { const value = { ...preferences, ...next }; setPreferences(value); localStorage.setItem(KEY, JSON.stringify(value)); };
  const markAllRead = async () => { await apiBridge('v1/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) }); setNotifications(items => items.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() }))); setUnread(0); };
  return <div className="modal-backdrop"><div className="modal-content-card" style={{ width: 'min(620px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Notifications</h3><p style={{ margin: '5px 0 14px', color: 'var(--text-muted)', fontSize: 12 }}>{unread} unread</p></div><button onClick={close} aria-label="Close notifications">×</button></div>
    <div style={{ display: 'grid', gap: 7, marginBottom: 16 }}>{labels.map(([key, label]) => <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 9 }}><span>{label}</span><input type="checkbox" checked={Boolean(preferences[key])} onChange={event => update({ [key]: event.target.checked })} /></label>)}</div>
    <button className="primary" onClick={markAllRead} disabled={!unread}>Mark all as read</button>
    <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>{notifications.map(item => <div key={item.id} style={{ padding: 11, borderRadius: 9, background: item.read_at ? 'var(--bg-directory)' : 'var(--bg-primary)', border: '1px solid var(--border-color)' }}><strong>{item.title}</strong><div style={{ marginTop: 3 }}>{item.body}</div><small style={{ color: 'var(--text-muted)' }}>{item.created_at}</small></div>)}{!notifications.length && <p style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>}</div>
  </div></div>;
}
