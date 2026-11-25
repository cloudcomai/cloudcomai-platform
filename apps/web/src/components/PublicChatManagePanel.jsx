import React, { useCallback, useEffect, useState } from 'react';
import { X, Info, Users, ShieldCheck, Settings, RefreshCw, Flag, ShieldAlert, EyeOff, UserX, Clock3, CheckCircle2 } from 'lucide-react';
import { requestApi, platformApi, mediaUrl } from '../services/platform';
import { UserProfileDialog } from './WebMobileParity';

const tabs = [
  { id: 'info', label: 'Info', Icon: Info },
  { id: 'members', label: 'Members', Icon: Users },
  { id: 'reports', label: 'Reports', Icon: Flag },
  { id: 'permissions', label: 'Permissions', Icon: ShieldCheck },
  { id: 'settings', label: 'Settings', Icon: Settings },
];
const reportReasons = ['Harassment', 'Spam', 'Hate or abusive content', 'Impersonation', 'Unsafe content', 'Other'];
const formatRetention = value => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Default room retention';
  if (seconds % 86400 === 0) return (seconds / 86400) + ' days';
  if (seconds % 3600 === 0) return (seconds / 3600) + ' hours';
  return Math.round(seconds / 60) + ' minutes';
};
const api = (options = {}) => requestApi('v1/public-chats', options);

export default function PublicChatManagePanel({ selectedChat, user, close }) {
  const [activeTab, setActiveTab] = useState('info');
  const [participants, setParticipants] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [hiddenUsers, setHiddenUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('Other');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [moderatingId, setModeratingId] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  const [failedMemberImages, setFailedMemberImages] = useState({});
  const [moderatorAccess, setModeratorAccess] = useState(false);

  const roomId = Number(selectedChat?.id);
  const currentUserId = Number(user?.id || user?.user_id);

  const loadRoomMembers = useCallback(async () => {
    if (!roomId) return;
    setLoading(true); setError('');
    try {
      const { data } = await platformApi.getPublicChatManage(roomId);
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setOnlineUsers(Array.isArray(data.online_users) ? data.online_users : []);
    } catch (err) { setError(err.message || 'Unable to load public chat information.'); }
    finally { setLoading(false); }
  }, [roomId]);

  const loadReports = useCallback(async () => {
    if (!roomId) return;
    setReportsLoading(true); setActionError('');
    try {
      const { data } = await platformApi.getPublicChatReports(roomId);
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setModeratorAccess(true);
    } catch (err) {
      setModeratorAccess(false);
      setActionError(err.message || 'Moderator access is required to view reports.');
      setReports([]);
    } finally { setReportsLoading(false); }
  }, [roomId]);

  const loadHiddenUsers = useCallback(async () => {
    if (!roomId) return;
    try {
      const { data } = await platformApi.getPublicChatHiddenUsers(roomId);
      setHiddenUsers(Array.isArray(data.hidden_users) ? data.hidden_users : []);
    } catch { setHiddenUsers([]); }
  }, [roomId]);

  useEffect(() => { void loadRoomMembers(); void loadHiddenUsers(); }, [loadRoomMembers, loadHiddenUsers]);
  useEffect(() => { if (activeTab === 'reports') void loadReports(); }, [activeTab, loadReports]);

  const submitReport = async () => {
    if (!reportTarget || !roomId || !Number(reportTarget.id) || Number(reportTarget.id) === currentUserId) return;
    setSubmittingReport(true); setActionError(''); setNotice('');
    try {
      const incidentKey = 'user:' + Number(reportTarget.id);
      const { data } = await platformApi.reportPublicChatUser(roomId, { reported_user_id: Number(reportTarget.id), reason: reportReason, details: reportDetails.trim(), incident_key: incidentKey });
      setNotice(data.duplicate ? 'You have already reported this user in this room.' : 'Report submitted and sent to the public chat moderators for review.');
      setReportTarget(null); setReportDetails(''); setReportReason('Other');
      await loadHiddenUsers();
    } catch (err) { setActionError(err.message || 'Unable to submit report.'); }
    finally { setSubmittingReport(false); }
  };

  const moderateUser = async (report, moderationAction) => {
    if (!roomId || !report?.reported_user_id) return;
    setModeratingId(Number(report.reported_user_id)); setActionError(''); setNotice('');
    try {
      await api({ method: 'POST', body: { action: 'moderation', room_id: roomId, user_id: Number(report.reported_user_id), moderation_action: moderationAction, days: 7 } });
      setNotice(moderationAction === 'remove' ? 'Restriction removed and reports marked reviewed.' : 'Restriction extended by 7 days.');
      await Promise.all([loadReports(), loadRoomMembers()]);
    } catch (err) { setActionError(err.message || 'Unable to apply moderation action.'); }
    finally { setModeratingId(null); }
  };

  const unhideUser = async targetId => {
    try {
      await platformApi.unhidePublicChatUser(roomId, Number(targetId));
      setHiddenUsers(items => items.filter(item => Number(item.id) !== Number(targetId)));
      setNotice('User is no longer hidden from your public chat view.');
    } catch (err) { setActionError(err.message || 'Unable to unhide user.'); }
  };

  const roomType = selectedChat?.room_type === 'language' ? 'Language room' : 'Public room';
  const joinedCount = Number(selectedChat?.joined_count ?? participants.length);
  const onlineCount = Number(selectedChat?.online_count ?? onlineUsers.length);

  return (
    <aside className="public-chat-manage-panel" role="dialog" aria-modal="true" aria-label="Manage Public Chat">
      <header className="public-chat-manage-header">
        <div className="public-chat-manage-room-avatar" aria-hidden="true">🌐</div>
        <div className="public-chat-manage-heading"><h2>Manage Public Chat</h2><p>{selectedChat?.name || 'Public Chat Room'}</p></div>
        <button type="button" className="public-chat-manage-close" onClick={close} aria-label="Close management panel"><X size={21}/></button>
      </header>
      <nav className="public-chat-manage-tabs" aria-label="Public chat management sections">
        {tabs.map(({ id, label, Icon }) => <button key={id} type="button" className={activeTab === id ? 'active' : ''} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}><Icon size={19}/><span>{label}</span></button>)}
      </nav>
      <div className="public-chat-manage-body">
        {error && <div className="public-chat-manage-error" role="alert">{error}</div>}
        {actionError && <div className="public-chat-manage-error" role="alert">{actionError}</div>}
        {notice && <div className="public-chat-manage-success" role="status"><CheckCircle2 size={16}/>{notice}</div>}
        {activeTab === 'info' && <section className="public-chat-manage-section">
          <div className="public-chat-manage-room-card"><div className="public-chat-manage-room-avatar large">🌐</div><div><h3>{selectedChat?.name || 'Public Chat Room'}</h3><p>{selectedChat?.group_description || 'Public community room'}</p></div></div>
          <div className="public-chat-manage-stat"><span>Room Type</span><strong>{roomType}</strong></div>
          <div className="public-chat-manage-stat"><span>Online Users</span><strong>{loading ? '…' : onlineCount}</strong></div>
          <div className="public-chat-manage-stat"><span>Total Joined</span><strong>{loading ? '…' : joinedCount}</strong></div>
          <button type="button" className="public-chat-manage-refresh" onClick={loadRoomMembers} disabled={loading}><RefreshCw size={16}/> {loading ? 'Refreshing…' : 'Refresh room information'}</button>
        </section>}
        {activeTab === 'members' && <section className="public-chat-manage-section">
          <div className="public-chat-manage-section-title"><div><h3>Room Members</h3><p>{loading ? 'Loading participants…' : participants.length + ' active participants'}</p></div><button type="button" onClick={loadRoomMembers} disabled={loading} aria-label="Refresh members"><RefreshCw size={17}/></button></div>
          {loading ? <p className="public-chat-manage-muted">Loading public chat members…</p> : participants.length ? <div className="public-chat-manage-member-list">
            {participants.map(member => <div className="public-chat-manage-member" key={member.id}>
              <button type="button" className="public-chat-manage-member-avatar public-chat-manage-member-avatar-button" aria-label={'View ' + (member.name || 'member') + ' profile'} onClick={() => setProfileUserId(Number(member.id))}>
                {!failedMemberImages[member.id] ? <img src={member.image_url || member.profile_image_url || member.avatar_url || mediaUrl('user', member.id) + (member.image_version ? '?v=' + encodeURIComponent(member.image_version) : '')} alt="" onError={() => setFailedMemberImages(current => ({ ...current, [member.id]: true }))} /> : String(member.name || 'U').trim().charAt(0).toUpperCase()}
              </button>
              <div className="public-chat-manage-member-details"><button type="button" className="public-chat-manage-member-name" onClick={() => setProfileUserId(Number(member.id))}>{member.name || 'CloudComAI user'}</button><span>{member.age != null ? member.age + ' years' : 'Age not shared'}{member.gender ? ' · ' + member.gender : ''}</span></div>
              <span className={'public-chat-manage-presence ' + (member.online ? 'online' : '')}>{member.online ? 'Online' : 'Offline'}</span>
              {Number(member.id) !== currentUserId && <button type="button" className="public-chat-manage-action-link" onClick={() => { setReportTarget(member); setActionError(''); }}><Flag size={14}/> Report User</button>}
            </div>)}
          </div> : <p className="public-chat-manage-muted">No active participants were returned for this room.</p>}
          <div className="public-chat-manage-subsection"><h3><EyeOff size={17}/> Hidden Users</h3>
            {hiddenUsers.length ? hiddenUsers.map(item => <div className="public-chat-manage-member" key={item.id}><div className="public-chat-manage-member-details"><strong>{item.name}</strong><span>Hidden from your public chat view</span></div><button type="button" className="public-chat-manage-action-link" onClick={() => unhideUser(item.id)}>Unhide</button></div>) : <p className="public-chat-manage-muted">No hidden users.</p>}
          </div>
        </section>}
        {activeTab === 'reports' && <section className="public-chat-manage-section">
          <div className="public-chat-manage-section-title"><div><h3>Community Reports</h3><p>Review reports submitted for this public chat</p></div><button type="button" onClick={loadReports} disabled={reportsLoading} aria-label="Refresh reports"><RefreshCw size={17}/></button></div>
          {!moderatorAccess && <div className="public-chat-manage-notice"><ShieldAlert size={19}/><span>Report review and moderation actions are available only to room owners, admins and moderators. You can still report individual users from the Members tab.</span></div>}
          {reportsLoading ? <p className="public-chat-manage-muted">Loading reports…</p> : reports.length ? reports.map(report => <article className="public-chat-manage-report" key={report.id}>
            <div className="public-chat-manage-section-title"><strong>{report.reported_user_name}</strong><span className="public-chat-manage-presence">{report.status}</span></div>
            <p><strong>Reason:</strong> {report.reason}</p>{report.details && <p>{report.details}</p>}
            <p className="public-chat-manage-muted">Reported {report.created_at ? new Date(report.created_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}</p>
            {moderatorAccess && <div className="public-chat-manage-report-actions"><button type="button" onClick={() => moderateUser(report, 'remove')} disabled={moderatingId === Number(report.reported_user_id)}><UserX size={15}/> Remove Restriction</button><button type="button" onClick={() => moderateUser(report, 'extend')} disabled={moderatingId === Number(report.reported_user_id)}><Clock3 size={15}/> Extend 7 Days</button></div>}
          </article>) : !reportsLoading && moderatorAccess ? <p className="public-chat-manage-muted">No community reports for this room.</p> : null}
        </section>}
        {activeTab === 'permissions' && <section className="public-chat-manage-section">
          <h3>Public Chat Permissions</h3>
          <p className="public-chat-manage-description">Public chat membership and moderation follow the existing public-room service rules.</p>
          <div className="public-chat-manage-notice"><ShieldCheck size={19}/><span>Public-room file-sharing, link-sharing, download and forwarding controls are not exposed by the current API. No nonfunctional toggles or Group-only permission endpoints are used.</span></div>
        </section>}
        {activeTab === 'settings' && <section className="public-chat-manage-section">
          <h3>Room Settings</h3>
          <div className="public-chat-manage-stat"><span>Room Type</span><strong>{roomType}</strong></div>
          <div className="public-chat-manage-stat"><span>Message Retention</span><strong>{formatRetention(selectedChat?.retention_seconds)}</strong></div>
          <div className="public-chat-manage-notice"><Info size={19}/><span>Room configuration changes are not available through the current public-room API. Existing room settings and chat behavior remain unchanged.</span></div>
        </section>}
      </div>
      {reportTarget && <div className="public-chat-report-overlay" role="presentation">
        <section className="public-chat-report-dialog" role="dialog" aria-modal="true" aria-labelledby="public-chat-report-title">
          <div className="public-chat-manage-section-title"><h3 id="public-chat-report-title">Report {reportTarget.name || 'User'}</h3><button type="button" onClick={() => setReportTarget(null)} aria-label="Close report form"><X size={18}/></button></div>
          <label htmlFor="public-chat-report-reason">Reason</label>
          <select id="public-chat-report-reason" value={reportReason} onChange={event => setReportReason(event.target.value)}>{reportReasons.map(reason => <option key={reason}>{reason}</option>)}</select>
          <label htmlFor="public-chat-report-details">Additional details (optional)</label>
          <textarea id="public-chat-report-details" maxLength={2000} rows={4} value={reportDetails} onChange={event => setReportDetails(event.target.value)} placeholder="Describe the issue to help moderators review your report."/>
          <div className="public-chat-manage-report-actions"><button type="button" onClick={() => setReportTarget(null)} disabled={submittingReport}>Cancel</button><button type="button" onClick={submitReport} disabled={submittingReport}>{submittingReport ? 'Submitting…' : 'Submit Report'}</button></div>
        </section>
      </div>}
      {profileUserId && <UserProfileDialog userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </aside>
  );
}
