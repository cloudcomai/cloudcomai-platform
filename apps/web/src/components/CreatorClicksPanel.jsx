import React, { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../services/platform';

const reactions = ['👍','❤️','😂','🔥','👏','😍','😮','😢'];
const buttonStyle = { border: '1px solid #d7deeb', borderRadius: 10, padding: '9px 13px', background: '#fff', color: '#172033', cursor: 'pointer', fontWeight: 650 };
const cardStyle = { border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff', marginBottom: 12 };

export default function CreatorClicksPanel({ user, close }) {
  const [tab, setTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [profile, setProfile] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [feed, directory, own] = await Promise.all([
        platformApi.listCreatorClicksFeed(),
        platformApi.listCreatorDirectory(),
        platformApi.getCreatorClicksProfile(Number(user?.id)),
      ]);
      setPosts(feed?.data?.posts || []);
      setCreators(directory?.data?.creators || []);
      setProfile(own?.data?.profile || null);
    } catch (e) {
      try {
        const [feed, directory] = await Promise.all([platformApi.listCreatorClicksFeed(), platformApi.listCreatorDirectory()]);
        setPosts(feed?.data?.posts || []);
        setCreators(directory?.data?.creators || []);
      } catch (inner) { setError(inner?.message || e?.message || 'Unable to load Creator Clicks.'); }
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const createProfile = async () => {
    setBusy(true); setError('');
    try {
      const result = await platformApi.saveCreatorClicksProfile({ display_name: user?.name || 'Creator', bio: '', category: 'Creator' });
      setProfile(result?.data?.profile || null);
      await load();
    } catch (e) { setError(e.message || 'Unable to create your creator profile.'); }
    finally { setBusy(false); }
  };

  const publish = async event => {
    event?.preventDefault?.();
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await platformApi.publishCreatorClick(body.trim());
      setBody('');
      await load();
      setTab('feed');
    } catch (e) { setError(e.message || 'Unable to publish this broadcast.'); }
    finally { setBusy(false); }
  };

  const toggleFollow = async creator => {
    setBusy(true); setError('');
    try {
      if (creator.is_following) await platformApi.unfollowCreator(creator.user_id);
      else await platformApi.followCreator(creator.user_id);
      await load();
    } catch (e) { setError(e.message || 'Unable to update your follow.'); }
    finally { setBusy(false); }
  };

  const react = async (post, reaction) => {
    try {
      await platformApi.reactToCreatorClick(post.id, reaction);
      await load();
    } catch (e) { setError(e.message || 'Unable to save reaction.'); }
  };

  const openCreator = async creatorId => {
    setBusy(true); setError('');
    try {
      const result = await platformApi.getCreatorClicksProfile(creatorId);
      setProfile(result?.data?.profile || null);
      setPosts(result?.data?.posts || []);
      setTab('profile');
    } catch (e) { setError(e.message || 'Unable to open creator profile.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="modal-content-card creator-clicks-panel" role="dialog" aria-modal="true" aria-label="Creator Clicks" style={{ width: 'min(900px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 22 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div><p style={{ margin: '0 0 4px', color: '#64748b', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>CLOUDCOMAI</p><h2 style={{ fontSize: 22, fontWeight: 800, color: '#172033', margin: 0 }}>Creator Clicks</h2><p style={{ margin: '5px 0 0', color: '#64748b' }}>Discover creators and follow their broadcasts.</p></div>
        <button type="button" style={buttonStyle} onClick={close} aria-label="Close Creator Clicks">✕</button>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {['feed','discover','profile'].map(value => <button key={value} type="button" style={{ ...buttonStyle, background: tab === value ? '#eaf0ff' : '#fff', borderColor: tab === value ? '#3157d5' : '#d7deeb' }} onClick={() => { setTab(value); if (value !== 'profile') load(); if (value === 'profile') openCreator(Number(user?.id)); }}>{value === 'feed' ? 'Following feed' : value === 'discover' ? 'Discover creators' : 'My channel'}</button>)}
        <span style={{ flex: 1 }} />
        <button type="button" disabled style={{ ...buttonStyle, opacity: .7, cursor: 'not-allowed' }}>Live Streaming · Coming Soon</button>
      </div>
      {error ? <p role="alert" style={{ color: '#b91c1c', background: '#fef2f2', padding: 10, borderRadius: 8 }}>{error}</p> : null}
      {tab === 'feed' && <>
        {!profile ? <div style={cardStyle}><strong>Start your creator channel</strong><p style={{ color: '#64748b' }}>Create a channel profile before publishing broadcasts.</p><button type="button" style={{ ...buttonStyle, background: '#3157d5', color: '#fff' }} disabled={busy} onClick={createProfile}>Create my channel</button></div> : <form onSubmit={publish} style={cardStyle}><strong>Publish a broadcast</strong><textarea value={body} onChange={e => setBody(e.target.value)} maxLength={300} placeholder="Share an update with your followers…" rows={3} style={{ display: 'block', width: '100%', margin: '10px 0', padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, resize: 'vertical', boxSizing: 'border-box' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><small style={{ color: '#64748b' }}>{[...body].length}/300 characters · Posts expire after 90 days</small><button type="submit" style={{ ...buttonStyle, background: '#3157d5', color: '#fff' }} disabled={busy || !body.trim()}>Publish</button></div></form>}
        {posts.length ? posts.map(post => <article key={post.id} style={cardStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><button type="button" onClick={() => openCreator(post.creator_id)} style={{ border: 0, padding: 0, background: 'transparent', fontWeight: 750, cursor: 'pointer' }}>{post.display_name || post.name || 'Creator'}</button><small style={{ color: '#64748b' }}>{post.created_at}</small></div><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{post.body}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{reactions.map(item => <button key={item} type="button" style={{ ...buttonStyle, padding: '5px 9px' }} onClick={() => react(post, item)}>{item}</button>)}<small style={{ alignSelf: 'center', color: '#64748b' }}>{post.reaction_count || 0} reactions · {post.view_count || 0} views</small></div></article>) : <p style={{ color: '#64748b' }}>No broadcasts yet. Follow a creator or publish your first update.</p>}
      </>}
      {tab === 'discover' && <div>{creators.length ? creators.map(creator => <article key={creator.user_id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 22, display: 'grid', placeItems: 'center', background: '#eaf0ff', color: '#3157d5', fontWeight: 800 }}>{(creator.display_name || creator.name || 'C').slice(0,1).toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><strong>{creator.display_name}</strong><p style={{ margin: '3px 0', color: '#64748b' }}>{creator.bio || creator.category} · {creator.follower_count} followers</p></div><button type="button" style={buttonStyle} disabled={busy || Number(creator.user_id) === Number(user?.id)} onClick={() => toggleFollow(creator)}>{creator.is_following ? 'Following' : 'Follow'}</button><button type="button" style={buttonStyle} disabled={!creator.is_following && Number(creator.user_id) !== Number(user?.id)} onClick={() => openCreator(creator.user_id)}>{creator.is_following || Number(creator.user_id) === Number(user?.id) ? "View" : "Follow to view"}</button></article>) : <p style={{ color: '#64748b' }}>No creator channels are available yet.</p>}</div>}
      {tab === 'profile' && <div style={cardStyle}>{profile ? <><h3 style={{ marginTop: 0 }}>{profile.display_name}</h3><p>{profile.bio || 'Welcome to my Creator Clicks channel.'}</p><p style={{ color: '#64748b' }}>{profile.follower_count} followers · {profile.post_count} broadcasts {profile.badge ? '· ' + profile.badge + ' creator milestone' : ''}</p><button type="button" style={buttonStyle} onClick={() => openCreator(Number(user?.id))}>Refresh channel</button></> : <><p>You have not created a Creator Clicks channel yet.</p><button type="button" style={buttonStyle} disabled={busy} onClick={createProfile}>Create my channel</button></>}</div>}
      <footer style={{ marginTop: 16, color: '#64748b', fontSize: 12 }}>Creator Clicks is separate from Chats and Moments. Live Streaming is not available yet.</footer>
    </section>
  );
}
