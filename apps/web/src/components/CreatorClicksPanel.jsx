import React, { useCallback, useEffect, useState } from 'react';
import { platformApi, fetchApiBlob } from '../services/platform';

const reactions = ['👍','❤️','😂','🔥','👏','😍','😮','😢'];
const buttonStyle = { border: '1px solid #d7deeb', borderRadius: 10, padding: '9px 13px', background: '#fff', color: '#172033', cursor: 'pointer', fontWeight: 650 };
const cardStyle = { border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff', marginBottom: 12 };

function CreatorClickAvatar({ userId, kind = 'creator', size = 42 }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    fetchApiBlob('v1/creator-clicks/profile-media', { user_id: userId, kind })
      .then(blob => { if (active && blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
      .catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [userId, kind]);
  return url
    ? <img src={url} alt={kind === 'channel' ? 'Channel picture' : 'Creator picture'} style={{ width: size, height: size, borderRadius: kind === 'channel' ? 10 : '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div aria-hidden="true" style={{ width: size, height: size, borderRadius: kind === 'channel' ? 10 : '50%', background: '#eaf0ff', display: 'grid', placeItems: 'center', color: '#3157d5', fontWeight: 800, flexShrink: 0 }}>C</div>;
}

function CreatorClickMedia({ item, postId }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    fetchApiBlob('v1/creator-clicks/media', { post_id: postId, file: item.filename })
      .then(blob => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [postId, item.filename]);
  if (!url) return <p style={{ color: '#64748b' }}>Loading media…</p>;
  return item.type === 'video'
    ? <video src={url} controls playsInline style={{ width: '100%', maxHeight: 420, borderRadius: 10 }} />
    : <img src={url} alt="Creator post" style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 10 }} />;
}

export default function CreatorClicksPanel({ user, close }) {
  const [tab, setTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [discoverPosts, setDiscoverPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [body, setBody] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState('');
  const [channelAvatarUrl, setChannelAvatarUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [feed, directory, own] = await Promise.all([
        platformApi.listCreatorClicksFeed(),
        platformApi.listCreatorDirectory(),
        platformApi.listCreatorClicksDiscoverFeed(),
        platformApi.getCreatorClicksProfile(Number(user?.id)),
      ]);
      setPosts(feed?.data?.posts || []);
      setCreators(directory?.data?.creators || []);
      setDiscoverPosts(discover?.data?.posts || []);
      setProfile(own?.data?.profile || null);
    } catch (e) {
      try {
        const [feed, directory, discover] = await Promise.all([platformApi.listCreatorClicksFeed(), platformApi.listCreatorDirectory(), platformApi.listCreatorClicksDiscoverFeed()]);
        setPosts(feed?.data?.posts || []);
        setCreators(directory?.data?.creators || []);
        setDiscoverPosts(discover?.data?.posts || []);
      } catch (inner) { setError(inner?.message || e?.message || 'Unable to load Creator Clicks.'); }
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let active = true;
    let creatorObjectUrl = '';
    let channelObjectUrl = '';
    const loadPictures = async () => {
      if (!profile?.user_id) { setCreatorAvatarUrl(''); setChannelAvatarUrl(''); return; }
      try {
        const blob = await fetchApiBlob('v1/creator-clicks/profile-media', { user_id: profile.user_id, kind: 'creator' });
        if (active && blob) { creatorObjectUrl = URL.createObjectURL(blob); setCreatorAvatarUrl(creatorObjectUrl); }
      } catch { if (active) setCreatorAvatarUrl(''); }
      try {
        const blob = await fetchApiBlob('v1/creator-clicks/profile-media', { user_id: profile.user_id, kind: 'channel' });
        if (active && blob) { channelObjectUrl = URL.createObjectURL(blob); setChannelAvatarUrl(channelObjectUrl); }
      } catch { if (active) setChannelAvatarUrl(''); }
    };
    void loadPictures();
    return () => { active = false; if (creatorObjectUrl) URL.revokeObjectURL(creatorObjectUrl); if (channelObjectUrl) URL.revokeObjectURL(channelObjectUrl); };
  }, [profile?.user_id, profile?.avatar_path, profile?.channel_avatar_path]);

  const uploadProfilePicture = async (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Creator profile pictures must be 5 MB or smaller.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      await platformApi.uploadCreatorClicksProfilePicture(form);
      await openCreator(Number(user?.id));
    } catch (e) { setError(e.message || 'Unable to update the creator picture.'); }
    finally { setBusy(false); }
  };


  useEffect(() => {
    const urls = selectedMedia.map(file => URL.createObjectURL(file));
    setMediaPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [selectedMedia]);

  const chooseMedia = event => {
    const files = Array.from(event.target.files || []);
    if (mediaType === 'image') {
      if (files.length > 5) { setError('Choose no more than 5 images per post.'); event.target.value = ''; return; }
      if (files.some(file => file.size > 10 * 1024 * 1024)) { setError('Each image must be 10 MB or smaller.'); event.target.value = ''; return; }
    } else if (mediaType === 'video' && files.length > 1) {
      setError('Choose one video per post.'); event.target.value = ''; return;
    }
    setError('');
    setSelectedMedia(files);
  };

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
    if ((mediaType === 'text' && !body.trim()) || busy) return;
    setBusy(true); setError('');
    try {
      if (mediaType === 'text') {
        await platformApi.publishCreatorClick(body.trim());
      } else {
        if (!selectedMedia.length) throw new Error('Choose media before publishing.');
        if (mediaType === 'video' && selectedMedia.length !== 1) throw new Error('Choose one video per post.');
        const uploaded = [];
        for (const file of selectedMedia) {
          const form = new FormData();
          form.append('file', file);
          const response = await platformApi.uploadCreatorClicksMedia(form);
          const media = response?.data || {};
          if (!media.filename || !media.type) throw new Error('The media upload did not return a valid file.');
          uploaded.push(media);
        }
        await platformApi.publishCreatorClickMedia({ content_type: mediaType, body: body.trim(), media: uploaded });
      }
      setBody('');
      setSelectedMedia([]);
      setMediaType('text');
      await load();
      await openCreator(Number(user?.id));
      setTab('profile');
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

  const deletePost = async post => {
    if (Number(post.creator_id) !== Number(user?.id)) return;
    if (!window.confirm('Delete this post? Only this selected post will be deleted. Your Creator Clicks channel and other posts will remain.')) return;
    setBusy(true); setError('');
    try {
      await platformApi.deleteCreatorClick(post.id);
      setPosts(current => current.filter(item => Number(item.id) !== Number(post.id)));
      if (Number(profile?.user_id) === Number(user?.id)) {
        const refreshed = await platformApi.getCreatorClicksProfile(Number(user.id));
        setProfile(refreshed?.data?.profile || null);
        setPosts(refreshed?.data?.posts || []);
      }
    } catch (e) { setError(e.message || 'Unable to delete this post.'); }
    finally { setBusy(false); }
  };

  const deleteChannel = async () => {
    if (Number(profile?.user_id) !== Number(user?.id)) return;
    const channelName = profile?.channel_name || profile?.display_name || 'my channel';
    if (!window.confirm('Delete the entire Creator Clicks channel "' + channelName + '"? This removes its posts and followers. Your CloudComAI account, chats, contacts and Moments will remain.')) return;
    const typed = window.prompt('Type the channel name to confirm deletion: ' + channelName);
    if (typed !== channelName) return;
    setBusy(true); setError('');
    try {
      await platformApi.deleteCreatorClicksChannel();
      setProfile(null);
      setPosts([]);
      await load();
      setTab('profile');
    } catch (e) { setError(e.message || 'Unable to delete your Creator Clicks channel.'); }
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
        {posts.length ? posts.map(post => <article key={post.id} style={cardStyle}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><button type="button" onClick={() => openCreator(post.creator_id)} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 0, padding: 0, background: 'transparent', fontWeight: 750, cursor: 'pointer' }}><CreatorClickAvatar userId={post.creator_id} /><span>{post.display_name || post.name || 'Creator'}</span></button><small style={{ color: '#64748b' }}>{post.created_at}</small></div><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{post.body}</p>{(post.media || []).map(item => <CreatorClickMedia key={item.filename} item={item} postId={post.id} />)}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{reactions.map(item => <button key={item} type="button" style={{ ...buttonStyle, padding: '5px 9px' }} onClick={() => react(post, item)}>{item}</button>)}<small style={{ alignSelf: 'center', color: '#64748b' }}>{post.reaction_count || 0} reactions · {post.view_count || 0} views</small></div></article>) : <p style={{ color: '#64748b' }}>No broadcasts yet. Follow a creator or publish your first update.</p>}
      </>}
      {tab === 'discover' && <div>{creators.length ? creators.map(creator => <article key={creator.user_id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}><CreatorClickAvatar userId={creator.user_id} /><div style={{ flex: 1, minWidth: 0 }}><strong>{creator.display_name}</strong><p style={{ margin: '3px 0', color: '#64748b' }}>{creator.bio || creator.category} · {creator.follower_count} followers</p></div><button type="button" style={buttonStyle} disabled={busy || Number(creator.user_id) === Number(user?.id)} onClick={() => toggleFollow(creator)}>{creator.is_following ? 'Following' : 'Follow'}</button><button type="button" style={buttonStyle} disabled={!creator.is_following && Number(creator.user_id) !== Number(user?.id)} onClick={() => openCreator(creator.user_id)}>{creator.is_following || Number(creator.user_id) === Number(user?.id) ? "View" : "Follow to view"}</button></article>) : <p style={{ color: '#64748b' }}>No creator channels are available yet.</p>}
        {discoverPosts.map(post => <article key={post.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <CreatorClickAvatar userId={post.creator_id} />
            <strong>{post.display_name || post.name || 'Creator'}</strong>
            <span style={{ flex: 1 }} />
            <button type="button" style={buttonStyle} disabled={busy} onClick={() => toggleFollow({ user_id: post.creator_id, is_following: false })}>Follow</button>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{post.body}</p>
          {(post.media || []).map(item => <CreatorClickMedia key={item.filename} item={item} postId={post.id} />)}
          <small style={{ color: '#64748b' }}>{post.reaction_count || 0} reactions · {post.view_count || 0} views</small>
        </article>)}
      </div>}
      {tab === 'profile' && <>
        <div style={cardStyle}>
          {profile ? <><div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {creatorAvatarUrl ? <img src={creatorAvatarUrl} alt="Creator profile" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eaf0ff', display: 'grid', placeItems: 'center' }}>Creator</div>}
          {channelAvatarUrl ? <img src={channelAvatarUrl} alt="Channel profile" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} /> : null}
          {Number(profile.user_id) === Number(user?.id) ? <div><label style={{ display: 'block', fontSize: 12 }}>Creator picture <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadProfilePicture(event, 'creator')} /></label><label style={{ display: 'block', fontSize: 12, marginTop: 6 }}>Channel picture <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadProfilePicture(event, 'channel')} /></label></div> : null}
        </div><h3 style={{ marginTop: 12 }}>{profile.channel_name || profile.display_name}</h3><p>{profile.bio || 'Welcome to my Creator Clicks channel.'}</p><p style={{ color: '#64748b' }}>{profile.follower_count} followers · {profile.post_count} broadcasts {profile.badge ? '· ' + profile.badge + ' creator milestone' : ''}</p>{Number(profile.user_id) === Number(user?.id) ? <><button type="button" style={buttonStyle} onClick={() => openCreator(Number(user?.id))}>Refresh channel</button><button type="button" style={{ ...buttonStyle, marginLeft: 8, borderColor: '#b91c1c', color: '#b91c1c' }} disabled={busy} onClick={deleteChannel}>Delete Channel</button></> : null}</> : <><p>You have not created your Creator Clicks channel yet.</p><button type="button" style={{ ...buttonStyle, background: '#3157d5', color: '#fff' }} disabled={busy} onClick={createProfile}>Create my channel</button></>}
        </div>
        {profile ? <form onSubmit={publish} style={cardStyle}>
          <strong>Publish a broadcast</strong>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={300} placeholder="Share an update with your followers…" rows={3} style={{ display: 'block', width: '100%', margin: '10px 0', padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {['text','image','video'].map(type => <button key={type} type="button" style={{ ...buttonStyle, background: mediaType === type ? '#eaf0ff' : '#fff' }} onClick={() => { setMediaType(type); setSelectedMedia([]); }}>{type === 'text' ? 'Text' : type === 'image' ? 'Images' : 'Video'}</button>)}
          </div>
          {mediaType !== 'text' ? <>
            <input type="file" accept={mediaType === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/quicktime,video/webm'} multiple={mediaType === 'image'} onChange={chooseMedia} />
            {mediaPreviews.map((url, index) => <div key={url} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, margin: '8px 8px 8px 0' }}>
              {mediaType === 'image' ? <img src={url} alt={'Selected image ' + (index + 1)} style={{ width: 104, height: 88, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>{selectedMedia[index]?.name}</span>}
              <button type="button" style={{ ...buttonStyle, padding: '4px 8px' }} onClick={() => setSelectedMedia(current => current.filter((_, i) => i !== index))}>Remove</button>
            </div>)}
            <small style={{ display: 'block', color: '#64748b' }}>{mediaType === 'image' ? 'Up to 5 images · 10 MB each' : 'One video · maximum 160 seconds'}</small>
          </> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><small style={{ color: '#64748b' }}>{[...body].length}/300 characters · Posts expire after 90 days</small><button type="submit" style={{ ...buttonStyle, background: '#3157d5', color: '#fff' }} disabled={busy || (mediaType === 'text' ? !body.trim() : !selectedMedia.length)}>Publish</button></div>
        </form> : null}
        {posts.length ? posts.map(post => <article key={post.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <small style={{ color: '#64748b' }}>{post.created_at}</small>
            {Number(post.creator_id) === Number(user?.id) ? <button type="button" style={{ ...buttonStyle, color: '#b91c1c', borderColor: '#fecaca' }} disabled={busy} onClick={() => deletePost(post)}>Delete Post</button> : null}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{post.body}</p>
          {(post.media || []).map(item => <CreatorClickMedia key={item.filename} item={item} postId={post.id} />)}
          <small style={{ color: '#64748b' }}>{post.reaction_count || 0} reactions · {post.view_count || 0} views</small>
        </article>) : null}
      </>}
      <footer style={{ marginTop: 16, color: '#64748b', fontSize: 12 }}>Creator Clicks is separate from Chats and Moments. Live Streaming is not available yet.</footer>
    </section>
  );
}
