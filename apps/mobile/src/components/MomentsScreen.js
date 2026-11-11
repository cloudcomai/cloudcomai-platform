import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ApiRoute } from '@cloudcomai/api-client';
import { API_BASE_URL, platformApi, sessionManager, uploadMobileFile } from '../services/platform';
import { resolveChatTheme } from '../services/chatTheme';

const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 90;
const TEXT_MAX_LENGTH = 500;

function MomentVideo({ uri, token }) {
  const player = useVideoPlayer({ uri, headers: token ? { Authorization: `Bearer ${token}` } : {} }, instance => {
    instance.loop = false;
  });
  return <VideoView player={player} style={styles.viewerMedia} nativeControls contentFit="contain" />;
}

function MomentMedia({ story, token }) {
  const uri = `${API_BASE_URL}/v1/stories/media?story_id=${Number(story.id)}`;
  if (story.type === 'video') return <MomentVideo uri={uri} token={token} />;
  return <Image source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : {} }} style={styles.viewerMedia} resizeMode="contain" />;
}

export default function MomentsScreen({ onBack, themeSettings }) {
  const theme = resolveChatTheme(themeSettings);
  const [stories, setStories] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [asset, setAsset] = useState(null);
  const [audience, setAudience] = useState('contacts');
  const [groupIds, setGroupIds] = useState([]);
  const [hideExpanded, setHideExpanded] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedStory, setSelectedStory] = useState(null);

  const registeredContacts = useMemo(() => (contacts || []).filter(contact => Number(contact.registered_user_id || contact.id) > 0), [contacts]);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return registeredContacts;
    return registeredContacts.filter(contact => `${contact.display_name || ''} ${contact.registered_name || ''} ${contact.registered_user_id_text || ''}`.toLowerCase().includes(query));
  }, [registeredContacts, contactSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storyResponse, contactResponse, groupResponse, privacyResponse, authToken] = await Promise.all([
        platformApi.listStories(),
        platformApi.listContacts(1, 500),
        platformApi.listGroups(),
        platformApi.getStoryPrivacy(),
        sessionManager.getToken(),
      ]);
      setStories(storyResponse?.data?.stories || []);
      setContacts(contactResponse?.data?.contacts || []);
      setGroups(groupResponse?.data?.groups || []);
      setHiddenIds((privacyResponse?.data?.hidden_user_ids || []).map(Number));
      setToken(authToken || '');
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load Moments right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleId = (items, setter, id) => {
    const value = Number(id);
    setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const pickMedia = async nextType => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: nextType === 'photo' ? ['images'] : ['videos'],
        allowsEditing: false,
        quality: 0.9,
        videoMaxDuration: VIDEO_MAX_SECONDS,
        ...(Platform.OS === 'ios' && ImagePicker.UIImagePickerPreferredAssetRepresentationMode
          ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
          : {}),
      });
      if (result.canceled || !result.assets?.[0]) return;
      const picked = result.assets[0];
      if (nextType === 'photo' && Number(picked.fileSize || picked.size || 0) > PHOTO_MAX_BYTES) {
        throw new Error('Photos must be 12 MB or smaller.');
      }
      if (nextType === 'video') {
        const durationSeconds = Number(picked.duration || 0) / 1000;
        if (!durationSeconds || durationSeconds > VIDEO_MAX_SECONDS) throw new Error('Videos must be 90 seconds or shorter.');
      }
      setType(nextType);
      setAsset(picked);
      setText('');
    } catch (pickerError) {
      setError(pickerError?.message || 'Unable to select this media.');
    }
  };

  const savePrivacy = async () => {
    setBusy(true);
    setError('');
    try {
      await platformApi.updateStoryPrivacy(hiddenIds);
      Alert.alert('Privacy saved', 'Your Hide Status From list will remain active for future Moments.');
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save Moments privacy.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (busy) return;
    if (type === 'text' && !text.trim()) { setError('Write a message before publishing.'); return; }
    if (type === 'text' && [...text].length > TEXT_MAX_LENGTH) { setError('Text Moments are limited to 500 characters.'); return; }
    if (type !== 'text' && !asset) { setError('Choose a photo or video first.'); return; }
    if (audience === 'groups' && groupIds.length === 0) { setError('Select at least one group.'); return; }
    setBusy(true);
    setError('');
    try {
      // Save exclusions first so the server applies the persistent privacy rule immediately.
      await platformApi.updateStoryPrivacy(hiddenIds);
      let content = text.trim();
      if (type !== 'text') {
        const durationSeconds = type === 'video' ? Math.ceil(Number(asset.duration || 0) / 1000) : undefined;
        if (type === 'video' && (!durationSeconds || durationSeconds > VIDEO_MAX_SECONDS)) throw new Error('Videos must be 90 seconds or shorter.');
        const upload = await uploadMobileFile(ApiRoute.STORY_MEDIA_UPLOAD, { ...asset, size: asset.fileSize || asset.size }, {
          fieldName: 'file',
          fallbackName: type === 'video' ? 'moment.mp4' : 'moment.jpg',
          fallbackMime: type === 'video' ? 'video/mp4' : 'image/jpeg',
          maxBytes: type === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES,
          multipartPartMode: 'expo-file',
          parameters: type === 'video' ? { duration_seconds: durationSeconds } : {},
        });
        content = { media_filename: upload?.data?.filename, caption: '' };
        if (!content.media_filename) throw new Error('The media upload did not return a valid file.');
      }
      await platformApi.createStory({ type, content, audience, group_ids: audience === 'groups' ? groupIds : [] });
      setComposeOpen(false);
      setText('');
      setAsset(null);
      setType('text');
      setGroupIds([]);
      await load();
      Alert.alert('Moment published', 'Your Moment will disappear automatically after 36 hours.');
    } catch (publishError) {
      setError(publishError?.message || 'Unable to publish this Moment.');
    } finally {
      setBusy(false);
    }
  };

  const resetCompose = () => {
    setError('');
    setComposeOpen(false);
  };

  const renderAudience = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Who can see this Moment?</Text>
      <Pressable style={styles.choiceRow} onPress={() => setAudience('contacts')}>
        <Text style={styles.choiceIcon}>{audience === 'contacts' ? '◉' : '○'}</Text>
        <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>All Contacts</Text><Text style={styles.choiceHint}>People saved as CloudComAI contacts</Text></View>
      </Pressable>
      <Pressable style={styles.choiceRow} onPress={() => setAudience('groups')}>
        <Text style={styles.choiceIcon}>{audience === 'groups' ? '◉' : '○'}</Text>
        <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Selected Groups</Text><Text style={styles.choiceHint}>Only members of the groups you choose</Text></View>
      </Pressable>
      {audience === 'groups' ? (
        <View style={styles.nestedList}>
          {groups.length ? groups.map(group => <Pressable key={group.id} style={styles.checkRow} onPress={() => toggleId(groupIds, setGroupIds, group.id)}>
            <Text style={styles.checkMark}>{groupIds.includes(Number(group.id)) ? '☑' : '□'}</Text><Text style={styles.checkLabel}>{group.name || 'Group'}</Text>
          </Pressable>) : <Text style={styles.muted}>You are not currently a member of any groups.</Text>}
        </View>
      ) : null}
    </View>
  );

  const renderHiddenContacts = () => (
    <View style={styles.sectionCard}>
      <Pressable style={styles.dropdownHeader} onPress={() => setHideExpanded(value => !value)}>
        <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Hide Status From...</Text><Text style={styles.choiceHint}>{hiddenIds.length} contact{hiddenIds.length === 1 ? '' : 's'} hidden from your Moments</Text></View>
        <Text style={styles.chevron}>{hideExpanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {hideExpanded ? <>
        <TextInput value={contactSearch} onChangeText={setContactSearch} placeholder="Search contacts" placeholderTextColor="#8a94a6" style={styles.searchInput} />
        <View style={styles.nestedList}>
          {filteredContacts.map(contact => {
            const id = Number(contact.registered_user_id || contact.id);
            const selected = hiddenIds.includes(id);
            return <Pressable key={id} style={styles.checkRow} onPress={() => toggleId(hiddenIds, setHiddenIds, id)}>
              <Text style={styles.checkMark}>{selected ? '☑' : '□'}</Text>
              <View style={{ flex: 1 }}><Text style={styles.checkLabel}>{contact.display_name || contact.registered_name || 'Contact'}</Text><Text style={styles.muted}>@{contact.registered_user_id_text || id}</Text></View>
            </Pressable>;
          })}
          {!filteredContacts.length ? <Text style={styles.muted}>No registered contacts found.</Text> : null}
        </View>
        <Pressable style={styles.secondaryButton} disabled={busy} onPress={savePrivacy}><Text style={styles.secondaryButtonText}>{busy ? 'Saving…' : 'Save hidden contacts'}</Text></Pressable>
      </> : null}
    </View>
  );

  if (privacyOpen) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => setPrivacyOpen(false)} accessibilityLabel="Go back"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Moments Privacy</Text>
        <Pressable disabled={busy} onPress={savePrivacy}><Text style={[styles.publishText, busy && styles.disabled]}>{busy ? 'Saving…' : 'Save'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hide Status From...</Text>
          <Text style={styles.choiceHint}>These contacts will not see any of your current or future Moments until you remove them from this list.</Text>
          <TextInput value={contactSearch} onChangeText={setContactSearch} placeholder="Search contacts" placeholderTextColor="#8a94a6" style={styles.searchInput} />
          <View style={styles.nestedList}>
            {filteredContacts.map(contact => {
              const id = Number(contact.registered_user_id || contact.id);
              const selected = hiddenIds.includes(id);
              return <Pressable key={id} style={styles.checkRow} onPress={() => toggleId(hiddenIds, setHiddenIds, id)}>
                <Text style={styles.checkMark}>{selected ? '☑' : '□'}</Text>
                <View style={{ flex: 1 }}><Text style={styles.checkLabel}>{contact.display_name || contact.registered_name || 'Contact'}</Text><Text style={styles.muted}>@{contact.registered_user_id_text || id}</Text></View>
              </Pressable>;
            })}
            {!filteredContacts.length ? <Text style={styles.muted}>No registered contacts found.</Text> : null}
          </View>
          <Text style={styles.muted}>{hiddenIds.length} contacts currently hidden. Clear a selection to allow that contact to see future Moments.</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={savePrivacy}><Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Save privacy settings'}</Text></Pressable></View>
    </SafeAreaView>;
  }

  if (composeOpen) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={resetCompose} accessibilityLabel="Go back"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Moment</Text>
        <Pressable disabled={busy} onPress={publish}><Text style={[styles.publishText, busy && styles.disabled]}>{busy ? 'Publishing…' : 'Publish'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          {['text','photo','video'].map(value => <Pressable key={value} onPress={() => { setType(value); if (value === 'text') setAsset(null); else void pickMedia(value); }} style={[styles.typeButton, type === value && styles.typeButtonActive]}><Text style={[styles.typeButtonText, type === value && styles.typeButtonTextActive]}>{value === 'text' ? 'Text' : value === 'photo' ? 'Photo' : 'Video'}</Text></Pressable>)}
        </View>
        {type === 'text' ? <View style={styles.sectionCard}><TextInput multiline value={text} onChangeText={setText} maxLength={TEXT_MAX_LENGTH} placeholder="Share a moment..." placeholderTextColor="#8a94a6" style={styles.textArea} /><Text style={styles.counter}>{[...text].length}/500</Text></View> : (
          <View style={styles.sectionCard}>
            <Pressable style={styles.secondaryButton} onPress={() => pickMedia(type)}><Text style={styles.secondaryButtonText}>{asset ? 'Choose a different ' + type : 'Choose ' + type}</Text></Pressable>
            {asset ? <Text style={styles.muted}>{asset.fileName || asset.uri?.split('/').pop() || 'Selected media'}{type === 'video' ? ' · ' + Math.ceil(Number(asset.duration || 0) / 1000) + ' sec' : ''}</Text> : <Text style={styles.muted}>Maximum photo size: 12 MB. Maximum video duration: 90 seconds.</Text>}
          </View>
        )}
        {renderAudience()}
        {renderHiddenContacts()}
        <Text style={styles.expiryNote}>Every Moment expires automatically 36 hours after publishing.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={publish}><Text style={styles.primaryButtonText}>{busy ? 'Publishing…' : 'Publish Moment'}</Text></Pressable></View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
    <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <Pressable onPress={onBack} accessibilityLabel="Go back to Home"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Moments</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => setPrivacyOpen(true)}><Text style={styles.publishText}>Privacy</Text></Pressable>
        <Pressable onPress={() => setComposeOpen(true)}><Text style={styles.publishText}>＋ Create</Text></Pressable>
      </View>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.createCard} onPress={() => setComposeOpen(true)}>
        <View style={styles.createRing}><Text style={styles.createRingText}>＋</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.createTitle}>Add to your Moments</Text><Text style={styles.muted}>Share a photo, video or text update</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>Recent Moments</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.accent} /> : stories.length ? stories.map(story => (
        <Pressable key={story.id} style={styles.storyRow} onPress={() => setSelectedStory(story)}>
          <View style={[styles.storyRing, story.watched && styles.storyRingWatched]}><Text style={styles.storyRingText}>{String(story.name || 'U').slice(0,1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.storyName}>{story.is_owner ? 'Your Moment' : story.name || 'Contact'}</Text><Text numberOfLines={2} style={styles.muted}>{story.type === 'text' ? story.content || 'Text Moment' : story.type === 'video' ? 'Video Moment' : 'Photo Moment'} · expires {new Date(String(story.expires_at).replace(' ', 'T') + 'Z').toLocaleString()}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )) : <Text style={styles.empty}>No active Moments yet. Be the first to share one.</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.expiryNote}>Moments disappear 36 hours after publishing.</Text>
    </ScrollView>
    <Modal visible={Boolean(selectedStory)} transparent animationType="fade" onRequestClose={() => setSelectedStory(null)}>
      <View style={styles.viewerBackdrop}>
        <View style={styles.viewerCard}>
          <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{selectedStory?.is_owner ? 'Your Moment' : selectedStory?.name || 'Moment'}</Text><Pressable onPress={() => setSelectedStory(null)}><Text style={styles.close}>×</Text></Pressable></View>
          {selectedStory?.type === 'text' ? <Text style={styles.viewerText}>{selectedStory?.content}</Text> : selectedStory ? <MomentMedia story={selectedStory} token={token} /> : null}
          {selectedStory?.caption ? <Text style={styles.viewerCaption}>{selectedStory.caption}</Text> : null}
          {selectedStory?.is_owner ? <Text style={styles.muted}>Viewed by {selectedStory.view_count || 0} people</Text> : null}
          <Text style={styles.expiryNote}>Expires after 36 hours</Text>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1 },
  back: { width: 64, fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  publishText: { minWidth: 64, textAlign: 'right', color: '#3157d5', fontWeight: '800', fontSize: 14 },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  createCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#dbe4ff', borderRadius: 16, backgroundColor: '#f8faff' },
  createRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#3157d5', alignItems: 'center', justifyContent: 'center' },
  createRingText: { color: '#3157d5', fontSize: 26, fontWeight: '700' },
  createTitle: { color: '#172033', fontWeight: '800', fontSize: 15 },
  sectionTitle: { color: '#172033', fontWeight: '800', fontSize: 15 },
  sectionCard: { padding: 14, borderWidth: 1, borderColor: '#e3e8f2', borderRadius: 14, backgroundColor: '#fff', gap: 10 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' },
  typeButtonActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' },
  typeButtonText: { color: '#596579', fontWeight: '700' },
  typeButtonTextActive: { color: '#3157d5' },
  textArea: { minHeight: 140, color: '#172033', fontSize: 16, textAlignVertical: 'top' },
  counter: { color: '#68748a', textAlign: 'right', fontSize: 12 },
  choiceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceIcon: { color: '#3157d5', fontSize: 22, width: 28 },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: '#172033', fontWeight: '700', fontSize: 14 },
  choiceHint: { color: '#68748a', fontSize: 12, marginTop: 2 },
  nestedList: { paddingLeft: 8, borderTopWidth: 1, borderTopColor: '#edf0f5' },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#f0f2f6' },
  checkMark: { color: '#3157d5', fontSize: 20 },
  checkLabel: { color: '#172033', fontSize: 14, fontWeight: '600' },
  muted: { color: '#68748a', fontSize: 12, marginTop: 2 },
  dropdownHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  chevron: { color: '#3157d5', fontSize: 24, fontWeight: '700' },
  searchInput: { minHeight: 42, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, paddingHorizontal: 12, color: '#172033', marginVertical: 8 },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3157d5', borderRadius: 10, paddingHorizontal: 12 },
  secondaryButtonText: { color: '#3157d5', fontWeight: '700' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footer: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#edf0f5', backgroundColor: '#fff' },
  expiryNote: { color: '#68748a', fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  error: { color: '#b91c1c', fontSize: 13, padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
  disabled: { opacity: 0.55 },
  storyRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: '#edf0f5', borderRadius: 14, backgroundColor: '#fff' },
  storyRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#3157d5', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8faff' },
  storyRingWatched: { borderColor: '#cbd5e1' },
  storyRingText: { color: '#3157d5', fontWeight: '800', fontSize: 18 },
  storyName: { color: '#172033', fontSize: 14, fontWeight: '800' },
  empty: { color: '#68748a', textAlign: 'center', padding: 24, backgroundColor: '#f8faff', borderRadius: 12 },
  viewerBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.75)' },
  viewerCard: { padding: 14, borderRadius: 18, backgroundColor: '#fff', gap: 10 },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  close: { color: '#172033', fontSize: 28 },
  viewerMedia: { width: '100%', height: 420, backgroundColor: '#111827', borderRadius: 12 },
  viewerText: { color: '#172033', fontSize: 22, lineHeight: 30, paddingVertical: 28, textAlign: 'center' },
  viewerCaption: { color: '#172033', fontSize: 14 },
});
