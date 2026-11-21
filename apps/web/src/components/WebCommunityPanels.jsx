import React, { useEffect, useMemo, useState } from 'react';
import { platformApi } from '../services/platform';

export function PublicChatsPanel({ close, onOpenChat }) {
  const [rooms,setRooms]=useState([]); const [query,setQuery]=useState(''); const [busy,setBusy]=useState(0); const [error,setError]=useState('');
  const load=async()=>{setError('');try{const {data}=await platformApi.listPublicChats();setRooms(data.rooms||data.chats||[]);}catch(e){setError(e.message||'Unable to load public chats.');}};
  useEffect(()=>{load();},[]);
  const visible=useMemo(()=>{const q=query.trim().toLowerCase();return q?rooms.filter(room=>[room.name,room.city,room.language,room.category,room.description].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))):rooms;},[rooms,query]);
  const join=async room=>{setBusy(Number(room.id));try{const {data}=await platformApi.joinPublicChat(room.id);await load();onOpenChat?.(Number(data.chat?.id||data.room?.chat_id||room.chat_id||room.id));}catch(e){setError(e.message||'Unable to join room.');}finally{setBusy(0);}};
  const leave=async room=>{setBusy(Number(room.id));try{await platformApi.leavePublicChat(room.id);await load();}catch(e){setError(e.message||'Unable to leave room.');}finally{setBusy(0);}};
  return <div className="modal-content-card parity-community-panel"><h3>Public Chat Rooms</h3><input aria-label="Search public chats" placeholder="Search room, city, language, category or keyword" value={query} onChange={e=>setQuery(e.target.value)}/>{error&&<p role="alert" className="privacy-error">{error}</p>}<div className="parity-list">{visible.map(room=><article key={room.id} className="parity-room"><div><strong>{room.name}</strong><small>{[room.city,room.language,room.category].filter(Boolean).join(' · ')}</small></div><div>{room.joined||room.is_member?<><button disabled={busy===Number(room.id)} onClick={()=>onOpenChat?.(Number(room.chat_id||room.id))}>Open</button><button disabled={busy===Number(room.id)} onClick={()=>leave(room)}>Leave</button></>:<button disabled={busy===Number(room.id)} onClick={()=>join(room)}>Join</button>}</div></article>)}</div><button onClick={close}>Close</button></div>;
}
