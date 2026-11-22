import React, { useEffect, useMemo, useState } from 'react';
import { platformApi } from '../services/platform';

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
                  <small>👥 {Number(room.joined_count || 0)} Joined · 🟢 {Number(room.online_count || 0)} Online</small>
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
