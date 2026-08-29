import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { platformApi, sessionManager } from './src/services/platform';

const normalizeChats = (items, isGroup) => (items || []).map(chat => ({
  ...chat,
  id: Number(chat.id),
  isGroup,
}));

function LoginScreen({ onAuthenticated }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!identifier.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await platformApi.login(identifier.trim(), password);
      if (!data?.token || !data?.user) throw new Error('Invalid login response.');
      const session = { token: data.token, user: data.user };
      await sessionManager.setSession(session);
      onAuthenticated(session);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.loginCard}>
        <View style={styles.logo}><Text style={styles.logoText}>C</Text></View>
        <Text style={styles.title}>CloudComAI</Text>
        <Text style={styles.subtitle}>Sign in to continue your conversations</Text>
        <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} placeholder="Email, phone or username" placeholderTextColor="#7f8aa3" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#7f8aa3" onSubmitEditing={login} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]} onPress={login} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatsScreen({ session, onLogout }) {
  const [tab, setTab] = useState('private');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadChats = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await platformApi.listChats(tab);
      setChats(normalizeChats(data.chats, tab === 'group'));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load chats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const logout = async () => {
    await sessionManager.clearSession();
    onLogout();
  };

  return (
    <SafeAreaView style={styles.appPage}>
      <StatusBar barStyle="light-content" backgroundColor="#3157d5" />
      <View style={styles.header}>
        <View><Text style={styles.headerTitle}>CloudComAI</Text><Text style={styles.headerUser}>{session.user?.name || 'Authorized user'}</Text></View>
        <Pressable onPress={logout}><Text style={styles.logout}>Sign out</Text></Pressable>
      </View>
      <View style={styles.tabs}>
        {['private', 'group'].map(value => <Pressable key={value} style={[styles.tab, tab === value && styles.activeTab]} onPress={() => setTab(value)}><Text style={[styles.tabText, tab === value && styles.activeTabText]}>{value === 'private' ? 'Chats' : 'Groups'}</Text></Pressable>)}
      </View>
      {error ? <Text style={styles.listError}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loader} color="#3157d5" /> : (
        <FlatList
          data={chats}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadChats(true)} />}
          contentContainerStyle={chats.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.emptyText}>No {tab === 'group' ? 'groups' : 'conversations'} found.</Text>}
          renderItem={({ item }) => <View style={styles.chatRow}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || 'C'}</Text></View><View style={styles.chatMeta}><Text style={styles.chatName}>{item.name || 'Conversation'}</Text><Text numberOfLines={1} style={styles.preview}>{item.preview || 'No messages yet'}</Text></View>{item.unread > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{item.unread}</Text></View> : null}</View>}
        />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let active = true;
    sessionManager.getSession().then(saved => { if (active) { setSession(saved); setReady(true); } });
    return () => { active = false; };
  }, []);

  if (!ready) return <View style={styles.splash}><ActivityIndicator color="#3157d5" /><Text style={styles.splashText}>Loading CloudComAI…</Text></View>;
  if (!session) return <LoginScreen onAuthenticated={setSession} />;
  return <ChatsScreen session={session} onLogout={() => setSession(null)} />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f7fb' }, splashText: { color: '#526078' },
  loginPage: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#eef2ff' }, loginCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 20, elevation: 4 },
  logo: { width: 56, height: 56, alignSelf: 'center', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5' }, logoText: { color: '#fff', fontSize: 28, fontWeight: '800' }, title: { marginTop: 14, textAlign: 'center', fontSize: 27, fontWeight: '800', color: '#172033' }, subtitle: { marginTop: 6, marginBottom: 22, textAlign: 'center', color: '#68748a' },
  input: { minHeight: 50, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', backgroundColor: '#fbfcff' }, error: { marginBottom: 12, color: '#dc2626' }, primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.65 },
  appPage: { flex: 1, backgroundColor: '#f5f7fb' }, header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' }, headerTitle: { color: '#fff', fontSize: 21, fontWeight: '800' }, headerUser: { marginTop: 2, color: '#dbe4ff', fontSize: 12 }, logout: { color: '#fff', fontWeight: '700' }, tabs: { flexDirection: 'row', padding: 8, margin: 14, borderRadius: 12, backgroundColor: '#e5eaf4' }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 }, activeTab: { backgroundColor: '#fff' }, tabText: { color: '#69758b', fontWeight: '700' }, activeTabText: { color: '#3157d5' },
  loader: { marginTop: 50 }, list: { paddingHorizontal: 14, paddingBottom: 24 }, emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#718096' }, listError: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' }, chatRow: { minHeight: 76, marginBottom: 9, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#fff' }, avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#dfe6ff' }, avatarText: { color: '#3157d5', fontSize: 18, fontWeight: '800' }, chatMeta: { flex: 1, marginHorizontal: 12 }, chatName: { color: '#172033', fontWeight: '700', fontSize: 15 }, preview: { marginTop: 5, color: '#778196', fontSize: 12 }, unread: { minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
