import React, { useEffect, useState } from 'react';
import { X, Info, Users, ShieldCheck, Settings, RefreshCw } from 'lucide-react';
import { platformApi } from '../services/platform';

const tabs = [
  { id: 'info', label: 'Info', Icon: Info },
  { id: 'members', label: 'Members', Icon: Users },
  { id: 'permissions', label: 'Permissions', Icon: ShieldCheck },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const formatRetention = value => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Default room retention';
  if (seconds % 86400 === 0) return (seconds / 86400) + ' days';
  if (seconds % 3600 === 0) return (seconds / 3600) + ' hours';
  return Math.round(seconds / 60) + ' minutes';
};

export default function PublicChatManagePanel({ selectedChat, close }) {
  const [activeTab, setActiveTab] = useState('info');
  const [participants, setParticipants] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRoomMembers = async () => {
    if (!selectedChat?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.getPublicChatManage(Number(selectedChat.id));
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setOnlineUsers(Array.isArray(data.online_users) ? data.online_users : []);
    } catch (err) {
      setError(err.message || 'Unable to load public chat information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!selectedChat?.id) return;
      setLoading(true);
      setError('');
      try {
        const { data } = await platformApi.getPublicChatManage(Number(selectedChat.id));
        if (!active) return;
        setParticipants(Array.isArray(data.participants) ? data.participants : []);
        setOnlineUsers(Array.isArray(data.online_users) ? data.online_users : []);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load public chat information.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [selectedChat?.id]);

  const roomType = selectedChat?.room_type === 'language' ? 'Language room' : 'Public room';
  const joinedCount = Number(selectedChat?.joined_count ?? participants.length);
  const onlineCount = Number(selectedChat?.online_count ?? onlineUsers.length);

  return (
    <aside className="public-chat-manage-panel" role="dialog" aria-modal="true" aria-label="Manage Public Chat">
      <header className="public-chat-manage-header">
        <div className="public-chat-manage-room-avatar" aria-hidden="true">🌐</div>
        <div className="public-chat-manage-heading">
          <h2>Manage Public Chat</h2>
          <p>{selectedChat?.name || 'Public Chat Room'}</p>
        </div>
        <button type="button" className="public-chat-manage-close" onClick={close} aria-label="Close management panel"><X size={21}/></button>
      </header>

      <nav className="public-chat-manage-tabs" aria-label="Public chat management sections">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeTab === id ? 'active' : ''} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>
            <Icon size={19}/><span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="public-chat-manage-body">
        {error && <div className="public-chat-manage-error" role="alert">{error}</div>}
        {activeTab === 'info' && (
          <section className="public-chat-manage-section">
            <div className="public-chat-manage-room-card">
              <div className="public-chat-manage-room-avatar large">🌐</div>
              <div><h3>{selectedChat?.name || 'Public Chat Room'}</h3><p>{selectedChat?.group_description || 'Public community room'}</p></div>
            </div>
            <div className="public-chat-manage-stat"><span>Room Type</span><strong>{roomType}</strong></div>
            <div className="public-chat-manage-stat"><span>Online Users</span><strong>{loading ? '…' : onlineCount}</strong></div>
            <div className="public-chat-manage-stat"><span>Total Joined</span><strong>{loading ? '…' : joinedCount}</strong></div>
            <button type="button" className="public-chat-manage-refresh" onClick={loadRoomMembers} disabled={loading}><RefreshCw size={16}/> {loading ? 'Refreshing…' : 'Refresh room information'}</button>
          </section>
        )}

        {activeTab === 'members' && (
          <section className="public-chat-manage-section">
            <div className="public-chat-manage-section-title"><div><h3>Room Members</h3><p>{loading ? 'Loading participants…' : participants.length + ' active participants'}</p></div><button type="button" onClick={loadRoomMembers} disabled={loading} aria-label="Refresh members"><RefreshCw size={17}/></button></div>
            {loading ? <p className="public-chat-manage-muted">Loading public chat members…</p> : participants.length ? (
              <div className="public-chat-manage-member-list">
                {participants.map(member => (
                  <div className="public-chat-manage-member" key={member.id}>
                    <div className="public-chat-manage-member-avatar">{String(member.name || 'U').trim().charAt(0).toUpperCase()}</div>
                    <div className="public-chat-manage-member-details"><strong>{member.name || 'CloudComAI user'}</strong><span>{member.age != null ? member.age + ' years' : 'Age not shared'}{member.gender ? ' · ' + member.gender : ''}</span></div>
                    <span className={'public-chat-manage-presence ' + (member.online ? 'online' : '')}>{member.online ? 'Online' : 'Offline'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="public-chat-manage-muted">No active participants were returned for this room.</p>}
          </section>
        )}

        {activeTab === 'permissions' && (
          <section className="public-chat-manage-section">
            <h3>Public Chat Permissions</h3>
            <p className="public-chat-manage-description">This room is public. Membership and moderation are enforced by the existing Public Chats service.</p>
            <div className="public-chat-manage-notice"><ShieldCheck size={19}/><span>The current public-room API does not expose editable file-sharing, link-sharing, download, or forwarding permission settings. These controls are intentionally not simulated or connected to Group-only APIs.</span></div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="public-chat-manage-section">
            <h3>Room Settings</h3>
            <div className="public-chat-manage-stat"><span>Room Type</span><strong>{roomType}</strong></div>
            <div className="public-chat-manage-stat"><span>Message Retention</span><strong>{formatRetention(selectedChat?.retention_seconds)}</strong></div>
            <div className="public-chat-manage-notice"><Info size={19}/><span>Room configuration changes are not available through the current public-room API. Existing room settings and chat behavior are left unchanged.</span></div>
          </section>
        )}
      </div>
    </aside>
  );
}
