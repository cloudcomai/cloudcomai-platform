import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { createPollingMessageTransport, formatMessageTimestamp, mergeMessageBatch } from '@cloudcomai/chat-core';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { API_BASE_URL, mediaUrl, platformApi, sessionManager } from './src/services/platform';
import { getLastNotificationResponse, getNotificationPreferences, requestNotificationPermission, setNotificationPreferences, subscribeToNotificationResponses } from './src/services/notifications';
import MobileMenu from './src/components/MobileMenu';

const normalizeChats = (items, isGroup) => (items || []).map(chat => ({
  ...chat,
  id: Number(chat.id),
  isGroup,
}));

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const persistAuthenticatedSession = async data => {
    if (!data?.token || !data?.user) throw new Error('Invalid authentication response.');
    const session = { token: data.token, user: data.user };
    await sessionManager.setSession(session);
    onAuthenticated(session);
  };

  const login = async () => {
    if (!identifier.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await platformApi.login(identifier.trim(), password);
      await persistAuthenticatedSession(data);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (busy) return;
    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!email.trim() && !mobile.trim() && !userId.trim()) { setError('Email, mobile number or CloudComAI User ID is required.'); return; }
    if (!dob.trim()) { setError('Date of birth is required in YYYY-MM-DD format.'); return; }
    if (password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setBusy(true);
    setError('');
    try {
      const { data } = await platformApi.register({
        name: name.trim(),
        user_id: userId.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        dob: dob.trim(),
        gender,
        password,
      });
      await persistAuthenticatedSession(data);
    } catch (registerError) {
      setError(registerError.message || 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = nextMode => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <SafeAreaView style={styles.loginPage} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#eef2ff" />
      <KeyboardAvoidingView style={styles.authKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.loginCard}>
            <Image source={require('./assets/splash-logo.png')} style={styles.authLogo} resizeMode="contain" />
            <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in once and CloudComAI will keep you signed in securely on this device.'
                : 'Create your CloudComAI account to start secure conversations.'}
            </Text>

            {mode === 'login' ? (
              <>
                <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} placeholder="Email, phone or username" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#7f8aa3" onSubmitEditing={login} />
                <View style={styles.rememberRow}>
                  <Text style={styles.rememberCheck}>✓</Text>
                  <Text style={styles.rememberText}>Keep me signed in on this device</Text>
                </View>
              </>
            ) : (
              <>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={userId} onChangeText={setUserId} autoCapitalize="none" autoCorrect={false} placeholder="CloudComAI User ID" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="Email address" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="Mobile number" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={dob} onChangeText={setDob} autoCapitalize="none" placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor="#7f8aa3" />
                <View style={styles.genderRow}>
                  {['Male', 'Female'].map(value => (
                    <Pressable key={value} style={[styles.genderButton, gender === value && styles.genderButtonActive]} onPress={() => setGender(value)}>
                      <Text style={[styles.genderButtonText, gender === value && styles.genderButtonTextActive]}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password (minimum 8 characters)" placeholderTextColor="#7f8aa3" />
                <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm password" placeholderTextColor="#7f8aa3" onSubmitEditing={register} />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]} onPress={mode === 'login' ? login : register} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Sign in' : 'Register'}</Text>}
            </Pressable>

            <View style={styles.authSwitchRow}>
              <Text style={styles.authSwitchText}>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</Text>
              <Pressable onPress={() => changeMode(mode === 'login' ? 'register' : 'login')}>
                <Text style={styles.authSwitchLink}>{mode === 'login' ? 'Register' : 'Sign in'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function ChatDetail({ chat, authToken, onBack, onDeleted }) {
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const cursorRef = useRef(0);
  const listRef = useRef(null);

  useEffect(() => {
    cursorRef.current = 0;
    setMessages([]);
    const transport = createPollingMessageTransport({
      intervalMs: Number(process.env.EXPO_PUBLIC_MESSAGE_POLL_INTERVAL_MS || 3000),
      getCursor: () => cursorRef.current,
      fetchMessages: async (afterId, options) => {
        const { data } = await platformApi.listMessages(chat.id, afterId, options);
        return data.messages || [];
      },
      onMessages: incoming => {
        setLoading(false);
        setMessages(current => {
          const result = mergeMessageBatch(current, incoming);
          cursorRef.current = result.cursor;
          return result.changed ? result.messages : current;
        });
      },
      onError: syncError => { setLoading(false); setError(syncError.message || 'Unable to synchronize messages.'); },
    });
    const handleAppState = nextState => {
      if (nextState === 'active') transport.start();
      else transport.stop();
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    transport.start();
    return () => { subscription.remove(); transport.stop(); };
  }, [chat.id]);

  const sendMessage = async () => {
    const body = composer.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await platformApi.sendMessage({ chat_id: chat.id, body });
      if (data.message) {
        setMessages(current => {
          const result = mergeMessageBatch(current, [data.message]);
          cursorRef.current = result.cursor;
          return result.messages;
        });
      }
      setComposer('');
    } catch (sendError) {
      setError(sendError.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const pickAttachment = async () => {
    if (uploading) return;
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > 20 * 1024 * 1024) { setError('Attachments must be 20 MB or smaller.'); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('chat_id', String(chat.id));
      form.append('file', { uri: asset.uri, name: asset.name || 'attachment', type: asset.mimeType || 'application/octet-stream' });
      const { data } = await platformApi.uploadAttachment(form);
      if (data.message) setMessages(current => { const result = mergeMessageBatch(current, [data.message]); cursorRef.current = result.cursor; return result.messages; });
    } catch (uploadError) { setError(uploadError.message || 'Unable to upload attachment.'); }
    finally { setUploading(false); }
  };

  const confirmDelete = () => {
    if (chat.isGroup || deleting) return;
    Alert.alert(
      'Delete chat?',
      `Your full history with ${chat.name || 'this user'} will be removed from your account. The other user keeps their copy. New messages will start a fresh history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError('');
            try {
              await platformApi.deleteChat(chat.id);
              onDeleted();
            } catch (deleteError) {
              setError(deleteError.message || 'Unable to delete chat.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.appPage} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.chatKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Chats</Text></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{chat.name || 'Conversation'}</Text>
        {chat.isGroup ? <View style={{ width: 54 }} /> : <Pressable onPress={confirmDelete} disabled={deleting}><Text style={styles.deleteChat}>{deleting ? 'Deleting' : 'Delete'}</Text></Pressable>}
      </View>
      {error ? <Text style={styles.listError}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loader} color="#3157d5" /> : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>}
          renderItem={({ item }) => {
            const attachment = item.attachment || item.attachments?.[0] || null;
            const isImage = attachment?.mime_type?.startsWith('image/');
            const previewUrl = attachment?.id
              ? `${API_BASE_URL}/v1/attachments?id=${encodeURIComponent(attachment.id)}&preview=1`
              : '';
            const body = item.body || item.text || '';

            return (
              <View style={[styles.messageBubble, item.mine && styles.myMessage]}>
                {isImage && previewUrl ? (
                  <Image
                    source={{
                      uri: previewUrl,
                      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
                    }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                ) : null}
                {body ? <Text style={styles.messageText}>{body}</Text> : null}
                {!body && attachment && !isImage ? (
                  <Text style={styles.attachmentLabel}>📎 {attachment.name || 'Attachment'}</Text>
                ) : null}
                <Text style={styles.messageTime}>{formatMessageTimestamp(item.created_at || item.timestamp || item.time)}</Text>
              </View>
            );
          }}
        />
      )}
      <View style={styles.composer}>
        <Pressable style={styles.attachButton} onPress={pickAttachment} disabled={uploading}>
          <Text style={styles.attachText}>{uploading ? '…' : '＋'}</Text>
        </Pressable>
        <TextInput
          style={styles.composerInput}
          value={composer}
          onChangeText={setComposer}
          placeholder="Type a message..."
          placeholderTextColor="#7f8aa3"
          multiline
          onSubmitEditing={sendMessage}
        />
        <Pressable style={[styles.sendButton, sending && styles.disabled]} onPress={sendMessage} disabled={sending}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NotificationSettings({ preferences, onBack, onChange }) {
  const items = [['enabled', 'Push notifications'], ['message', 'Messages'], ['group', 'Groups'], ['attachment', 'Attachments'], ['system', 'System']];
  return (
    <SafeAreaView style={styles.appPage} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.headerTitle}>Notifications</Text><View style={{ width: 54 }} />
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsIntro}>Choose which notifications this device can receive.</Text>
        {items.map(([key, label]) => <View key={key} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Switch value={Boolean(preferences[key])} onValueChange={value => onChange({ [key]: value })} />
        </View>)}
      </View>
    </SafeAreaView>
  );
}

function ChatsScreen({ session, onLogout, onSettings, initialChatId }) {
  const [tab, setTab] = useState('private');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const lastBackPressRef = useRef(0);

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
  useEffect(() => {
    if (!initialChatId) return;
    const target = chats.find(item => Number(item.id) === Number(initialChatId));
    if (target) setSelectedChat(target);
  }, [chats, initialChatId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedChat) {
        setSelectedChat(null);
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      ToastAndroid.show('Press back again to exit CloudComAI', ToastAndroid.SHORT);
      return true;
    });

    return () => subscription.remove();
  }, [selectedChat]);

  const logout = async () => {
    await sessionManager.clearSession();
    onLogout();
  };

  if (selectedChat) return <ChatDetail chat={selectedChat} authToken={session.token} onBack={() => setSelectedChat(null)} onDeleted={() => { setSelectedChat(null); loadChats(true); }} />;

  return (
    <SafeAreaView style={styles.appPage} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#3157d5" />
      <View style={styles.header}>
        <View style={styles.headerIdentity}><Text style={styles.headerTitle} numberOfLines={1}>CloudComAI</Text><Text style={styles.headerUser} numberOfLines={1}>{session.user?.name || 'Authorized user'}</Text></View>
        <View style={styles.headerActions}>
          <Pressable onPress={onSettings}><Text style={styles.logout}>Alerts</Text></Pressable>
          <Pressable onPress={() => setMenuVisible(true)}><Text style={styles.logout}>Menu</Text></Pressable>
        </View>
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
          renderItem={({ item }) => {
            const imageId = item.isGroup ? item.id : (item.other_user_id || item.id);
            return <Pressable onPress={() => setSelectedChat(item)} style={styles.chatRow}><View style={styles.avatar}><Image source={{ uri: mediaUrl(item.isGroup ? 'group' : 'user', imageId) }} style={styles.avatarImage} /><View style={styles.avatarFallback}><Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || 'C'}</Text></View></View><View style={styles.chatMeta}><Text style={styles.chatName}>{item.name || 'Conversation'}</Text><Text numberOfLines={1} style={styles.preview}>{item.preview || 'No messages yet'}</Text></View>{item.unread > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{item.unread}</Text></View> : null}</Pressable>;
          }}
        />
      )}
      <MobileMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onOpenNotificationSettings={onSettings}
        onLogout={logout}
        onChatCreated={chat => {
          setMenuVisible(false);
          setTab('private');
          setChats(current => [chat, ...current.filter(item => Number(item.id) !== Number(chat.id))]);
          setSelectedChat(chat);
        }}
        onGroupCreated={group => {
          setMenuVisible(false);
          setTab('group');
          setChats(current => [group, ...current.filter(item => Number(item.id) !== Number(group.id))]);
          setSelectedChat(group);
        }}
      />
    </SafeAreaView>
  );
}

function AppContent() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [notificationPreferences, setNotificationPreferencesState] = useState(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [initialChatId, setInitialChatId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([sessionManager.getSession(), getNotificationPreferences()]).then(([saved, preferences]) => { if (active) { setSession(saved); setNotificationPreferencesState(preferences); setReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !showNotificationSettings) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowNotificationSettings(false);
      return true;
    });
    return () => subscription.remove();
  }, [showNotificationSettings]);

  useEffect(() => {
    if (session && notificationPreferences) {
      requestNotificationPermission().then(device => {
        if (device?.data) return platformApi.registerDeviceToken({ token: device.data, platform: Platform.OS.toUpperCase() });
        return platformApi.unregisterDeviceToken();
      }).catch(() => null);
    }
  }, [session, notificationPreferences]);

  useEffect(() => {
    const openResponse = response => {
      const chatId = response?.notification?.request?.content?.data?.chat_id;
      if (chatId) { setInitialChatId(Number(chatId)); setShowNotificationSettings(false); }
    };
    getLastNotificationResponse().then(openResponse).catch(() => null);
    const subscription = subscribeToNotificationResponses(openResponse);
    return () => subscription.remove();
  }, []);

  if (!ready) return <SafeAreaView style={styles.splash} edges={['top', 'bottom', 'left', 'right']}><Image source={require('./assets/splash-logo.png')} style={styles.splashLogo} resizeMode="contain" /><ActivityIndicator color="#3157d5" /><Text style={styles.splashText}>Loading CloudComAI…</Text></SafeAreaView>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  if (showNotificationSettings) return <NotificationSettings preferences={notificationPreferences} onBack={() => setShowNotificationSettings(false)} onChange={changes => setNotificationPreferencesState(current => { const next = { ...current, ...changes }; setNotificationPreferences(next); return next; })} />;
  return <ChatsScreen session={session} onLogout={() => setSession(null)} onSettings={() => setShowNotificationSettings(true)} initialChatId={initialChatId} />;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center', flexShrink: 0 }, headerIdentity: { flex: 1, minWidth: 0, paddingRight: 12 }, settingsCard: { margin: 16, padding: 18, borderRadius: 16, backgroundColor: '#fff' }, settingsIntro: { color: '#68748a', marginBottom: 8 }, settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, settingLabel: { color: '#172033', fontSize: 15, fontWeight: '600' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f7fb' }, splashLogo: { width: 180, height: 72, marginBottom: 8 }, splashText: { color: '#526078' },
  loginPage: { flex: 1, backgroundColor: '#eef2ff' }, authKeyboard: { flex: 1 }, authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 }, loginCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 20, elevation: 4 }, authLogo: { width: 176, height: 60, alignSelf: 'center', marginBottom: 4 },
  logo: { width: 56, height: 56, alignSelf: 'center', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5' }, logoText: { color: '#fff', fontSize: 28, fontWeight: '800' }, title: { marginTop: 14, textAlign: 'center', fontSize: 27, fontWeight: '800', color: '#172033' }, subtitle: { marginTop: 6, marginBottom: 22, textAlign: 'center', color: '#68748a' },
  input: { minHeight: 50, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', backgroundColor: '#fbfcff' }, rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -2, marginBottom: 14 }, rememberCheck: { width: 22, height: 22, textAlign: 'center', textAlignVertical: 'center', borderRadius: 6, overflow: 'hidden', color: '#fff', backgroundColor: '#3157d5', fontWeight: '800' }, rememberText: { flex: 1, color: '#68748a', fontSize: 12 }, genderRow: { flexDirection: 'row', gap: 10, marginBottom: 12 }, genderButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, backgroundColor: '#fbfcff' }, genderButtonActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, genderButtonText: { color: '#68748a', fontWeight: '700' }, genderButtonTextActive: { color: '#3157d5' }, authSwitchRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, authSwitchText: { color: '#68748a', fontSize: 13 }, authSwitchLink: { color: '#3157d5', fontWeight: '800', fontSize: 13 }, error: { marginBottom: 12, color: '#dc2626' }, primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.65 },
  appPage: { flex: 1, backgroundColor: '#f5f7fb' }, chatKeyboard: { flex: 1 }, header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' }, headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 }, headerUser: { marginTop: 2, color: '#dbe4ff', fontSize: 12 }, logout: { color: '#fff', fontWeight: '700' }, back: { color: '#fff', fontWeight: '700', width: 54 }, deleteChat: { color: '#fee2e2', fontWeight: '700', textAlign: 'right', minWidth: 54 }, tabs: { flexDirection: 'row', padding: 8, margin: 14, borderRadius: 12, backgroundColor: '#e5eaf4' }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 }, activeTab: { backgroundColor: '#fff' }, tabText: { color: '#69758b', fontWeight: '700' }, activeTabText: { color: '#3157d5' },
  loader: { marginTop: 50 }, list: { paddingHorizontal: 14, paddingBottom: 24 }, emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#718096', textAlign: 'center', padding: 18 }, listError: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' }, chatRow: { minHeight: 76, marginBottom: 9, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#fff' }, avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#dfe6ff', overflow: 'hidden' }, avatarImage: { ...StyleSheet.absoluteFillObject, width: 48, height: 48, zIndex: 2 }, avatarFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#3157d5', fontSize: 18, fontWeight: '800' }, chatMeta: { flex: 1, marginHorizontal: 12 }, chatName: { color: '#172033', fontWeight: '700', fontSize: 15 }, preview: { marginTop: 5, color: '#778196', fontSize: 12 }, unread: { minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' }, messageList: { flexGrow: 1, padding: 14, justifyContent: 'flex-end' }, messageBubble: { alignSelf: 'flex-start', maxWidth: '82%', marginBottom: 9, padding: 11, borderRadius: 14, backgroundColor: '#fff' }, myMessage: { alignSelf: 'flex-end', backgroundColor: '#dfe6ff' }, messageImage: { width: 220, height: 220, maxWidth: '100%', borderRadius: 10, marginBottom: 8, backgroundColor: '#e5eaf4' }, attachmentLabel: { color: '#3157d5', fontSize: 14, fontWeight: '600' }, messageText: { color: '#172033', fontSize: 15 }, messageTime: { alignSelf: 'flex-end', marginTop: 4, color: '#778196', fontSize: 10 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, minHeight: 64, borderTopWidth: 1, borderTopColor: '#dfe4ee', backgroundColor: '#fff' }, attachButton: { minHeight: 46, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#e5eaf4', flexShrink: 0 }, attachText: { color: '#3157d5', fontSize: 22 }, composerInput: { flex: 1, maxHeight: 100, minHeight: 44, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033' }, sendButton: { minHeight: 46, minWidth: 64, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5', flexShrink: 0 }, sendText: { color: '#fff', fontWeight: '700' },
});
