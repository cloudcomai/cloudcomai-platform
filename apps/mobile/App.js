import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Appearance,
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
import { createPollingMessageTransport, createReadTracker, formatMessageTimestamp, mergeMessageBatch } from '@cloudcomai/chat-core';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import MediaMessage from './src/components/MediaMessage';
import MediaComposer from './src/components/MediaComposer';
import PrivacySettings from './src/components/PrivacySettings';
import AccountTools from './src/components/AccountTools';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { mediaUrl, platformApi, sessionManager, subscribeToSessionExpiration, uploadAttachmentAsset } from './src/services/platform';
import { isAppLockEnabled, verifyAppLockPin } from './src/services/appLock';
import { isAppLockResumeSuppressed, withAppLockExternalActivity } from './src/utils/appLockActivity';
import { getLastNotificationResponse, getNotificationPreferences, rememberDeviceToken, forgetDeviceToken, setApplicationBadge, requestNotificationPermission, setNotificationPreferences, subscribeToNotificationResponses } from './src/services/notifications';
import { useMessagingStore } from './src/hooks/useMessagingStore';
import MobileMenu from './src/components/MobileMenu';
import { ContactsList, NotificationsList } from './src/components/MobileDashboardLists';
import PublicChatsList from './src/components/PublicChatsList';
import GroupManagement from './src/components/GroupManagement';
import UserProfileModal from './src/components/UserProfileModal';
import ChatThemeSettings from './src/components/ChatThemeSettings';
import { getChatThemeSettings, resolveChatTheme } from './src/services/chatTheme';

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
  const [success, setSuccess] = useState('');

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

  const forgotPassword = async () => {
    if (busy) return;
    if (!identifier.trim()) { setError('Enter your registered email, mobile number or User ID.'); return; }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await platformApi.forgotPassword(identifier.trim());
      setSuccess(data?.message || 'If your account has an email address, reset instructions will be sent. Check your inbox and spam folder.');
    } catch (recoveryError) {
      setError(recoveryError.message || 'Unable to request a password reset. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = nextMode => {
    if (busy) return;
    setMode(nextMode);
    setError('');
    setSuccess('');
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
            <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in once and CloudComAI will keep you signed in securely on this device.'
                : mode === 'forgot' ? 'We’ll email a reset link to your registered address. Open it in your browser, choose a new password, then return here to sign in.'
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
            ) : mode === 'forgot' ? (
              <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="Registered email, mobile or User ID" placeholderTextColor="#7f8aa3" accessibilityLabel="Registered email, mobile or User ID" onSubmitEditing={forgotPassword} />
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
            {success ? <Text style={styles.success} accessibilityLiveRegion="polite">{success}</Text> : null}
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]} onPress={mode === 'login' ? login : mode === 'forgot' ? forgotPassword : register} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset instructions' : 'Register'}</Text>}
            </Pressable>

            {mode === 'login' && <Pressable style={styles.authSwitchRow} disabled={busy} onPress={() => changeMode('forgot')}><Text style={styles.authSwitchLink}>Forgot password?</Text></Pressable>}

            <View style={styles.authSwitchRow}>
              <Text style={styles.authSwitchText}>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</Text>
              <Pressable disabled={busy} onPress={() => changeMode(mode === 'login' ? 'register' : 'login')}>
                <Text style={styles.authSwitchLink}>{mode === 'login' ? 'Register' : 'Sign in'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChatDetail({ chat, user, onBack, onDeleted, messaging, localMessages, localMessageError, deliveredMessage, themeSettings }) {
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendInProgress = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const cursorRef = useRef(0);
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const [privacy, setPrivacy] = useState({ media_auto_download: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [groupManagementOpen, setGroupManagementOpen] = useState(false);
  const [groupName, setGroupName] = useState(chat.name || 'Group');
  const [groupOwnerId, setGroupOwnerId] = useState(chat.owner_id);
  const [muted, setMuted] = useState(Boolean(chat.notifications_muted));
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchActive = searchOpen && query.trim().length > 0;
  const baseTheme = resolveChatTheme(themeSettings, Appearance.getColorScheme());
  const customAccent = themeSettings?.accentColor || baseTheme.colors.accent;
  const theme = { ...baseTheme, colors: { ...baseTheme.colors, accent: customAccent, outgoing: themeSettings?.accentColor || baseTheme.colors.outgoing } };

  useEffect(() => { setComposer(messaging?.snapshot().drafts[String(chat.id)] || ''); }, [messaging, chat.id]);
  useEffect(() => { if (Number(deliveredMessage?.chat_id) === Number(chat.id)) setMessages(current => mergeMessageBatch(current, [deliveredMessage]).messages); }, [deliveredMessage, chat.id]);
  const messagingRef = useRef(messaging); messagingRef.current = messaging;
  const changeComposer = value => {
    const next = typeof value === 'function' ? value(composer) : value;
    setComposer(next);
    if (!editing && messaging) messaging.saveDraft(chat.id, next).catch(e => setError(e.message));
  };
  const toggleSaved = async item => {
    try { if (item.saved) await platformApi.unsaveMessage(item.id); else await platformApi.saveMessage(item.id); setMessages(current => current.map(message => Number(message.id) === Number(item.id) ? { ...message, saved: !item.saved } : message)); }
    catch (e) { setError(e.message); }
  };
  const readTracker = useRef(null);
  useEffect(() => {
    const tracker = createReadTracker({ send: through => platformApi.updateChatNotificationState(chat.id, { mark_read: true, last_read_message_id: through }), onRead: result => setApplicationBadge(result.data.unread_count) });
    readTracker.current = tracker;
    return () => tracker.dispose();
  }, [chat.id]);
  const markVisibleRead = () => {
    if (AppState.currentState !== 'active' || groupManagementOpen || profileOpen || searchActive || !atBottomRef.current) return;
    readTracker.current?.mark(messages.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0));
  };
  useEffect(() => {
    const frame = requestAnimationFrame(markVisibleRead);
    const timer = setInterval(markVisibleRead, 15000);
    const subscription = AppState.addEventListener('change', markVisibleRead);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); subscription.remove(); };
  }, [messages, searchActive, groupManagementOpen, profileOpen]);

  useEffect(() => {
    let active = true;
    platformApi.getPrivacySettings().then(({ data }) => { if (active) setPrivacy(data.settings || {}); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Android 13 and older require broad gallery access for detection; do not request it solely for this feature.
    if (Platform.OS !== 'ios' && !(Platform.OS === 'android' && Number(Platform.Version) >= 34)) return undefined;
    let lastCapture = 0;
    const subscription = ScreenCapture.addScreenshotListener(async () => {
      if (AppState.currentState !== 'active' || chat.blocked || Date.now() - lastCapture < 10000) return;
      lastCapture = Date.now();
      try {
        const { data } = await platformApi.reportScreenshot(chat.id);
        Alert.alert('Screenshot detected', data.notified_users ? 'Chat participants with screenshot alerts enabled have been notified.' : 'Screenshot detected in this conversation.');
      } catch { Alert.alert('Screenshot detected', 'Unable to notify participants.'); }
    });
    return () => subscription.remove();
  }, [chat.id, chat.blocked]);

  useEffect(() => {
    if (!searchActive) return undefined;
    let active = true;
    const controller = new AbortController();
    setSearchStatus('Searching…');
    const timer = setTimeout(async () => {
      try {
        const { data } = await platformApi.searchMessages(chat.id, query.trim(), { signal: controller.signal });
        if (active) { setResults(data.messages || []); setSearchStatus(`${data.messages?.length || 0} results (up to 100)`); }
      } catch (error) { if (active) { setResults([]); setSearchStatus(error.message); } }
    }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [chat.id, query, searchActive, messages]);

  useEffect(() => {
    cursorRef.current = 0;
    setMessages([]);
    let syncedAt = '';
    let syncFromId = 1;
    const shownAlerts = new Set();
    const transport = createPollingMessageTransport({
      intervalMs: Number(process.env.EXPO_PUBLIC_MESSAGE_POLL_INTERVAL_MS || 3000),
      getCursor: () => cursorRef.current,
      fetchMessages: async (afterId, options) => {
        const { data } = await platformApi.listMessages(chat.id, afterId, { ...options, query: { sync_from_id: syncFromId, updated_after: syncedAt } });
        if (!afterId && data.messages?.length) syncFromId = Number(data.messages[0].id);
        syncedAt = data.synced_at || syncedAt;
        return data;
      },
      onMessages: incoming => {
        messagingRef.current?.acknowledge(incoming.messages || []).catch(e => setError(e.message));
        setLoading(false);
        for (const item of incoming.screenshot_alerts || []) {
          if (!shownAlerts.has(item.id)) { shownAlerts.add(item.id); Alert.alert('Screenshot alert', item.body); }
        }
        setMessages(current => {
          const result = mergeMessageBatch(current, incoming);
          cursorRef.current = (incoming.messages || incoming).reduce((max, item) => Math.max(max, Number(item.id || 0)), cursorRef.current);
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

  const onMediaMessage = message => {
    if (!message) return;
    setMessages(current => {
      const result = mergeMessageBatch(current, [message]);
      return result.messages;
    });
  };
  const deleteMessage = message => {
    const remove = async scope => {
      try {
        await platformApi.deleteMessage(message.id, scope);
        setMessages(current => mergeMessageBatch(current, [], [message.id]).messages);
        setResults(current => current.filter(item => Number(item.id) !== Number(message.id)));
      } catch (error) { Alert.alert('Unable to delete message', error.message); }
    };
    Alert.alert('Delete message?', 'Delete for me removes it only from your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => remove('self') },
      ...(Number(message.sender_id) === Number(user.id) ? [{ text: 'Delete for everyone', style: 'destructive', onPress: () => remove('everyone') }] : []),
    ]);
  };

  const sendMessage = async () => {
    const body = composer.trim();
    if (!body || sendInProgress.current || chat.blocked) return;
    sendInProgress.current = true; setSending(true);
    setError('');
    try {
      if (editing) {
        await platformApi.editMessage(editing.id, body);
        setMessages(current => current.map(item => Number(item.id) === Number(editing.id) ? { ...item, body, edit_count: 1, edited: true } : item));
        setEditing(null);
      } else {
        if (!messaging) throw new Error('Local messages are still loading. Please try again.');
        await messaging.enqueue({ chat_id: chat.id, body, reply_to_message_id: replyTo?.id || null });
        messaging.flush().catch(e => setError(e.message));
        setReplyTo(null);
      }
      setComposer(editing ? (messaging?.snapshot().drafts[String(chat.id)] || '') : '');
    } catch (sendError) {
      setError(sendError.message || (editing ? 'Unable to edit message.' : 'Unable to send message.'));
    } finally {
      sendInProgress.current = false; setSending(false);
    }
  };

  const uploadAttachment = async asset => {
    if (!asset || uploading || chat.blocked) return;
    setUploading(true); setError('');
    try {
      const { data } = await uploadAttachmentAsset(asset, {
        chat_id: chat.id,
        download_policy: 'APPROVAL_REQUIRED',
      });
      if (data.message) setMessages(current => mergeMessageBatch(current, [data.message]).messages);
    } catch (uploadError) { setError(uploadError.message || 'Unable to upload attachment.'); }
    finally { setUploading(false); }
  };

  const pickImage = async useCamera => {
    if (uploading || chat.blocked) return;
    setError('');
    try {
      const picked = await withAppLockExternalActivity(async () => {
        if (useCamera) {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Camera permission is required to take a photo.');
        }
        const options = {
          mediaTypes: ['images'],
          quality: 0.82,
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        };
        return useCamera
          ? ImagePicker.launchCameraAsync(options)
          : ImagePicker.launchImageLibraryAsync(options);
      });
      if (!picked.canceled && picked.assets?.[0]) await uploadAttachment(picked.assets[0]);
    } catch (pickerError) {
      setError(pickerError.message || 'Unable to select an image.');
    }
  };

  const pickDocument = async () => {
    if (uploading || chat.blocked) return;
    setError('');
    try {
      const picked = await withAppLockExternalActivity(() => DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
      }));
      if (!picked.canceled && picked.assets?.[0]) await uploadAttachment(picked.assets[0]);
    } catch (pickerError) {
      setError(pickerError.message || 'Unable to open the document picker.');
    }
  };

  const openAttachmentPicker = () => {
    if (uploading || chat.blocked) return;
    Alert.alert('Add attachment', 'Choose where the attachment should come from.', [
      { text: 'Camera', onPress: () => pickImage(true) },
      { text: 'Photo library', onPress: () => pickImage(false) },
      { text: 'Document', onPress: pickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmDelete = () => {
    if (chat.isGroup || chat.isPublic || deleting) return;
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
    <SafeAreaView style={[styles.appPage, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {themeSettings?.wallpaperUri ? <Image pointerEvents="none" source={{ uri: themeSettings.wallpaperUri }} style={[StyleSheet.absoluteFillObject, { opacity: Math.max(0.2, Math.min(1, 1 - Number(themeSettings.wallpaperOpacity ?? 0.35))) }]} /> : null}
      <KeyboardAvoidingView
        style={styles.chatKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { backgroundColor: theme.colors.header }]}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Chats</Text></Pressable>
        <Pressable
          style={styles.chatHeaderIdentity}
          disabled={chat.isGroup || chat.isPublic || !chat.other_user_id}
          onPress={() => setProfileOpen(true)}
          accessibilityRole={chat.isGroup || chat.isPublic ? undefined : 'button'}
          accessibilityLabel={chat.isGroup || chat.isPublic ? undefined : `View ${chat.name || 'user'} profile`}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>{chat.isGroup ? groupName : (chat.name || 'Conversation')}</Text>
          {!chat.isGroup && !chat.isPublic && chat.other_user_id ? <Text style={styles.headerProfileHint}>View profile</Text> : null}
        </Pressable>
        <View style={styles.chatHeaderActions}>
          <Pressable onPress={async () => { const next = !muted; try { await platformApi.updateChatNotificationState(chat.id, { muted: next }); setMuted(next); } catch (e) { setError(e.message || 'Unable to update mute setting.'); } }}><Text style={styles.headerActionText}>{muted ? '🔕' : '🔔'}</Text></Pressable>
          {chat.isGroup ? <Pressable onPress={() => setGroupManagementOpen(true)}><Text style={styles.deleteChat}>Manage</Text></Pressable> : chat.isPublic ? <View style={{ width: 54 }} /> : <Pressable onPress={confirmDelete} disabled={deleting}><Text style={styles.deleteChat}>{deleting ? 'Deleting' : 'Delete'}</Text></Pressable>}
        </View>
      </View>
      <View style={styles.searchRow}><Pressable onPress={() => { setSearchOpen(value => !value); setQuery(''); }}><Text style={styles.searchLink}>{searchOpen ? 'Close search' : 'Search messages'}</Text></Pressable>{chat.blocked && <Text style={styles.error}>Contact blocked</Text>}</View>
      {searchOpen && <View style={styles.searchBox}><TextInput style={styles.input} value={query} onChangeText={setQuery} maxLength={120} autoFocus placeholder="Search messages and filenames" />{searchActive && <Text>{searchStatus}</Text>}</View>}
      {error ? <Text style={styles.listError}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loader} color="#3157d5" /> : (
        <FlatList
          ref={listRef}
          data={searchActive ? results : messages}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.messageList}
          onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; atBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; markVisibleRead(); }}
          scrollEventThrottle={100}
          onContentSizeChange={() => { if (atBottomRef.current && !searchActive) listRef.current?.scrollToEnd?.({ animated: false }); }}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>}
          renderItem={({ item }) => {
            const mine = Number(item.sender_id) === Number(user.id);
            const selected = Number(selectedMessage?.id) === Number(item.id);
            return <Pressable onPress={() => setSelectedMessage(current => Number(current?.id) === Number(item.id) ? null : item)} onLongPress={() => setSelectedMessage(item)} style={[styles.messageBubble, mine && styles.myMessage, { backgroundColor: mine ? theme.colors.outgoing : theme.colors.incoming, borderColor: theme.colors.border }, selected && styles.selectedMessage]}>
              {(chat.isGroup || chat.isPublic) && <Text style={styles.sender}>{mine ? 'You' : (item.sender_name || 'Member')}</Text>}
              {item.reply_to_text ? <View style={[styles.replyPreview, { backgroundColor: theme.colors.background, borderLeftColor: theme.colors.accent }]}><Text style={styles.replySender}>{item.reply_to_sender_name || 'Member'}</Text><Text numberOfLines={2} style={styles.replyText}>{item.reply_to_text}</Text></View> : null}
              <MediaMessage message={item} autoDownload={privacy.media_auto_download} />
              <Text style={[styles.messageTime, { color: theme.colors.secondary, fontSize: 10 * Number(themeSettings?.textScale || 1) }]}>{formatMessageTimestamp(item.created_at || item.timestamp || item.time)}{Number(item.edit_count) > 0 ? ' · Edited' : ''}</Text>
              {selected ? <View style={styles.messageActions}>
                <Pressable onPress={() => toggleSaved(item)}><Text style={styles.messageActionText}>{item.saved ? 'Unsave' : 'Save'}</Text></Pressable>
                <Pressable onPress={() => { setReplyTo(item); if (editing) setComposer(messaging?.snapshot().drafts[String(chat.id)] || ''); setEditing(null); setSelectedMessage(null); }}><Text style={styles.messageActionText}>↩ Reply</Text></Pressable>
                {mine && item.type === 'text' && Number(item.edit_count || 0) === 0 ? <Pressable onPress={() => { setEditing(item); setReplyTo(null); setComposer(item.body || item.text || ''); setSelectedMessage(null); }}><Text style={styles.messageActionText}>Edit</Text></Pressable> : null}
                <Pressable onPress={() => { setSelectedMessage(null); deleteMessage(item); }}><Text style={[styles.messageActionText, styles.messageDeleteAction]}>🗑 Delete</Text></Pressable>
              </View> : null}
            </Pressable>;
          }}
        />
      )}
      {(replyTo || editing) ? <View style={[styles.contextBar, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]}><View style={styles.contextBarText}><Text style={styles.contextBarLabel}>{editing ? 'Editing message' : 'Replying to'}</Text><Text numberOfLines={1} style={styles.contextBarValue}>{(editing || replyTo)?.body || (editing || replyTo)?.text || 'Message'}</Text></View><Pressable onPress={() => { if (editing) setComposer(messaging?.snapshot().drafts[String(chat.id)] || ''); setReplyTo(null); setEditing(null); }}><Text style={styles.contextBarClose}>×</Text></Pressable></View> : null}
      {localMessageError ? <Text style={styles.listError}>{localMessageError}</Text> : null}
      {localMessages?.outbox?.some(item => item.payload.chat_id === Number(chat.id)) ? <ScrollView style={{ maxHeight: 130, flexGrow: 0 }} accessibilityLabel="Pending messages">
        {localMessages.outbox.filter(item => item.payload.chat_id === Number(chat.id)).map(item => <View key={item.id} style={{ padding: 8, backgroundColor: '#eef2ff' }}><Text numberOfLines={2}>{item.payload.body}</Text><Text style={styles.preview}>{item.status === 'sending' ? 'Sending…' : item.status === 'failed' ? item.error : 'Queued · sends when connected'}</Text>{item.status !== 'sending' && <View style={styles.messageActions}><Pressable onPress={() => messaging.retry(item.id).then(() => messaging.flush()).catch(e => setError(e.message))}><Text style={styles.messageActionText}>Retry</Text></Pressable><Pressable onPress={() => messaging.remove(item.id).catch(e => setError(e.message))}><Text style={styles.messageActionText}>Discard</Text></Pressable></View>}</View>)}
      </ScrollView> : null}
      <MediaComposer chat={chat} onMessage={onMediaMessage} />
      {emojiOpen ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.emojiStrip, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]} contentContainerStyle={styles.emojiStripContent}>
        <Pressable key="😀" onPress={() => changeComposer(value => `${value}😀`)} style={styles.emojiButton}><Text style={styles.emojiText}>😀</Text></Pressable><Pressable key="😂" onPress={() => changeComposer(value => `${value}😂`)} style={styles.emojiButton}><Text style={styles.emojiText}>😂</Text></Pressable><Pressable key="😍" onPress={() => changeComposer(value => `${value}😍`)} style={styles.emojiButton}><Text style={styles.emojiText}>😍</Text></Pressable><Pressable key="😊" onPress={() => changeComposer(value => `${value}😊`)} style={styles.emojiButton}><Text style={styles.emojiText}>😊</Text></Pressable><Pressable key="👍" onPress={() => changeComposer(value => `${value}👍`)} style={styles.emojiButton}><Text style={styles.emojiText}>👍</Text></Pressable><Pressable key="🙏" onPress={() => changeComposer(value => `${value}🙏`)} style={styles.emojiButton}><Text style={styles.emojiText}>🙏</Text></Pressable><Pressable key="❤️" onPress={() => changeComposer(value => `${value}❤️`)} style={styles.emojiButton}><Text style={styles.emojiText}>❤️</Text></Pressable><Pressable key="🎉" onPress={() => changeComposer(value => `${value}🎉`)} style={styles.emojiButton}><Text style={styles.emojiText}>🎉</Text></Pressable><Pressable key="😢" onPress={() => changeComposer(value => `${value}😢`)} style={styles.emojiButton}><Text style={styles.emojiText}>😢</Text></Pressable><Pressable key="😡" onPress={() => changeComposer(value => `${value}😡`)} style={styles.emojiButton}><Text style={styles.emojiText}>😡</Text></Pressable><Pressable key="🤔" onPress={() => changeComposer(value => `${value}🤔`)} style={styles.emojiButton}><Text style={styles.emojiText}>🤔</Text></Pressable><Pressable key="👏" onPress={() => changeComposer(value => `${value}👏`)} style={styles.emojiButton}><Text style={styles.emojiText}>👏</Text></Pressable>
      </ScrollView> : null}
      <View style={[styles.composer, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]}><Pressable style={styles.emojiToggle} onPress={() => setEmojiOpen(value => !value)}><Text style={styles.emojiToggleText}>☺</Text></Pressable><Pressable style={styles.attachButton} onPress={openAttachmentPicker} disabled={uploading || chat.blocked} accessibilityLabel="Add photo or document"><Text style={styles.attachText}>{uploading ? '…' : '＋'}</Text></Pressable><TextInput style={[styles.composerInput, { color: theme.colors.text, borderColor: theme.colors.border, fontSize: 15 * Number(themeSettings?.textScale || 1) }]} value={composer} onChangeText={changeComposer} editable={!sending && !chat.blocked} placeholder="Type a message..." placeholderTextColor="#7f8aa3" multiline onSubmitEditing={sendMessage} /><Pressable style={[styles.sendButton, { backgroundColor: theme.colors.accent }, sending && styles.disabled]} onPress={sendMessage} disabled={sending || chat.blocked}><Text style={styles.sendText}>Send</Text></Pressable></View>
      </KeyboardAvoidingView>
      {chat.isGroup ? <GroupManagement
        visible={groupManagementOpen}
        group={{ ...chat, name: groupName, owner_id: groupOwnerId }}
        user={user}
        onClose={() => setGroupManagementOpen(false)}
        onGroupUpdated={updated => { setGroupName(updated.name || groupName); if (updated.owner_id) setGroupOwnerId(updated.owner_id); }}
        onGroupDeleted={onDeleted}
      /> : null}
      <UserProfileModal
        visible={profileOpen}
        userId={chat.other_user_id}
        fallbackName={chat.name}
        onClose={() => setProfileOpen(false)}
      />
    </SafeAreaView>
  );
}

function NotificationSettings({ preferences, onBack, onChange, onPrivacy, onAppearance, onAccountTool }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = async changes => { if (busy) return; setBusy(true); setError(''); try { await onChange(changes); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const items = [['enabled', 'Push notifications'], ['message', 'Messages'], ['group', 'Groups'], ['attachment', 'Attachments'], ['system', 'System']];
  return (
    <SafeAreaView style={styles.appPage} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.headerTitle}>Settings</Text><View style={{ width: 54 }} />
      </View>
      <ScrollView contentContainerStyle={styles.settingsCard}>
        <Pressable onPress={onAppearance} style={styles.settingRow}><Text style={styles.settingLabel}>Appearance & Chat Theme</Text><Text>›</Text></Pressable>
        {[['saved_messages', 'Saved messages'], ['sessions', 'Devices & sessions']].map(([id, label]) => <Pressable key={id} onPress={() => onAccountTool(id)} style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><Text>›</Text></Pressable>)}
        <Pressable onPress={onPrivacy} style={styles.settingRow}><Text style={styles.settingLabel}>Privacy & Account</Text><Text>›</Text></Pressable>
        <Text style={styles.settingsIntro}>Choose push notifications for your account on every device.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {items.map(([key, label]) => <View key={key} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Switch disabled={busy} value={Boolean(preferences?.[key])} onValueChange={value => update({ [key]: value })} />
        </View>)}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChatsScreen({ session, onLogout, onSettings, initialChatId, onInitialChatConsumed, onProfileUpdated, messaging, localMessages, localMessageError, deliveredMessage, themeSettings }) {
  const [section, setSection] = useState('all');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuInitialScreen, setMenuInitialScreen] = useState('menu');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const lastBackPressRef = useRef(0);

  const loadChats = useCallback(async (refresh = false, silent = false) => {
    if (section === 'contacts' || section === 'notifications' || section === 'public') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      if (section === 'all') {
        const [{ data: privateData }, { data: groupData }] = await Promise.all([
          platformApi.listChats('private'),
          platformApi.listChats('group'),
        ]);
        setChats([
          ...normalizeChats(privateData.chats, false),
          ...normalizeChats(groupData.chats, true),
        ].sort((a, b) => String(b.last_message_at || b.created_at || '').localeCompare(String(a.last_message_at || a.created_at || ''))));
      } else {
        const type = section === 'groups' ? 'group' : 'private';
        const { data } = await platformApi.listChats(type);
        setChats(normalizeChats(data.chats, type === 'group'));
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load chats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [section]);
  useEffect(() => {
    const timer = setInterval(() => { if (!selectedChat && AppState.currentState === 'active') loadChats(false, true); }, 15000);
    return () => clearInterval(timer);
  }, [loadChats, selectedChat]);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    if (!initialChatId) return;
    const openInitial = async () => {
      const local = chats.find(item => Number(item.id) === Number(initialChatId));
      if (local) { setSelectedChat(local); onInitialChatConsumed?.(); return; }
      try {
        const [{ data: privateData }, { data: groupData }, { data: publicData }] = await Promise.all([
          platformApi.listChats('private'),
          platformApi.listChats('group'),
          platformApi.listChats('public'),
        ]);
        const target = [
          ...normalizeChats(privateData.chats, false),
          ...normalizeChats(groupData.chats, true),
          ...(publicData.chats || []).map(chat => ({ ...chat, id: Number(chat.id), isPublic: true, isGroup: false })),
        ].find(item => Number(item.id) === Number(initialChatId));
        if (target) { setSelectedChat(target); onInitialChatConsumed?.(); }
      } catch {}
    };
    openInitial();
  }, [chats, initialChatId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedChat) {
        setSelectedChat(null);
        return true;
      }
      if (section !== 'all') {
        setSection('all');
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
  }, [selectedChat, section]);

  const openMenu = initialScreen => {
    setMenuInitialScreen(initialScreen || 'menu');
    setMenuVisible(true);
  };
  const openChatFromNotification = async chatId => {
    try {
      const [{ data: privateData }, { data: groupData }, { data: publicData }] = await Promise.all([
        platformApi.listChats('private'),
        platformApi.listChats('group'),
        platformApi.listChats('public'),
      ]);
      const target = [
        ...normalizeChats(privateData.chats, false),
        ...normalizeChats(groupData.chats, true),
        ...(publicData.chats || []).map(chat => ({ ...chat, id: Number(chat.id), isPublic: true, isGroup: false })),
      ].find(item => Number(item.id) === Number(chatId));
      if (target) {
        setSection(target.isPublic ? 'public' : target.isGroup ? 'groups' : 'private');
        setSelectedChat(target);
      }
    } catch (e) {
      setError(e.message || 'Unable to open notification chat.');
    }
  };

  if (selectedChat) return <ChatDetail messaging={messaging} localMessages={localMessages} localMessageError={localMessageError} deliveredMessage={deliveredMessage} key={selectedChat.id} chat={selectedChat} user={session.user} themeSettings={themeSettings} onBack={() => { setSelectedChat(null); loadChats(false, true); }} onDeleted={() => { setSelectedChat(null); loadChats(true); }} />;

  const filteredChats = searchText.trim()
    ? chats.filter(item => `${item.name || ''} ${item.preview || ''}`.toLowerCase().includes(searchText.trim().toLowerCase()))
    : chats;
  const navItems = [['all','Chats','💬'],['public','Public','🌐'],['contacts','Contacts','👥'],['notifications','Alerts','🔔'],['groups','Groups','👪']];
  const topTabs = [['all','All Chats'],['private','Private'],['groups','Groups'],['public','Public Chats'],['contacts','Contacts']];

  return (
    <SafeAreaView style={styles.mobileHome} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.mobileTopBar}>
        <Pressable style={styles.topIconButton} onPress={() => openMenu('menu')}><Text style={styles.topIconText}>☰</Text></Pressable>
        <View style={styles.mobileBrand}><Image source={require('./assets/app-icon.png')} style={styles.mobileBrandIcon} resizeMode="contain" /><Text style={styles.mobileBrandText}>CloudComAI</Text></View>
        <View style={styles.mobileTopActions}>
          <Pressable style={styles.topIconButton} onPress={() => { setSearchOpen(value => !value); setSearchText(''); }}><Text style={styles.topIconText}>⌕</Text></Pressable>
        </View>
      </View>
      {searchOpen ? <View style={styles.mobileSearchWrap}><TextInput style={styles.mobileSearchInput} value={searchText} onChangeText={setSearchText} autoFocus placeholder="Search conversations" placeholderTextColor="#8a94a6" /></View> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalStrip} contentContainerStyle={styles.quickActions}>
        <Pressable style={styles.quickAction} onPress={() => openMenu('private')}><View style={styles.quickCircle}><Text style={styles.quickIcon}>＋</Text></View><Text style={styles.quickLabel}>New Chat</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => openMenu('group')}><View style={styles.quickCircle}><Text style={styles.quickIcon}>👪</Text></View><Text style={styles.quickLabel}>New Group</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setSection('contacts')}><View style={styles.quickCircle}><Text style={styles.quickIcon}>👥</Text></View><Text style={styles.quickLabel}>Contacts</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => openMenu('menu')}><View style={styles.quickCircle}><Text style={styles.quickIcon}>▥</Text></View><Text style={styles.quickLabel}>Polls</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={onSettings}><View style={styles.quickCircle}><Text style={styles.quickIcon}>⚙</Text></View><Text style={styles.quickLabel}>Settings</Text></Pressable>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryStrip} contentContainerStyle={styles.categoryTabs}>
        {topTabs.map(([value,label]) => <Pressable key={value} style={[styles.categoryTab, section === value && styles.categoryTabActive]} onPress={() => { setSection(value); setSearchText(''); }}><Text style={[styles.categoryTabText, section === value && styles.categoryTabTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.mobileContent}>
        {section === 'contacts' ? <ContactsList onOpenChat={chat => { setSection('private'); setSelectedChat(chat); }} />
          : section === 'notifications' ? <NotificationsList onOpenChat={openChatFromNotification} />
          : section === 'public' ? <PublicChatsList onOpenChat={chat => { setSection('public'); setSelectedChat(chat); }} />
          : <>
            {error ? <Text style={styles.listError}>{error}</Text> : null}
            {loading ? <ActivityIndicator style={styles.loader} color="#3157d5" /> : <FlatList
              data={filteredChats}
              keyExtractor={item => `${item.isGroup ? 'g' : 'p'}-${item.id}`}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadChats(true)} />}
              contentContainerStyle={filteredChats.length ? styles.mobileChatList : styles.emptyList}
              ListEmptyComponent={<Text style={styles.emptyText}>No conversations found.</Text>}
              renderItem={({ item }) => {
                const imageId = item.isGroup ? item.id : (item.other_user_id || item.id);
                const title = item.name || 'Conversation';
                return <Pressable onPress={() => setSelectedChat(item)} style={styles.mobileChatRow}>
                  <View style={styles.mobileAvatar}><Image source={{ uri: mediaUrl(item.isGroup ? 'group' : 'user', imageId, item.image_version) }} style={styles.mobileAvatarImage} /><View style={styles.mobileAvatarFallback}><Text style={styles.mobileAvatarText}>{title[0]?.toUpperCase() || 'C'}</Text></View></View>
                  <View style={styles.mobileChatMeta}><Text numberOfLines={1} style={styles.mobileChatName}>{title}</Text><Text numberOfLines={1} style={styles.mobilePreview}>{localMessages?.drafts?.[String(item.id)] ? `Draft: ${localMessages.drafts[String(item.id)]}` : item.preview || (item.isGroup ? 'Group conversation' : 'No messages yet')}</Text></View>
                  <View style={styles.mobileChatRight}><Text style={styles.mobileTime}>{compactTime(item.last_message_at || item.created_at)}</Text>{Number(item.unread || 0) > 0 ? <View style={styles.mobileUnread}><Text style={styles.mobileUnreadText}>{Number(item.unread) > 99 ? '99+' : item.unread}</Text></View> : null}</View>
                </Pressable>;
              }}
            />}
          </>}
      </View>

      {section !== 'notifications' && section !== 'contacts' && section !== 'public' ? <Pressable style={styles.floatingChatButton} onPress={() => openMenu(section === 'groups' ? 'group' : 'private')}><Text style={styles.floatingChatIcon}>💬</Text></Pressable> : null}

      <View style={styles.bottomNav}>
        {navItems.map(([value,label,icon]) => {
          const active = (value === 'all' && (section === 'all' || section === 'private')) || section === value;
          return <Pressable key={value} style={styles.bottomNavItem} onPress={() => setSection(value)}><Text style={[styles.bottomNavIcon, active && styles.bottomNavIconActive]}>{icon}</Text><Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{label}</Text></Pressable>;
        })}
      </View>

      <MobileMenu
        visible={menuVisible}
        initialScreen={menuInitialScreen}
        user={session.user}
        onClose={() => setMenuVisible(false)}
        onOpenNotificationSettings={onSettings}
        onLogout={onLogout}
        onProfileUpdated={onProfileUpdated}
        onChatCreated={chat => { setMenuVisible(false); setSection('private'); setChats(current => [chat, ...current.filter(item => Number(item.id) !== Number(chat.id) || item.isGroup)]); setSelectedChat(chat); }}
        onGroupCreated={group => { setMenuVisible(false); setSection('groups'); setChats(current => [group, ...current.filter(item => Number(item.id) !== Number(group.id) || !item.isGroup)]); setSelectedChat(group); }}
      />
    </SafeAreaView>
  );
}

function compactTime(value) {
  if (!value) return '';
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function AppLockScreen({ onUnlocked }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const unlock = async () => {
    if (pin.length < 4) return;
    const ok = await verifyAppLockPin(pin);
    if (ok) {
      setPin('');
      setError('');
      onUnlocked();
    } else {
      setPin('');
      setError('Incorrect PIN.');
    }
  };
  return <SafeAreaView style={styles.loginPage} edges={['top','bottom','left','right']}>
    <View style={styles.appLockCard}>
      <Image source={require('./assets/app-icon.png')} style={styles.appLockIcon} resizeMode="contain" />
      <Text style={styles.title}>CloudComAI locked</Text>
      <Text style={styles.subtitle}>Enter your App Lock PIN to continue.</Text>
      <TextInput
        autoFocus
        style={styles.input}
        value={pin}
        onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="App Lock PIN"
        placeholderTextColor="#7f8aa3"
        onSubmitEditing={unlock}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={unlock}><Text style={styles.primaryButtonText}>Unlock</Text></Pressable>
    </View>
  </SafeAreaView>;
}

function AppContent() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [notificationPreferences, setNotificationPreferencesState] = useState(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showChatThemeSettings, setShowChatThemeSettings] = useState(false);
  const [accountTool, setAccountTool] = useState(null);
  const [chatThemeSettings, setChatThemeSettings] = useState({ id: 'system', accentColor: null, wallpaperUri: null, wallpaperOpacity: 0.35, textScale: 1 });
  const [initialChatId, setInitialChatId] = useState(null);
  const [appLocked, setAppLocked] = useState(false);
  const [deliveredMessage, setDeliveredMessage] = useState(null);
  const { store: messaging, state: localMessages, error: localMessageError } = useMessagingStore(session?.user?.id, setDeliveredMessage);


  useEffect(() => subscribeToSessionExpiration(() => {
    setSession(null);
    setShowNotificationSettings(false);
    setShowPrivacySettings(false);
    setShowChatThemeSettings(false);
    setAccountTool(null); setDeliveredMessage(null);
    setInitialChatId(null);
  }), []);

  useEffect(() => {
    let active = true;
    Promise.all([sessionManager.getSession(), getNotificationPreferences(), isAppLockEnabled(), getChatThemeSettings()]).then(([saved, preferences, lockEnabled, themeSettings]) => {
      if (active) {
        setSession(saved);
        setNotificationPreferencesState(preferences);
        setAppLocked(Boolean(saved && lockEnabled));
        setChatThemeSettings(themeSettings);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let backgrounded = false;
    const subscription = AppState.addEventListener('change', async nextState => {
      if (nextState !== 'active') {
        backgrounded = true;
        return;
      }
      if (backgrounded && session && !isAppLockResumeSuppressed() && await isAppLockEnabled()) setAppLocked(true);
      backgrounded = false;
    });
    return () => subscription.remove();
  }, [session]);

  useEffect(() => {
    if (Platform.OS !== 'android' || (!showNotificationSettings && !showPrivacySettings && !showChatThemeSettings && !accountTool)) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (accountTool) setAccountTool(null);
      else if (showChatThemeSettings) setShowChatThemeSettings(false);
      else if (showPrivacySettings) setShowPrivacySettings(false);
      else setShowNotificationSettings(false);
      return true;
    });
    return () => subscription.remove();
  }, [showNotificationSettings, showPrivacySettings, showChatThemeSettings, accountTool]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const syncNotifications = async () => {
      try {
        const { data } = await platformApi.getNotificationPreferences();
        if (!active) return;
        await setNotificationPreferences(data.preferences);
        if (!active) return;
        setNotificationPreferencesState(data.preferences);
      } catch { if (!active) return; }
      const device = await requestNotificationPermission();
      if (!active || await sessionManager.getToken() !== session.token) return;
      if (device?.data) { await rememberDeviceToken(device.data); await platformApi.registerDeviceToken({ token: device.data, platform: Platform.OS.toUpperCase() }, { headers: { Authorization: `Bearer ${session.token}` } }); }
      else await forgetDeviceToken(platformApi);
    };
    syncNotifications().catch(() => {});
    return () => { active = false; };
  }, [session?.token]);

  useEffect(() => {
    const openResponse = response => {
      const chatId = response?.notification?.request?.content?.data?.chat_id;
      if (Number.isSafeInteger(Number(chatId)) && Number(chatId) > 0) { setInitialChatId(Number(chatId)); setAccountTool(null); setShowChatThemeSettings(false); setShowNotificationSettings(false); setShowPrivacySettings(false); }
    };
    getLastNotificationResponse().then(openResponse).catch(() => null);
    const subscription = subscribeToNotificationResponses(openResponse);
    return () => subscription.remove();
  }, []);

  const logout = async () => {
    messaging?.stop();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try { await platformApi.revokeSession(undefined, { signal: controller.signal }); } catch {}
    finally { clearTimeout(timer); }
    await setApplicationBadge(0);
    await sessionManager.clearSession();
    setSession(null); setAccountTool(null); setShowNotificationSettings(false); setShowPrivacySettings(false); setInitialChatId(null); setDeliveredMessage(null);
  };
  const acceptRotatedSession = async data => {
    const next = { token: data.token, user: { ...session.user, ...data.user } };
    await sessionManager.setSession(next); setSession(next);
  };

  if (!ready) return <SafeAreaView style={styles.splash} edges={['top', 'bottom', 'left', 'right']}><Image source={require('./assets/splash-logo.png')} style={styles.splashLogo} resizeMode="contain" /><ActivityIndicator color="#3157d5" /><Text style={styles.splashText}>Loading CloudComAI…</Text></SafeAreaView>;
  if (!session) return <AuthScreen onAuthenticated={async nextSession => {
    setSession(nextSession);
    setAppLocked(await isAppLockEnabled());
  }} />;
  if (appLocked) return <AppLockScreen onUnlocked={() => setAppLocked(false)} />;
  if (accountTool) return <AccountTools key={accountTool} mode={accountTool} onBack={() => setAccountTool(null)} onLogout={logout} onSessionRotated={acceptRotatedSession} onOpenChat={id => { setInitialChatId(id); setAccountTool(null); setShowNotificationSettings(false); }} />;
  if (showChatThemeSettings) return <ChatThemeSettings value={chatThemeSettings} onChange={setChatThemeSettings} onBack={() => setShowChatThemeSettings(false)} />;
  if (showPrivacySettings) return <PrivacySettings onBack={() => setShowPrivacySettings(false)} />;
  if (showNotificationSettings) return <NotificationSettings onAccountTool={setAccountTool} preferences={notificationPreferences} onBack={() => setShowNotificationSettings(false)} onPrivacy={() => setShowPrivacySettings(true)} onAppearance={() => setShowChatThemeSettings(true)} onChange={async changes => { const { data } = await platformApi.updateNotificationPreferences(changes); await setNotificationPreferences(data.preferences); setNotificationPreferencesState(data.preferences); if (data.preferences.enabled) { const device = await requestNotificationPermission(); if (device?.data) { await rememberDeviceToken(device.data); await platformApi.registerDeviceToken({ token: device.data, platform: Platform.OS.toUpperCase() }); } } }} />;
  return <ChatsScreen
    messaging={messaging} localMessages={localMessages} localMessageError={localMessageError} deliveredMessage={deliveredMessage}
    session={session}
    onLogout={logout}
    onSettings={() => setShowNotificationSettings(true)}
    initialChatId={initialChatId}
    themeSettings={chatThemeSettings}
    onInitialChatConsumed={() => setInitialChatId(null)}
    onProfileUpdated={async user => {
      const next = { ...session, user };
      await sessionManager.setSession(next);
      setSession(next);
    }}
  />;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: 12, color: '#166534', lineHeight: 20 },
  searchRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 }, contextBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#dfe4ee', backgroundColor: '#f8faff' }, contextBarText: { flex: 1, minWidth: 0 }, contextBarLabel: { color: '#3157d5', fontWeight: '800', fontSize: 11 }, contextBarValue: { color: '#475569', fontSize: 12, marginTop: 2 }, contextBarClose: { color: '#64748b', fontSize: 24, paddingHorizontal: 8 }, replyPreview: { padding: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#3157d5', borderRadius: 6, backgroundColor: '#f8faff' }, replySender: { color: '#3157d5', fontSize: 10, fontWeight: '800' }, replyText: { color: '#64748b', fontSize: 11, marginTop: 2 }, messageActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 14, rowGap: 2, marginTop: 8 }, messageActionText: { paddingVertical: 10, color: '#3157d5', fontSize: 11, fontWeight: '700' }, selectedMessage: { borderWidth: 1.5, borderColor: '#3157d5' }, messageDeleteAction: { color: '#b91c1c' }, searchLink: { color: '#3157d5', fontWeight: '600' }, searchBox: { paddingHorizontal: 14, paddingBottom: 8 }, messageDelete: { alignSelf: 'flex-end', color: '#68748a', fontSize: 11, paddingTop: 8 }, sender: { color: '#68748a', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center', flexShrink: 0 }, headerIdentity: { flex: 1, minWidth: 0, paddingRight: 12 }, chatHeaderIdentity: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 }, headerProfileHint: { marginTop: 2, color: '#dbe4ff', fontSize: 10, fontWeight: '600' }, settingsCard: { margin: 16, padding: 18, borderRadius: 16, backgroundColor: '#fff' }, settingsIntro: { color: '#68748a', marginBottom: 8 }, settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#edf0f5' }, settingLabel: { flex: 1, flexShrink: 1, paddingRight: 8, color: '#172033', fontSize: 15, fontWeight: '600' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f7fb' }, splashLogo: { width: 180, height: 72, marginBottom: 8 }, splashText: { color: '#526078' },
  loginPage: { flex: 1, backgroundColor: '#eef2ff' }, appLockCard: { margin: 24, padding: 24, borderRadius: 20, backgroundColor: '#fff', alignSelf: 'stretch', marginTop: '45%' }, appLockIcon: { width: 58, height: 58, alignSelf: 'center' }, authKeyboard: { flex: 1 }, authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 }, loginCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 20, elevation: 4 }, authLogo: { width: 176, height: 60, alignSelf: 'center', marginBottom: 4 },
  logo: { width: 56, height: 56, alignSelf: 'center', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5' }, logoText: { color: '#fff', fontSize: 28, fontWeight: '800' }, title: { marginTop: 14, textAlign: 'center', fontSize: 27, fontWeight: '800', color: '#172033' }, subtitle: { marginTop: 6, marginBottom: 22, textAlign: 'center', color: '#68748a' },
  input: { minHeight: 50, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033', backgroundColor: '#fbfcff' }, rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -2, marginBottom: 14 }, rememberCheck: { width: 22, height: 22, textAlign: 'center', textAlignVertical: 'center', borderRadius: 6, overflow: 'hidden', color: '#fff', backgroundColor: '#3157d5', fontWeight: '800' }, rememberText: { flex: 1, color: '#68748a', fontSize: 12 }, genderRow: { flexDirection: 'row', gap: 10, marginBottom: 12 }, genderButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, backgroundColor: '#fbfcff' }, genderButtonActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' }, genderButtonText: { color: '#68748a', fontWeight: '700' }, genderButtonTextActive: { color: '#3157d5' }, authSwitchRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, authSwitchText: { color: '#68748a', fontSize: 13 }, authSwitchLink: { color: '#3157d5', fontWeight: '800', fontSize: 13 }, error: { marginBottom: 12, color: '#dc2626' }, primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.65 },
  mobileHome: { flex: 1, backgroundColor: '#fff' },
  mobileTopBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  topIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topIconText: { color: '#172033', fontSize: 24, fontWeight: '700' },
  mobileBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  mobileBrandIcon: { width: 34, height: 34, marginRight: 8 },
  mobileBrandText: { color: '#172033', fontSize: 21, fontWeight: '900' },
  mobileTopActions: { flexDirection: 'row', gap: 2 },
  mobileSearchWrap: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  mobileSearchInput: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#f2f5fa', color: '#172033' },
  horizontalStrip: { flexGrow: 0, flexShrink: 0, height: 112, backgroundColor: '#fff' },
  quickActions: { height: 112, paddingHorizontal: 12, paddingVertical: 12, gap: 14, alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  quickAction: { width: 68, alignItems: 'center' },
  quickCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#dbe4ff', backgroundColor: '#f8faff' },
  quickIcon: { fontSize: 21, color: '#3157d5', fontWeight: '800' },
  quickLabel: { marginTop: 5, color: '#4b5563', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  categoryStrip: { flexGrow: 0, flexShrink: 0, height: 54, backgroundColor: '#fff' },
  categoryTabs: { height: 54, paddingHorizontal: 10, alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  categoryTab: { minHeight: 38, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  categoryTabActive: { backgroundColor: '#eef2ff' },
  categoryTabText: { color: '#596579', fontSize: 12, fontWeight: '700' },
  categoryTabTextActive: { color: '#3157d5' },
  mobileContent: { flex: 1, backgroundColor: '#fff' },
  mobileChatList: { paddingBottom: 96 },
  mobileChatRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#edf0f5', backgroundColor: '#fff' },
  mobileAvatar: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  mobileAvatarImage: { ...StyleSheet.absoluteFillObject, width: 50, height: 50, zIndex: 2 },
  mobileAvatarFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mobileAvatarText: { color: '#3157d5', fontSize: 18, fontWeight: '800' },
  mobileChatMeta: { flex: 1, minWidth: 0, marginLeft: 12 },
  mobileChatName: { color: '#111827', fontSize: 16, fontWeight: '800' },
  mobilePreview: { marginTop: 4, color: '#667085', fontSize: 13 },
  mobileChatRight: { minWidth: 58, alignItems: 'flex-end', justifyContent: 'center', marginLeft: 8 },
  mobileTime: { color: '#667085', fontSize: 10 },
  mobileUnread: { minWidth: 23, height: 23, paddingHorizontal: 6, marginTop: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5' },
  mobileUnreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  floatingChatButton: { position: 'absolute', right: 20, bottom: 88, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  floatingChatIcon: { fontSize: 24 },
  bottomNav: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  bottomNavIcon: { color: '#4b5563', fontSize: 18, fontWeight: '700' },
  bottomNavIconActive: { color: '#3157d5' },
  bottomNavLabel: { marginTop: 3, color: '#4b5563', fontSize: 10, fontWeight: '600' },
  bottomNavLabelActive: { color: '#3157d5', fontWeight: '800' },
    appPage: { flex: 1, backgroundColor: '#f5f7fb' }, chatKeyboard: { flex: 1 }, header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3157d5' }, headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 }, headerUser: { marginTop: 2, color: '#dbe4ff', fontSize: 12 }, logout: { color: '#fff', fontWeight: '700' }, back: { color: '#fff', fontWeight: '700', width: 54 }, deleteChat: { color: '#fee2e2', fontWeight: '700', textAlign: 'right', minWidth: 54 }, tabs: { flexDirection: 'row', padding: 8, margin: 14, borderRadius: 12, backgroundColor: '#e5eaf4' }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 }, activeTab: { backgroundColor: '#fff' }, tabText: { color: '#69758b', fontWeight: '700' }, activeTabText: { color: '#3157d5' },
  chatHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerActionText: { fontSize: 18 }, loader: { marginTop: 50 }, list: { paddingHorizontal: 14, paddingBottom: 24 }, emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: '#718096', textAlign: 'center', padding: 18 }, listError: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, color: '#b91c1c', backgroundColor: '#fee2e2' }, chatRow: { minHeight: 76, marginBottom: 9, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: '#fff' }, avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#dfe6ff', overflow: 'hidden' }, avatarImage: { ...StyleSheet.absoluteFillObject, width: 48, height: 48, zIndex: 2 }, avatarFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#3157d5', fontSize: 18, fontWeight: '800' }, chatMeta: { flex: 1, marginHorizontal: 12 }, chatName: { color: '#172033', fontWeight: '700', fontSize: 15 }, preview: { marginTop: 5, color: '#778196', fontSize: 12 }, unread: { minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' }, unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' }, messageList: { flexGrow: 1, padding: 14, justifyContent: 'flex-end' }, messageBubble: { alignSelf: 'flex-start', maxWidth: '82%', marginBottom: 9, padding: 11, borderRadius: 14, backgroundColor: '#fff' }, myMessage: { alignSelf: 'flex-end', backgroundColor: '#dfe6ff' }, messageImage: { width: 220, height: 220, maxWidth: '100%', borderRadius: 10, marginBottom: 8, backgroundColor: '#e5eaf4' }, attachmentLabel: { color: '#3157d5', fontSize: 14, fontWeight: '600' }, messageText: { color: '#172033', fontSize: 15 }, messageTime: { alignSelf: 'flex-end', marginTop: 4, color: '#778196', fontSize: 10 }, emojiStrip: { flexGrow: 0, maxHeight: 54, borderTopWidth: 1, borderTopColor: '#edf0f5', backgroundColor: '#fff' }, emojiStripContent: { paddingHorizontal: 8, alignItems: 'center', gap: 4 }, emojiButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' }, emojiText: { fontSize: 26 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10, minHeight: 64, borderTopWidth: 1, borderTopColor: '#dfe4ee', backgroundColor: '#fff' }, emojiToggle: { minHeight: 46, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f3f4f6', flexShrink: 0 }, emojiToggleText: { fontSize: 24 }, attachButton: { minHeight: 46, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#e5eaf4', flexShrink: 0 }, attachText: { color: '#3157d5', fontSize: 22 }, composerInput: { flex: 1, minWidth: 0, maxHeight: 100, minHeight: 44, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: '#d8deea', borderRadius: 12, color: '#172033' }, sendButton: { minHeight: 46, minWidth: 56, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5', flexShrink: 0 }, sendText: { color: '#fff', fontWeight: '700' },
});
