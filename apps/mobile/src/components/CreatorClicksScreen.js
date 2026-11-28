import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { platformApi } from '../services/platform';
import { resolveChatTheme } from '../services/chatTheme';

const reactions = ['👍','❤️','😂','🔥','👏','😍','😮','😢'];

export default function CreatorClicksScreen({ user, themeSettings, onBack }) {
  const theme = resolveChatTheme(themeSettings);
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

  const publish = async () => {
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await platformApi.publishCreatorClick(body.trim());
      setBody('');
      await load();
      setTab('profile');
    } catch (e) { setError(e.message || 'Unable to publish this broadcast.'); }
    finally { setBusy(false); }
  };

  const follow = async creator => {
    setBusy(true); setError('');
    try {
      if (creator.is_following) await platformApi.unfollowCreator(creator.user_id);
      else await platformApi.followCreator(creator.user_id);
      await load();
    } catch (e) { setError(e.message || 'Unable to update your follow.'); }
    finally { setBusy(false); }
  };

  const react = async (post, reaction) => {
    try { await platformApi.reactToCreatorClick(post.id, reaction); await load(); }
    catch (e) { setError(e.message || 'Unable to save reaction.'); }
  };

  const openProfile = async creatorId => {
    setBusy(true); setError('');
    try {
      const result = await platformApi.getCreatorClicksProfile(creatorId);
      setProfile(result?.data?.profile || null);
      setPosts(result?.data?.posts || []);
      setTab('profile');
    } catch (e) { setError(e.message || 'Unable to open creator profile.'); }
    finally { setBusy(false); }
  };

  const card = [styles.card, { backgroundColor: theme.colors.surface || theme.colors.panel || theme.colors.background, borderColor: theme.colors.border }];
  const textColor = theme.colors.text;
  const mutedColor = theme.colors.secondary || '#64748b';

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to chats"><Text style={[styles.back, { color: theme.colors.accent }]}>‹ Back</Text></Pressable>
        <Text style={[styles.heading, { color: textColor }]}>Creator Clicks</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {['feed','discover','profile'].map(value => <Pressable key={value} onPress={() => { setTab(value); if (value !== 'profile') load(); if (value === 'profile') openProfile(Number(user?.id)); }} style={[styles.tab, { borderColor: tab === value ? theme.colors.accent : theme.colors.border, backgroundColor: tab === value ? theme.colors.panel : 'transparent' }]}><Text style={{ color: textColor, fontWeight: '700' }}>{value === 'feed' ? 'Following feed' : value === 'discover' ? 'Discover' : 'My channel'}</Text></Pressable>)}
        <View style={[styles.tab, styles.comingSoon]}><Text style={{ color: mutedColor, fontWeight: '700' }}>Live Streaming · Coming Soon</Text></View>
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 10 }} /> : null}
      {tab === 'feed' ? <ScrollView contentContainerStyle={styles.content}>
        {posts.map(post => <View key={post.id} style={card}><Text style={[styles.cardTitle, { color: textColor }]}>{post.display_name || post.name || 'Creator'}</Text><Text style={[styles.postBody, { color: textColor }]}>{post.body}</Text><View style={styles.reactions}>{reactions.map(item => <Pressable key={item} onPress={() => react(post, item)} style={[styles.reaction, { borderColor: theme.colors.border }]}><Text>{item}</Text></Pressable>)}</View><Text style={{ color: mutedColor, marginTop: 8 }}>{post.reaction_count || 0} reactions · {post.view_count || 0} views</Text></View>)}
        {!posts.length ? <Text style={{ color: mutedColor, padding: 16 }}>No broadcasts yet. Discover and follow creators.</Text> : null}
      </ScrollView> : null}
      {tab === 'discover' ? <ScrollView contentContainerStyle={styles.content}>{creators.map(creator => <View key={creator.user_id} style={[card, styles.creatorRow]}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: textColor }]}>{creator.display_name}</Text><Text style={{ color: mutedColor }}>{creator.bio || creator.category} · {creator.follower_count} followers</Text></View><Pressable onPress={() => follow(creator)} disabled={busy || Number(creator.user_id) === Number(user?.id)} style={[styles.smallButton, { borderColor: theme.colors.border }]}><Text style={{ color: textColor }}>{creator.is_following ? 'Following' : 'Follow'}</Text></Pressable><Pressable disabled={!creator.is_following && Number(creator.user_id) !== Number(user?.id)} onPress={() => openProfile(creator.user_id)} style={[styles.smallButton, { borderColor: theme.colors.border, opacity: creator.is_following || Number(creator.user_id) === Number(user?.id) ? 1 : 0.55 }]}><Text style={{ color: textColor }}>{creator.is_following || Number(creator.user_id) === Number(user?.id) ? "View" : "Follow to view"}</Text></Pressable></View>)}{!creators.length ? <Text style={{ color: mutedColor, padding: 16 }}>No creator channels are available yet.</Text> : null}</ScrollView> : null}
      {tab === 'profile' ? <ScrollView contentContainerStyle={styles.content}>
        <View style={card}>
          {profile ? <><Text style={[styles.cardTitle, { color: textColor }]}>{profile.display_name}</Text><Text style={{ color: textColor, marginVertical: 8 }}>{profile.bio || 'Welcome to my Creator Clicks channel.'}</Text><Text style={{ color: mutedColor }}>{profile.follower_count} followers · {profile.post_count} broadcasts {profile.badge ? '· ' + profile.badge + ' milestone' : ''}</Text></> : <><Text style={{ color: textColor }}>You have not created your Creator Clicks channel yet.</Text><Pressable disabled={busy} onPress={createProfile} style={[styles.primary, { backgroundColor: theme.colors.accent, marginTop: 12 }]}><Text style={styles.primaryText}>Create my channel</Text></Pressable></>}
        </View>
        {profile ? <View style={card}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Publish a broadcast</Text>
          <TextInput multiline value={body} onChangeText={setBody} maxLength={300} placeholder="Share an update with your followers…" placeholderTextColor={mutedColor} style={[styles.input, { color: textColor, borderColor: theme.colors.border }]} />
          <Text style={{ color: mutedColor, marginBottom: 10 }}>{Array.from(body).length}/300 characters · 90-day expiry</Text>
          <Pressable disabled={busy || !body.trim()} onPress={publish} style={[styles.primary, { backgroundColor: theme.colors.accent }]}><Text style={styles.primaryText}>Publish</Text></Pressable>
        </View> : null}
      </ScrollView> : null}
      <Text style={[styles.footer, { color: mutedColor }]}>Creator Clicks is separate from Chats and Moments. Live Streaming is not available yet.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { fontSize: 16, fontWeight: '700' },
  heading: { fontSize: 19, fontWeight: '800' },
  tabs: { paddingHorizontal: 12, paddingVertical: 12, gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 12 },
  comingSoon: { opacity: 0.65 },
  content: { padding: 14, paddingBottom: 28 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 10, padding: 12, textAlignVertical: 'top', marginVertical: 10 },
  primary: { padding: 12, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  postBody: { fontSize: 15, lineHeight: 22, marginVertical: 10 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reaction: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', margin: 12, padding: 10, borderRadius: 8 },
  footer: { padding: 12, fontSize: 11, textAlign: 'center' },
});
