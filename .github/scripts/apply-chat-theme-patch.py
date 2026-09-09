from pathlib import Path

p = Path('apps/mobile/App.js')
s = p.read_text()
if 'ChatThemeSettings' in s and 'themeSettings={chatThemeSettings}' in s:
    raise SystemExit(0)

def replace(old, new, count=1):
    global s
    if s.count(old) < count:
        raise SystemExit(f'Expected {count} occurrence(s), found {s.count(old)}: {old[:100]}')
    s = s.replace(old, new, count)

replace('  ActivityIndicator,\n', '  ActivityIndicator,\n  Appearance,\n')
replace("import UserProfileModal from './src/components/UserProfileModal';\n", "import UserProfileModal from './src/components/UserProfileModal';\nimport ChatThemeSettings from './src/components/ChatThemeSettings';\nimport { getChatThemeSettings, resolveChatTheme } from './src/services/chatTheme';\n")
replace('function ChatDetail({ chat, user, onBack, onDeleted }) {', 'function ChatDetail({ chat, user, onBack, onDeleted, themeSettings }) {')
replace('  const searchActive = searchOpen && query.trim().length > 0;\n', '  const searchActive = searchOpen && query.trim().length > 0;\n  const theme = resolveChatTheme(themeSettings, Appearance.getColorScheme());\n')
replace("<SafeAreaView style={styles.appPage} edges={['top', 'bottom', 'left', 'right']}>", "<SafeAreaView style={[styles.appPage, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom', 'left', 'right']}>")
replace('<View style={styles.header}>\n        <Pressable onPress={onBack}>', '<View style={[styles.header, { backgroundColor: theme.colors.header }]}>\n        <Pressable onPress={onBack}>')
replace('style={[styles.messageBubble, mine && styles.myMessage, selected && styles.selectedMessage]}', 'style={[styles.messageBubble, mine && styles.myMessage, { backgroundColor: mine ? theme.colors.outgoing : theme.colors.incoming, borderColor: theme.colors.border }, selected && styles.selectedMessage]}')
replace('<View style={styles.replyPreview}>', '<View style={[styles.replyPreview, { backgroundColor: theme.colors.background, borderLeftColor: theme.colors.accent }]}>')
replace('<Text style={styles.messageTime}>', '<Text style={[styles.messageTime, { color: theme.colors.secondary, fontSize: 10 * Number(themeSettings?.textScale || 1) }]}>')
replace('<View style={styles.contextBar}>', '<View style={[styles.contextBar, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]}>')
replace('<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiStrip}', '<ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.emojiStrip, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]}')
replace('<View style={styles.composer}>', '<View style={[styles.composer, { backgroundColor: theme.colors.composer, borderTopColor: theme.colors.border }]}>')
replace('<TextInput style={styles.composerInput}', '<TextInput style={[styles.composerInput, { color: theme.colors.text, borderColor: theme.colors.border, fontSize: 15 * Number(themeSettings?.textScale || 1) }]}')
replace('<Pressable style={[styles.sendButton, sending && styles.disabled]}', '<Pressable style={[styles.sendButton, { backgroundColor: theme.colors.accent }, sending && styles.disabled]}')
replace('function NotificationSettings({ preferences, onBack, onChange, onPrivacy }) {', 'function NotificationSettings({ preferences, onBack, onChange, onPrivacy, onAppearance }) {')
replace('<Pressable onPress={onPrivacy} style={styles.settingRow}>', '<Pressable onPress={onAppearance} style={styles.settingRow}><Text style={styles.settingLabel}>Appearance & Chat Theme</Text><Text>›</Text></Pressable>\n        <Pressable onPress={onPrivacy} style={styles.settingRow}>')
replace('function ChatsScreen({ session, onLogout, onSettings, initialChatId, onProfileUpdated }) {', 'function ChatsScreen({ session, onLogout, onSettings, initialChatId, onProfileUpdated, themeSettings }) {')
replace('<ChatDetail key={selectedChat.id} chat={selectedChat} user={session.user}', '<ChatDetail key={selectedChat.id} chat={selectedChat} user={session.user} themeSettings={themeSettings}')
replace("  const [showPrivacySettings, setShowPrivacySettings] = useState(false);\n", "  const [showPrivacySettings, setShowPrivacySettings] = useState(false);\n  const [showChatThemeSettings, setShowChatThemeSettings] = useState(false);\n  const [chatThemeSettings, setChatThemeSettings] = useState({ id: 'system', accentColor: null, wallpaperUri: null, wallpaperOpacity: 0.35, textScale: 1 });\n")
replace('    setShowPrivacySettings(false);\n    setInitialChatId(null);', '    setShowPrivacySettings(false);\n    setShowChatThemeSettings(false);\n    setInitialChatId(null);')
replace('Promise.all([sessionManager.getSession(), getNotificationPreferences(), isAppLockEnabled()]).then(([saved, preferences, lockEnabled]) => {', 'Promise.all([sessionManager.getSession(), getNotificationPreferences(), isAppLockEnabled(), getChatThemeSettings()]).then(([saved, preferences, lockEnabled, themeSettings]) => {')
replace('        setAppLocked(Boolean(saved && lockEnabled));\n        setReady(true);', '        setAppLocked(Boolean(saved && lockEnabled));\n        setChatThemeSettings(themeSettings);\n        setReady(true);')
replace("if (Platform.OS !== 'android' || (!showNotificationSettings && !showPrivacySettings)) return undefined;", "if (Platform.OS !== 'android' || (!showNotificationSettings && !showPrivacySettings && !showChatThemeSettings)) return undefined;")
replace('      if (showPrivacySettings) setShowPrivacySettings(false);\n      else setShowNotificationSettings(false);', '      if (showChatThemeSettings) setShowChatThemeSettings(false);\n      else if (showPrivacySettings) setShowPrivacySettings(false);\n      else setShowNotificationSettings(false);')
replace('  if (showPrivacySettings) return <PrivacySettings onBack={() => setShowPrivacySettings(false)} />;\n', '  if (showChatThemeSettings) return <ChatThemeSettings value={chatThemeSettings} onChange={setChatThemeSettings} onBack={() => setShowChatThemeSettings(false)} />;\n  if (showPrivacySettings) return <PrivacySettings onBack={() => setShowPrivacySettings(false)} />;\n')
replace('if (showNotificationSettings) return <NotificationSettings preferences={notificationPreferences} onBack={() => setShowNotificationSettings(false)} onPrivacy={() => setShowPrivacySettings(true)}', 'if (showNotificationSettings) return <NotificationSettings preferences={notificationPreferences} onBack={() => setShowNotificationSettings(false)} onPrivacy={() => setShowPrivacySettings(true)} onAppearance={() => setShowChatThemeSettings(true)}')
replace('    initialChatId={initialChatId}\n', '    initialChatId={initialChatId}\n    themeSettings={chatThemeSettings}\n')

p.write_text(s)
