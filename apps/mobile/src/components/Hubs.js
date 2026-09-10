import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient, mediaUrl } from '../services/platform';

const VIEWS = [
  ['discover', 'Discover'],
  ['my', 'My Hubs'],
  ['following', 'Following'],
  ['saved', 'Saved'],
];
const DISCOVER_TABS = [['for_you', 'For You'], ['following', 'Following'], ['trending', 'Trending'], ['people', 'People']];
const AUDIENCES = [['public', 'Public'], ['contacts', 'Contacts/Friends'], ['hub_members', 'Hub Members'], ['only_me', 'Only Me']];

export default function Hubs({ user, onClose, onOpenProfile }) {
  const [view, setView] = useState('discover');
  const [discoverTab, setDiscoverTab] = useState('for_you');
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [audience, setAudience] = useState('public');
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('v1/hubs', { query: { view, tab: discoverTab } });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setPeople(Array.isArray(data.people) ? data.people : []);
      setHubs(Array.isArray(data.hubs) ? data.hubs : []);
    } catch (e) {
      setError(e.message || 'Unable to load Hubs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, discoverTab]);

  useEffect(() => { load(); }, [load]);

  const submitPost = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const payload = { action: editingId ? 'edit' : 'create', post_id: editingId, text: draft.trim(), audience };
      const { data } = await apiClient.post('v1/hubs', payload);
      if (data.post) {
        setPosts(current => editingId ? current.map(item => Number(item.id) === Number(editingId) ? data.post : item) : [data.post, ...current]);
      }
      setDraft(''); setAudience('public'); setEditingId(null); setComposerOpen(false);
    } catch (e) { setError(e.message || 'Unable to publish post.'); }
    finally { setBusy(false); }
  };

  const act = async (action, post, extra = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post('v1/hubs', { action, post_id: post?.id, ...extra });
      if (action === 'react') setPosts(current => current.map(item => Number(item.id) === Number(post.id) ? { ...item, reacted: data.reacted, reaction_count: data.reaction_count } : item));
      if (action === 'save') setPosts(current => current.map(item => Number(item.id) === Number(post.id) ? { ...item, saved: data.saved } : item));
      if (action === 'comment' && data.post) setPosts(current => current.map(item => Number(item.id) === Number(post.id) ? data.post : item));
      if (action === 'delete') setPosts(current => current.filter(item => Number(item.id) !== Number(post.id)));
    } catch (e) { setError(e.message || 'Unable to update post.'); }
    finally { setBusy(false); }
  };

  const editPost = post => { setDraft(post.text || ''); setAudience(post.audience || 'public'); setEditingId(post.id); setComposerOpen(true); };
  const deletePost = post => Alert.alert('Delete post?', 'This will remove your post from Hubs.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => act('delete', post) }]);
  const reportPost = post => Alert.alert('Report post', 'Choose a reason.', [['Spam', 'spam'], ['Abuse or harassment', 'abuse'], ['Other', 'other']].map(([label, reason]) => ({ text: label, onPress: () => act('report', post, { reason }) })).concat([{ text: 'Cancel', style: 'cancel' }]));
  const blockUser = post => Alert.alert('Block user?', `You will no longer see posts from ${post.author_name || 'this user'}.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => act('block', post, { target_user_id: post.user_id }) }]);
  const comment = post => {
    Alert.prompt?.('Comment', 'Write a comment', text => { if (text?.trim()) act('comment', post, { text: text.trim() }); });
    if (!Alert.prompt) {
      Alert.alert('Comments', 'Comment composer is available on Android in the next interaction update.');
    }
  };

  const title = useMemo(() => view === 'my' ? 'My Hubs' : view === 'following' ? 'Following' : view === 'saved' ? 'Saved' : 'Discover', [view]);

  if (loading) return <View style={styles.screen}><ActivityIndicator style={styles.loader} color="#3157d5" /></View>;
  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={onClose} accessibilityLabel="Back"><Text style={styles.back}>‹</Text></Pressable>
      <Text style={styles.headerTitle}>Hubs</Text>
      <Pressable onPress={() => { setComposerOpen(true); setEditingId(null); setDraft(''); }}><Text style={styles.newPost}>＋ Post</Text></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewTabs}>
      {VIEWS.map(([key, label]) => <Pressable key={key} onPress={() => setView(key)} style={[styles.tab, view === key && styles.tabActive]}><Text style={[styles.tabText, view === key && styles.tabTextActive]}>{label}</Text></Pressable>)}
    </ScrollView>
    {view === 'discover' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
      {DISCOVER_TABS.map(([key, label]) => <Pressable key={key} onPress={() => setDiscoverTab(key)} style={[styles.subTab, discoverTab === key && styles.subTabActive]}><Text style={[styles.subTabText, discoverTab === key && styles.subTabTextActive]}>{label}</Text></Pressable>)}
    </ScrollView> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {composerOpen ? <View style={styles.composerCard}>
      <Text style={styles.composerTitle}>{editingId ? 'Edit post' : 'Create status'}</Text>
      <TextInput style={styles.composerInput} value={draft} onChangeText={setDraft} multiline maxLength={5000} placeholder="What's happening? Add text, emojis or a link…" placeholderTextColor="#8a94a6" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.audienceRow}>
        {AUDIENCES.map(([key, label]) => <Pressable key={key} onPress={() => setAudience(key)} style={[styles.audience, audience === key && styles.audienceActive]}><Text style={[styles.audienceText, audience === key && styles.audienceTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.composerActions}><Pressable onPress={() => { setComposerOpen(false); setDraft(''); setEditingId(null); }}><Text style={styles.cancel}>Cancel</Text></Pressable><Pressable disabled={busy || !draft.trim()} onPress={submitPost} style={styles.publish}><Text style={styles.publishText}>{busy ? 'Saving…' : editingId ? 'Save' : 'Publish'}</Text></Pressable></View>
    </View> : null}
    {view === 'discover' && discoverTab === 'people' ? <FlatList data={people} keyExtractor={item => String(item.id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No people to discover yet.</Text>} renderItem={({ item }) => <View style={styles.personRow}><View style={styles.avatar}><Image source={{ uri: mediaUrl('user', item.id, item.image_version) }} style={styles.avatarImage} /></View><Pressable style={styles.personMeta} onPress={() => onOpenProfile?.(item.id)}><Text style={styles.personName}>{item.name}</Text><Text style={styles.personSub}>{item.user_id ? `@${item.user_id}` : 'CloudComAI user'}</Text></Pressable><Pressable style={styles.follow} onPress={() => apiClient.post('v1/hubs', { action: 'follow', target_user_id: item.id }).catch(() => null)}><Text style={styles.followText}>{item.following ? 'Following' : 'Follow'}</Text></Pressable></View>} />
      : <FlatList data={posts} keyExtractor={item => String(item.id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} contentContainerStyle={styles.list} ListHeaderComponent={view === 'discover' ? <View style={styles.discoveryHeader}><Text style={styles.sectionTitle}>Trending</Text><Text style={styles.sectionSub}>Popular conversations and recommended Hubs appear here.</Text><View style={styles.discoveryCards}>{hubs.slice(0, 4).map(hub => <Pressable key={hub.id} style={styles.hubCard} onPress={() => apiClient.post('v1/hubs', { action: 'join_hub', hub_id: hub.id }).catch(() => null)}><Text style={styles.hubIcon}>◉</Text><Text numberOfLines={1} style={styles.hubName}>{hub.name}</Text><Text style={styles.hubMeta}>{hub.member_count || 0} members</Text></Pressable>)}</View></View> : null} ListEmptyComponent={<Text style={styles.empty}>No posts here yet.</Text>} renderItem={({ item }) => <View style={styles.postCard}>
        <Pressable style={styles.authorRow} onPress={() => onOpenProfile?.(item.user_id)}><View style={styles.avatar}><Image source={{ uri: mediaUrl('user', item.user_id, item.image_version) }} style={styles.avatarImage} /></View><View style={styles.authorMeta}><Text style={styles.authorName}>{item.author_name || 'CloudComAI user'}</Text><Text style={styles.authorHandle}>{item.author_user_id ? `@${item.author_user_id} · ` : ''}{item.created_at ? new Date(`${String(item.created_at).replace(' ', 'T')}Z`).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</Text></View></Pressable>
        <Text style={styles.postText}>{item.text}</Text>
        {item.link ? <Text style={styles.link}>{item.link}</Text> : null}
        {item.location ? <Text style={styles.location}>📍 {item.location}</Text> : null}
        <View style={styles.actionRow}><Pressable onPress={() => act('react', item)}><Text style={styles.action}>{item.reacted ? '♥' : '♡'} {item.reaction_count || 0}</Text></Pressable><Pressable onPress={() => comment(item)}><Text style={styles.action}>Comment {item.comment_count || 0}</Text></Pressable><Pressable onPress={() => act('share', item)}><Text style={styles.action}>Share</Text></Pressable><Pressable onPress={() => act('save', item)}><Text style={styles.action}>{item.saved ? 'Saved' : 'Save'}</Text></Pressable></View>
        <View style={styles.secondaryRow}><Pressable onPress={() => reportPost(item)}><Text style={styles.secondary}>Report</Text></Pressable>{Number(item.user_id) === Number(user?.id) ? <><Pressable onPress={() => editPost(item)}><Text style={styles.secondary}>Edit</Text></Pressable><Pressable onPress={() => deletePost(item)}><Text style={styles.secondaryDanger}>Delete</Text></Pressable></> : <Pressable onPress={() => blockUser(item)}><Text style={styles.secondary}>Block</Text></Pressable>}</View>
      </View>} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' }, loader: { marginTop: 60 },
  header: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' },
  back: { color: '#fff', fontSize: 32, width: 42 }, headerTitle: { color: '#fff', fontSize: 19, fontWeight: '900' }, newPost: { color: '#fff', fontWeight: '800' },
  viewTabs: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, backgroundColor: '#fff' }, tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 }, tabActive: { backgroundColor: '#eef2ff' }, tabText: { color: '#64748b', fontWeight: '700' }, tabTextActive: { color: '#3157d5' },
  subTabs: { paddingHorizontal: 10, paddingBottom: 8, gap: 6, backgroundColor: '#fff' }, subTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 }, subTabActive: { backgroundColor: '#e8edff' }, subTabText: { color: '#64748b', fontSize: 12, fontWeight: '700' }, subTabTextActive: { color: '#3157d5' },
  error: { margin: 10, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' }, composerCard: { margin: 10, padding: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, composerTitle: { color: '#172033', fontWeight: '900', marginBottom: 8 }, composerInput: { minHeight: 100, maxHeight: 180, padding: 12, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', textAlignVertical: 'top' }, audienceRow: { gap: 6, paddingVertical: 9 }, audience: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, borderWidth: 1, borderColor: '#d8deea' }, audienceActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, audienceText: { color: '#64748b', fontSize: 11, fontWeight: '700' }, audienceTextActive: { color: '#3157d5' }, composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }, cancel: { color: '#64748b', fontWeight: '700' }, publish: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#3157d5' }, publishText: { color: '#fff', fontWeight: '800' },
  list: { padding: 10, paddingBottom: 90 }, discoveryHeader: { paddingBottom: 8 }, sectionTitle: { color: '#172033', fontSize: 17, fontWeight: '900' }, sectionSub: { marginTop: 3, color: '#6b7280', fontSize: 12 }, discoveryCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, hubCard: { width: '48%', padding: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, hubIcon: { color: '#3157d5', fontSize: 18 }, hubName: { marginTop: 4, color: '#172033', fontWeight: '800' }, hubMeta: { marginTop: 3, color: '#64748b', fontSize: 10 },
  postCard: { marginBottom: 10, padding: 13, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }, authorRow: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }, avatarImage: { ...StyleSheet.absoluteFillObject, width: 42, height: 42 }, authorMeta: { flex: 1, marginLeft: 10 }, authorName: { color: '#172033', fontWeight: '800' }, authorHandle: { marginTop: 2, color: '#94a3b8', fontSize: 10 }, postText: { marginTop: 12, color: '#172033', fontSize: 15, lineHeight: 21 }, link: { marginTop: 8, color: '#3157d5' }, location: { marginTop: 7, color: '#64748b', fontSize: 12 }, actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#edf0f5' }, action: { color: '#3157d5', fontSize: 11, fontWeight: '800' }, secondaryRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 8 }, secondary: { color: '#64748b', fontSize: 10, fontWeight: '700' }, secondaryDanger: { color: '#b91c1c', fontSize: 10, fontWeight: '800' }, empty: { padding: 30, textAlign: 'center', color: '#718096' },
  personRow: { minHeight: 64, padding: 10, marginBottom: 8, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' }, personMeta: { flex: 1, marginLeft: 10 }, personName: { color: '#172033', fontWeight: '800' }, personSub: { marginTop: 3, color: '#64748b', fontSize: 11 }, follow: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#eef2ff' }, followText: { color: '#3157d5', fontWeight: '800', fontSize: 11 },
});
