import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { API_BASE_URL, platformApi, sessionManager, uploadMobileFile } from '../services/platform';
import { isRingBellsActive, ringBellsRemainingLabel } from '../utils/ringBells';

function StoryVideo({ uri }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  return <View style={styles.mediaFrame}><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls /></View>;
}

export default function RingBellsStatus({ refreshToken = 0 }) {
  const [stories, setStories] = useState([]);
  const [composer, setComposer] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [viewerStory, setViewerStory] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState({});

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listStories();
      setStories((data.stories || []).filter(item => isRingBellsActive(item?.expires_at)));
    } catch (e) {
      setError(e.message || 'Unable to load Ring Bells.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { load(true); setNow(Date.now()); }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => { if (refreshToken > 0) load(true); }, [refreshToken, load]);

  const pickMedia = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo and video access is required to create a Ring Bell.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: false, quality: 1, videoMaxDuration: 60 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const type = asset.type === 'video' ? 'video' : 'photo';
    setSelectedMedia({ ...asset, type });
    setMediaPreview(asset.uri);
  };

  const clearMedia = () => { setSelectedMedia(null); setMediaPreview(null); setCaption(''); };

  const postText = async () => {
    const content = composer.trim();
    if (!content || posting) return;
    setPosting(true); setError('');
    try { await platformApi.createStory({ type: 'text', content, audience: 'friends' }); setComposer(''); await load(true); }
    catch (e) { setError(e.message || 'Unable to publish Ring Bell.'); }
    finally { setPosting(false); }
  };

  const postMedia = async () => {
    if (!selectedMedia || posting) return;
    setPosting(true); setError('');
    try {
      const upload = await uploadMobileFile('v1/stories/media/upload', selectedMedia, { fieldName: 'file', fallbackName: selectedMedia.fileName || (selectedMedia.type === 'video' ? 'ring-bell.mp4' : 'ring-bell.jpg'), fallbackMime: selectedMedia.mimeType || (selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg'), maxBytes: 50 * 1024 * 1024 });
      await platformApi.createStory({ type: selectedMedia.type, content: { media_filename: upload.data.filename, caption: caption.trim() }, audience: 'friends' });
      clearMedia(); await load(true);
    } catch (e) { setError(e.message || 'Unable to publish Ring Bell media.'); }
    finally { setPosting(false); }
  };

  const markViewed = async story => {
    try {
      await platformApi.viewStory(Number(story.id));
      setStories(current => current.map(item => Number(item.id) === Number(story.id) ? { ...item, watched: true, view_count: Number(item.view_count || 0) + (story.is_owner ? 0 : 0) } : item));
    } catch (e) { setError(e.message || 'Unable to mark Ring Bell as viewed.'); }
  };

  const openStory = async story => {
    setViewerStory(story);
    await markViewed(story);
    if (story.media_url && !mediaCache[story.id]) {
      try {
        const token = await sessionManager.getToken();
        const directory = new Directory(Paths.cache, 'cloudcomai-ring-bells');
        directory.create({ intermediates: true, idempotent: true });
        const file = new File(directory, `${Number(story.id)}-${Date.now()}`);
        const result = await File.downloadFileAsync(`${API_BASE_URL}/${story.media_url}`, file, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setMediaCache(current => ({ ...current, [story.id]: result.uri }));
      } catch (e) { setError(e.message || 'Unable to load Ring Bell media.'); }
    }
  };

  const showViewers = async story => {
    if (!story.is_owner) return;
    setViewerLoading(true); setViewers([]);
    try { const { data } = await platformApi.listStoryViewers(Number(story.id)); setViewers(data.viewers || []); setViewerStory({ ...story, viewerList: true }); }
    catch (e) { setError(e.message || 'Unable to load viewers.'); }
    finally { setViewerLoading(false); }
  };

  const deleteStory = story => {
    if (!story.is_owner) return;
    Alert.alert('Delete this Ring Bell?', 'Nobody will be able to access it after deletion.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await platformApi.deleteStory(Number(story.id)); setStories(current => current.filter(item => Number(item.id) !== Number(story.id))); if (Number(viewerStory?.id) === Number(story.id)) setViewerStory(null); } catch (e) { setError(e.message || 'Unable to delete Ring Bell.'); } } },
    ]);
  };

  const visibleStories = useMemo(() => stories.filter(item => isRingBellsActive(item.expires_at, now)), [stories, now]);
  const unwatched = visibleStories.filter(item => !item.watched || item.is_owner);
  const watched = visibleStories.filter(item => item.watched && !item.is_owner);

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  const renderStory = item => {
    const media = mediaCache[item.id];
    return <View key={String(item.id)} style={styles.storyCard}>
      <Pressable onPress={() => openStory(item)} style={styles.storyHeader}>
        <View style={styles.storyAvatar}><Text style={styles.storyAvatarText}>{String(item.name || 'C')[0]?.toUpperCase()}</Text></View>
        <View style={styles.storyIdentity}><Text style={styles.storyName}>{item.name || 'CloudComAI user'}</Text><Text style={styles.storyTime}>{ringBellsRemainingLabel(item.expires_at, now)}</Text></View>
        <Text style={styles.storyStatus}>{item.watched && !item.is_owner ? 'Watched' : 'New'}</Text>
      </Pressable>
      {item.type === 'photo' && media ? <Image source={{ uri: media }} style={styles.mediaPreview} resizeMode="cover" /> : null}
      {item.type === 'video' && media ? <StoryVideo uri={media} /> : null}
      {item.type === 'photo' || item.type === 'video' ? <Text style={styles.storyContent}>{item.caption}</Text> : <Text style={styles.storyContent}>{item.content || ''}</Text>}
      <View style={styles.storyFooter}>
        <Pressable onPress={() => showViewers(item)} disabled={!item.is_owner}><Text style={[styles.count, !item.is_owner && styles.muted]}>Count: {Number(item.view_count || 0)}</Text></Pressable>
        {item.is_owner ? <Pressable onPress={() => deleteStory(item)}><Text style={styles.delete}>Delete</Text></Pressable> : null}
      </View>
    </View>;
  };

  return <View style={[styles.container, styles.content]}>
    <View style={styles.hero}><View style={styles.heroIcon}><Text style={styles.heroStatus}>✦</Text></View><View style={styles.heroCopy}><Text style={styles.heroTitle}>Ring Bells</Text><Text style={styles.heroSubtitle}>Temporary text, photo and video updates. Every Ring Bell expires after 36 hours.</Text></View></View>

    <View style={styles.composeCard}>
      <Text style={styles.sectionTitle}>Create a Ring Bell</Text>
      <TextInput value={composer} onChangeText={setComposer} style={styles.input} placeholder="Write a text update…" placeholderTextColor="#94a3b8" multiline maxLength={700} />
      <View style={styles.composeActions}><Pressable onPress={pickMedia} style={styles.secondaryButton}><Text style={styles.secondaryText}>Photo / Video</Text></Pressable><Pressable disabled={!composer.trim() || posting} onPress={postText} style={[styles.postButton, (!composer.trim() || posting) && styles.disabled]}><Text style={styles.postButtonText}>{posting ? 'Posting…' : 'Ring the Bell'}</Text></Pressable></View>
      {selectedMedia ? <View style={styles.selectedMediaCard}><Text style={styles.mediaType}>{selectedMedia.type === 'video' ? 'Video selected' : 'Photo selected'}</Text>{mediaPreview ? (selectedMedia.type === 'video' ? <Text style={styles.mediaFile}>{selectedMedia.fileName || 'Selected video'}</Text> : <Image source={{ uri: mediaPreview }} style={styles.mediaPreview} resizeMode="cover" />) : null}<TextInput value={caption} onChangeText={setCaption} style={styles.caption} placeholder="Optional caption" placeholderTextColor="#94a3b8" maxLength={700} /><View style={styles.composeActions}><Pressable onPress={clearMedia} style={styles.secondaryButton}><Text style={styles.secondaryText}>Remove</Text></Pressable><Pressable disabled={posting} onPress={postMedia} style={[styles.postButton, posting && styles.disabled]}><Text style={styles.postButtonText}>{posting ? 'Uploading…' : 'Post media'}</Text></Pressable></View></View> : null}
    </View>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.sectionTitle}>Unwatched</Text>
    {unwatched.length ? unwatched.map(renderStory) : <View style={styles.empty}><Text style={styles.emptyTitle}>No unwatched Ring Bells</Text></View>}
    <Text style={[styles.sectionTitle, styles.watchedHeading]}>Watched</Text>
    {watched.length ? watched.map(renderStory) : <View style={styles.empty}><Text style={styles.emptyTitle}>No watched Ring Bells</Text></View>}

    <Modal visible={Boolean(viewerStory)} animationType="slide" onRequestClose={() => setViewerStory(null)}><View style={styles.viewerModal}>
      <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{viewerStory?.viewerList ? 'Viewers' : viewerStory?.name || 'Ring Bell'}</Text><Pressable onPress={() => setViewerStory(null)}><Text style={styles.close}>×</Text></Pressable></View>
      {viewerStory?.viewerList ? (viewerLoading ? <ActivityIndicator color="#3157d5" /> : <ScrollView contentContainerStyle={styles.viewerList}>{viewers.map(viewer => <View key={String(viewer.viewer_id)} style={styles.viewerRow}><View style={styles.storyAvatar}><Text style={styles.storyAvatarText}>{String(viewer.name || 'C')[0]?.toUpperCase()}</Text></View><View style={styles.viewerMeta}><Text style={styles.storyName}>{viewer.name}</Text><Text style={styles.storyTime}>{viewer.viewed_at}</Text></View></View>)}</ScrollView>) : <ScrollView contentContainerStyle={styles.viewerBody}>{viewerStory?.type === 'photo' && mediaCache[viewerStory.id] ? <Image source={{ uri: mediaCache[viewerStory.id] }} style={styles.viewerMedia} resizeMode="contain" /> : null}{viewerStory?.type === 'video' && mediaCache[viewerStory.id] ? <StoryVideo uri={mediaCache[viewerStory.id]} /> : null}<Text style={styles.viewerText}>{viewerStory?.content || viewerStory?.caption || ''}</Text></ScrollView>}
    </View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  container:{backgroundColor:'#f7f9fd'},content:{padding:14,paddingBottom:32},loader:{marginTop:50},hero:{flexDirection:'row',alignItems:'center',padding:16,borderRadius:18,backgroundColor:'#3157d5',marginBottom:14},heroIcon:{width:54,height:54,borderRadius:27,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',marginRight:13},heroStatus:{fontSize:28,color:'#3157d5'},heroCopy:{flex:1},heroTitle:{color:'#fff',fontSize:22,fontWeight:'900'},heroSubtitle:{color:'#dbe4ff',marginTop:4,lineHeight:18,fontSize:12},composeCard:{padding:14,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3e8f2',marginBottom:16},sectionTitle:{color:'#172033',fontSize:16,fontWeight:'900',marginBottom:10},watchedHeading:{marginTop:16},input:{minHeight:96,maxHeight:150,padding:13,borderWidth:1,borderColor:'#d8deea',borderRadius:12,color:'#172033',backgroundColor:'#fbfcff',textAlignVertical:'top'},caption:{minHeight:46,padding:12,borderWidth:1,borderColor:'#d8deea',borderRadius:10,color:'#172033',marginTop:10},composeActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:10},secondaryButton:{minHeight:42,paddingHorizontal:14,alignItems:'center',justifyContent:'center',borderRadius:12,borderWidth:1,borderColor:'#3157d5',backgroundColor:'#fff'},secondaryText:{color:'#3157d5',fontWeight:'800'},postButton:{minHeight:42,paddingHorizontal:16,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#3157d5'},postButtonText:{color:'#fff',fontWeight:'800'},disabled:{opacity:.5},selectedMediaCard:{marginTop:12,padding:10,borderRadius:12,backgroundColor:'#f8faff'},mediaType:{color:'#3157d5',fontWeight:'800'},mediaFile:{marginTop:8,color:'#64748b',fontSize:12},mediaPreview:{width:'100%',height:220,borderRadius:12,backgroundColor:'#10131a',marginTop:8},mediaFrame:{height:220,borderRadius:12,overflow:'hidden',backgroundColor:'#10131a',marginTop:8},error:{marginBottom:12,padding:10,borderRadius:9,color:'#b91c1c',backgroundColor:'#fee2e2'},storyCard:{padding:15,marginBottom:10,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5eaf4'},storyHeader:{flexDirection:'row',alignItems:'center'},storyAvatar:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:'#eef2ff',overflow:'hidden'},storyAvatarText:{color:'#3157d5',fontSize:16,fontWeight:'900'},storyIdentity:{flex:1,marginLeft:10},storyName:{color:'#172033',fontSize:14,fontWeight:'800'},storyTime:{marginTop:3,color:'#64748b',fontSize:11},storyStatus:{color:'#3157d5',fontSize:11,fontWeight:'800'},storyContent:{marginTop:12,color:'#273449',fontSize:15,lineHeight:22},storyFooter:{marginTop:12,paddingTop:9,borderTopWidth:1,borderTopColor:'#edf0f5',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},count:{color:'#3157d5',fontWeight:'800'},muted:{color:'#94a3b8'},delete:{color:'#b91c1c',fontWeight:'800'},empty:{alignItems:'center',padding:24,borderRadius:16,backgroundColor:'#fff',marginBottom:10},emptyTitle:{color:'#172033',fontWeight:'800'},viewerModal:{flex:1,backgroundColor:'#f7f9fd',paddingTop:30},viewerHeader:{minHeight:58,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#3157d5'},viewerTitle:{color:'#fff',fontSize:18,fontWeight:'900'},close:{color:'#fff',fontSize:30},viewerList:{padding:14},viewerRow:{minHeight:64,flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#e5eaf4'},viewerMeta:{marginLeft:10},viewerBody:{padding:14},viewerMedia:{width:'100%',height:360,borderRadius:12,backgroundColor:'#10131a'},viewerText:{marginTop:14,color:'#172033',fontSize:16,lineHeight:23}
});
