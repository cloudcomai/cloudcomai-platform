import React, { useState } from 'react';
import { User, Shield, SlidersHorizontal, LogOut, X, ChevronRight, Contact } from 'lucide-react';

export default function SettingsPanel({ user, setModal, onLogout, close, setScreen }) {
  const displayName = user?.name || 'Authorized User';
  const username = user?.user_id || user?.username || '';
  const email = user?.email || '';
  const phoneNumber = user?.phone_number || user?.phone || user?.mobile || '';
  const age = user?.age ?? '';
  const gender = user?.gender || '';
  const imageUrl = user?.image_url || `https://cloudcomai.com/apiapp/api/media.php?type=user&id=${encodeURIComponent(user?.id || '')}`;
  const [imageFailed, setImageFailed] = useState(false);

  const detailValue = value => value !== '' && value !== null && value !== undefined ? String(value) : 'Not set';

  return (
    <div className="modal-backdrop">
      <div className="modal-content-card" style={{ width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px' }}>Settings</h3>
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Your personal profile and account settings</p>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-light)' }} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'var(--bg-directory)', borderRadius: '12px', marginBottom: '14px' }}>
          <div className="avatar-frame" style={{ width: 58, height: 58, flex: '0 0 58px' }}>
            {!imageFailed ? (
              <img src={imageUrl} alt="Profile" onError={() => setImageFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <div className="avatar-placeholder">{displayName[0]}</div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{displayName}</div>
            {username && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>@{username}</div>}
            {email && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
          <div style={detailCardStyle}><span style={detailLabelStyle}>Age</span><strong style={detailValueStyle}>{detailValue(age)}</strong></div>
          <div style={detailCardStyle}><span style={detailLabelStyle}>Gender</span><strong style={detailValueStyle}>{detailValue(gender)}</strong></div>
          <div style={detailCardStyle}><span style={detailLabelStyle}>Phone Number</span><strong style={detailValueStyle}>{detailValue(phoneNumber)}</strong></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button type="button" onClick={() => setModal('profile')} style={rowStyle}>
            <span style={iconWrapStyle}><User size={17} /></span>
            <span style={textWrapStyle}><strong>Edit Profile</strong><small>Update your name, profile image and personal details</small></span>
            <ChevronRight size={16} />
          </button>

          <button type="button" onClick={() => setScreen('interests')} style={rowStyle}>
            <span style={iconWrapStyle}><SlidersHorizontal size={17} /></span>
            <span style={textWrapStyle}><strong>Preferences</strong><small>Manage your interests and personal recommendations</small></span>
            <ChevronRight size={16} />
          </button>

          <button type="button" onClick={() => setModal('google_contacts')} style={rowStyle}>
            <span style={iconWrapStyle}><Contact size={17} /></span>
            <span style={textWrapStyle}><strong>Google Contacts</strong><small>Connect Google and synchronize your contacts</small></span>
            <ChevronRight size={16} />
          </button>

          <div style={rowStyleNonButton}>
            <span style={iconWrapStyle}><Shield size={17} /></span>
            <span style={textWrapStyle}><strong>Privacy & Account</strong><small>Your account controls and privacy options</small></span>
          </div>

          <button type="button" onClick={onLogout} style={{ ...rowStyle, color: '#ef4444' }}>
            <span style={{ ...iconWrapStyle, color: '#ef4444' }}><LogOut size={17} /></span>
            <span style={textWrapStyle}><strong>Sign Out</strong><small>Sign out from this account</small></span>
          </button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-primary)', color: 'var(--text-main)', textAlign: 'left' };
const rowStyleNonButton = { ...rowStyle, cursor: 'default' };
const iconWrapStyle = { width: '32px', height: '32px', borderRadius: '9px', display: 'grid', placeItems: 'center', background: 'var(--bg-directory)', color: 'var(--primary-color)', flex: '0 0 32px' };
const textWrapStyle = { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 };
const detailCardStyle = { display: 'flex', flexDirection: 'column', gap: '4px', padding: '11px 12px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-primary)', minWidth: 0 };
const detailLabelStyle = { fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const detailValueStyle = { fontSize: '13px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
