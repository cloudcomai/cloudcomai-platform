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
import GoogleContactsPanel from './components/GoogleContactsPanel';
import InterestsScreen from './components/InterestsScreen';
import NotificationPanel from './components/NotificationPanel';
import PollModal from './components/PollModal';
import InvitationPage from './components/InvitationPage';
import { inviteUrlFromResponse } from './utils/shareLink';
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

const inviteTokenFromLocation = () => {
    const match = window.location.hash.match(/^#invite=([^&]+)/i);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); }
    catch { return ''; }
};

const screenFromLocation = () => {
    if (new URLSearchParams(window.location.search).get('reset_token')) return 'login';

    const route = window.location.hash.replace(/^#/, '').toLowerCase();
    if (route.startsWith('invite=')) return 'invite';
    if (route === 'login' || route === 'register' || route === 'app') return route;
    return 'home';
};

const screenHashes = {
    home: '#top',
    login: '#login',
    register: '#register',
    app: '#app',
};

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [screen, setScreen] = useState(screenFromLocation);
    const [token, setToken] = useState('');
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [composer, setComposer] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [editing, setEditing] = useState(null);
    const [modal, setModal] = useState(null);
    const [chatFilter, setChatFilter] = useState('all');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('chats');
    const [topInterests, setTopInterests] = useState(defaultInterests);
    const [pendingInviteToken, setPendingInviteToken] = useState(() => inviteTokenFromLocation() || window.sessionStorage.getItem(pendingInviteStorageKey) || '');
    const latestMessageIdRef = useRef(0);

    const navigateTo = useCallback((nextScreen, { replace = false, inviteToken = '' } = {}) => {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('reset_token');
        nextUrl.hash = nextScreen === 'invite' && inviteToken
            ? `invite=${encodeURIComponent(inviteToken)}`
            : screenHashes[nextScreen] || screenHashes.home;

        const relativeUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        window.history[replace ? 'replaceState' : 'pushState']({}, '', relativeUrl);
        setScreen(nextScreen);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        let cancelled = false;
        const initializeAuth = async () => {
            const session = await loadWebSession();
            if (cancelled) return;
            if (session) {
                setUser(session.user);
                setToken(session.token);
            }
            setAuthReady(true);
        };
        const handleUnauthorized = () => {
            clearWebSession().catch(error => console.error('Unable to clear the expired session:', error));
            setToken('');
            setUser(null);
            navigateTo('login', { replace: true });
        };
        const handleLocationChange = () => {
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
        await clearWebSession();
        setToken('');
        setUser(null);
        setSelectedChat(null);
        setChats([]);
        setMessages([]);
        latestMessageIdRef.current = 0;
        setTopInterests(defaultInterests);
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
        const transport = createPollingMessageTransport({
            intervalMs: messagePollInterval,
            getCursor: () => latestMessageIdRef.current,
            fetchMessages: async (afterId, options) => {
                const { data } = await platformApi.listMessages(selectedChat.id, afterId, options);
                return data.messages || [];
            },
            onMessages: incoming => {
                setMessages(current => {
                    const result = mergeMessageBatch(current, incoming);
                    latestMessageIdRef.current = result.cursor;
                    return result.changed ? result.messages : current;
                });
            },
            onError: err => console.error('Unable to synchronize messages:', err),
        });
        transport.start();
        return () => transport.stop();
    }, [selectedChat, token, screen]);

    const handleSendMessage = async () => {
        if (!composer.trim() || !selectedChat) return;
        const payload = { chat_id: selectedChat.id, body: composer, reply_to_message_id: replyTo ? replyTo.id : null };
        try {
            const targetEndpoint = editing ? ApiRoute.EDIT_MESSAGE : ApiRoute.MESSAGES;
            if (editing) payload.editing_id = editing.id;
            const result = await api(targetEndpoint, { method: 'POST', body: JSON.stringify(payload) });
            if (editing) {
                setMessages(prev => prev.map(m => m.id === editing.id ? { ...m, body: composer, edited: true } : m));
                setEditing(null);
            } else if (result.message) {
                setMessages(prev => {
                    const messageId = Number(result.message.id || 0);
                    latestMessageIdRef.current = Math.max(latestMessageIdRef.current, messageId);
                    if (prev.some(message => Number(message.id) === messageId)) return prev;
                    return [...prev, result.message];
                });
            }
            setComposer('');
            setReplyTo(null);
            refreshConversationList();
        } catch (err) { alert(err.message); }
    };

    const handleAttachmentUploaded = useCallback(message => {
        if (!message) return;
        setMessages(prev => {
            const messageId = Number(message.id || 0);
            if (messageId) latestMessageIdRef.current = Math.max(latestMessageIdRef.current, messageId);
            if (messageId && prev.some(item => Number(item.id) === messageId)) return prev;
            return [...prev, message];
        });
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
    if (screen === 'login' || screen === 'register' || !token) {
        return (
            <Auth
                key={screen}
                onAuth={auth}
                authApi={platformApi}
                initialMode={screen === 'register' ? 'register' : 'login'}
                onNavigateHome={pendingInviteToken ? leaveInvitation : () => navigateTo('home')}
                onModeChange={nextMode => navigateTo(nextMode, { replace: true })}
            />
        );
    }
    if (screen === 'interests') return <InterestsScreen interests={interests} topInterests={topInterests} saveAndContinue={savePreferences} cancel={() => navigateTo('app', { replace: true })} />;

    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : ''} ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            <Sidebar user={user} setModal={setModal} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onLogout={logout} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} onTabChange={handleTabChange} setScreen={setScreen} />

            <ChatDirectory searchQuery={searchQuery} setSearchQuery={setSearchQuery} chatFilter={chatFilter} setChatFilter={setChatFilter} filteredChats={filteredChats} selectedChat={selectedChat} setSelectedChat={handleSelectConversationRow} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} setModal={setModal} activeTab={activeTab} topInterests={topInterests} onEditPreferences={() => setScreen('interests')} />

            <ChatCanvas selectedChat={selectedChat} messages={messages} user={user} setModal={setModal} replyTo={replyTo} setReplyTo={setReplyTo} editing={editing} setEditing={setEditing} composer={composer} setComposer={setComposer} onSendMessage={handleSendMessage} apiBridge={api} onDeleteChat={handleDeleteChat} onDeleteGroup={handleDeleteGroup} onGroupInvite={handleGroupInvite} onAttachmentUploaded={handleAttachmentUploaded} />

            {modal && (
                <div className="modal-backdrop">
                    {modal === 'add_member' || modal === 'manage_members' ? <GroupMembershipModal type={modal} selectedChat={selectedChat} apiBridge={api} close={() => setModal(null)} onActionComplete={() => setModal(null)} />
                    : modal === 'group' ? <GroupCreationModal groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupCreated={handleGroupCreated} />
                    : modal === 'edit_group' ? <GroupEditModal group={selectedChat} groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupUpdated={handleGroupUpdated} />
                    : modal === 'profile' ? <ProfileEditModal user={user} apiBridge={api} close={() => setModal(null)} onUserUpdated={handleUserUpdated} />
                    : modal === 'settings' ? <SettingsPanel user={user} setModal={setModal} onLogout={logout} close={() => setModal(null)} setScreen={nextScreen => { setModal(null); setScreen(nextScreen); }} apiBridge={api} />
                    : modal === 'notifications' ? <NotificationPanel apiBridge={api} close={() => setModal(null)} />
                    : modal === 'google_contacts' ? <GoogleContactsPanel apiBridge={api} close={() => setModal(null)} />
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
