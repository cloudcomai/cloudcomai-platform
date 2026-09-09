import React, { useCallback, useEffect, useState } from 'react';
import { Database, Download, EyeOff, Search, Shield, UserX, X } from 'lucide-react';

const formatBytes = value => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const emptyStorage = {
  total_files: 0,
  total_bytes: 0,
  categories: {
    images: { count: 0, bytes: 0 },
    audio: { count: 0, bytes: 0 },
    video: { count: 0, bytes: 0 },
    documents: { count: 0, bytes: 0 },
  },
};

export default function PrivacyAccountPanel({ privacyApi, close, onSettingsChanged }) {
  const [settings, setSettings] = useState({ hide_online_status: false, media_auto_download: false, screenshot_alerts: true });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [storage, setStorage] = useState(emptyStorage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await privacyApi.getPrivacySettings();
      setSettings(current => ({ ...current, ...(data.settings || {}) }));
      setBlockedUsers(data.blocked_users || []);
      setStorage(data.storage || emptyStorage);
      onSettingsChanged?.(data.settings || {});
    } catch (loadError) {
      setError(loadError.message || 'Unable to load privacy settings.');
    } finally {
      setLoading(false);
    }
  }, [onSettingsChanged, privacyApi]);

  useEffect(() => { load(); }, [load]);

  const updateSetting = async (key, value) => {
    setSaving(key);
    setError('');
    try {
      const { data } = await privacyApi.updatePrivacySettings({ [key]: value });
      const next = { ...settings, ...(data.settings || {}) };
      setSettings(next);
      onSettingsChanged?.(next);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save privacy setting.');
    } finally {
      setSaving('');
    }
  };

  const searchContacts = async event => {
    event?.preventDefault?.();
    if (!query.trim()) { setCandidates([]); return; }
    setSearching(true);
    setError('');
    try {
      const { data } = await privacyApi.searchUsers(query.trim());
      setCandidates(data.users || []);
    } catch (searchError) {
      setError(searchError.message || 'Unable to search contacts.');
    } finally {
      setSearching(false);
    }
  };

  const block = async candidate => {
    setSaving(`block-${candidate.id}`);
    setError('');
    try {
      const { data } = await privacyApi.blockContact(candidate.id);
      setBlockedUsers(current => [...current.filter(item => Number(item.id) !== Number(candidate.id)), data.blocked_user || candidate]);
      onSettingsChanged?.({});
      setCandidates(current => current.filter(item => Number(item.id) !== Number(candidate.id)));
    } catch (blockError) {
      setError(blockError.message || 'Unable to block contact.');
    } finally {
      setSaving('');
    }
  };

  const unblock = async contact => {
    setSaving(`unblock-${contact.id}`);
    setError('');
    try {
      await privacyApi.unblockContact(contact.id);
      setBlockedUsers(current => current.filter(item => Number(item.id) !== Number(contact.id)));
      onSettingsChanged?.({});
    } catch (unblockError) {
      setError(unblockError.message || 'Unable to unblock contact.');
    } finally {
      setSaving('');
    }
  };

  const downloadBackup = async () => {
    setDownloading(true);
    setError('');
    try {
      const { data } = await privacyApi.downloadAccountBackup({ responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cloudcomai-account-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (backupError) {
      setError(backupError.message || 'Unable to create account backup.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-content-card privacy-account-panel">
      <div className="privacy-panel-heading">
        <div><h3>Privacy & Account</h3><p>Control visibility, blocked contacts, media storage, and account exports.</p></div>
        <button type="button" onClick={close} aria-label="Close privacy settings"><X size={20} /></button>
      </div>

      {error && <div className="privacy-error">{error}</div>}
      {loading ? <div className="privacy-loading">Loading privacy controls…</div> : <>
        <section className="privacy-section">
          <h4><Shield size={17} /> Privacy controls</h4>
          <ToggleRow label="Hide online status" description="Other users will see you as offline." checked={settings.hide_online_status} disabled={Boolean(saving)} onChange={value => updateSetting('hide_online_status', value)} />
          <ToggleRow label="Automatically load chat media" description="When off, images, voice notes, and videos load only after you choose them." checked={settings.media_auto_download} disabled={Boolean(saving)} onChange={value => updateSetting('media_auto_download', value)} />
          <ToggleRow label="Screenshot alerts" description="Receive a notification when the mobile app detects a screenshot in your chat." checked={settings.screenshot_alerts} disabled={Boolean(saving)} onChange={value => updateSetting('screenshot_alerts', value)} />
          <div className="privacy-info"><EyeOff size={16} /><span>Detection works in the iOS app and on Android 14 or newer. Browsers and some capture methods cannot report screenshots.</span></div>
        </section>

        <section className="privacy-section">
          <h4>Profile visibility</h4>
          {[['share_email', 'Show email address'], ['share_mobile', 'Show phone number'], ['share_age', 'Show age'], ['share_gender', 'Show gender']].map(([key, label]) => <ToggleRow key={key} label={label} description="Visible to other signed-in users when enabled." checked={settings[key]} disabled={Boolean(saving)} onChange={value => updateSetting(key, value)} />)}
        </section>

        <section className="privacy-section">
          <h4><UserX size={17} /> Blocked contacts</h4>
          <form className="privacy-contact-search" onSubmit={searchContacts}>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, or user ID" aria-label="Search contacts to block" />
            <button type="submit" disabled={searching || !query.trim()}><Search size={15} />{searching ? 'Searching…' : 'Search'}</button>
          </form>
          {candidates.length > 0 && <div className="privacy-contact-list search-results">{candidates.map(candidate => <ContactRow key={candidate.id} contact={candidate} actionLabel="Block" busy={saving === `block-${candidate.id}`} onAction={() => block(candidate)} />)}</div>}
          <div className="privacy-contact-list">
            {blockedUsers.map(contact => <ContactRow key={contact.id} contact={contact} actionLabel="Unblock" busy={saving === `unblock-${contact.id}`} onAction={() => unblock(contact)} />)}
            {!blockedUsers.length && <p className="privacy-empty">You have not blocked any contacts.</p>}
          </div>
          <p className="privacy-footnote">Blocking stops private messages in both directions and hides presence. Shared group conversations remain available.</p>
        </section>

        <section className="privacy-section">
          <h4><Database size={17} /> Storage & media</h4>
          <div className="storage-summary"><strong>{formatBytes(storage.total_bytes)}</strong><span>{storage.total_files} uploaded files</span></div>
          <div className="storage-grid">{Object.entries(storage.categories || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{formatBytes(value.bytes)}</strong><small>{value.count} files</small></div>)}</div>
          <p className="privacy-footnote">Storage totals are specific to this account and count media you uploaded.</p>
        </section>

        <section className="privacy-section">
          <h4><Download size={17} /> Account backup</h4>
          <p className="privacy-footnote">Download your profile, preferences, contacts, chats, messages, and attachment metadata as JSON. Media files are not embedded.</p>
          <button type="button" className="privacy-backup-button" onClick={downloadBackup} disabled={downloading}>{downloading ? 'Preparing backup…' : 'Download account backup'}</button>
        </section>
      </>}
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }) {
  return <label className="privacy-toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={event => onChange(event.target.checked)} /></label>;
}

function ContactRow({ contact, actionLabel, busy, onAction }) {
  return <div className="privacy-contact-row"><div className="privacy-contact-avatar">{contact.name?.[0]?.toUpperCase() || '?'}</div><span><strong>{contact.name || 'CloudComAI user'}</strong><small>{contact.user_id ? `@${contact.user_id}` : ''}</small></span><button type="button" onClick={onAction} disabled={busy}>{busy ? 'Saving…' : actionLabel}</button></div>;
}
