import React, { useState, useEffect, useCallback, useRef } from 'react';
import './styles.css';
import Sidebar from './components/Sidebar';
import ChatDirectory from './components/ChatDirectory';
import ChatCanvas from './components/ChatCanvas';
import Auth from './components/Auth';
import GroupMembershipModal from './components/GroupMembershipModal';
import GroupCreationModal from './components/GroupCreationModal';
import GroupEditModal from './components/GroupEditModal';
import ProfileEditModal from './components/ProfileEditModal';
import SettingsPanel from './components/SettingsPanel';
import GoogleContactsPanel from './components/GoogleContactsPanel';
import InterestsScreen from './components/InterestsScreen';
import PollModal from './components/PollModal';

const API = import.meta.env.VITE_API_BASE_URL || 'https://cloudcomai.com/apiapp/api';
const groupTypes = ['Family Group', 'Friend Group', 'Fan Group', 'Study Group', 'College Group', 'Class Group', 'Department Group', 'Project Group', 'Club Group', 'Alumni Group', 'Workplace Group', 'Neighborhood Group', 'Event Group', 'Staff Group'];
const interests = ['Private Chats', 'Public Chat Rooms', ...groupTypes, 'Communities', 'Local Groups', 'Jobs and Internships', 'Business and Finance', 'Technology', 'Sports', 'Music', 'Movies', 'Education', 'Gaming', 'Travel', 'Career Guidance'];

async function api(path, options = {}) {
    const token = localStorage.getItem('cc_token');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
}

export default function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [screen, setScreen] = useState(localStorage.getItem('cc_token') ? 'app' : 'login');
    const [token, setToken] = useState(localStorage.getItem('cc_token') || '');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('cc_user') || 'null'));
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
    const [topInterests, setTopInterests] = useState(['Private Chats', 'Family Group', 'Study Group', 'Technology']);
    const latestMessageIdRef = useRef(0);

    const auth = (u, t) => {
        setUser(u);
        setToken(t);
        localStorage.setItem('cc_user', JSON.stringify(u));
        localStorage.setItem('cc_token', t);
        setScreen('app');
    };

    const logout = () => {
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        setToken('');
        setUser(null);
        setSelectedChat(null);
        setChats([]);
        setMessages([]);
        latestMessageIdRef.current = 0;
        setScreen('login');
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
        if (activeTab === 'groups') return '/chats.php?type=group';
        if (activeTab === 'people') return '/users_list.php';
        return '/chats.php?type=private';
    }, [activeTab]);

    const refreshConversationList = useCallback(async () => {
        if (!token || screen !== 'app') return;
        try {
            const data = await api(getActiveListPath(), { method: 'GET' });
            if (data.chats) {
                const mapped = data.chats.map(chat => ({ ...chat, id: Number(chat.id), isGroup: chat.type === 'group' }));
                setChats(mapped);
                setSelectedChat(prev => {
                    if (!prev) return mapped[0] || null;
                    const refreshed = mapped.find(chat => chat.id === Number(prev.id));
                    return refreshed ? { ...prev, ...refreshed } : prev;
                });
            } else if (data.users) {
                setChats(data.users.map(u => ({ id: Number(u.id), name: u.name, preview: `@${u.user_id} - Click to start chat`, time: '', unread: 0, online: Boolean(u.online), image_url: u.image_url, isContact: true })));
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
            try { if (!stopped) await api('/heartbeat.php', { method: 'POST' }); }
            catch (err) { console.warn('Presence heartbeat failed:', err); }
        };
        sendHeartbeat();
        const intervalId = window.setInterval(sendHeartbeat, 30000);
        return () => { stopped = true; window.clearInterval(intervalId); };
    }, [token, screen]);

    useEffect(() => {
        if (!token || !selectedChat || screen !== 'app' || selectedChat.isContact) return undefined;
        let cancelled = false;
        latestMessageIdRef.current = 0;
        setMessages([]);

        const getMessageId = message => Number(message?.id || 0);
        const mergeIncomingMessages = incoming => {
            if (!Array.isArray(incoming) || incoming.length === 0) return;
            setMessages(prev => {
                const existingIds = new Set(prev.map(getMessageId).filter(Boolean));
                const additions = incoming.filter(message => !existingIds.has(getMessageId(message))).sort((a, b) => getMessageId(a) - getMessageId(b));
                if (additions.length === 0) return prev;
                const next = [...prev, ...additions];
                latestMessageIdRef.current = Math.max(latestMessageIdRef.current, ...next.map(getMessageId));
                return next;
            });
        };

        const loadMessages = async () => {
            try {
                const data = await api(`/messages.php?chat_id=${selectedChat.id}`, { method: 'GET' });
                if (cancelled || !data.messages) return;
                const initialMessages = [...data.messages].sort((a, b) => getMessageId(a) - getMessageId(b));
                latestMessageIdRef.current = initialMessages.reduce((max, message) => Math.max(max, getMessageId(message)), 0);
                setMessages(initialMessages);
            } catch (err) { if (!cancelled) console.error('Unable to load messages:', err); }
        };

        const pollForNewMessages = async () => {
            try {
                const afterId = latestMessageIdRef.current;
                const data = await api(`/messages.php?chat_id=${selectedChat.id}&after_id=${afterId}`, { method: 'GET' });
                if (!cancelled) mergeIncomingMessages(data.messages);
            } catch (err) { if (!cancelled) console.error('Unable to refresh new messages:', err); }
        };

        loadMessages();
        const intervalId = window.setInterval(pollForNewMessages, 2000);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, [selectedChat, token, screen]);

    const handleSendMessage = async () => {
        if (!composer.trim() || !selectedChat) return;
        const payload = { chat_id: selectedChat.id, body: composer, reply_to_message_id: replyTo ? replyTo.id : null };
        try {
            const targetEndpoint = editing ? '/edit_message.php' : '/messages.php';
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
            const response = await api('/chats.php', { method: 'POST', body: JSON.stringify({ type: 'private', target_user_id: selectedRowItem.id }) });
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
        setModal(null);
    };

    const handleDeleteGroup = async (group) => {
        if (!group?.id) return;
        const confirmed = window.confirm(`Delete group \"${group.name}\"? This will remove the group for all members.`);
        if (!confirmed) return;
        try {
            await api(`/groups.php?id=${group.id}`, { method: 'DELETE' });
            setChats(prev => prev.filter(chat => chat.id !== group.id));
            setSelectedChat(null);
            setMessages([]);
            latestMessageIdRef.current = 0;
        } catch (err) { alert(err.message || 'Unable to delete group.'); }
    };

    const handleGroupInvite = async group => {
        if (!group?.id) return null;
        return api(`/groups.php?action=invite&id=${group.id}`, { method: 'POST' });
    };

    const handleUserUpdated = nextUser => {
        setUser(prev => ({ ...prev, ...nextUser }));
        localStorage.setItem('cc_user', JSON.stringify({ ...user, ...nextUser }));
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

    if (screen === 'login' || !token) return <Auth onAuth={auth} apiBridge={api} />;
    if (screen === 'interests') return <InterestsScreen interests={interests} topInterests={topInterests} setTopInterests={setTopInterests} saveAndContinue={() => setScreen('app')} />;

    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : ''} ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            <Sidebar user={user} setModal={setModal} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} onLogout={logout} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} onTabChange={handleTabChange} setScreen={setScreen} />

            <ChatDirectory searchQuery={searchQuery} setSearchQuery={setSearchQuery} chatFilter={chatFilter} setChatFilter={setChatFilter} filteredChats={filteredChats} selectedChat={selectedChat} setSelectedChat={handleSelectConversationRow} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} setModal={setModal} activeTab={activeTab} />

            <ChatCanvas selectedChat={selectedChat} messages={messages} user={user} setModal={setModal} replyTo={replyTo} setReplyTo={setReplyTo} editing={editing} setEditing={setEditing} composer={composer} setComposer={setComposer} onSendMessage={handleSendMessage} apiBridge={api} onDeleteGroup={handleDeleteGroup} onGroupInvite={handleGroupInvite} onAttachmentUploaded={handleAttachmentUploaded} />

            {modal && (
                <div className="modal-backdrop">
                    {modal === 'add_member' || modal === 'manage_members' ? <GroupMembershipModal type={modal} selectedChat={selectedChat} apiBridge={api} close={() => setModal(null)} onActionComplete={() => setModal(null)} />
                    : modal === 'group' ? <GroupCreationModal groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupCreated={handleGroupCreated} />
                    : modal === 'edit_group' ? <GroupEditModal group={selectedChat} groupTypes={groupTypes} apiBridge={api} close={() => setModal(null)} onGroupUpdated={handleGroupUpdated} />
                    : modal === 'profile' ? <ProfileEditModal user={user} apiBridge={api} close={() => setModal(null)} onUserUpdated={handleUserUpdated} />
                    : modal === 'settings' ? <SettingsPanel user={user} setModal={setModal} onLogout={logout} close={() => setModal(null)} setScreen={setScreen} apiBridge={api} />
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
