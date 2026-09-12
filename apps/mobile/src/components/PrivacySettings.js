import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { platformApi } from '../services/platform';

const bytes = value => `${(Number(value || 0) / 1024 / 1024).toFixed(2)} MB`;
const prettyDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
const frequencies = [['off', 'Off'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];

export default function PrivacySettings({ onBack }) {
  const [data, setData] = useState(null);
  const [backup, setBackup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const load = useCallback(async () => {
    try {
      const [privacyResponse, backupResponse] = await Promise.all([platformApi.getPrivacySettings(), platformApi.getAccountBackupStatus()]);
      setData(privacyResponse.data);
      setBackup(backupResponse.data.backup || {});
    } catch (loadError) { setError(loadError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const perform = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (actionError) { setError(actionError.message || 'Unable to update settings.'); }
    finally { setBusy(false); }
  };
  const update = (key, value) => perform(async () => {
    const response = await platformApi.updatePrivacySettings({ [key]: value });
    setData(current => ({ ...current, settings: response.data.settings }));
  });
  const updateBackupSettings = async changes => {
    const response = await platformApi.updateAccountBackupSettings({
      automatic_frequency: changes.automatic_frequency ?? backup?.automatic_frequency ?? 'off',
      include_videos: changes.include_videos ?? backup?.include_videos ?? false,
      wifi_only: changes.wifi_only ?? backup?.wifi_only ?? true,
    });
    setBackup(response.data.settings || response.data.backup || {});
  };
  const createBackup = () => perform(async () => {
    if (!backup?.email_verified) throw new Error('Verify your registered email address before using Cloud Backup.');
    setProgress('Preparing backup');
    await new Promise(resolve => setTimeout(resolve, 250));
    setProgress('Uploading encrypted backup');
    const response = await platformApi.createAccountBackup({ include_videos: Boolean(backup.include_videos) });
    setProgress('Backup completed');
    setBackup(response.data.backup || backup);
    setTimeout(() => setProgress(''), 900);
  });
  const restoreBackup = () => Alert.alert('Restore backup?', 'Your CloudComAI account data and supported conversations will be restored from your latest encrypted cloud backup.', [
    { text: 'Skip', style: 'cancel' },
    { text: 'Restore', onPress: () => perform(async () => {
      setProgress('Preparing restore');
      await new Promise(resolve => setTimeout(resolve, 250));
      setProgress('Restoring backup');
      const response = await platformApi.restoreAccountBackup();
      setProgress('Restore completed');
      Alert.alert('Restore completed', `${response.data.restore?.chats || 0} chats and ${response.data.restore?.messages || 0} messages restored.`);
      setTimeout(() => setProgress(''), 900);
    }) },
  ]);
  const exportAccountData = () => perform(async () => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    const response = await platformApi.downloadAccountBackup();
    const file = new File(Paths.cache, `cloudcomai-account-export-${Date.now()}.json`);
    try { file.create(); file.write(JSON.stringify(response.data, null, 2)); await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export account data' }); }
    finally { if (file.exists) file.delete(); }
  });
  const automaticLabel = useMemo(() => frequencies.find(([key]) => key === backup?.automatic_frequency)?.[1] || 'Off', [backup?.automatic_frequency]);
  return <SafeAreaView style={styles.page}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Privacy & Account</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {progress ? <View style={styles.progress}><ActivityIndicator color="#3157d5" /><Text style={styles.progressText}>{progress}</Text></View> : null}
    {!data || !backup ? <><ActivityIndicator style={{ margin: 30 }} /><Pressable onPress={load}><Text style={styles.link}>Retry</Text></Pressable></> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}><Text style={styles.heading}>Privacy controls</Text>
        {[['hide_online_status', 'Hide online status'], ['media_auto_download', 'Automatically load chat media'], ['screenshot_alerts', 'Receive screenshot alerts']].map(([key, label]) => <View key={key} style={styles.row}><Text style={styles.label}>{label}</Text><Switch disabled={busy} value={Boolean(data.settings?.[key])} onValueChange={value => update(key, value)} /></View>)}
        <Text style={styles.note}>Media loads on request when automatic loading is off. Screenshot alerts work on iOS and Android 14 or newer while a chat is open.</Text>
      </View>
      <View style={styles.card}><Text style={styles.heading}>Profile visibility</Text>
        {[['share_email', 'Show email address'], ['share_mobile', 'Show phone number'], ['share_age', 'Show age'], ['share_gender', 'Show gender']].map(([key, label]) => <View key={key} style={styles.row}><Text style={styles.label}>{label}</Text><Switch accessibilityLabel={label} disabled={busy} value={Boolean(data.settings?.[key])} onValueChange={value => update(key, value)} /></View>)}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Chat Backup</Text>
        <Text style={styles.statLabel}>Last backup</Text><Text style={styles.stat}>{prettyDate(backup.last_backup_at)}</Text>
        <Text style={styles.statLabel}>Backup size</Text><Text style={styles.stat}>{bytes(backup.backup_size)}</Text>
        <Text style={styles.statLabel}>Backup account</Text><Text style={styles.email}>{backup.backup_account_email || 'No verified email'}</Text>
        {!backup.email_verified ? <Text style={styles.warning}>Verify your registered email address to enable cloud backup and restore.</Text> : null}
        <Pressable disabled={busy || !backup.email_verified} onPress={createBackup} style={styles.primary}><Text style={styles.primaryText}>BACK UP NOW</Text></Pressable>
        <View style={styles.row}><Text style={styles.label}>Automatic backup: {automaticLabel}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frequencyRow}>
          {frequencies.map(([key,label]) => <Pressable key={key} disabled={busy} onPress={() => perform(() => updateBackupSettings({ automatic_frequency: key }))} style={[styles.frequency, backup.automatic_frequency === key && styles.frequencyActive]}><Text style={[styles.frequencyText, backup.automatic_frequency === key && styles.frequencyTextActive]}>{label}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.row}><Text style={styles.label}>Include videos</Text><Switch disabled={busy || !backup.email_verified} value={Boolean(backup.include_videos)} onValueChange={value => perform(() => updateBackupSettings({ include_videos: value }))} /></View>
        <View style={styles.row}><Text style={styles.label}>Backup over Wi-Fi only</Text><Switch disabled={busy} value={Boolean(backup.wifi_only)} onValueChange={value => perform(() => updateBackupSettings({ wifi_only: value }))} /></View>
        {backup.restore_available ? <Pressable disabled={busy} onPress={restoreBackup}><Text style={styles.restoreLink}>Restore backup</Text></Pressable> : null}
        <Text style={styles.note}>Backups are encrypted before they are stored in private CloudComAI server storage. Each account can only read its own backup.</Text>
      </View>
      <View style={styles.card}><Text style={styles.heading}>Export account data</Text><Text style={styles.note}>This is a separate local JSON export. It is not the Cloud Backup and cannot be used as the in-app restore backup.</Text><Pressable disabled={busy} onPress={exportAccountData}><Text style={styles.link}>{busy ? 'Please wait…' : 'Export account data'}</Text></Pressable></View>
      <View style={styles.card}><Text style={styles.heading}>Blocked contacts</Text>
        <TextInput style={styles.input} placeholder="Search name or user ID" value={query} onChangeText={setQuery} autoCapitalize="none" />
        <Pressable disabled={busy || !query.trim()} onPress={() => perform(async () => { const response = await platformApi.searchUsers(query.trim()); setResults(response.data.users || []); })}><Text style={styles.link}>Search contacts</Text></Pressable>
        {results.map(contact => <View key={contact.id} style={styles.row}><Text style={styles.label}>{contact.name}</Text><Pressable disabled={busy} onPress={() => perform(async () => { await platformApi.blockContact(contact.id); setResults(current => current.filter(item => item.id !== contact.id)); await load(); })}><Text style={styles.link}>Block</Text></Pressable></View>)}
        {(data.blocked_users || []).map(contact => <View key={contact.id} style={styles.row}><Text style={styles.label}>{contact.name}</Text><Pressable disabled={busy} onPress={() => perform(async () => { await platformApi.unblockContact(contact.id); await load(); })}><Text style={styles.link}>Unblock</Text></Pressable></View>)}
        {!data.blocked_users?.length && !results.length && <Text style={styles.note}>No blocked contacts.</Text>}
      </View>
      <View style={styles.card}><Text style={styles.heading}>Storage & media</Text><Text style={styles.storage}>{bytes(data.storage?.total_bytes)}</Text><Text style={styles.note}>{data.storage?.total_files || 0} files uploaded by this account.</Text></View>
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fb' }, header: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#3157d5', padding: 20 }, title: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' }, back: { color: '#fff', fontWeight: '700' }, content: { padding: 16 }, card: { padding: 18, borderRadius: 14, backgroundColor: '#fff', marginBottom: 14 }, heading: { fontSize: 17, fontWeight: '700', color: '#172033', marginBottom: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, label: { flex: 1, color: '#172033' }, note: { fontSize: 12, lineHeight: 18, color: '#68748a', marginVertical: 10 }, link: { color: '#3157d5', fontWeight: '700', paddingVertical: 12 }, restoreLink: { color: '#3157d5', fontWeight: '800', paddingVertical: 16, fontSize: 15 }, input: { borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, padding: 12, color: '#172033' }, error: { margin: 16, color: '#b91c1c' }, storage: { fontSize: 28, fontWeight: '700' }, statLabel: { color: '#68748a', fontSize: 12, marginTop: 6 }, stat: { color: '#172033', fontSize: 17, fontWeight: '700', marginBottom: 5 }, email: { color: '#3157d5', fontWeight: '700', marginBottom: 12 }, primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5', marginVertical: 14 }, primaryText: { color: '#fff', fontWeight: '800' }, frequencyRow: { gap: 8, paddingVertical: 8 }, frequency: { borderWidth: 1, borderColor: '#d8deea', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 }, frequencyActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, frequencyText: { color: '#68748a', fontWeight: '700', fontSize: 12 }, frequencyTextActive: { color: '#3157d5' }, progress: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: '#eef2ff', flexDirection: 'row', alignItems: 'center', gap: 10 }, progressText: { color: '#3157d5', fontWeight: '800' }, warning: { color: '#9a3412', backgroundColor: '#fff7ed', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 12 } });
