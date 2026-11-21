import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { API_BASE_URL, platformApi, sessionManager } from '../services/platform';

const MAX_TEXT = 500;
const MAX_PHOTO = 12 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 90;

function mediaUrl(id) {
  const url = new URL(ApiRoute.STORY_MEDIA, `${API_BASE_URL}/`);
  url.searchParams.set('story_id', String(id));
  return url.toString();
}

export default function MomentsPanel({ close, onOpenChat }) {
  const [stories, setStories] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [audience, setAudience] = useState('contacts');
  const [groupIds, setGroupIds] = useState([]);
  const [kind, setKind] = useState('text');
  const [text, setText] = useState('');
  const [asset, setAsset] = useState(null);
  const [search, setSearch] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [activeStory, setActiveStory] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [storyResponse, contactResponse, groupResponse, privacyResponse] = await Promise.all([
        platformApi.listStories(), platformApi.listContacts(1, 500),
        platformApi.listGroups(), platformApi.getStoryPrivacy(),
      ]);
      setStories(storyResponse?.data?.stories || []);
      setContacts((contactResponse?.data?.contacts || []).filter(item => Number(item.registered_user_id || item.id) > 0));
      setGroups(groupResponse?.data?.groups || []);
      setHiddenIds((privacyResponse?.data?.hidden_user_ids || []).map(Number));
    } catch (e) { setError(e.message || 'Unable to load Moments.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(person => !q || `${person.display_name || ''} ${person.registered_name || ''} ${person.registered_user_id_text || ''}`.toLowerCase().includes(q));
  }, [contacts, search]);

  const chooseFile = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const video = file.type.startsWith('video/');
    if (!video && !file.type.startsWith('image/')) { setError('Choose an image or video file.'); return; }
    if (file.size > (video ? MAX_VIDEO : MAX_PHOTO)) { setError(video ? 'Videos must be 50 MB or smaller.' : 'Photos must be 12 MB or smaller.'); return; }
    if (video && file.duration > MAX_VIDEO_SECONDS) { setError('Videos must be 90 seconds or shorter.'); return; }
    setKind(video ? 'video' : 'photo');
    setAsset(file);
    setError('');
  };

  const publish = async () => {
    if (busy) return;
    if (kind === 'text' && !text.trim()) { setError('Write something before publishing.'); return; }
    if (kind === 'text' && [...text].length > MAX_TEXT) { setError('Text Moments are limited to 500 characters.'); return; }
    if (kind !== 'text' && !asset) { setError('Choose a photo or video first.'); return; }
    if (audience === 'groups' && !groupIds.length) { setError('Select at least one group.'); return; }
    setBusy(true); setError('');
    try {
      await platformApi.updateStoryPrivacy(hiddenIds);
      let content = text.trim();
      if (kind !== 'text') {
        const token = await sessionManager.getToken();
        const form = new FormData();
        form.append('file', asset);
        if (kind === 'video') {
          const duration = await new Promise(resolve => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(Math.ceil(video.duration)); };
            video.onerror = () => resolve(0);
            video.src = URL.createObjectURL(asset);
          });
          if (!duration || duration > MAX_VIDEO_SECONDS) throw new Error('Videos must be 90 seconds or shorter.');
          form.append('duration_seconds', String(duration));
        }
        form.append('original_filename', asset.name);
        const response = await fetch(new URL(ApiRoute.STORY_MEDIA_UPLOAD, `${API_BASE_URL}/`), {
          method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
        });
        const uploaded = await response.json();
        if (!response.ok) throw new Error(uploaded?.error || uploaded?.message || 'Media upload failed.');
        if (!uploaded?.filename) throw new Error('The media upload did not return a valid file.');
        content = { media_filename: uploaded.filename, caption: '' };
      }
      await platformApi.createStory({ type: kind, content, audience, group_ids: audience === 'groups' ? groupIds : [] });
      setText(''); setAsset(null); setKind('text'); setGroupIds([]);
      await load();
    } catch (e) { setError(e.message || 'Unable to publish this Moment.'); }
    finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!activeStory || activeStory.is_owner || !reply.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await platformApi.replyToStory(Number(activeStory.id), reply.trim());
      setReply('');
      if (result?.data?.chat_id) onOpenChat?.(Number(result.data.chat_id));
    } catch (e) { setError(e.message || 'Unable to send your reply.'); }
    finally { setBusy(false); }
  };

  const removeStory = async story => {
    if (!window.confirm('Delete this Moment for everyone?')) return;
    try { await platformApi.deleteStory(story.id); setStories(current => current.filter(item => Number(item.id) !== Number(story.id))); setActiveStory(null); }
    catch (e) { setError(e.message || 'Unable to delete this Moment.'); }
  };

  const savePrivacy = async () => {
    setBusy(true);
    try { await platformApi.updateStoryPrivacy(hiddenIds); setPrivacyOpen(false); }
    catch (e) { setError(e.message || 'Unable to save Moments privacy.'); }
    finally { setBusy(false); }
  };

  return <section className="moments-workspace" aria-label="Moments">
    <header className="moments-header"><div><span className="moments-eyebrow">SHARE UPDATES</span><h2>Moments</h2><p>Photos, videos and short updates that disappear after 36 hours.</p></div><div className="moments-header-actions"><button onClick={() => setPrivacyOpen(value => !value)}>Privacy</button><button className="moments-close" onClick={close} aria-label="Close Moments">×</button></div></header>
    {error && <p className="moments-error" role="alert">{error}</p>}
    <div className="moments-layout">
      <div className="moments-compose-card">
        <h3>Create a Moment</h3>
        <div className="moments-type-tabs">{['text','photo','video'].map(value => <button key={value} className={kind===value?'active':''} onClick={() => {setKind(value);setAsset(null);}}>{value==='text'?'Text':value==='photo'?'Photo':'Video'}</button>)}</div>
        {kind==='text' ? <textarea maxLength={MAX_TEXT} value={text} onChange={e=>setText(e.target.value)} placeholder="What would you like to share?" /> : <label className="moments-file-picker"><input type="file" accept={kind==='photo'?'image/*':'video/*'} onChange={chooseFile}/><span>{asset ? asset.name : `Choose a ${kind}`}</span><small>{kind==='photo'?'Maximum 12 MB':'Maximum 50 MB · 90 seconds'}</small></label>}
        {kind==='text' && <small className="moments-counter">{[...text].length}/500</small>}
        <div className="moments-audience"><label>Audience</label><select value={audience} onChange={e=>setAudience(e.target.value)}><option value="contacts">All Contacts</option><option value="groups">Selected Groups</option></select></div>
        {audience==='groups' && <div className="moments-group-options">{groups.map(group=><label key={group.id}><input type="checkbox" checked={groupIds.includes(Number(group.id))} onChange={e=>setGroupIds(current=>e.target.checked?[...current,Number(group.id)]:current.filter(id=>id!==Number(group.id)))}/>{group.name}</label>)}</div>}
        <button className="moments-publish" disabled={busy} onClick={publish}>{busy?'Publishing…':'Publish Moment'}</button>
      </div>
      <div className="moments-feed-card"><div className="moments-feed-heading"><h3>Recent Moments</h3><button onClick={load}>Refresh</button></div>
        {stories.length===0?<div className="moments-empty"><span>◌</span><strong>No Moments yet</strong><p>When your contacts share updates, they’ll appear here.</p></div>:<div className="moments-feed">{stories.map(story=><article key={story.id} className={Number(activeStory?.id)===Number(story.id)?'moment-row selected':'moment-row'}><button className="moment-open" onClick={async()=>{setActiveStory(story);try{await platformApi.viewStory(story.id);}catch{}}}><span className="moment-avatar">{String(story.user_name||story.name||'U').slice(0,1).toUpperCase()}</span><span className="moment-meta"><strong>{story.user_name||story.name||'CloudComAI user'}{story.is_owner?' · You':''}</strong><small>{story.type==='video'?'Video':story.type==='photo'?'Photo':story.content||story.caption||'Text Moment'}</small></span><span className="moment-time">{story.view_count||0} views</span></button>{story.is_owner&&<button className="moment-delete" onClick={()=>removeStory(story)}>Delete</button>}</article>)}</div>}
        {activeStory && <div className="moment-detail"><div className="moment-detail-head"><strong>{activeStory.user_name||activeStory.name||'Moment'}</strong><button onClick={()=>setActiveStory(null)}>Close</button></div>{activeStory.type==='photo'?<img src={mediaUrl(activeStory.id)} alt="Moment"/>:activeStory.type==='video'?<video src={mediaUrl(activeStory.id)} controls playsInline autoPlay muted />:<p>{activeStory.content||activeStory.caption}</p>}{!activeStory.is_owner&&<div className="moment-reply"><input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Send a reply…"/><button disabled={busy||!reply.trim()} onClick={sendReply}>Send</button></div>}</div>}
      </div>
    </div>
    {privacyOpen && <div className="moments-privacy"><div className="moments-privacy-head"><strong>Hide Moments from</strong><button onClick={()=>setPrivacyOpen(false)}>×</button></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your contacts"/><div className="moments-contact-list">{filteredContacts.map(person=>{const id=Number(person.registered_user_id||person.id);return <label key={id}><input type="checkbox" checked={hiddenIds.includes(id)} onChange={e=>setHiddenIds(current=>e.target.checked?[...current,id]:current.filter(value=>value!==id))}/><span>{person.display_name||person.registered_name||person.name||'Contact'}</span></label>;})}</div><button className="moments-publish" disabled={busy} onClick={savePrivacy}>Save privacy</button></div>}
  </section>;
}
