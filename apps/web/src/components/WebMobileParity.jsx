import React, { useEffect, useMemo, useRef, useState } from 'react';
import { platformApi, mediaUrl } from '../services/platform';

export function ForwardMessageDialog({ message, onClose }) {
  const [chats, setChats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([platformApi.listChats('private'), platformApi.listChats('group')])
      .then(results => { if (active) setChats(results.flatMap(result => result.data?.chats || [])); })
      .catch(e => { if (active) setError(e.message || 'Unable to load chats.'); });
    return () => { active = false; };
  }, []);
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const forward = async () => {
    if (!selected.length || busy) return;
    setBusy(true); setError('');
    try { await platformApi.forwardMessage(message.id, selected); onClose(); }
    catch (e) { setError(e.message || 'Unable to forward message.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-overlay"><div className="modal-content-card parity-dialog" role="dialog" aria-modal="true" aria-label="Forward message">
    <h3>Forward message</h3><p>Select one or more conversations.</p>
    <div className="parity-list">{chats.map(chat => <label key={chat.id}><input type="checkbox" checked={selected.includes(Number(chat.id))} onChange={() => toggle(Number(chat.id))}/><span>{chat.name || 'Conversation'}</span></label>)}</div>
    {error && <p role="alert" className="privacy-error">{error}</p>}
    <div className="parity-actions"><button onClick={forward} disabled={!selected.length || busy}>{busy ? 'Forwarding…' : 'Forward'}</button><button onClick={onClose} disabled={busy}>Cancel</button></div>
  </div></div>;
}

export function MessageReadStatusDialog({ message, onClose }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; platformApi.getMessageReadStatus(message.id).then(({data: result}) => active && setData(result)).catch(e => active && setError(e.message || 'Unable to load read status.')); return () => { active = false; }; }, [message.id]);
  const readers = data?.readers || data?.read_by || [];
  return <div className="modal-overlay"><div className="modal-content-card parity-dialog" role="dialog" aria-modal="true" aria-label="Message info">
    <h3>Message info</h3>{error && <p role="alert" className="privacy-error">{error}</p>}
    {!data && !error ? <p>Loading…</p> : <div className="parity-list">{readers.length ? readers.map((reader, index) => <div key={reader.user_id || index} className="parity-reader"><strong>{reader.name || reader.user_name || 'Member'}</strong><small>{reader.read_at || reader.created_at || 'Read'}</small></div>) : <p>No read receipts yet.</p>}</div>}
    <button onClick={onClose}>Close</button>
  </div></div>;
}

export function UserProfileDialog({ userId, currentUserId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [trustBusy, setTrustBusy] = useState(false);
  const trustRequestRef = useRef(false);
  useEffect(() => {
    let active = true;
    setProfile(null); setTrusted(false); setRelationship(null); setError('');
    Promise.all([platformApi.getUserProfile(userId), platformApi.getFriendRelationship(userId)])
      .then(([p, r]) => { if (active) { const nextProfile = p.data?.user || p.data?.profile || p.data; setProfile(nextProfile); setTrusted(Boolean(nextProfile?.trusted_user)); setRelationship(r.data?.relationship || r.data); } })
      .catch(e => active && setError(e.message || 'Unable to load profile.'));
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const status = String(relationship?.status || relationship?.relationship || 'none').toLowerCase();
  const direction = relationship?.direction || relationship?.request_direction;
  const requestId = Number(relationship?.request_id || relationship?.id || 0);
  const act = async action => {
    setBusy(true); setError('');
    try {
      if (action === 'send') {
        const result = await platformApi.sendFriendRequest(userId);
        setRelationship(result.data?.relationship || { status: 'pending', direction: 'outgoing', request_id: result.data?.request_id });
      } else {
        if (!requestId) throw new Error('The friend request could not be identified. Refresh and try again.');
        const result = await platformApi.respondToFriendRequest(requestId, action);
        setRelationship(result.data?.relationship || (action === 'accept' ? { status: 'accepted' } : { status: 'none' }));
      }
    } catch (e) { setError(e.message || 'Unable to update friendship.'); }
    finally { setBusy(false); }
  };
  const toggleTrustedUser = async () => {
    const profileRelationship = String(profile?.relationship?.status || '').toLowerCase();
    const blocked = status === 'blocked' || profileRelationship === 'blocked' || profile?.blocked === true || profile?.is_blocked === true;
    if (!profile || trustBusy || trustRequestRef.current || Number(userId) === Number(currentUserId) || profileRelationship === 'self' || blocked) return;
    const next = !trusted;
    if (next && !window.confirm(`Allow ${profile.name || profile.username || 'this user'} to receive, download, save, and forward attachments you send without approval?`)) return;
    trustRequestRef.current = true;
    setTrustBusy(true);
    setError('');
    try {
      if (next) await platformApi.trustUser(userId);
      else await platformApi.untrustUser(userId);
      setTrusted(next);
    } catch (e) {
      setError(e.message || 'Unable to update Trusted User.');
    } finally {
      trustRequestRef.current = false;
      setTrustBusy(false);
    }
  };
  const image = profile?.image_url || profile?.profile_image_url || profile?.avatar_url || (profile?.id ? mediaUrl('user', profile.id) : '');
  const name = profile?.display_name || profile?.name || profile?.username || 'User profile';
  const fields = [['Age', profile?.age_private ? null : profile?.age], ['Gender', profile?.gender_private ? null : profile?.gender]].filter(([, value]) => value !== null && value !== undefined && value !== '');
  return <div className="modal-overlay profile-popup-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <div className="modal-content-card parity-dialog profile-popup-card" role="dialog" aria-modal="true" aria-label="User profile">
      <button type="button" className="profile-popup-close" aria-label="Close profile" onClick={onClose}>×</button>
      {image && <img className="profile-popup-avatar" src={image} alt={name} onError={event => { event.currentTarget.style.display = 'none'; }} />}
      <h3>{name}</h3>
      {profile?.username && <p className="profile-popup-handle">@{String(profile.username).replace(/^@/, '')}</p>}
      {error && <p role="alert" className="privacy-error">{error}</p>}
      {!profile && !error ? <p>Loading…</p> : <div className="parity-profile">{fields.map(([label, value]) => <p key={label}><strong>{label}:</strong> {value}</p>)}{profile?.bio && <p>{profile.bio}</p>}</div>}
      {Number(userId) === Number(currentUserId) ? <p className="profile-friend-status">This is your profile</p> : status === 'accepted' || status === 'friends' ? <p className="profile-friend-status">Friends</p>
        : status === 'pending' && direction === 'incoming' ? <div className="parity-actions"><button disabled={busy} onClick={() => act('accept')}>Accept</button><button disabled={busy} onClick={() => act('decline')}>Decline</button></div>
        : status === 'pending' ? <div className="parity-actions"><span className="profile-friend-status">Request Sent</span><button disabled={busy || !requestId} onClick={() => act('cancel')}>{busy ? 'Please wait…' : 'Cancel Request'}</button></div>
        : <button disabled={busy || !profile} onClick={() => act('send')}>{busy ? 'Sending…' : 'Add Friend'}</button>}
      {profile && Number(userId) !== Number(currentUserId) && status !== 'blocked' && profile?.relationship?.status !== 'self' && profile?.relationship?.status !== 'blocked' && profile?.blocked !== true && profile?.is_blocked !== true && <section className="privacy-section" style={{ width: '100%', marginTop: 12, textAlign: 'left' }}>
        <label className="privacy-toggle-row">
          <span><strong>Trusted User</strong><small>Allow this user to receive, download, save, and forward attachments you send without approval.</small></span>
          <input type="checkbox" checked={trusted} disabled={trustBusy} onChange={toggleTrustedUser} aria-label="Trusted User" />
        </label>
      </section>}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  </div>;
}

export function ProfileImageDialog({ imageUrl, name, onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-overlay profile-image-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="modal-content-card profile-image-dialog" role="dialog" aria-modal="true" aria-label={name + ' profile picture'}>
      <header><strong>{name}</strong><button type="button" aria-label="Close image" onClick={onClose}>×</button></header>
      <img src={imageUrl} alt={name + ' profile'} />
    </section>
  </div>;
}

export function ChatThemeControl({ chatId }) {
  const key = `cloudcomai.web.chat-theme.${chatId || 'none'}`;
  const [theme, setTheme] = useState(() => localStorage.getItem(key) || 'default');
  useEffect(() => { setTheme(localStorage.getItem(key) || 'default'); }, [key]);
  const change = value => { setTheme(value); localStorage.setItem(key, value); document.querySelector('.chat-interaction-canvas')?.setAttribute('data-chat-theme', value); };
  useEffect(() => { document.querySelector('.chat-interaction-canvas')?.setAttribute('data-chat-theme', theme); }, [theme, chatId]);
  return <select aria-label="Chat theme" value={theme} onChange={event => change(event.target.value)} disabled={!chatId}><option value="default">Default theme</option><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="sunset">Sunset</option><option value="midnight">Midnight</option></select>;
}
