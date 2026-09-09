import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { createPollingMessageTransport, mergeMessageBatch } from '@cloudcomai/chat-core';
import './styles.css';
import Sidebar from './components/Sidebar';
import ChatDirectory from './components/ChatDirectory';
import ChatCanvas from './components/ChatCanvas';
import Auth from './components/Auth';
import HomePage from './components/HomePage';
import GroupMembershipModal from './components/GroupMembershipModal';
import GroupCreationModal from './components/GroupCreationModal';
import GroupEditModal from './components/GroupEditModal';
import ProfileEditModal from './components/ProfileEditModal';
import SettingsPanel from './components/SettingsPanel';
import AccountToolsPanel from './components/AccountToolsPanel';
import GoogleContactsPanel from './components/GoogleContactsPanel';
import InterestsScreen from './components/InterestsScreen';
import { useMessagingStore } from './hooks/useMessagingStore';
import NotificationPanel from './components/NotificationPanel';
import PollModal from './components/PollModal';
import InvitationPage from './components/InvitationPage';
import PrivacyAccountPanel from './components/PrivacyAccountPanel';
import { inviteUrlFromResponse } from './utils/shareLink';
import { passwordResetLink, privatePasswordResetUrl } from './utils/passwordRecovery';
import {
    clearWebSession,
    requestApi as api,
    loadWebSession,
    platformApi,
    saveWebSession
} from './services/platform';

const groupTypes = ['Family Group', 'Friend Group', 'Fan Group', 'Study Group', 'College Group', 'Class Group', 'Department Group', 'Project Group', 'Club Group', 'Alumni Group', 'Workplace Group', 'Neighborhood Group', 'Event Group', 'Staff Group'];
const interests = ['Private Chats', 'Public Chat Rooms', ...groupTypes, 'Communities', 'Local Groups', 'Jobs and Internships', 'Business and Finance', 'Technology', 'Sports', 'Music', 'Movies', 'Education', 'Gaming', 'Travel', 'Career Guidance'];
const defaultInterests = ['Private Chats', 'Family Group', 'Study Group', 'Technology'];
const messagePollInterval = Number(import.meta.env.VITE_MESSAGE_POLL_INTERVAL_MS || 3000);
const pendingInviteStorageKey = 'cloudcomai.pendingInvite';
const defaultPrivacySettings = { hide_online_status: false, media_auto_download: false, screenshot_alerts: true };

const inviteTokenFromLocation = () => {
    const match = window.location.hash.match(/^#invite=([^&]+)/i);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); }
    catch { return ''; }
};

const screenFromLocation = () => {
    if (passwordResetLink(window.location.href).present) return 'reset';

    const route = window.location.hash.replace(/^#/, '').toLowerCase();
    if (route.startsWith('invite=')) return 'invite';
    if (['login', 'register', 'forgot', 'app'].includes(route)) return route;
    return 'home';
};

const screenHashes = {
    home: '#top',
    login: '#login',
    register: '#register',
    forgot: '#forgot',
    reset: '#reset',
    app: '#app',
};

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [screen, setScreen] = useState(screenFromLocation);
    const [resetToken, setResetToken] = useState(() => passwordResetLink(window.location.href).token);
    const [authMessage, setAuthMessage] = useState('');
    const [token, setToken] = useState('');
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [composer, setComposer] = useState('');
    const [sending, setSending] = useState(false);
    const sendInProgress = useRef(false);
    const [replyTo, setReplyTo] = useState(null);
    const [editing, setEditing] = useState(null);
    const [modal, setModal] = useState(null);
    const [chatFilter, setChatFilter] = useState('all');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('chats');
    const [topInterests, setTopInterests] = useState(defaultInterests);
    const [pendingInviteToken, setPendingInviteToken] = useState(() => inviteTokenFromLocation() || window.sessionStorage.getItem(pendingInviteStorageKey) || '');
    const [privacySettings, setPrivacySettings] = useState(defaultPrivacySettings);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const latestMessageIdRef = useRef(0);
    const activeChatRef = useRef(selectedChat); activeChatRef.current = selectedChat;
    const { store: messaging, state: localMessages, error: localMessageError, setError: setLocalMessageError } = useMessagingStore(user?.id, message => {
        if (Number(activeChatRef.current?.id) === Number(message.chat_id)) setMessages(current => mergeMessageBatch(current, [message]).messages);
    });
    const messagingRef = useRef(messaging); messagingRef.current = messaging;
    useEffect(() => {
        setComposer(messaging?.snapshot().drafts[String(selectedChat?.id)] || '');
        setReplyTo(null); setEditing(null);
    }, [messaging, selectedChat?.id]);
    const updateComposer = value => {
        const next = typeof value === 'function' ? value(composer) : value;
        setComposer(next);
        if (!editing && messaging && selectedChat?.id) messaging.saveDraft(selectedChat.id, next).catch(e => setLocalMessageError(e.message));
    };


    const navigateTo = useCallback((nextScreen, { replace = false, inviteToken = '' } = {}) => {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('reset_token');
        nextUrl.hash = nextScreen === 'invite' && inviteToken
            ? `invite=${encodeURIComponent(inviteToken)}`
            : screenHashes[nextScreen] || screenHashes.home;

        const relativeUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        window.history[replace ? 'replaceState' : 'pushState']({}, '', relativeUrl);
        setScreen(nextScreen);
        setResetToken('');
        if (nextScreen !== 'login') setAuthMessage('');
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        let cancelled = false;
        const initializeAuth = async () => {
            const session = await loadWebSession();
            if (cancelled) return;
            if (session && !passwordResetLink(window.location.href).present) {
                setUser(session.user);
                setToken(session.token);
            }
            setAuthReady(true);
        };
        const handleUnauthorized = () => {
            clearWebSession().catch(error => console.error('Unable to clear the expired session:', error));
            setToken('');
            setUser(null);
            if (!passwordResetLink(window.location.href).present) navigateTo('login', { replace: true });
        };
        const handleLocationChange = () => {
            const recovery = passwordResetLink(window.location.href);
            setResetToken(recovery.token);
            if (recovery.present) {
                setToken('');
                setUser(null);
                window.history.replaceState({}, '', privatePasswordResetUrl(window.location.href));
            }
            const locationInviteToken = inviteTokenFromLocation();
            if (locationInviteToken) {
                setPendingInviteToken(locationInviteToken);
                window.sessionStorage.setItem(pendingInviteStorageKey, locationInviteToken);
            }
            setScreen(screenFromLocation());
        };
        window.addEventListener('cloudcomai:unauthorized', handleUnauthorized);
        window.addEventListener('hashchange', handleLocationChange);
        window.addEventListener('popstate', handleLocationChange);
        window.history.replaceState({}, '', privatePasswordResetUrl(window.location.href));
        initializeAuth();
        return () => {
            cancelled = true;
            window.removeEventListener('cloudcomai:unauthorized', handleUnauthorized);
            window.removeEventListener('hashchange', handleLocationChange);
            window.removeEventListener('popstate', handleLocationChange);
        };
    }, [navigateTo]);

    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        platformApi.getPreferences()
            .then(({ data }) => {
                if (!cancelled && data.configured && Array.isArray(data.preferences)) setTopInterests(data.preferences);
            })
            .catch(error => console.warn('Unable to load preferences:', error));
        return () => { cancelled = true; };
    }, [token]);

    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        platformApi.getPrivacySettings()
            .then(({ data }) => {
                if (!cancelled) setPrivacySettings(current => ({ ...current, ...(data.settings || {}) }));
            })
            .catch(error => console.warn('Unable to load privacy settings:', error));
        return () => { cancelled = true; };
    }, [token]);

    useEffect(() => {
        if (pendingInviteToken) window.sessionStorage.setItem(pendingInviteStorageKey, pendingInviteToken);
    }, [pendingInviteToken]);

    useEffect(() => {
        const pageTitles = {
            home: 'CloudComAI — Secure Chats. Smart Features. Total Control.',
            login: 'Sign in | CloudComAI',
            register: 'Create an account | CloudComAI',
            app: 'CloudComAI Messenger',
            interests: 'Interests | CloudComAI',
            invite: 'Group invitation | CloudComAI',
        };
        document.title = pageTitles[screen] || pageTitles.home;
    }, [screen]);

    const auth = async (u, t) => {
        await saveWebSession({ user: u, token: t });
        setUser(u);
        setToken(t);
        if (pendingInviteToken) navigateTo('invite', { replace: true, inviteToken: pendingInviteToken });
        else navigateTo('app', { replace: true });
    };

    const logout = async () => {
        messaging?.stop();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try { await platformApi.revokeSession(undefined, { signal: controller.signal }); } catch {}
        finally { clearTimeout(timer); }
        await clearWebSession();
        setToken('');
        setUser(null);
        setModal(null);
        setSelectedChat(null);
        setChats([]);
        setMessages([]);
        latestMessageIdRef.current = 0;
        setTopInterests(defaultInterests);
        setPrivacySettings(defaultPrivacySettings);
        setNotificationUnreadCount(0);
        navigateTo('home', { replace: true });
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedChat(null);
        setMessages([]);
        latestMessageIdRef.current = 0;
        setSearchQuery('');
        setChatFilter('all');
    };

    const getActiveListPath = useCallback(() => {
        if (activeTab === 'groups') return { route: ApiRoute.CHATS, query: { type: 'group' } };
        if (activeTab === 'people') return null;
        return { route: ApiRoute.CHATS, query: { type: 'private' } };
    }, [activeTab]);

    const refreshConversationList = useCallback(async () => {
        if (!token || screen !== 'app') return;
        try {
            const activeListPath = getActiveListPath();
            if (!activeListPath) return;
            const { route, query } = activeListPath;
            const data = await api(route, { method: 'GET', query });
            if (data.chats) {
                const mapped = data.chats.map(chat => ({ ...chat, id: Number(chat.id), isGroup: chat.type === 'group' }));
                setChats(mapped);
                setSelectedChat(prev => {
                    if (!prev) return mapped[0] || null;
                    const refreshed = mapped.find(chat => chat.id === Number(prev.id));
                    return refreshed ? { ...prev, ...refreshed } : prev;
                });
            }
        } catch (err) {
            console.error('Unable to refresh conversation list:', err);
        }
    }, [getActiveListPath, screen, token]);

    useEffect(() => {
        if (!token || screen !== 'app') return undefined;
        let cancelled = false;
        const run = async () => { if (!cancelled) await refreshConversationList(); };
        run();
        const intervalId = window.setInterval(run, 15000);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, [refreshConversationList]);

    useEffect(() => {
        if (!token || screen !== 'app') {
            setNotificationUnreadCount(0);
            return undefined;
        }

        let cancelled = false;
        const refreshNotificationCount = async () => {
            try {
                const data = await api(ApiRoute.NOTIFICATIONS || 'v1/notifications', { method: 'GET', query: { limit: 1 } });
                if (!cancelled) setNotificationUnreadCount(Number(data.unread_count || 0));
            } catch (err) {
                console.warn('Unable to refresh notification count:', err);
            }
        };

        refreshNotificationCount();
        const intervalId = window.setInterval(refreshNotificationCount, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [token, screen]);

    useEffect(() => {
        if (!token || screen !== 'app') return undefined;
        let stopped = false;
        const sendHeartbeat = async () => {
            try { if (!stopped) await api(ApiRoute.HEARTBEAT, { method: 'POST' }); }
            catch (err) { console.warn('Presence heartbeat failed:', err); }
        };
        sendHeartbeat();
        const intervalId = window.setInterval(sendHeartbeat, 30000);
        return () => { stopped = true; window.clearInterval(intervalId); };
    }, [token, screen]);

    useEffect(() => {
        if (!token || !selectedChat || screen !== 'app' || selectedChat.isContact) return undefined;
        latestMessageIdRef.current = 0;
        setMessages([]);
        let syncFromId = 1;
        let syncedAt = '';
        const shownScreenshotAlerts = new Set();
        const transport = createPollingMessageTransport({
            intervalMs: messagePollInterval,
            getCursor: () => latestMessageIdRef.current,
            fetchMessages: async (afterId, options) => {
                const { data } = await platformApi.listMessages(selectedChat.id, afterId, { ...options, query: { sync_from_id: syncFromId, updated_after: syncedAt } });
                if (!afterId && data.messages?.length) syncFromId = Number(data.messages[0].id);
                syncedAt = data.synced_at || syncedAt;
                return data;
            },
            onMessages: incoming => {
                messagingRef.current?.acknowledge(incoming.messages || []).catch(e => setLocalMessageError(e.message));
                for (const item of incoming.screenshot_alerts || []) {
                    if (!shownScreenshotAlerts.has(item.id)) { shownScreenshotAlerts.add(item.id); window.alert(`Screenshot alert: ${item.body}`); }
                }
                setMessages(current => {
                    const result = mergeMessageBatch(current, incoming);
                    latestMessageIdRef.current = (incoming.messages || incoming).reduce((max, item) => Math.max(max, Number(item.id || 0)), latestMessageIdRef.current);
                    return result.changed ? result.messages : current;
                });
            },
            onError: err => console.error('Unable to synchronize messages:', err),
        });
        transport.start();
        return () => transport.stop();
    }, [selectedChat?.id, selectedChat?.isContact, token, screen]);

    const handleSendMessage = async () => {
        if (!composer.trim() || !selectedChat || selectedChat.blocked || sendInProgress.current) return;
        sendInProgress.current = true; setSending(true);
        const chatId = selectedChat.id;
        try {
            if (editing) {
                await platformApi.editMessage(editing.id, composer);
                setMessages(prev => prev.map(m => Number(m.id) === Number(editing.id) ? { ...m, body: composer, edit_count: 1, edited: true } : m));
                if (Number(activeChatRef.current?.id) === Number(chatId)) { setEditing(null); setComposer(messaging?.snapshot().drafts[String(chatId)] || ''); }
            } else {
                if (!messaging) throw new Error('Local messages are still loading. Please try again.');
                await messaging.enqueue({ chat_id: selectedChat.id, body: composer, reply_to_message_id: replyTo?.id || null });
                if (Number(activeChatRef.current?.id) === Number(chatId)) { setComposer(''); setReplyTo(null); }
                messaging.flush().catch(e => setLocalMessageError(e.message));
            }
        } catch (err) { alert(err.message); }
        finally { sendInProgress.current = false; setSending(false); }
    };

    const handleAttachmentUploaded = useCallback(message => {
        if (!message) return;
        setMessages(prev => {
            const messageId = Number(message.id || 0);
            if (messageId && prev.some(item => Number(item.id) === messageId)) return prev;
            return [...prev, message];
        });
        refreshConversationList();
    }, [refreshConversationList]);

    const handleDeleteMessage = useCallback(async (message, scope) => {
        if (!message?.id) return;
        await platformApi.deleteMessage(message.id, scope);
        setMessages(current => mergeMessageBatch(current, [], [message.id]).messages);
    }, []);

    const handlePrivacySettingsChanged = useCallback(nextSettings => {
        setPrivacySettings(current => ({ ...current, ...nextSettings }));
        refreshConversationList();
    }, [refreshConversationList]);

    const handleSelectConversationRow = async (selectedRowItem) => {
        if (!selectedRowItem) return;
        if (!selectedRowItem.isContact) { setSelectedChat(selectedRowItem); return; }
        try {
            const response = await api(ApiRoute.CHATS, { method: 'POST', body: JSON.stringify({ type: 'private', target_user_id: selectedRowItem.id }) });
            if (response.chat) {
                const chat = { ...response.chat, id: Number(response.chat.id), isGroup: false };
                setActiveTab('chats');
                setChats(prev => [chat, ...prev.filter(c => c.id !== chat.id)]);
                setSelectedChat(chat);
            }
        } catch (err) { alert(err.message || 'Failed to establish a private chat.'); }
    };

    const handleGroupCreated = (newChat) => {
        setActiveTab('groups');
        setChats(prev => [newChat, ...prev.filter(c => c.id !== newChat.id)]);
        setSelectedChat(newChat);
    };

    const handleDeleteGroup = async (group) => {
        if (!group?.id) return;
        const confirmed = window.confirm(`Delete group \"${group.name}\"? This will remove the group for all members.`);
        if (!confirmed) return;
        try {
            await api(ApiRoute.GROUPS, { method: 'DELETE', query: { id: group.id } });
            setChats(prev => prev.filter(chat => chat.id !== group.id));
            setSelectedChat(null);
            setMessages([]);
            latestMessageIdRef.current = 0;
        } catch (err) { alert(err.message || 'Unable to delete group.'); }
    };

    const handleDeleteChat = async chat => {
        if (!chat?.id) return;
        const confirmed = window.confirm(`Delete your chat with \"${chat.name}\"? Your full message history and attachments will be removed from your account. ${chat.name} will keep their copy. New messages will start a fresh history.`);
        if (!confirmed) return;
        try {
            await platformApi.deleteChat(chat.id);
            setChats(current => current.filter(item => item.id !== chat.id));
            setSelectedChat(null);
            setMessages([]);
            latestMessageIdRef.current = 0;
        } catch (error) { alert(error.message || 'Unable to delete chat.'); }
    };

    const handleGroupInvite = async group => {
        if (!group?.id) return null;
        const response = await api(ApiRoute.GROUPS, { method: 'POST', query: { action: 'invite', id: group.id } });
        return { ...response, invite_url: inviteUrlFromResponse(response) };
    };

    const savePreferences = async selectedInterests => {
        const { data } = await platformApi.updatePreferences(selectedInterests);
        setTopInterests(data.preferences || selectedInterests);
        setModal(null);
        navigateTo('app', { replace: true });
    };

    const rememberInviteAndNavigate = nextScreen => {
        if (pendingInviteToken) window.sessionStorage.setItem(pendingInviteStorageKey, pendingInviteToken);
        navigateTo(nextScreen);
    };

    const leaveInvitation = () => {
        setPendingInviteToken('');
        window.sessionStorage.removeItem(pendingInviteStorageKey);
        navigateTo('home', { replace: true });
    };

    const handleInvitationJoined = async result => {
        const joinedGroup = result?.group;
        if (!joinedGroup) throw new Error('The group could not be opened.');
        const chat = { ...joinedGroup, id: Number(joinedGroup.id), type: 'group', isGroup: true };
        setPendingInviteToken('');
        window.sessionStorage.removeItem(pendingInviteStorageKey);
        setActiveTab('groups');
        setChats(current => [chat, ...current.filter(item => item.id !== chat.id)]);
        setSelectedChat(chat);
        setMessages([]);
        latestMessageIdRef.current = 0;
        navigateTo('app', { replace: true });
    };

    const handleUserUpdated = nextUser => {
        const updatedUser = { ...user, ...nextUser };
        setUser(updatedUser);
        saveWebSession({ user: updatedUser, token }).catch(error => {
            console.error('Unable to update stored session:', error);
        });
    };

    const openExistingChat = async id => {
        const results = await Promise.all(['private', 'group'].map(type => platformApi.listChats(type)));
        const chat = results.flatMap(result => result.data.chats || []).find(item => Number(item.id) === Number(id));
        if (!chat) throw new Error('This conversation is no longer available.');
        setSelectedChat({ ...chat, id: Number(id), isGroup: chat.type === 'group' });
    };
    const acceptRotatedSession = async data => {
        await saveWebSession({ token: data.token, user: { ...user, ...data.user } });
        setToken(data.token); setUser(current => ({ ...current, ...data.user }));
    };
    const cancelComposerContext = () => {
        if (editing) setComposer(messaging?.snapshot().drafts[String(selectedChat?.id)] || '');
        setReplyTo(null); setEditing(null);
    };

    const handleGroupUpdated = nextGroup => {
        setChats(prev => prev.map(chat => chat.id === Number(nextGroup.id) ? { ...chat, ...nextGroup } : chat));
        setSelectedChat(prev => prev && prev.id === Number(nextGroup.id) ? { ...prev, ...nextGroup } : prev);
    };

    const filteredChats = chats.filter(c => {
        const chatName = c.name || '';
        const matchesSearch = chatName.toLowerCase().includes(searchQuery.toLowerCase());
        if (chatFilter === 'unread') return matchesSearch && c.unread > 0;
        return matchesSearch;
    });

    if (!authReady) return <div className="auth-page"><div className="auth-card">Loading CloudComAI...</div></div>;
    if (screen === 'home') {
        return (
            <HomePage
                user={user}
                onLogin={() => navigateTo('login')}
                onRegister={() => navigateTo('register')}
                onOpenApp={() => navigateTo('app')}
                onLogout={logout}
            />
        );
    }
    if (screen === 'invite' && pendingInviteToken) {
        return (
            <InvitationPage
                inviteToken={pendingInviteToken}
                user={user}
                invitationApi={platformApi}
                onLogin={() => rememberInviteAndNavigate('login')}
                onRegister={() => rememberInviteAndNavigate('register')}
                onJoin={handleInvitationJoined}
                onHome={leaveInvitation}
            />
        );
    }
    if (['login', 'register', 'forgot', 'reset'].includes(screen) || !token) {
        return (
            <Auth
                key={screen}
                onAuth={auth}
                authApi={platformApi}
                initialMode={['register', 'forgot', 'reset'].includes(screen) ? screen : 'login'}
                resetToken={resetToken}
                initialMessage={authMessage}
                onPasswordReset={async () => {
                    await clearWebSession();
                    setToken('');
                    setUser(null);
                    setAuthMessage('Password updated. Sign in with your new password.');
                    navigateTo('login', { replace: true });
                }}
                onNavigateHome={pendingInviteToken ? leaveInvitation : () => navigateTo('home')}
                onModeChange={nextMode => navigateTo(nextMode, { replace: true })}
            />
        );
    }
    if (screen === 'interests') return <InterestsScreen interests={interests} topInterests={topInterests} saveAndContinue={savePreferences} cancel={() => navigateTo('app', { replace: true })} />;

    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : ''} ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            <Sidebar user={user} setModal={setModal} notificationUnreadCount={notificationUnreadCount} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onLogout={logout} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} onTabChange={handleTabChange} setScreen={setScreen} />

            <ChatDirectory searchQuery={searchQuery} setSearchQuery={setSearchQuery} chatFilter={chatFilter} setChatFilter={setChatFilter} filteredChats={filteredChats} selectedChat={selectedChat} setSelectedChat={handleSelectConversationRow} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} setModal={setModal} activeTab={activeTab} topInterests={topInterests} onEditPreferences={() => setScreen('interests')} />

            <ChatCanvas active={!modal} sending={sending} onComposerChange={updateComposer} onCancelContext={cancelComposerContext} onBeginEdit={message => { setEditing(message); setReplyTo(null); setComposer(message.body || message.text || ''); }} onBeginReply={message => { cancelComposerContext(); setReplyTo(message); }} pendingMessages={localMessages.outbox.filter(item => Number(item.payload.chat_id) === Number(selectedChat?.id))} localMessageError={localMessageError} onRetryPending={async id => { await messaging.retry(id); await messaging.flush(); }} onDiscardPending={id => messaging.remove(id)} onToggleSaved={async message => { if (message.saved) await platformApi.unsaveMessage(message.id); else await platformApi.saveMessage(message.id); setMessages(current => current.map(item => item.id === message.id ? { ...item, saved: !message.saved } : item)); }} onRead={result => { setNotificationUnreadCount(Number(result.unread_count || 0)); setChats(current => current.map(chat => Number(chat.id) === Number(result.chat_id) ? { ...chat, unread: Number(result.unread_messages_count || 0) } : chat)); }} selectedChat={selectedChat} messages={messages} user={user} setModal={setModal} replyTo={replyTo} setReplyTo={setReplyTo} editing={editing} setEditing={setEditing} composer={composer} setComposer={setComposer} onSendMessage={handleSendMessage} apiBridge={api} onDeleteChat={handleDeleteChat} onDeleteGroup={handleDeleteGroup} onGroupInvite={handleGroupInvite} onAttachmentUploaded={handleAttachmentUploaded} onDeleteMessage={handleDeleteMessage} mediaAutoDownload={privacySettings.media_auto_download} />

            {modal && (
                <div className="modal-backdrop">
                    {modal === 'add_member' || modal === 'manage_members' ? <GroupMembershipModal type={modal} user={user} onGroupUpdated={handleGroupUpdated} selectedChat={selectedChat} apiBridge={api} close={() => setModal(null)} onActionComplete={() => setModal(null)} />
                    : modal === 'group' ? <GroupCreationModal groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupCreated={handleGroupCreated} />
                    : modal === 'edit_group' ? <GroupEditModal group={selectedChat} groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupUpdated={handleGroupUpdated} />
                    : modal === 'profile' ? <ProfileEditModal user={user} apiBridge={api} close={() => setModal(null)} onUserUpdated={handleUserUpdated} />
                    : modal === 'settings' ? <SettingsPanel user={user} setModal={setModal} onLogout={logout} close={() => setModal(null)} setScreen={nextScreen => { setModal(null); setScreen(nextScreen); }} apiBridge={api} />
                    : modal === 'notifications' ? <NotificationPanel onOpenChat={openExistingChat} apiBridge={api} close={() => setModal(null)} onUnreadChange={setNotificationUnreadCount} />
                    : modal === 'saved_messages' || modal === 'sessions' ? <AccountToolsPanel key={modal} mode={modal} close={() => setModal(null)} onOpenChat={openExistingChat} onSessionRotated={acceptRotatedSession} onLogout={logout} onUnsave={id => setMessages(current => current.map(item => Number(item.id) === Number(id) ? { ...item, saved: false } : item))} />
                    : modal === 'google_contacts' ? <GoogleContactsPanel apiBridge={api} close={() => setModal(null)} />
                    : modal === 'privacy_account' ? <PrivacyAccountPanel privacyApi={platformApi} close={() => setModal(null)} onSettingsChanged={handlePrivacySettingsChanged} />
                    : modal === 'poll' ? <PollModal selectedChat={selectedChat} apiBridge={api} close={() => setModal(null)} onPollCreated={pollMessageObject => setMessages(prev => {
                        const messageId = Number(pollMessageObject?.id || 0);
                        if (messageId) latestMessageIdRef.current = Math.max(latestMessageIdRef.current, messageId);
                        if (!messageId || !prev.some(message => Number(message.id) === messageId)) return [...prev, pollMessageObject];
                        return prev;
                    })} />
                    : <div className="modal-content-card"><h3>Feature Panel ({modal.replace('_', ' ')})</h3><button className="primary" onClick={() => setModal(null)}>Dismiss</button></div>}
                </div>
            )}
        </div>
    );
}
