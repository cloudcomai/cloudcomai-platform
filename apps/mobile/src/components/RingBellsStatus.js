import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { platformApi } from '../services/platform';
import { isRingBellsActive, ringBellsRemainingLabel } from '../utils/ringBells';

export default function RingBellsStatus({ refreshToken = 0 }) {
  const [stories, setStories] = useState([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listStories();
      setStories((data.stories || []).filter(item => isRingBellsActive(item?.expires_at)));
    } catch (e) {
      setError(e.message || 'Unable to load Ring Bells.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { load(true); setNow(Date.now()); }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const post = async () => {
    const content = composer.trim();
    if (!content || posting) return;
    setPosting(true);
    setError('');
    try {
      await platformApi.createStory({ type: 'text', content, audience: 'friends' });
      setComposer('');
      await load(true);
    } catch (e) {
      setError(e.message || 'Unable to publish Ring Bells.');
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => { if (refreshToken > 0) load(true); }, [refreshToken, load]);

  const visibleStories = useMemo(() => stories.filter(item => isRingBellsActive(item.expires_at, now)), [stories, now]);

  if (loading) return <ActivityIndicator style={styles.loader} color="#3157d5" />;

  return (
    <View style={[styles.container, styles.content]}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Text style={styles.heroBell}>🔔</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Ring Bells</Text>
          <Text style={styles.heroSubtitle}>Share a moment with friends. Each Ring Bell stays visible for up to 36 hours.</Text>
        </View>
      </View>

      <View style={styles.composeCard}>
        <Text style={styles.sectionTitle}>Create a Ring Bell</Text>
        <TextInput value={composer} onChangeText={setComposer} style={styles.input} placeholder="What’s happening?" placeholderTextColor="#94a3b8" multiline maxLength={700} accessibilityLabel="Ring Bells status text" />
        <View style={styles.composeFooter}>
          <Text style={styles.counter}>{composer.length}/700</Text>
          <Pressable disabled={!composer.trim() || posting} onPress={post} style={[styles.postButton, (!composer.trim() || posting) && styles.disabled]}><Text style={styles.postButtonText}>{posting ? 'Posting…' : 'Ring the Bell'}</Text></Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.sectionTitle}>Recent Ring Bells</Text>
      {!visibleStories.length ? <View style={styles.empty}><Text style={styles.emptyIcon}>🔔</Text><Text style={styles.emptyTitle}>No Ring Bells yet</Text><Text style={styles.emptyText}>Be the first to share an update.</Text></View> : null}
      {visibleStories.map(item => (
        <View key={String(item.id)} style={styles.storyCard}>
          <View style={styles.storyHeader}>
            <View style={styles.storyAvatar}><Text style={styles.storyAvatarText}>{String(item.name || 'C')[0]?.toUpperCase()}</Text></View>
            <View style={styles.storyIdentity}><Text style={styles.storyName}>{item.name || 'CloudComAI user'}</Text><Text style={styles.storyTime}>{ringBellsRemainingLabel(item.expires_at, now)}</Text></View>
            <Text style={styles.storyBell}>🔔</Text>
          </View>
          <Text style={styles.storyContent}>{item.content}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f9fd' }, content: { padding: 14, paddingBottom: 32 }, loader: { marginTop: 50 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#3157d5', marginBottom: 14 }, heroIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginRight: 13 }, heroBell: { fontSize: 28 }, heroCopy: { flex: 1 }, heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' }, heroSubtitle: { color: '#dbe4ff', marginTop: 4, lineHeight: 18, fontSize: 12 },
  composeCard: { padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e8f2', marginBottom: 16 }, sectionTitle: { color: '#172033', fontSize: 16, fontWeight: '900', marginBottom: 10 }, input: { minHeight: 96, maxHeight: 150, padding: 13, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', backgroundColor: '#fbfcff', textAlignVertical: 'top' }, composeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, counter: { color: '#94a3b8', fontSize: 11 }, postButton: { minHeight: 42, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, postButtonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.5 }, error: { marginBottom: 12, padding: 10, borderRadius: 9, color: '#b91c1c', backgroundColor: '#fee2e2' },
  storyCard: { padding: 15, marginBottom: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5eaf4' }, storyHeader: { flexDirection: 'row', alignItems: 'center' }, storyAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' }, storyAvatarText: { color: '#3157d5', fontSize: 16, fontWeight: '900' }, storyIdentity: { flex: 1, marginLeft: 10 }, storyName: { color: '#172033', fontSize: 14, fontWeight: '800' }, storyTime: { marginTop: 3, color: '#64748b', fontSize: 11 }, storyBell: { fontSize: 19 }, storyContent: { marginTop: 12, color: '#273449', fontSize: 15, lineHeight: 22 }, empty: { alignItems: 'center', padding: 32, borderRadius: 16, backgroundColor: '#fff' }, emptyIcon: { fontSize: 30, marginBottom: 8 }, emptyTitle: { color: '#172033', fontWeight: '900', fontSize: 15 }, emptyText: { marginTop: 4, color: '#718096', fontSize: 12 },
});
