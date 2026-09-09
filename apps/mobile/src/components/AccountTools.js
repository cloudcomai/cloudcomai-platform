import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMessageTimestamp } from '@cloudcomai/chat-core';
import { platformApi } from '../services/platform';

export default function AccountTools({ mode, onBack, onOpenChat, onSessionRotated, onLogout }) {
  const saved = mode === 'saved_messages';
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async before => {
    setLoading(true); setError('');
    try {
      const { data } = saved ? await platformApi.listSavedMessages({ query: { before_id: before } }) : await platformApi.listSessions();
      const incoming = saved ? data.messages || [] : data.sessions || [];
      setItems(current => before ? [...current, ...incoming.filter(item => !current.some(old => old.saved_id === item.saved_id))] : incoming);
      setCursor(data.next_before_id || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [saved]);
  useEffect(() => { load(); }, [load]);
  const perform = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const revoke = item => Alert.alert('Sign out device?', item.current ? 'You will sign out of this device.' : 'This device will need to sign in again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => perform(async () => {
      if (item.current) { await onLogout(); return; }
      await platformApi.revokeSession(item.id);
      setItems(current => current.filter(entry => entry.id !== item.id));
    }) },
  ]);
  return <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>{saved ? 'Saved messages' : 'Devices & sessions'}</Text></View>
    {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    <FlatList
      data={items}
      keyExtractor={item => String(saved ? item.saved_id : item.id)}
      refreshing={loading}
      onRefresh={() => { if (!busy) load(); }}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<Text style={styles.note}>{saved ? 'Save messages from their actions to find them here. Expired or deleted messages are removed.' : 'Review active sign-ins. Sign out other devices to require them to sign in again.'}</Text>}
      ListEmptyComponent={!loading ? <Text style={styles.note}>{saved ? 'No saved messages yet.' : 'No active sessions found.'}</Text> : <ActivityIndicator color="#3157d5" />}
      renderItem={({ item }) => <View style={styles.card}>
        <Text style={styles.name}>{saved ? item.chat_name || item.sender_name || 'Conversation' : item.current ? 'This device' : 'Signed-in device'}</Text>
        <Text style={styles.body} numberOfLines={saved ? 4 : 3}>{saved ? item.type === 'text' ? item.body : item.poll?.question || `[${item.type} message]` : item.device_label || 'Device details unavailable'}</Text>
        <Text style={styles.note}>{saved ? `Saved ${formatMessageTimestamp(item.saved_at)}` : `Last active ${formatMessageTimestamp(item.last_seen_at)}`}</Text>
        <View style={styles.actions}>{saved ? <><Pressable disabled={busy} onPress={() => perform(() => onOpenChat(Number(item.chat_id)))}><Text style={styles.link}>Open chat</Text></Pressable><Pressable disabled={busy} onPress={() => perform(async () => { await platformApi.unsaveMessage(item.id); setItems(current => current.filter(entry => entry.id !== item.id)); })}><Text style={styles.link}>Unsave</Text></Pressable></> : <Pressable disabled={busy} onPress={() => revoke(item)}><Text style={styles.link}>Sign out</Text></Pressable>}</View>
      </View>}
      ListFooterComponent={saved ? cursor ? <Pressable disabled={loading || busy} onPress={() => load(cursor)}><Text style={styles.link}>Load more</Text></Pressable> : null : <Pressable disabled={loading || busy} onPress={() => Alert.alert('Sign out other devices?', 'You will stay signed in here. Older sign-ins will also be invalidated.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out others', style: 'destructive', onPress: () => perform(async () => { const { data } = await platformApi.revokeOtherSessions(); await onSessionRotated(data); await load(); }) },
      ])}><Text style={styles.link}>Sign out all other devices</Text></Pressable>}
    />
    {busy ? <ActivityIndicator color="#3157d5" /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' }, header: { minHeight: 64, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#3157d5' }, back: { color: '#fff', fontWeight: '700', paddingVertical: 8 }, title: { color: '#fff', fontSize: 19, fontWeight: '700', flex: 1 }, content: { padding: 16, paddingBottom: 32 }, card: { padding: 16, borderRadius: 12, backgroundColor: '#fff', marginVertical: 8 }, name: { color: '#172033', fontSize: 16, fontWeight: '700' }, body: { color: '#172033', marginTop: 8, lineHeight: 21 }, note: { color: '#68748a', fontSize: 12, lineHeight: 18, marginVertical: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, link: { color: '#3157d5', fontWeight: '700', paddingVertical: 12 }, error: { margin: 16, color: '#b91c1c' },
});
