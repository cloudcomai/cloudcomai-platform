import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { platformApi } from '../services/platform';

export default function GroupManagement({ visible, group, user, onClose, onGroupUpdated, onGroupDeleted }) {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState(group?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const load = useCallback(async () => {
    if (!visible || !group?.id) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.listGroupMembers(group.id);
      setMembers(data.members || []);
      setName(group.name || '');
    } catch (e) {
      setError(e.message || 'Unable to load group members.');
    } finally {
      setBusy(false);
    }
  }, [visible, group?.id, group?.name]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.createGroupInvite(group.id);
      const url = data.invite_url || data.invite_path || data.invite_token;
      if (!url) throw new Error('Invite link was not returned.');
      await Share.share({ title: `Join ${group.name}`, message: `Join my CloudComAI group: ${url}`, url });
    } catch (e) {
      setError(e.message || 'Unable to create group invitation.');
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.updateGroup(group.id, {
        name: name.trim(),
        group_category: group.group_category || 'Family Group',
      });
      onGroupUpdated?.({ ...group, ...(data.group || {}), name: name.trim() });
      Alert.alert('Group updated', 'Group details were saved.');
    } catch (e) {
      setError(e.message || 'Unable to update group.');
    } finally { setBusy(false); }
  };

  const search = async () => {
    if (!query.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await platformApi.searchUsers(query.trim());
      setResults(data.users || []);
    } catch (e) { setError(e.message || 'Unable to search users.'); }
    finally { setBusy(false); }
  };

  const add = async candidate => {
    setBusy(true); setError('');
    try {
      await platformApi.updateGroupMember(group.id, candidate.id, 'add');
      setResults(current => current.filter(item => Number(item.id) !== Number(candidate.id)));
      await load();
    } catch (e) { setError(e.message || 'Unable to add member.'); }
    finally { setBusy(false); }
  };

  const remove = member => {
    const memberId = Number(member.user_id);
    const isOwner = member.role === 'owner';
    if (isOwner && memberId !== Number(user?.id)) {
      Alert.alert('Owner cannot be removed', 'Transfer ownership before removing the group owner.');
      return;
    }
    Alert.alert('Remove member?', `Remove ${member.name || member.username || 'this member'} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try {
          await platformApi.updateGroupMember(group.id, memberId, 'remove');
          if (memberId === Number(user?.id)) { onClose(); return; }
          await load();
        } catch (e) { setError(e.message || 'Unable to remove member.'); }
        finally { setBusy(false); }
      }},
    ]);
  };

  const deleteGroup = () => {
    Alert.alert('Delete group?', 'This removes the group for all active members.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try {
          await platformApi.deleteGroup(group.id);
          onGroupDeleted?.(group.id);
          onClose();
        } catch (e) { setError(e.message || 'Unable to delete group.'); }
        finally { setBusy(false); }
      }},
    ]);
  };

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}><Pressable onPress={onClose}><Text style={styles.headerLink}>‹ Back</Text></Pressable><Text style={styles.headerTitle}>Manage group</Text><Pressable onPress={invite}><Text style={styles.headerLink}>Invite</Text></Pressable></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.heading}>Group details</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Group name" />
            <Text style={styles.note}>{group.group_category || 'Group'}</Text>
            <Pressable style={styles.primary} onPress={save}><Text style={styles.primaryText}>Save group</Text></Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Add member</Text>
            <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search name, email or User ID" autoCapitalize="none" onSubmitEditing={search} />
            <Pressable style={styles.linkButton} onPress={search}><Text style={styles.link}>Search</Text></Pressable>
            {results.map(item => <View key={item.id} style={styles.row}><View style={styles.meta}><Text style={styles.name}>{item.name}</Text><Text style={styles.note}>{item.user_id ? `@${item.user_id}` : ''}</Text></View><Pressable onPress={() => add(item)}><Text style={styles.link}>Add</Text></Pressable></View>)}
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Members · {members.length}</Text>
            {members.map(member => <View key={`${member.user_id}-${member.role}`} style={styles.row}><View style={styles.meta}><Text style={styles.name}>{member.name || member.username || 'Member'}</Text><Text style={styles.note}>{member.role}{member.username ? ` · @${member.username}` : ''}</Text></View><Pressable onPress={() => remove(member)}><Text style={member.role === 'owner' && Number(member.user_id) !== Number(user?.id) ? styles.disabledText : styles.danger}>Remove</Text></Pressable></View>)}
          </View>
          {Number(group.owner_id) === Number(user?.id) ? <Pressable style={styles.deleteButton} onPress={deleteGroup}><Text style={styles.deleteText}>Delete group</Text></Pressable> : null}
        </ScrollView>
        {busy ? <View style={styles.busy}><ActivityIndicator color="#3157d5" /></View> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#3157d5' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  headerLink: { color: '#fff', fontWeight: '700', minWidth: 54 },
  content: { padding: 14, paddingBottom: 40 },
  card: { padding: 16, marginBottom: 12, borderRadius: 14, backgroundColor: '#fff' },
  heading: { color: '#172033', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, color: '#172033' },
  note: { color: '#68748a', fontSize: 11, marginTop: 4 },
  primary: { minHeight: 46, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#3157d5' },
  primaryText: { color: '#fff', fontWeight: '800' },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 10 },
  link: { color: '#3157d5', fontWeight: '800' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  meta: { flex: 1 },
  name: { color: '#172033', fontWeight: '700' },
  danger: { color: '#b91c1c', fontWeight: '700' },
  disabledText: { color: '#94a3b8', fontWeight: '700' },
  deleteButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff' },
  deleteText: { color: '#b91c1c', fontWeight: '800' },
  error: { margin: 12, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' },
  busy: { position: 'absolute', right: 18, bottom: 18, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', elevation: 5 },
});
