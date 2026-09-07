import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { platformApi } from '../services/platform';

const bytes = value => `${(Number(value || 0) / 1024 / 1024).toFixed(2)} MB`;
export default function PrivacySettings({ onBack }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const load = useCallback(async () => {
    try { const response = await platformApi.getPrivacySettings(); setData(response.data); }
    catch (error) { setError(error.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const perform = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (error) { setError(error.message || 'Unable to update settings.'); }
    finally { setBusy(false); }
  };
  const update = (key, value) => perform(async () => {
    const response = await platformApi.updatePrivacySettings({ [key]: value });
    setData(current => ({ ...current, settings: response.data.settings }));
  });
  const backup = () => perform(async () => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    const response = await platformApi.downloadAccountBackup();
    const file = new File(Paths.cache, `cloudcomai-account-${Date.now()}.json`);
    try {
      file.create();
      file.write(JSON.stringify(response.data, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save account backup' });
    } finally { if (file.exists) file.delete(); }
  });
  return <SafeAreaView style={styles.page}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Privacy & Account</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!data ? <><ActivityIndicator style={{ margin: 30 }} /><Pressable onPress={load}><Text style={styles.link}>Retry</Text></Pressable></> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}><Text style={styles.heading}>Privacy controls</Text>
        {[['hide_online_status', 'Hide online status'], ['media_auto_download', 'Automatically load chat media'], ['screenshot_alerts', 'Receive screenshot alerts']].map(([key, label]) => <View key={key} style={styles.row}><Text style={styles.label}>{label}</Text><Switch disabled={busy} value={Boolean(data.settings?.[key])} onValueChange={value => update(key, value)} /></View>)}
        <Text style={styles.note}>Media loads on request when automatic loading is off. Screenshot alerts work on iOS and Android 14 or newer while a chat is open. They cannot detect every capture method.</Text>
      </View>
      <View style={styles.card}><Text style={styles.heading}>Blocked contacts</Text>
        <TextInput style={styles.input} placeholder="Search name or user ID" value={query} onChangeText={setQuery} autoCapitalize="none" />
        <Pressable disabled={busy || !query.trim()} onPress={() => perform(async () => { const response = await platformApi.searchUsers(query.trim()); setResults(response.data.users || []); })}><Text style={styles.link}>Search contacts</Text></Pressable>
        {results.map(contact => <View key={contact.id} style={styles.row}><Text style={styles.label}>{contact.name}</Text><Pressable disabled={busy} onPress={() => perform(async () => { await platformApi.blockContact(contact.id); setResults(current => current.filter(item => item.id !== contact.id)); await load(); })}><Text style={styles.link}>Block</Text></Pressable></View>)}
        {(data.blocked_users || []).map(contact => <View key={contact.id} style={styles.row}><Text style={styles.label}>{contact.name}</Text><Pressable disabled={busy} onPress={() => perform(async () => { await platformApi.unblockContact(contact.id); await load(); })}><Text style={styles.link}>Unblock</Text></Pressable></View>)}
        {!data.blocked_users?.length && <Text style={styles.note}>No blocked contacts.</Text>}
        <Text style={styles.note}>Blocking stops private messages in both directions. Shared group conversations remain available.</Text>
      </View>
      <View style={styles.card}><Text style={styles.heading}>Storage & media</Text><Text style={styles.storage}>{bytes(data.storage?.total_bytes)}</Text><Text style={styles.note}>{data.storage?.total_files || 0} files uploaded by this account.</Text>
        {Object.entries(data.storage?.categories || {}).map(([key, category]) => <View key={key} style={styles.row}><Text style={styles.label}>{key}</Text><Text>{category.count} files · {bytes(category.bytes)}</Text></View>)}
      </View>
      <View style={styles.card}><Text style={styles.heading}>Account backup</Text><Text style={styles.note}>Export your profile, preferences, contacts, chats, messages, and attachment metadata as JSON. Media files are not embedded. This export does not restore conversations into the app.</Text><Pressable disabled={busy} onPress={backup}><Text style={styles.link}>{busy ? 'Please wait…' : 'Save account backup'}</Text></Pressable></View>
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fb' }, header: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#3157d5', padding: 20 }, title: { color: '#fff', fontSize: 20, fontWeight: '700' }, back: { color: '#fff', fontWeight: '700' }, content: { padding: 16 }, card: { padding: 18, borderRadius: 14, backgroundColor: '#fff', marginBottom: 14 }, heading: { fontSize: 17, fontWeight: '700', color: '#172033', marginBottom: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, label: { flex: 1, color: '#172033' }, note: { fontSize: 12, lineHeight: 18, color: '#68748a', marginVertical: 10 }, link: { color: '#3157d5', fontWeight: '700', paddingVertical: 12 }, input: { borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, padding: 12, color: '#172033' }, error: { margin: 16, color: '#b91c1c' }, storage: { fontSize: 28, fontWeight: '700' } });
