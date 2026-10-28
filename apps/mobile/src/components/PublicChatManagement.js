import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { mediaUrl, platformApi } from '../services/platform';
import { resolveChatTheme } from '../services/chatThemeDefinitions';

const REASONS = ['Harassment', 'Spam', 'Hate or abusive content', 'Impersonation', 'Unsafe content', 'Other'];
const relationshipLabel = relationship => {
  const status = relationship?.status || 'none';
  if (status === 'accepted') return 'Friend';
  if (status === 'pending' && relationship?.direction === 'outgoing') return 'Request Sent';
  if (status === 'pending' && relationship?.direction === 'incoming') return 'Respond to Request';
  return 'Add as Friend';
};

export default function PublicChatManagement({ visible, chat, user, onClose, onLeave, themeSettings }) {
  const theme = resolveChatTheme(themeSettings);
  const [screen, setScreen] = useState('menu');
  const [users, setUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await platformApi.getPublicChatManage(chat.id);
      setUsers(Array.isArray(data.online_users) ? data.online_users : []);
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Unable to load room members.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [chat?.id]);

  useEffect(() => {
    if (!visible) {
      setScreen('menu'); setSelectedUser(null); setDetails(''); setError(''); setImageErrors({});
      return undefined;
    }
    let active = true;
    const refresh = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await platformApi.getPublicChatManage(chat.id);
        if (active) {
          setUsers(Array.isArray(data.online_users) ? data.online_users : []);
          setParticipants(Array.isArray(data.participants) ? data.participants : []);
          setError('');
        }
      } catch (e) {
        if (active) setError(e.message || 'Unable to load room members.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(true), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [visible, chat?.id]);

  const goBack = useCallback(() => {
    if (screen !== 'menu') {
      setScreen('menu');
      setSelectedUser(null);
      setDetails('');
      setError('');
      return true;
    }
    onClose?.();
    return true;
  }, [screen, onClose]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [visible, goBack]);

  const sendFriendRequest = async item => {
    const id = Number(item?.id);
    if (!id || id === Number(user?.id) || busyUserId !== null) return;
    const relationship = item.relationship || {};
    if (relationship.status === 'accepted') return;
    if (relationship.status === 'pending' && relationship.direction === 'outgoing') return;
    setBusyUserId(id); setError('');
    try {
      if (relationship.status === 'pending' && relationship.direction === 'incoming') {
        const requestId = Number(relationship.request_id);
        if (!requestId) throw new Error('The incoming friend request could not be identified. Refresh and try again.');
        await platformApi.respondToFriendRequest(requestId, 'accept');
        setUsers(current => current.map(person => Number(person.id) === id ? { ...person, relationship: { status: 'accepted' } } : person));
        setParticipants(current => current.map(person => Number(person.id) === id ? { ...person, relationship: { status: 'accepted' } } : person));
        return;
      }
      await platformApi.sendFriendRequest(id);
      setUsers(current => current.map(person => Number(person.id) === id ? { ...person, relationship: { status: 'pending', direction: 'outgoing' } } : person));
      setParticipants(current => current.map(person => Number(person.id) === id ? { ...person, relationship: { status: 'pending', direction: 'outgoing' } } : person));
    } catch (e) {
      // Refresh relationship state after conflicts (for example, a request sent from another screen).
      try {
        const { data } = await platformApi.getPublicChatManage(chat.id);
        setUsers(Array.isArray(data.online_users) ? data.online_users : []);
        setParticipants(Array.isArray(data.participants) ? data.participants : []);
      } catch {}
      setError(e.message || 'Unable to update friend request. Please try again.');
    } finally {
      setBusyUserId(null);
    }
  };

  const report = async () => {
    if (!selectedUser || Number(selectedUser.id) === Number(user.id) || submitting) return;
    setSubmitting(true); setError('');
    try {
      await platformApi.reportPublicChatUser(chat.id, {
        reported_user_id: Number(selectedUser.id), reason, details: details.trim(),
        incident_key: 'incident-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12),
      });
      Alert.alert('Report submitted', 'Your report was securely recorded for moderator review.');
      setSelectedUser(null); setDetails('');
    } catch (e) {
      setError(e.message || 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmLeave = () => Alert.alert('Leave this room?', 'You will leave this public chat room and can join again unless a moderation restriction prevents access.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave Room', style: 'destructive', onPress: onLeave },
  ]);
  const title = screen === 'menu' ? 'Manage Public Chat' : screen === 'users' ? 'Online Users' : 'Report User';

  const renderUser = item => {
    const name = item.name || 'CloudComAI user';
    const source = item.image_version ? { uri: `${mediaUrl('user', item.id)}&v=${encodeURIComponent(item.image_version)}` } : { uri: mediaUrl('user', item.id) };
    const relationship = item.relationship || { status: 'none' };
    const status = relationshipLabel(relationship);
    const busy = busyUserId === Number(item.id);
    const isSelf = Number(item.id) === Number(user?.id);
    return <View key={item.id} style={[styles.userRow, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.avatar}>
        {!imageErrors[item.id] ? <Image source={source} style={styles.avatarImage} onError={() => setImageErrors(current => ({ ...current, [item.id]: true }))} /> : <Text style={styles.avatarFallback}>{name[0]?.toUpperCase() || 'U'}</Text>}
      </View>
      <View style={styles.userMeta}>
        <Text style={[styles.userName, { color: theme.colors.text }]}>{name}</Text>
        <Text style={[styles.userSub, { color: theme.colors.secondary }]}>{item.age_private ? 'Age: Private' : item.age == null ? 'Age: Not set' : `Age: ${item.age}`} · {item.gender_private ? 'Gender: Private' : item.gender || 'Gender: Not set'}</Text>
        <Text style={[styles.userSub, { color: theme.colors.secondary }]}>{item.online ? 'Online now' : 'Offline'}</Text>
      </View>
      {!isSelf ? <Pressable accessibilityRole="button" disabled={busy || relationship.status === 'accepted' || (relationship.status === 'pending' && relationship.direction === 'outgoing')} onPress={() => sendFriendRequest(item)} style={[styles.friendButton, (busy || relationship.status === 'accepted' || (relationship.status === 'pending' && relationship.direction === 'outgoing')) && styles.disabled]}>
        <Text style={[styles.friendButtonText, { color: theme.colors.accent }]}>{busy ? 'Please wait…' : status}</Text>
      </Pressable> : null}
    </View>;
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={goBack}>
    <View style={styles.overlay}><View style={[styles.card, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}><Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close manage menu" onPress={goBack}><Text style={[styles.close, { color: theme.colors.secondary }]}>×</Text></Pressable></View>
      {screen === 'menu' ? <View style={styles.menu}>
        <Pressable style={[styles.menuItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]} onPress={() => { setScreen('users'); void load(); }}><Text style={[styles.menuTitle, { color: theme.colors.text }]}>Online Users</Text><Text style={[styles.menuText, { color: theme.colors.secondary }]}>See profiles and add people from this room.</Text></Pressable>
        <Pressable style={[styles.menuItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]} onPress={() => setScreen('report')}><Text style={[styles.menuTitle, { color: theme.colors.text }]}>Report User</Text><Text style={[styles.menuText, { color: theme.colors.secondary }]}>Report a participant for moderator review.</Text></Pressable>
        <Pressable style={[styles.menuItem, styles.leaveItem]} onPress={confirmLeave}><Text style={styles.leaveText}>Leave Chat / Leave Room</Text></Pressable>
      </View> : <>
        <Pressable accessibilityRole="button" onPress={goBack}><Text style={[styles.back, { color: theme.colors.accent }]}>‹ Manage</Text></Pressable>
        {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /><Text style={{ color: theme.colors.secondary }}>Loading…</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {screen === 'users' ? <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {users.length ? users.map(renderUser) : !loading ? <Text style={[styles.empty, { color: theme.colors.secondary }]}>No users are currently online in this room.</Text> : null}
        </ScrollView> : <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {participants.filter(item => Number(item.id) !== Number(user.id)).map(item => <Pressable key={item.id} style={[styles.userRow, { borderBottomColor: theme.colors.border }]} onPress={() => setSelectedUser(item)}><View style={[styles.dot, !item.online && styles.offline]} /><View style={styles.userMeta}><Text style={[styles.userName, { color: theme.colors.text }]}>{item.name || 'Member'}</Text><Text style={[styles.userSub, { color: theme.colors.secondary }]}>{item.online ? 'Online now' : 'Participant'}</Text></View></Pressable>)}
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Reason</Text>
          <View style={styles.reasonWrap}>{REASONS.map(item => <Pressable key={item} style={[styles.reason, reason === item && styles.reasonActive]} onPress={() => setReason(item)}><Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>{item}</Text></Pressable>)}</View>
          <TextInput style={[styles.details, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]} value={details} onChangeText={setDetails} maxLength={2000} multiline placeholder="Additional details (optional)" placeholderTextColor="#7f8aa3" />
          <Pressable style={[styles.submit, (!selectedUser || submitting) && styles.disabled]} disabled={!selectedUser || submitting} onPress={report}><Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text></Pressable>
        </ScrollView>}
      </>}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  card: { maxHeight: '90%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '800', color: '#172033' }, close: { fontSize: 30, color: '#68748a' },
  back: { fontWeight: '800', marginBottom: 10 }, menu: { gap: 10 },
  menuItem: { padding: 15, borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 14 },
  menuTitle: { fontSize: 14, fontWeight: '800', color: '#172033' }, menuText: { marginTop: 4, fontSize: 11, color: '#68748a' },
  leaveItem: { marginTop: 6, borderColor: '#fecaca' }, leaveText: { fontSize: 14, fontWeight: '800', color: '#b91c1c' },
  list: { maxHeight: 560 }, loading: { padding: 12, alignItems: 'center', gap: 6 }, errorBox: { padding: 10, backgroundColor: '#fff1f2', borderRadius: 10 }, error: { color: '#b91c1c' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#edf0f5', gap: 9 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8edf5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 }, avatarFallback: { color: '#536179', fontWeight: '800', fontSize: 16 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#16a34a', marginHorizontal: 8 }, offline: { backgroundColor: '#cbd5e1' },
  userMeta: { flex: 1, minWidth: 0 }, userName: { fontSize: 14, fontWeight: '700', color: '#172033' }, userSub: { marginTop: 3, fontSize: 11, color: '#68748a' },
  friendButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 135, alignItems: 'center' },
  friendButtonText: { fontSize: 11, fontWeight: '800', textAlign: 'center' }, disabled: { opacity: 0.5 },
  empty: { padding: 25, textAlign: 'center' }, sectionLabel: { marginTop: 12, marginBottom: 7, fontSize: 12, fontWeight: '800' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, reason: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: '#d5dceb' },
  reasonActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, reasonText: { fontSize: 11, color: '#4b5563' }, reasonTextActive: { color: '#3157d5', fontWeight: '800' },
  details: { minHeight: 90, borderWidth: 1, borderColor: '#d5dceb', borderRadius: 12, padding: 10, marginTop: 12, textAlignVertical: 'top' },
  submit: { marginTop: 12, padding: 13, borderRadius: 12, backgroundColor: '#3157d5', alignItems: 'center' }, submitText: { color: '#fff', fontWeight: '800' },
});
