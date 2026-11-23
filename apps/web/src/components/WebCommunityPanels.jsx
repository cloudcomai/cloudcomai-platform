import React, { useEffect, useMemo, useState } from 'react';
import { mediaUrl, platformApi } from '../services/platform';

const relationshipLabel = relationship => {
  const status = relationship?.status || 'none';
  if (status === 'accepted') return 'Friend';
  if (status === 'pending' && relationship?.direction === 'outgoing') return 'Request Sent';
  if (status === 'pending' && relationship?.direction === 'incoming') return 'Respond to Request';
  return 'Add as Friend';
};

const roomSearchText = room => [
  room?.name, room?.city, room?.language, room?.language_code,
  room?.category, room?.group_category, room?.description, room?.keywords,
].filter(Boolean).join(' ').toLowerCase();

export function PublicChatsPanel({ close, onOpenChat }) {
  const [rooms, setRooms] = useState([]);
  const [query, setQuery] = useState('');
  const [busyRoomId, setBusyRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await platformApi.listPublicChats({ query: { q: query.trim() } });
      setRooms(Array.isArray(data.rooms) ? data.rooms : Array.isArray(data.favorites) ? data.favorites : Array.isArray(data.chats) ? data.chats : []);
    } catch (err) {
      setError(err.message || 'Unable to load public chat rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visibleRooms = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? rooms.filter(room => roomSearchText(room).includes(term)) : rooms;
  }, [rooms, query]);

  const openRoom = async room => {
    const roomId = Number(room?.id || room?.chat_id);
    if (!Number.isInteger(roomId) || roomId <= 0 || busyRoomId !== null) return;
    setBusyRoomId(roomId);
    setError('');
    try {
      await onOpenChat?.(roomId);
    } catch (err) {
      setError(err.message || 'Unable to open this public chat room. Please try again.');
    } finally {
      setBusyRoomId(null);
    }
  };

  const joinRoom = async room => {
    const roomId = Number(room?.id);
    if (!Number.isInteger(roomId) || roomId <= 0 || busyRoomId !== null) return;
    setBusyRoomId(roomId);
    setError('');
    try {
      const { data } = await platformApi.joinPublicChat(roomId);
      const joinedRoom = { ...room, ...(data.chat || {}), id: roomId, joined: true, type: 'public', isPublic: true };
      setRooms(current => current.map(item => Number(item.id) === roomId ? joinedRoom : item));
      await onOpenChat?.(roomId);
    } catch (err) {
      setError(err.message || 'Unable to join public chat room.');
    } finally {
      setBusyRoomId(null);
    }
  };

  const leaveRoom = async room => {
    const roomId = Number(room?.id);
    if (!Number.isInteger(roomId) || roomId <= 0 || busyRoomId !== null) return;
    setBusyRoomId(roomId);
    setError('');
    try {
      await platformApi.leavePublicChat(roomId);
      setRooms(current => current.map(item => Number(item.id) === roomId ? { ...item, joined: false, is_member: false } : item));
    } catch (err) {
      setError(err.message || 'Unable to leave public chat room.');
    } finally {
      setBusyRoomId(null);
    }
  };

  return (
    <div className="modal-content-card parity-community-panel">
      <h3>Public Chat Rooms</h3>
      <input aria-label="Search public chats" placeholder="Search room, city, language, category or keyword" value={query} onChange={event => setQuery(event.target.value)} />
      {error && <p role="alert" className="privacy-error">{error}</p>}
      {loading ? <p role="status">Loading public chat rooms…</p> : (
        <div className="parity-list">
          {visibleRooms.map(room => {
            const roomId = Number(room.id);
            const joined = Boolean(room.joined || room.is_member);
            const busy = busyRoomId === roomId;
            return (
              <article key={room.id} className="parity-room">
                <div>
                  <strong>{room.name}</strong>
                  <small>{[room.city, room.language || room.language_code, room.category || room.group_category].filter(Boolean).join(' · ')}</small>
                  <small><span className="public-room-live-indicator">● Live room</span> · 👥 {Number(room.joined_count || 0)} Joined · 🟢 {Number(room.online_count || 0)} Online</small>
                </div>
                <div>
                  {joined ? <>
                    <button type="button" disabled={busy || busyRoomId !== null} onClick={() => void openRoom(room)}>{busy ? 'Opening…' : 'Open'}</button>
                    <button type="button" disabled={busy || busyRoomId !== null} onClick={() => void leaveRoom(room)}>Leave</button>
                  </> : <button type="button" disabled={busyRoomId !== null} onClick={() => void joinRoom(room)}>{busy ? 'Joining…' : 'Join'}</button>}
                </div>
              </article>
            );
          })}
          {!visibleRooms.length && <p className="empty-state">No public chat rooms match your search.</p>}
        </div>
      )}
      <button type="button" onClick={close}>Close</button>
    </div>
  );
}


const REPORT_REASONS = ['Harassment', 'Spam', 'Hate or abusive content', 'Impersonation', 'Unsafe content', 'Other'];

export function PublicChatManagementPanel({ chat, user, close, onLeave }) {
  const [screen, setScreen] = useState('menu');
  const [users, setUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [hiddenUsers, setHiddenUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data }, hidden] = await Promise.all([
        platformApi.getPublicChatManage(Number(chat.id)),
        platformApi.getPublicChatHiddenUsers(Number(chat.id)),
      ]);
      setUsers(Array.isArray(data.online_users) ? data.online_users : []);
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setHiddenUsers(Array.isArray(hidden.data.hidden_users) ? hidden.data.hidden_users : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load public chat members.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data }, hidden] = await Promise.all([
          platformApi.getPublicChatManage(Number(chat.id)),
          platformApi.getPublicChatHiddenUsers(Number(chat.id)),
        ]);
        if (!active) return;
        setUsers(Array.isArray(data.online_users) ? data.online_users : []);
        setParticipants(Array.isArray(data.participants) ? data.participants : []);
        setHiddenUsers(Array.isArray(hidden.data.hidden_users) ? hidden.data.hidden_users : []);
        setError('');
      } catch (err) {
        if (active) setError(err.message || 'Unable to load public chat members.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(true), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [chat?.id, refreshKey]);

  const sendFriendRequest = async item => {
    const id = Number(item?.id);
    if (!id || id === Number(user?.id) || busyUserId !== null) return;
    const relationship = item.relationship || {};
    if (relationship.status === 'accepted' || (relationship.status === 'pending' && relationship.direction === 'outgoing')) return;
    setBusyUserId(id); setError(''); setNotice('');
    try {
      if (relationship.status === 'pending' && relationship.direction === 'incoming') {
        const requestId = Number(relationship.request_id);
        if (!requestId) throw new Error('The incoming friend request could not be identified. Refresh and try again.');
        await platformApi.respondToFriendRequest(requestId, 'accept');
        const update = person => Number(person.id) === id ? { ...person, relationship: { status: 'accepted' } } : person;
        setUsers(current => current.map(update));
        setParticipants(current => current.map(update));
        setNotice('Friend request accepted.');
        return;
      }
      await platformApi.sendFriendRequest(id);
      const update = person => Number(person.id) === id ? { ...person, relationship: { status: 'pending', direction: 'outgoing' } } : person;
      setUsers(current => current.map(update));
      setParticipants(current => current.map(update));
      setNotice('Friend request sent.');
    } catch (err) {
      setError(err.message || 'Unable to update friend request. Please try again.');
      setRefreshKey(value => value + 1);
    } finally {
      setBusyUserId(null);
    }
  };

  const submitReport = async () => {
    if (!selectedUser || Number(selectedUser.id) === Number(user?.id) || submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const { data } = await platformApi.reportPublicChatUser(Number(chat.id), {
        reported_user_id: Number(selectedUser.id), reason, details: details.trim(),
        incident_key: 'user:' + String(selectedUser.id),
      });
      setNotice(data?.duplicate
        ? 'This report was already submitted. Duplicate reports are not counted; messages from this user remain hidden from you in public chats.'
        : 'Report submitted. Messages from this user are now hidden from you in public chats. You will receive a private confirmation in CloudComAI Alerts.');
      setSelectedUser(null); setDetails('');
      const hidden = await platformApi.getPublicChatHiddenUsers(Number(chat.id));
      setHiddenUsers(Array.isArray(hidden.data.hidden_users) ? hidden.data.hidden_users : []);
    } catch (err) {
      setError(err.message || 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const unhide = async item => {
    setBusyUserId(Number(item.id)); setError(''); setNotice('');
    try {
      await platformApi.unhidePublicChatUser(Number(chat.id), Number(item.id));
      setHiddenUsers(current => current.filter(entry => Number(entry.id) !== Number(item.id)));
      setNotice('User unhidden. Their messages can appear again in public chats.');
    } catch (err) {
      setError(err.message || 'Unable to unhide user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const leaveRoom = async () => {
    if (!window.confirm('Leave this room? You will leave this public chat room and can join again unless a moderation restriction prevents access.')) return;
    setSubmitting(true); setError('');
    try {
      await onLeave?.(chat);
    } catch (err) {
      setError(err.message || 'Unable to leave public chat room.');
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (screen !== 'menu') {
      setScreen('menu'); setSelectedUser(null); setDetails(''); setError(''); setNotice('');
    } else close?.();
  };

  const renderUser = item => {
    const name = item.name || 'CloudComAI user';
    const id = Number(item.id);
    const relationship = item.relationship || { status: 'none' };
    const state = relationshipLabel(relationship);
    const busy = busyUserId === id;
    const isSelf = id === Number(user?.id);
    return <div className="public-manage-user-row" key={id}>
      <div className="public-manage-avatar">
        {!imageErrors[id] ? <img src={mediaUrl('user', id) + (item.image_version ? '&v=' + encodeURIComponent(item.image_version) : '')} alt="" onError={() => setImageErrors(current => ({ ...current, [id]: true }))} /> : <span>{name[0]?.toUpperCase() || 'U'}</span>}
      </div>
      <div className="public-manage-user-meta">
        <strong>{name}</strong>
        <small>{item.age_private ? 'Age: Private' : item.age == null ? 'Age: Not set' : 'Age: ' + item.age} · {item.gender_private ? 'Gender: Private' : item.gender || 'Gender: Not set'}</small>
        <small className={item.online ? 'public-presence-online' : ''}>{item.online ? '● Online now' : 'Participant'}</small>
      </div>
      {!isSelf && <button type="button" className="public-manage-friend-btn" disabled={busy || relationship.status === 'accepted' || (relationship.status === 'pending' && relationship.direction === 'outgoing')} onClick={() => void sendFriendRequest(item)}>{busy ? 'Please wait…' : state}</button>}
    </div>;
  };

  return <div className="public-manage-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close?.(); }}>
    <section className="public-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="public-manage-title">
      <header className="public-manage-header">
        <div><span className="public-manage-kicker">PUBLIC CHAT · LIVE ROOM</span><h2 id="public-manage-title">{screen === 'menu' ? 'Manage Public Chat' : screen === 'users' ? 'Online Users' : screen === 'hidden' ? 'Hidden Users' : 'Report User'}</h2><p>{chat?.name || 'Public chat room'}</p></div>
        <button type="button" className="public-manage-close" aria-label="Close public chat management" onClick={goBack}>×</button>
      </header>
      {screen !== 'menu' && <button type="button" className="public-manage-back" onClick={goBack}>‹ Manage</button>}
      {error && <div className="public-manage-feedback error" role="alert">{error}</div>}
      {notice && <div className="public-manage-feedback success" role="status">{notice}</div>}
      {loading && <p className="public-manage-loading" role="status">Loading room members…</p>}

      {screen === 'menu' ? <div className="public-manage-menu">
        <button type="button" onClick={() => { setScreen('users'); void load(); }}><span className="public-manage-menu-icon">◉</span><span><strong>Online Users</strong><small>See profiles, presence and friend relationships in this room.</small></span><b>›</b></button>
        <button type="button" onClick={() => { setScreen('report'); setSelectedUser(null); }}><span className="public-manage-menu-icon">⚑</span><span><strong>Report User</strong><small>Report a participant for moderator review.</small></span><b>›</b></button>
        <button type="button" onClick={() => { setScreen('hidden'); void load(); }}><span className="public-manage-menu-icon">◌</span><span><strong>Hidden Users</strong><small>Manage people whose public-chat messages are hidden from you.</small></span><b>›</b></button>
        <button type="button" className="leave" onClick={() => void leaveRoom()} disabled={submitting}><span className="public-manage-menu-icon">↪</span><span><strong>{submitting ? 'Leaving…' : 'Leave Chat / Leave Room'}</strong><small>Leave this public room. You can rejoin unless restricted.</small></span><b>›</b></button>
      </div> : screen === 'users' ? <div className="public-manage-list">
        {users.map(renderUser)}
        {!loading && !users.length && <p className="public-manage-empty">No users are currently online in this room.</p>}
      </div> : screen === 'hidden' ? <div className="public-manage-list">
        {hiddenUsers.map(item => <div className="public-manage-user-row" key={item.id}>
          <div className="public-manage-avatar fallback"><span>{item.name?.[0]?.toUpperCase() || 'U'}</span></div>
          <div className="public-manage-user-meta"><strong>{item.name || 'Member'}</strong><small>Hidden in all public chats</small></div>
          <button type="button" className="public-manage-friend-btn" disabled={busyUserId === Number(item.id)} onClick={() => void unhide(item)}>{busyUserId === Number(item.id) ? 'Please wait…' : 'Unhide'}</button>
        </div>)}
        {!loading && !hiddenUsers.length && <p className="public-manage-empty">You have no hidden users.</p>}
      </div> : <div className="public-manage-report">
        <label htmlFor="public-report-user">Select participant</label>
        <div className="public-manage-participants">
          {participants.filter(item => Number(item.id) !== Number(user?.id)).map(item => <button type="button" key={item.id} className={Number(selectedUser?.id) === Number(item.id) ? 'selected' : ''} onClick={() => setSelectedUser(item)}><span className={item.online ? 'online-dot' : 'offline-dot'} /><span>{item.name || 'Member'}</span><small>{item.online ? 'Online now' : 'Participant'}</small></button>)}
          {!loading && !participants.some(item => Number(item.id) !== Number(user?.id)) && <p className="public-manage-empty">No other participants are available to report.</p>}
        </div>
        <label htmlFor="public-report-reason">Reason</label>
        <select id="public-report-reason" value={reason} onChange={event => setReason(event.target.value)}>{REPORT_REASONS.map(item => <option key={item}>{item}</option>)}</select>
        <label htmlFor="public-report-details">Additional details (optional)</label>
        <textarea id="public-report-details" value={details} onChange={event => setDetails(event.target.value)} maxLength={2000} rows={4} placeholder="Describe what happened…" />
        <button type="button" className="public-manage-submit" disabled={!selectedUser || submitting} onClick={() => void submitReport()}>{submitting ? 'Submitting…' : 'Submit Report'}</button>
      </div>}
      <footer className="public-manage-footer"><button type="button" onClick={goBack}>{screen === 'menu' ? 'Close' : 'Back to Manage'}</button></footer>
    </section>
  </div>;
}
