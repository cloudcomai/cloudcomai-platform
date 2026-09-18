import React, { useEffect, useMemo, useState } from 'react';
import { platformApi } from '../services/platform';

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

export function UserProfileDialog({ userId, onClose }) {
  const [profile, setProfile] = useState(null); const [relationship, setRelationship] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; Promise.all([platformApi.getUserProfile(userId), platformApi.getFriendRelationship(userId)]).then(([p,r]) => { if(active){setProfile(p.data?.user || p.data?.profile || p.data);setRelationship(r.data);}}).catch(e => active && setError(e.message || 'Unable to load profile.')); return () => { active = false; }; }, [userId]);
  const sendRequest = async () => { setBusy(true); try { await platformApi.sendFriendRequest(userId); setRelationship({status:'pending'}); } catch(e){setError(e.message || 'Unable to send friend request.');} finally{setBusy(false);} };
  const fields = useMemo(() => profile ? [['Age',profile.age],['Gender',profile.gender],['Email',profile.email],['Mobile',profile.mobile],['Qualification',profile.qualification]].filter(([,v]) => v) : [], [profile]);
  return <div className="modal-overlay"><div className="modal-content-card parity-dialog" role="dialog" aria-modal="true" aria-label="User profile">
    <h3>{profile?.name || 'User profile'}</h3>{error && <p role="alert" className="privacy-error">{error}</p>}
    {!profile && !error ? <p>Loading…</p> : <div className="parity-profile">{fields.map(([label,value]) => <p key={label}><strong>{label}:</strong> {value}</p>)}</div>}
    {profile && !['accepted','friends','pending'].includes(String(relationship?.status || relationship?.relationship || '').toLowerCase()) && <button disabled={busy} onClick={sendRequest}>{busy ? 'Sending…' : 'Add friend'}</button>}
    <button onClick={onClose}>Close</button>
  </div></div>;
}

export function ChatThemeControl({ chatId }) {
  const key = `cloudcomai.web.chat-theme.${chatId || 'none'}`;
  const [theme, setTheme] = useState(() => localStorage.getItem(key) || 'default');
  useEffect(() => { setTheme(localStorage.getItem(key) || 'default'); }, [key]);
  const change = value => { setTheme(value); localStorage.setItem(key, value); document.querySelector('.chat-interaction-canvas')?.setAttribute('data-chat-theme', value); };
  useEffect(() => { document.querySelector('.chat-interaction-canvas')?.setAttribute('data-chat-theme', theme); }, [theme, chatId]);
  return <select aria-label="Chat theme" value={theme} onChange={event => change(event.target.value)} disabled={!chatId}><option value="default">Default theme</option><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="sunset">Sunset</option><option value="midnight">Midnight</option></select>;
}
