import React, { useState } from 'react';
import { MessageCircle, Users, UserCheck, Bookmark, BarChart3, Settings, Sun, Moon, X } from 'lucide-react';

const mediaUrl = (user) => user?.image_url || `https://cloudcomai.com/apiapp/api/media.php?type=user&id=${encodeURIComponent(user?.id || '')}`;

export default function Sidebar({ user, setModal, isDarkMode, setIsDarkMode, onLogout, isSidebarOpen, setIsSidebarOpen, activeTab, onTabChange, setScreen }) {
  const [imageFailed, setImageFailed] = useState(false);
  const nav = tab => onTabChange(tab);

  return (
    <aside className={`main-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-brand">
        <div className="brand-layout-row"><div className="brand-logo">C</div><span className="brand-text">CloudComAI</span></div>
        <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
      </div>

      <button className="user-profile-card" onClick={() => setModal('profile')} type="button">
        <div className="avatar-frame">
          {!imageFailed ? (
            <img
              src={mediaUrl(user)}
              alt="Profile"
              onError={() => setImageFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            <div className="avatar-placeholder">{user?.name ? user.name[0] : 'U'}</div>
          )}
          <span className="online-indicator-dot"></span>
        </div>
        <div className="user-info"><h4>{user?.name || 'Authorized User'}</h4><span className="status-badge"><span className="dot online"></span>Online</span></div>
      </button>

      <nav className="sidebar-navigation">
        <button className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => nav('chats')}><MessageCircle size={20}/><span>Chats</span></button>
        <button className={`nav-item ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => nav('groups')}><Users size={20}/><span>Groups</span></button>
        {/* Calls, Status, and Stories are temporarily hidden until their functionality is completed. */}
        {/* <button className="nav-item"><Phone size={20}/><span>Calls</span></button> */}
        {/* <button className="nav-item"><Camera size={20}/><span>Status</span></button> */}
        {/* <button className="nav-item"><Video size={20}/><span>Stories</span></button> */}
        <button className={`nav-item ${activeTab === 'people' ? 'active' : ''}`} onClick={() => nav('people')}><UserCheck size={20}/><span>People & Contacts</span></button>
        <button className="nav-item"><Bookmark size={20}/><span>Saved Messages</span></button>
        <button className="nav-item" onClick={() => setScreen('interests')}><UserCheck size={20}/><span>Edit Preferences</span></button>
        <button className="nav-item" onClick={() => setModal('poll')}><BarChart3 size={20}/><span>Polls</span></button>
        <button className="nav-item" onClick={() => setModal('settings')}><Settings size={20}/><span>Settings</span></button>
      </nav>

      <div className="sidebar-app-promo">
        <h5>Download App</h5><p>Get the CloudComAI app on your mobile device.</p>
        <div className="store-buttons"><button className="store-btn">Google Play</button><button className="store-btn">App Store</button></div>
      </div>

      <div className="sidebar-footer-toggle" style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'var(--bg-sidebar, var(--bg-primary))', borderTop: '1px solid var(--border-color)' }}>
        <button className="theme-toggle-btn" onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}<span>Theme</span></button>
        <button className="logout-btn" onClick={onLogout}>Sign Out</button>
      </div>
    </aside>
  );
}
