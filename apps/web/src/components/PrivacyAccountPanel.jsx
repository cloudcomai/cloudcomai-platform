import React, { useCallback, useEffect, useRef, useState } from 'react';
import WebAppLockSettings from './WebAppLockSettings';
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

export default function PrivacyAccountPanel({ privacyApi, close, onSettingsChanged, userId }) {
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
  const [backup, setBackup] = useState({});
  const [backupLoading, setBackupLoading] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const backupRequestRef = useRef(false);

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

  const refreshBackupStatus = useCallback(async () => {
    try {
      const { data } = await privacyApi.getAccountBackupStatus();
      const nextBackup = data.backup || data;
      setBackup(nextBackup);
      return nextBackup;
    } catch (statusError) {
      setBackup({ configured: false, unavailable: true, status_error: statusError.message || 'Cloud backup status is unavailable.' });
      throw statusError;
    } finally {
      setBackupLoading(false);
    }
  }, [privacyApi]);

  useEffect(() => {
    let active = true;
    refreshBackupStatus().catch(() => {});
    return () => { active = false; };
  }, [refreshBackupStatus]);

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

  const updateBackupSettings = async changes => {
    if (backupRequestRef.current) return;
    backupRequestRef.current = true;
    setBackupBusy(true);
    setError('');
    try {
      const response = await privacyApi.updateAccountBackupSettings({
        automatic_frequency: changes.automatic_frequency ?? backup.automatic_frequency ?? 'off',
        include_videos: changes.include_videos ?? Boolean(backup.include_videos),
        wifi_only: changes.wifi_only ?? backup.wifi_only !== false,
      });
      setBackup(response.data.settings || response.data.backup || backup);
      await refreshBackupStatus().catch(() => {});
    } catch (backupError) {
      setError(backupError.message || 'Unable to update cloud backup settings.');
    } finally {
      backupRequestRef.current = false;
      setBackupBusy(false);
    }
  };

  const createCloudBackup = async () => {
    if (backupRequestRef.current || backupBusy) return;
    if (!backup.email_verified) {
      setError('Verify your registered email address before using Cloud Backup.');
      return;
    }
    const connection = typeof navigator !== 'undefined' ? navigator.connection : null;
    const networkType = String(connection?.type || '').toLowerCase();
    if (backup.wifi_only !== false && ['cellular', 'none'].includes(networkType)) {
      setError('Connect to Wi-Fi or turn off the Wi-Fi-only backup setting.');
      return;
    }
    backupRequestRef.current = true;
    setBackupBusy(true);
    setError('');
    setBackupProgress('Creating encrypted cloud backup…');
    try {
      const response = await privacyApi.createAccountBackup({ include_videos: Boolean(backup.include_videos) });
      setBackup(response.data.backup || backup);
      setBackupProgress('Cloud backup completed.');
      await refreshBackupStatus().catch(() => { setBackupProgress('Cloud backup completed. Backup status could not be refreshed.'); });
    } catch (backupError) {
      setBackupProgress('');
      setError(backupError.message || 'Unable to create cloud backup.');
    } finally {
      backupRequestRef.current = false;
      setBackupBusy(false);
    }
  };

  const restoreCloudBackup = async () => {
    if (backupRequestRef.current || backupBusy || !backup.restore_available) return;
    const confirmed = window.confirm('Restore your latest encrypted CloudComAI backup? Existing account data may be updated. Expired or deleted messages and rooms you have left cannot be restored.');
    if (!confirmed) return;
    backupRequestRef.current = true;
    setBackupBusy(true);
    setError('');
    setBackupProgress('Restoring cloud backup…');
    try {
      const response = await privacyApi.restoreAccountBackup();
      const restored = response.data.restore || {};
      const restoredCounts = [
        restored.chats != null ? `${restored.chats} chats` : null,
        restored.messages != null ? `${restored.messages} messages` : null,
      ].filter(Boolean);
      setBackupProgress(restoredCounts.length ? `Restore completed: ${restoredCounts.join(' and ')} restored.` : 'Restore completed.');
      await refreshBackupStatus().catch(() => { setBackupProgress(current => `${current} Backup status could not be refreshed.`); });
    } catch (backupError) {
      setBackupProgress('');
      setError(backupError.message || 'Unable to restore cloud backup.');
    } finally {
      backupRequestRef.current = false;
      setBackupBusy(false);
    }
  };

  const formatBackupDate = value => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
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

      {error && <div className="privacy-error" role="alert">{error}</div>}
      <WebAppLockSettings userId={userId} />
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
          <h4><Download size={17} /> Cloud backup & restore</h4>
          {backupLoading ? <p className="privacy-footnote">Loading cloud backup status…</p> : <>
            <div className="storage-summary"><strong>{formatBackupDate(backup.last_backup_at)}</strong><span>Last successful backup</span></div>
            <p className="privacy-footnote">Backup account: {backup.backup_account_email || 'No verified email'} · Size: {formatBytes(backup.backup_size)}</p>
            {!backup.configured && <p className="privacy-error">{backup.status_error || (backup.unavailable ? 'Cloud backup status is unavailable. Retry by reopening Privacy & Account.' : 'Cloud backup is not configured on the server.')}</p>}
            {backup.expired && <p className="privacy-error">The available cloud backup has expired and cannot be restored.</p>}
            {!backup.email_verified && <p className="privacy-error">Verify your registered email address to enable cloud backup and restore.</p>}
            <label className="privacy-toggle-row"><span><strong>Automatic backup</strong><small>Choose how often the server creates an encrypted backup.</small></span>
              <select aria-label="Automatic backup frequency" value={backup.automatic_frequency || 'off'} disabled={backupBusy || !backup.configured || !backup.email_verified} onChange={event => updateBackupSettings({ automatic_frequency: event.target.value })}>
                <option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </label>
            <ToggleRow label="Include videos" description="Include uploaded videos in the encrypted backup." checked={Boolean(backup.include_videos)} disabled={backupBusy || !backup.configured || !backup.email_verified} onChange={value => updateBackupSettings({ include_videos: value })} />
            <ToggleRow label="Backup over Wi-Fi only" description="Applied when the browser exposes network connection details." checked={backup.wifi_only !== false} disabled={backupBusy || !backup.configured || !backup.email_verified} onChange={value => updateBackupSettings({ wifi_only: value })} />
            <div className="privacy-backup-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="privacy-backup-button" onClick={createCloudBackup} disabled={backupBusy || !backup.configured || !backup.email_verified}>{backupBusy ? 'Please wait…' : 'Back up now'}</button>
              {backup.restore_available && <button type="button" className="privacy-backup-button" onClick={restoreCloudBackup} disabled={backupBusy || !backup.email_verified}>Restore backup</button>}
            </div>
            {backupProgress && <p className="privacy-footnote" role="status">{backupProgress}</p>}
          </>}
          <p className="privacy-footnote">Cloud backups are encrypted by the server before storage. Restore is available only when a valid backup exists and your registered email is verified.</p>
        </section>
        <section className="privacy-section">
          <h4><Download size={17} /> Local account export</h4>
          <p className="privacy-footnote">Download your profile, preferences, contacts, chats, messages, and attachment metadata as JSON. This export is separate from encrypted cloud backup; media files are not embedded.</p>
          <button type="button" className="privacy-backup-button" onClick={downloadBackup} disabled={downloading}>{downloading ? 'Preparing export…' : 'Download account data'}</button>
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
