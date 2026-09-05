import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, UserRound } from 'lucide-react';
import { mediaUrl, platformApi } from '../services/platform';

const imageUrl = chat => chat?.image_url || mediaUrl(
  chat?.isGroup ? 'group' : 'user',
  chat?.isGroup ? chat?.id : chat?.other_user_id || chat?.id,
);

export default function ChatDirectory({ searchQuery, setSearchQuery, chatFilter, setChatFilter, filteredChats, selectedChat, setSelectedChat, isSidebarOpen, setIsSidebarOpen, setModal, activeTab }) {
  const [failedImages, setFailedImages] = useState({});
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contactsTotal, setContactsTotal] = useState(0);

  const markImageFailed = id => setFailedImages(prev => ({ ...prev, [id]: true }));

  useEffect(() => {
    if (activeTab !== 'people') return undefined;
    let cancelled = false;

    const loadAllContacts = async () => {
      setContactsLoading(true);
      setContactsError('');
      try {
        const allContacts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && !cancelled) {
          const { data } = await platformApi.listContacts(page, 500);
          const pageContacts = Array.isArray(data.contacts) ? data.contacts : [];
          allContacts.push(...pageContacts);
          setContacts([...allContacts]);
          setContactsTotal(Number(data.pagination?.total || allContacts.length));
          hasMore = Boolean(data.pagination?.has_more);
          page += 1;
        }
      } catch (err) {
        if (!cancelled) setContactsError(err.message || 'Unable to load contacts.');
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    };

    setContacts([]);
    setContactsTotal(0);
    loadAllContacts();
    return () => { cancelled = true; };
  }, [activeTab]);

  const visibleContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter(contact => [
      contact.display_name,
      contact.given_name,
      contact.family_name,
      contact.email,
      contact.phone,
      contact.registered_name,
      contact.registered_user_id_text
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(query)));
  }, [contacts, searchQuery]);

  if (activeTab === 'people') {
    return (
      <section className="chats-directory">
        <header className="directory-header">
          <div className="header-flex-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <button className="sidebar-toggle-trigger" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>People & Contacts</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #777)' }}>
                {contactsTotal} registered {contactsTotal === 1 ? 'contact' : 'contacts'}
              </span>
            </div>
          </div>
          <div className="search-box-wrapper" style={{ marginTop: '14px', position: 'relative' }}>
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </header>

        {contactsError && (
          <div className="empty-state" style={{ margin: '12px 16px', padding: '14px', textAlign: 'left' }}>
            <strong>Unable to load contacts</strong>
            <p style={{ margin: '6px 0 0' }}>{contactsError}</p>
          </div>
        )}

        <div className="conversations-scroll-stack">
          {contactsLoading && contacts.length === 0 ? (
            <div className="empty-state">Loading contacts...</div>
          ) : visibleContacts.length === 0 && !contactsError ? (
            <div className="empty-state">
              {contactsTotal === 0 ? 'None of your synced contacts are registered on CloudComAI yet.' : 'No registered contacts match your search.'}
            </div>
          ) : visibleContacts.map(contact => {
            const registeredUserId = Number(contact.registered_user_id);
            const imageKey = `contact-${registeredUserId}`;
            const imageFailed = Boolean(failedImages[imageKey]);
            const name = contact.display_name || [contact.given_name, contact.family_name].filter(Boolean).join(' ') || contact.registered_name || 'CloudComAI user';
            const registeredLabel = contact.registered_user_id_text ? `@${contact.registered_user_id_text}` : contact.registered_name;
            const registeredContact = {
              id: registeredUserId,
              other_user_id: registeredUserId,
              name: contact.registered_name || name,
              preview: registeredLabel ? `${registeredLabel} - Click to start chat` : 'Click to start chat',
              online: Boolean(contact.online),
              isContact: true,
            };
            return (
              <div
                key={registeredUserId}
                className="conversation-row-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedChat(registeredContact)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedChat(registeredContact);
                  }
                }}
                aria-label={`Start a chat with ${name}`}
              >
                <div className="avatar-frame">
                  {!imageFailed ? (
                    <img src={mediaUrl('user', registeredUserId)} alt="" onError={() => markImageFailed(imageKey)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <div className="avatar-placeholder">{name[0]?.toUpperCase() || <UserRound size={18} />}</div>
                  )}
                  {contact.online && <span className="online-indicator-dot"></span>}
                </div>
                <div className="conversation-meta-summary" style={{ minWidth: 0 }}>
                  <div className="top-row"><h5 title={name}>{name}</h5></div>
                  <div className="bottom-row"><p className="message-snippet"><MessageCircle size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />{registeredLabel || 'Registered on CloudComAI'}</p></div>
                </div>
              </div>
            );
          })}
          {contactsLoading && contacts.length > 0 && <div className="empty-state">Loading more contacts...</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="chats-directory">
      <header className="directory-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', textTransform: 'capitalize', color: 'var(--text-main)' }}>{activeTab === 'chats' ? 'Messages' : activeTab === 'groups' ? 'Group Rooms' : 'Conversations'}</h2>
          {activeTab === 'groups' && <button onClick={() => setModal('group')} style={{ background: 'var(--primary-color)', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>+ Create Group</button>}
        </div>

        <div className="header-flex-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <button className="sidebar-toggle-trigger" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
          <div className="search-box-wrapper" style={{ flex: 1, position: 'relative' }}><Search size={18} className="search-icon"/><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        </div>
      </header>

      <div className="filter-pill-row"><button className={`filter-pill ${chatFilter === 'all' ? 'active' : ''}`} onClick={() => setChatFilter('all')}>All</button><button className={`filter-pill ${chatFilter === 'unread' ? 'active' : ''}`} onClick={() => setChatFilter('unread')}>Unread</button></div>

      <div className="conversations-scroll-stack">
        {filteredChats.length === 0 ? <div className="empty-state">No conversations found.</div> : filteredChats.map(chat => {
          const src = imageUrl(chat);
          const imageKey = `${chat.isGroup ? 'group' : 'user'}-${chat.id}`;
          const imageFailed = Boolean(failedImages[imageKey]);
          return (
            <div key={chat.id} className={`conversation-row-card ${selectedChat?.id === chat.id ? 'selected' : ''}`} onClick={() => setSelectedChat(chat)}>
              <div className="avatar-frame">
                {!imageFailed ? (
                  <img src={`${src}${src.includes('?') ? '&' : '?'}v=${chat.image_version || ''}`} alt="" onError={() => markImageFailed(imageKey)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <div className="avatar-placeholder">{chat.name ? chat.name[0] : 'C'}</div>
                )}
                {chat.online && <span className="online-indicator-dot"></span>}
              </div>
              <div className="conversation-meta-summary">
                <div className="top-row"><h5>{chat.name}</h5><span className="timestamp">{chat.time || 'Active'}</span></div>
                <div className="bottom-row"><p className="message-snippet">{chat.preview || 'No messages yet'}</p>{chat.unread > 0 && <span className="unread-counter-bubble">{chat.unread}</span>}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
