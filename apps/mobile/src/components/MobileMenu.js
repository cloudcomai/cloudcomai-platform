import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { platformApi } from '../services/platform';

const GROUP_TYPES = [
  'Family Group','Friend Group','Fan Group','Study Group','College Group','Class Group',
  'Department Group','Project Group','Club Group','Alumni Group','Workplace Group',
  'Neighborhood Group','Event Group','Staff Group'
];

const ScreenHeader = ({ title, onBack, onClose }) => (
  <View style={styles.header}>
    {onBack ? <Pressable onPress={onBack}><Text style={styles.headerAction}>‹ Back</Text></Pressable> : <View style={styles.headerSpacer} />}
    <Text style={styles.headerTitle}>{title}</Text>
    <Pressable onPress={onClose}><Text style={styles.headerAction}>Close</Text></Pressable>
  </View>
);

export default function MobileMenu({
  visible,
  onClose,
  onChatCreated,
  onGroupCreated,
  onOpenNotificationSettings,
  onLogout,
}) {
  const [screen, setScreen] = useState('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);

  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState(GROUP_TYPES[0]);

  const [preferencesText, setPreferencesText] = useState('');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const [pollChats, setPollChats] = useState([]);
  const [pollChatId, setPollChatId] = useState(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');

  const [googleStatus, setGoogleStatus] = useState(null);

  useEffect(() => {
    if (!visible) {
      setScreen('menu');
      setError('');
      setBusy(false);
      setUserQuery('');
      setUserResults([]);
      setPollChats([]);
      setPollChatId(null);
      setGoogleStatus(null);
    }
  }, [visible]);

  const go = next => {
    setError('');
    setScreen(next);
  };

  const searchUsers = async () => {
    const query = userQuery.trim();
    if (!query || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.searchUsers(query);
      setUserResults(data.users || []);
    } catch (e) {
      setError(e.message || 'Unable to search users.');
    } finally {
      setBusy(false);
    }
  };

  const startPrivateChat = async user => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.createPrivateChat(user.id);
      if (!data.chat) throw new Error('Chat was not created.');
      onChatCreated?.({ ...data.chat, id: Number(data.chat.id), isGroup: false });
      onClose();
    } catch (e) {
      setError(e.message || 'Unable to create private chat.');
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.createGroup({
        name: groupName.trim(),
        group_category: groupType,
      });
      if (!data.group) throw new Error('Group was not created.');
      onGroupCreated?.({ ...data.group, id: Number(data.group.id), isGroup: true });
      onClose();
    } catch (e) {
      setError(e.message || 'Unable to create group.');
    } finally {
      setBusy(false);
    }
  };

  const loadPreferences = async () => {
    go('preferences');
    if (preferencesLoaded) return;
    setBusy(true);
    try {
      const { data } = await platformApi.getPreferences();
      setPreferencesText((data.preferences || []).join(', '));
      setPreferencesLoaded(true);
    } catch (e) {
      setError(e.message || 'Unable to load preferences.');
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    const interests = preferencesText.split(',').map(v => v.trim()).filter(Boolean);
    if (!interests.length) { setError('Enter at least one preference.'); return; }
    setBusy(true); setError('');
    try {
      await platformApi.updatePreferences(interests);
      Alert.alert('Preferences saved', 'Your CloudComAI preferences have been updated.');
      setScreen('menu');
    } catch (e) {
      setError(e.message || 'Unable to save preferences.');
    } finally {
      setBusy(false);
    }
  };

  const loadPoll = async () => {
    go('poll');
    setBusy(true);
    try {
      const [{ data: privateData }, { data: groupData }] = await Promise.all([
        platformApi.listChats('private'),
        platformApi.listChats('group'),
      ]);
      const chats = [
        ...(privateData.chats || []).map(c => ({ ...c, id: Number(c.id), label: c.name || 'Private chat' })),
        ...(groupData.chats || []).map(c => ({ ...c, id: Number(c.id), label: c.name || 'Group' })),
      ];
      setPollChats(chats);
      if (chats[0]) setPollChatId(chats[0].id);
    } catch (e) {
      setError(e.message || 'Unable to load conversations for the poll.');
    } finally {
      setBusy(false);
    }
  };

  const createPoll = async () => {
    if (!pollChatId || !pollQuestion.trim() || !pollOptionA.trim() || !pollOptionB.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await platformApi.createPoll({
        chat_id: pollChatId,
        question: pollQuestion.trim(),
        options: [pollOptionA.trim(), pollOptionB.trim()],
      });
      Alert.alert('Poll created', 'The poll was posted to the selected conversation.');
      onClose();
    } catch (e) {
      setError(e.message || 'Unable to create poll.');
    } finally {
      setBusy(false);
    }
  };

  const openSyncContacts = async () => {
    go('contacts');
    setBusy(true);
    try {
      const { data } = await platformApi.getGoogleStatus();
      setGoogleStatus(data);
    } catch (e) {
      setError(e.message || 'Unable to check Google Contacts status.');
    } finally {
      setBusy(false);
    }
  };

  const syncContacts = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.syncGoogleContacts();
      const count = Array.isArray(data.contacts) ? data.contacts.length : (data.contact_count || 0);
      Alert.alert('Contacts synced', count ? `${count} contacts were processed.` : 'Google Contacts sync completed.');
      const { data: status } = await platformApi.getGoogleStatus();
      setGoogleStatus(status);
    } catch (e) {
      setError(e.message || 'Unable to sync Google Contacts.');
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.getGoogleConnect();
      if (!data.authorization_url) throw new Error('Google authorization URL was not returned.');
      await Linking.openURL(data.authorization_url);
    } catch (e) {
      setError(e.message || 'Unable to open Google connection.');
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (screen === 'private') return (
      <>
        <ScreenHeader title="Start private chat" onBack={() => go('menu')} onClose={onClose} />
        <View style={styles.content}>
          <TextInput style={styles.input} value={userQuery} onChangeText={setUserQuery} placeholder="Search name, email or User ID" autoCapitalize="none" onSubmitEditing={searchUsers} />
          <Pressable style={styles.primary} onPress={searchUsers}><Text style={styles.primaryText}>Search</Text></Pressable>
          <ScrollView style={styles.results}>
            {userResults.map(user => (
              <Pressable key={user.id} style={styles.resultRow} onPress={() => startPrivateChat(user)}>
                <Text style={styles.resultTitle}>{user.name}</Text>
                <Text style={styles.resultSub}>{user.user_id ? `@${user.user_id}` : 'CloudComAI user'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </>
    );

    if (screen === 'group') return (
      <>
        <ScreenHeader title="Create group" onBack={() => go('menu')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.content}>
          <TextInput style={styles.input} value={groupName} onChangeText={setGroupName} placeholder="Group name" />
          <Text style={styles.label}>Group category</Text>
          <View style={styles.chips}>
            {GROUP_TYPES.map(type => (
              <Pressable key={type} style={[styles.chip, groupType === type && styles.chipActive]} onPress={() => setGroupType(type)}>
                <Text style={[styles.chipText, groupType === type && styles.chipTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primary} onPress={createGroup}><Text style={styles.primaryText}>Create group</Text></Pressable>
        </ScrollView>
      </>
    );

    if (screen === 'preferences') return (
      <>
        <ScreenHeader title="Preferences" onBack={() => go('menu')} onClose={onClose} />
        <View style={styles.content}>
          <Text style={styles.help}>Enter interests separated by commas.</Text>
          <TextInput style={[styles.input, styles.multiline]} value={preferencesText} onChangeText={setPreferencesText} multiline placeholder="Technology, Private Chats, Family Group" />
          <Pressable style={styles.primary} onPress={savePreferences}><Text style={styles.primaryText}>Save preferences</Text></Pressable>
        </View>
      </>
    );

    if (screen === 'poll') return (
      <>
        <ScreenHeader title="Create poll" onBack={() => go('menu')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Conversation</Text>
          <View style={styles.chips}>
            {pollChats.map(chat => (
              <Pressable key={chat.id} style={[styles.chip, pollChatId === chat.id && styles.chipActive]} onPress={() => setPollChatId(chat.id)}>
                <Text style={[styles.chipText, pollChatId === chat.id && styles.chipTextActive]} numberOfLines={1}>{chat.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} value={pollQuestion} onChangeText={setPollQuestion} placeholder="Poll question" />
          <TextInput style={styles.input} value={pollOptionA} onChangeText={setPollOptionA} placeholder="Option 1" />
          <TextInput style={styles.input} value={pollOptionB} onChangeText={setPollOptionB} placeholder="Option 2" />
          <Pressable style={styles.primary} onPress={createPoll}><Text style={styles.primaryText}>Create poll</Text></Pressable>
        </ScrollView>
      </>
    );

    if (screen === 'contacts') return (
      <>
        <ScreenHeader title="Sync contacts" onBack={() => go('menu')} onClose={onClose} />
        <View style={styles.content}>
          {googleStatus?.connected ? (
            <>
              <Text style={styles.resultTitle}>Google connected</Text>
              <Text style={styles.help}>{googleStatus.email || ''}</Text>
              <Text style={styles.help}>{googleStatus.contact_count || 0} contacts stored</Text>
              <Text style={styles.help}>Last sync: {googleStatus.last_contacts_sync_at || 'Not synced yet'}</Text>
              <Pressable style={styles.primary} onPress={syncContacts}><Text style={styles.primaryText}>Sync Google Contacts</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.help}>Google Contacts is not connected on this account.</Text>
              <Pressable style={styles.primary} onPress={connectGoogle}><Text style={styles.primaryText}>Connect Google Contacts</Text></Pressable>
            </>
          )}
        </View>
      </>
    );

    if (screen === 'settings') return (
      <>
        <ScreenHeader title="Settings" onBack={() => go('menu')} onClose={onClose} />
        <View style={styles.content}>
          <Pressable style={styles.menuItem} onPress={() => { onClose(); onOpenNotificationSettings?.(); }}>
            <Text style={styles.menuTitle}>Notifications</Text>
            <Text style={styles.menuSub}>Push notification preferences</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={openSyncContacts}>
            <Text style={styles.menuTitle}>Google Contacts</Text>
            <Text style={styles.menuSub}>Connection and sync status</Text>
          </Pressable>
          <Pressable style={[styles.menuItem, styles.dangerItem]} onPress={() => { onClose(); onLogout?.(); }}>
            <Text style={styles.dangerText}>Sign out</Text>
          </Pressable>
        </View>
      </>
    );

    return (
      <>
        <ScreenHeader title="CloudComAI Menu" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.content}>
          {[
            ['Start private chat', 'Search users and begin a direct conversation', () => go('private')],
            ['Create group', 'Create a new CloudComAI group', () => go('group')],
            ['Preferences', 'Edit your interests and preferences', loadPreferences],
            ['Create poll', 'Post a poll to a chat or group', loadPoll],
            ['Settings', 'Notifications, account and integrations', () => go('settings')],
            ['Sync contacts', 'Connect or sync Google Contacts', openSyncContacts],
          ].map(([title, sub, action]) => (
            <Pressable key={title} style={styles.menuItem} onPress={action}>
              <Text style={styles.menuTitle}>{title}</Text>
              <Text style={styles.menuSub}>{sub}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={screen === 'menu' ? onClose : () => go('menu')}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
          {body()}
          {busy ? <View style={styles.busy}><ActivityIndicator color="#3157d5" /></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 18 },
  headerAction: { color: '#fff', fontWeight: '700', minWidth: 54 },
  headerSpacer: { width: 54 },
  content: { padding: 16, gap: 12 },
  menuItem: { padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e8f0' },
  menuTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  menuSub: { marginTop: 4, color: '#6b7280', fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, backgroundColor: '#fff', color: '#172033' },
  multiline: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' },
  primaryText: { color: '#fff', fontWeight: '800' },
  results: { maxHeight: 420 },
  resultRow: { padding: 14, marginBottom: 8, borderRadius: 12, backgroundColor: '#fff' },
  resultTitle: { color: '#172033', fontWeight: '800' },
  resultSub: { marginTop: 3, color: '#6b7280', fontSize: 12 },
  label: { color: '#172033', fontWeight: '700', marginBottom: -4 },
  help: { color: '#6b7280', lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { maxWidth: '100%', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d8deea', backgroundColor: '#fff' },
  chipActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' },
  chipText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#3157d5' },
  busy: { position: 'absolute', right: 18, bottom: 18, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', elevation: 5 },
  error: { margin: 16, marginTop: 0, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' },
  dangerItem: { borderColor: '#fecaca' },
  dangerText: { color: '#b91c1c', fontWeight: '800' },
});
