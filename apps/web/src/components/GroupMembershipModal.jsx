import React, { useState, useEffect } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { UserPlus, UserMinus, Search, X, ArrowLeft, Bell, ChevronRight, Clock3, Crown, Download, MoreHorizontal, Settings, Share2, ShieldCheck, Users } from 'lucide-react';
import { getAvatarInitial, getAvatarPalette } from '@cloudcomai/chat-core';
import { mediaUrl, platformApi } from '../services/platform';

const parseGrantExpiry = value => {
  if (!value) return null;
  const normalized = String(value).trim().replace(' ', 'T');
  const timestamp = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized + 'Z');
  return Number.isFinite(timestamp) ? timestamp : null;
};
const isGrantActive = grant => Boolean(grant && !grant.revoked_at && (!grant.expires_at || (parseGrantExpiry(grant.expires_at) || 0) > Date.now()));
const formatRemaining = (expiry, now = Date.now()) => {
  const timestamp = parseGrantExpiry(expiry);
  if (!timestamp) return 'Expiry unavailable';
  const minutes = Math.max(0, Math.ceil((timestamp - now) / 60000));
  if (!minutes) return 'Expiring now';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? hours + 'h ' + remainingMinutes + 'm remaining' : remainingMinutes + 'm remaining';
};

export default function GroupMembershipModal({ type, selectedChat, apiBridge, close, onActionComplete, user, onGroupUpdated, onEditGroup, onOpenNotifications }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentMembers, setCurrentMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState('all');
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [savedContacts, setSavedContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [contactsQuery, setContactsQuery] = useState('');
  const [failedAvatars, setFailedAvatars] = useState({});
  const [attachmentGrants, setAttachmentGrants] = useState([]);
  const [attachmentSearch, setAttachmentSearch] = useState('');
  const [attachmentPermissionFilter, setAttachmentPermissionFilter] = useState('all');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [success, setSuccess] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    if (type !== 'manage_members') return undefined;
    const timer = setInterval(() => setClockNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [type]);

  useEffect(() => {
    if (type !== 'manage_members' || !selectedChat?.id) return undefined;
    let cancelled = false;
    platformApi.listGroups().then(({ data }) => {
      const latest = (data.groups || []).find(item => Number(item.id) === Number(selectedChat.id));
      if (!cancelled && latest) onGroupUpdated?.({ ...selectedChat, ...latest });
    }).catch(() => {
      // Keep the group data already supplied by the conversation list if refresh is unavailable.
    });
    return () => { cancelled = true; };
  }, [type, selectedChat?.id]);

  const currentUserId = Number(user?.id);
  const ownsGroup = currentMembers.some(member => Number(member.user_id || member.id) === currentUserId && member.role === 'owner');
  const isAdmin = currentMembers.some(member => Number(member.user_id || member.id) === currentUserId && member.role === 'admin');
  const canManageMembers = ownsGroup || isAdmin;
  const adminCount = currentMembers.filter(member => member.role === 'admin').length;
  const adminLimitReached = adminCount >= 3;

  useEffect(() => {
    if (type !== 'add_member') return;
    let cancelled = false;
    setContactsLoading(true);
    platformApi.listContacts(1, 500)
      .then(({ data }) => { if (!cancelled) setSavedContacts(Array.isArray(data.contacts) ? data.contacts : []); })
      .catch(err => { if (!cancelled) setError(err.message || 'Unable to load your contacts.'); })
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  useEffect(() => {
    if ((type === 'manage_members' || type === 'add_member') && selectedChat) {
      setMembersLoading(true);
      apiBridge(ApiRoute.GROUP_MEMBERS, { query: { chat_id: selectedChat.id } })
        .then(data => { if (data.members) setCurrentMembers(data.members); })
        .catch(err => setError(err.message || "Unable to load group members."))
        .finally(() => setMembersLoading(false));
    }
  }, [type, selectedChat, apiBridge]);


  useEffect(() => {
    if (type !== 'manage_members' || !selectedChat?.id || !ownsGroup) return undefined;
    let cancelled = false;
    setAttachmentLoading(true);
    platformApi.getGroupAttachmentAccess(selectedChat.id)
      .then(({ data }) => { if (!cancelled) setAttachmentGrants(Array.isArray(data.grants) ? data.grants : []); })
      .catch(err => { if (!cancelled) setError(err.message || 'Unable to load member attachment permissions.'); })
      .finally(() => { if (!cancelled) setAttachmentLoading(false); });
    return () => { cancelled = true; };
  }, [type, selectedChat?.id, ownsGroup]);

  const updateAttachmentAccess = async (memberId, scope = 'member', durationHours = null) => {
    if (attachmentBusy || !ownsGroup) return;
    const existing = attachmentGrants.find(item => item.grant_scope === scope && (scope !== 'member' || Number(item.member_id) === Number(memberId)));
    const active = isGrantActive(existing);
    setAttachmentBusy(true); setError(''); setSuccess('');
    try {
      if (scope === 'group') {
        if (durationHours) await platformApi.grantGroupAttachmentAccess(selectedChat.id, Number(durationHours));
        else await platformApi.revokeGroupAttachmentAccess(selectedChat.id);
      } else if (active) {
        await platformApi.revokeGroupMemberAttachmentAccess(selectedChat.id, Number(memberId));
      } else {
        await platformApi.grantGroupMemberAttachmentAccess(selectedChat.id, Number(memberId));
      }
      const { data } = await platformApi.getGroupAttachmentAccess(selectedChat.id);
      setAttachmentGrants(Array.isArray(data.grants) ? data.grants : []);
      setSuccess(scope === 'group'
        ? (durationHours ? 'Group-wide download and forwarding access enabled for ' + durationHours + ' hours.' : 'Group-wide attachment access revoked.')
        : (active ? 'Individual attachment access revoked.' : 'Individual attachment access granted.'));
    } catch (err) {
      setError(err.message || 'Unable to update attachment permissions.');
    } finally { setAttachmentBusy(false); }
  };

  const openMemberProfile = async member => {
    const memberId = Number(member?.user_id || member?.id);
    if (!memberId) return;
    setSelectedMemberProfile({ id: memberId, name: member.name || member.username || 'Member', role: member.role || 'member', relationship: { status: 'unavailable' } });
    setProfileLoading(true);
    setProfileError('');
    try {
      const result = await apiBridge(ApiRoute.USER_PROFILE, { query: { id: memberId } });
      setSelectedMemberProfile(current => current?.id === memberId ? { ...result.user, role: member.role || 'member' } : current);
    } catch (err) {
      setProfileError(err.message || 'Unable to load this member profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const updateMemberFriendship = async (responseAction = 'accept') => {
    const profile = selectedMemberProfile;
    if (!profile?.id || profileBusy || Number(profile.id) === currentUserId) return;
    const relationship = profile.relationship || { status: 'none' };
    if (relationship.status === 'accepted' || relationship.status === 'blocked') return;
    setProfileBusy(true);
    setProfileError('');
    try {
      if (relationship.status === 'pending' && relationship.direction === 'incoming') {
        await apiBridge(ApiRoute.FRIEND_REQUESTS, { method: 'POST', body: JSON.stringify({ action: responseAction, request_id: Number(relationship.request_id) }) });
        setSelectedMemberProfile(current => ({ ...current, relationship: { status: responseAction === 'accept' ? 'accepted' : 'declined', direction: 'incoming', request_id: relationship.request_id } }));
      } else if (relationship.status !== 'pending') {
        await apiBridge(ApiRoute.FRIEND_REQUESTS, { method: 'POST', body: JSON.stringify({ action: 'send', user_id: Number(profile.id) }) });
        setSelectedMemberProfile(current => ({ ...current, relationship: { status: 'pending', direction: 'outgoing' } }));
      }
    } catch (err) {
      try {
        const result = await apiBridge(ApiRoute.FRIEND_REQUESTS, { query: { user_id: Number(profile.id) } });
        setSelectedMemberProfile(current => ({ ...current, relationship: result.relationship || { status: 'none' } }));
      } catch {}
      setProfileError(err.message || 'Unable to update friend request.');
    } finally {
      setProfileBusy(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const result = await apiBridge(ApiRoute.SEARCH_USERS, { query: { q: searchTerm } });
      if (result.users) setSearchResults(result.users);
    } catch (err) {
      alert(err.message || "Failed to locate matching accounts");
    } finally {
      setLoading(false);
    }
  };

  const executeMemberAction = async (targetUserId, actionType) => {
    const isRemoval = actionType === 'remove';
    const isSelf = Number(targetUserId) === currentUserId;
    if (loading || (isRemoval && !window.confirm(isSelf ? 'Leave this group? You may need an invitation to rejoin.' : 'Remove this member from the group?'))) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      await apiBridge(ApiRoute.GROUP_MEMBERS, {
        method: 'POST',
        body: JSON.stringify({ chat_id: selectedChat.id, user_id: targetUserId, action: actionType })
      });
      setSearchTerm(''); setContactsQuery(''); setSearchResults([]); setHasSearched(false);
      if (type === 'manage_members' && isRemoval && !isSelf) {
        const result = await apiBridge(ApiRoute.GROUP_MEMBERS, { query: { chat_id: selectedChat.id } });
        setCurrentMembers(result.members || []);
        setSuccess('Member removed from the group.');
      } else if (type === 'manage_members' && isSelf) {
        onActionComplete();
      } else {
        setSuccess(actionType === 'add' ? 'User successfully added to the group.' : 'Membership updated.');
        onActionComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to update group membership.');
    } finally {
      setLoading(false);
    }
  };

  const setMemberRole = async (member, action) => {
    if (loading) return;
    const label = action === 'promote_admin' ? 'make this member an admin' : 'remove admin privileges from this member';
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    setLoading(true); setError('');
    try {
      await apiBridge(ApiRoute.GROUP_MEMBERS, {
        method: 'POST',
        body: JSON.stringify({ chat_id: selectedChat.id, user_id: Number(member.user_id || member.id), action })
      });
      const result = await apiBridge(ApiRoute.GROUP_MEMBERS, { query: { chat_id: selectedChat.id } });
      setCurrentMembers(result.members || []);
      setSuccess(action === 'promote_admin' ? 'Member promoted to admin.' : 'Admin privileges removed.');
    } catch (e) { setError(e.message || 'Unable to update member role.'); }
    finally { setLoading(false); }
  };

  const transferOwnership = async member => {
    if (loading || !window.confirm(`Make ${member.name || 'this member'} the group owner? You will become an admin and existing invite links will stop working.`)) return;
    setLoading(true); setError('');
    try {
      const data = await apiBridge(ApiRoute.GROUPS, { method: 'POST', query: { action: 'transfer', id: selectedChat.id }, body: { user_id: Number(member.user_id || member.id) } });
      onGroupUpdated?.({ ...selectedChat, owner_id: data.owner_id });
      const result = await apiBridge(ApiRoute.GROUP_MEMBERS, { query: { chat_id: selectedChat.id } });
      setCurrentMembers(result.members || []);
      setSuccess((member.name || 'Member') + ' is now the group owner.');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!selectedChat) return null;
  const isManagePage = type === 'manage_members';
  const groupGrant = attachmentGrants.find(item => item.grant_scope === 'group' && Number(item.member_id) === 0);
  const groupGrantActive = isGrantActive(groupGrant);
  const activeIndividualGrantCount = attachmentGrants.filter(item => item.grant_scope === 'member' && isGrantActive(item)).length;
  const visibleMembers = currentMembers.filter(member => {
    const roleMatches = memberTypeFilter === 'all' || (member.role || 'member') === memberTypeFilter;
    const query = memberSearchTerm.trim().toLowerCase();
    const textMatches = !query || [member.name, member.username, member.user_id, member.id].some(value => String(value || '').toLowerCase().includes(query));
    return roleMatches && textMatches;
  });
  const memberAccessState = member => {
    const memberId = Number(member.user_id || member.id);
    const individualGrant = attachmentGrants.find(item => item.grant_scope === 'member' && Number(item.member_id) === memberId);
    const individualActive = isGrantActive(individualGrant);
    const effective = individualGrant ? (individualActive ? individualGrant : null) : (groupGrantActive ? groupGrant : null);
    return {
      individualActive,
      download: Boolean(effective && Number(effective.download_enabled) === 1),
      forward: Boolean(effective && Number(effective.forward_enabled) === 1),
      inherited: !individualGrant && groupGrantActive
    };
  };
  const groupImageUrl = selectedChat.image_url || mediaUrl('group', selectedChat.id);
  const groupImageKey = 'group-' + selectedChat.id;
  const groupImageSrc = groupImageUrl ? groupImageUrl + (groupImageUrl.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(selectedChat.image_version || '') : '';
  const userImageUrl = user && user.image_url ? user.image_url : mediaUrl('user', user && user.id);
  const userImageKey = 'dashboard-user-' + (user && user.id);
  const groupHandle = selectedChat.username || selectedChat.user_id || '';
  const groupDescription = selectedChat.group_description || selectedChat.description || 'No group description has been added yet.';

  return (
    <div className={isManagePage ? 'group-management-page' : 'modal-backdrop group-management-modal-backdrop'}>
      <div className={isManagePage ? 'group-management-workspace' : 'modal-content-card group-management-modal'}>
        {!isManagePage && <div className="group-management-dialog-heading">
          <h3>Add New Member</h3>
          <button type="button" onClick={close} aria-label="Close add-member dialog"><X size={20}/></button>
        </div>}
        {error && <p className={isManagePage ? 'group-management-error' : 'privacy-error'} role="alert">{error}</p>}
        {success && <p className="group-management-success" role="status">{success}</p>}
        {!isManagePage && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Group Target: <strong>{selectedChat.name}</strong>
        </p>}

        {type === 'add_member' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Choose from your contacts</div>
            <input type="search" placeholder="Filter saved contacts..." value={contactsQuery} onChange={e => setContactsQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-main)' }} />
            <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '4px' }}>
              {contactsLoading || membersLoading ? <p style={{ padding: 12, color: 'var(--text-muted)' }}>Loading contacts…</p> : savedContacts.filter(c => Number(c.registered_user_id) > 0 && !currentMembers.some(m => Number(m.user_id || m.id) === Number(c.registered_user_id)) && [c.display_name,c.given_name,c.family_name,c.registered_name,c.registered_user_id_text,c.email,c.phone].some(v => String(v || '').toLowerCase().includes(contactsQuery.trim().toLowerCase()))).map(c => {
                const id = Number(c.registered_user_id);
                const displayName = c.display_name || [c.given_name,c.family_name].filter(Boolean).join(' ') || c.registered_name || 'CloudComAI contact';
                const imageKey = `contact-${id}-${c.image_version || ''}`;
                const palette = getAvatarPalette(id || displayName);
                return <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 8px', borderBottom:'1px solid var(--border-color)' }}>
                  <img src={mediaUrl('user', id) + (c.image_version ? `&v=${encodeURIComponent(c.image_version)}` : '')} alt="" onError={e => { e.currentTarget.style.display='none'; setFailedAvatars(prev => ({...prev,[imageKey]:true})); }} style={{ display: failedAvatars[imageKey] ? 'none' : 'block', width:38,height:38,borderRadius:'50%',objectFit:'cover',background:'var(--bg-directory)' }} />
                  {failedAvatars[imageKey] && <span style={{ width:38,height:38,borderRadius:'50%',display:'grid',placeItems:'center',background:palette.backgroundColor,color:palette.textColor,fontWeight:800 }}>{getAvatarInitial(displayName,c.registered_user_id_text)}</span>}
                  <div style={{ flex:1,minWidth:0 }}><div style={{ color:'var(--text-main)',fontWeight:600,fontSize:13 }}>{displayName}</div><div style={{ color:'var(--text-muted)',fontSize:11 }}>@{c.registered_user_id_text || c.registered_name || id}</div></div>
                  <button type="button" onClick={() => executeMemberAction(id,'add')} disabled={loading} style={{ color:'var(--primary-color)',background:'transparent',border:0,fontWeight:700 }}>+ Add</button>
                </div>;
              })}
              {!contactsLoading && !membersLoading && !savedContacts.some(c => Number(c.registered_user_id)>0 && !currentMembers.some(m => Number(m.user_id || m.id)===Number(c.registered_user_id)) && [c.display_name,c.given_name,c.family_name,c.registered_name,c.registered_user_id_text,c.email,c.phone].some(v => String(v || '').toLowerCase().includes(contactsQuery.trim().toLowerCase()))) && <p style={{padding:12,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>No eligible saved contacts found.</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Type name, email or User ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-main)' }}
                onKeyDown={e => e.key === 'Enter' && handleSearchUsers()}
              />
              <button className="primary" onClick={handleSearchUsers} style={{ background: 'var(--primary-color)', color: 'white', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={loading}>
                <Search size={16}/>
              </button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
              {!hasSearched && searchResults.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-light)', textAlign: 'center', padding: '12px' }}>
                  Search CloudComAI users by name, email or User ID.
                </p>
              )}

              {hasSearched && searchResults.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#ef4444', marginBottom: '4px' }}>🔍 No Users Found</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    We couldn't find any accounts matching "{searchTerm}". Check the spelling and try again.
                  </p>
                </div>
              )}

              {searchResults.length > 0 && searchResults.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h5 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{u.name}</h5>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>@{u.username || u.user_id}</span>
                  </div>
                  <button style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none' }} onClick={() => executeMemberAction(u.id, 'add')} disabled={loading}>
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isManagePage && (
          <div className="group-management-dashboard">
            <header className="group-management-topbar">
              <div className="group-management-breadcrumb">
                <button type="button" onClick={close} aria-label="Back to chats"><ArrowLeft size={19}/></button>
                <span>Groups</span><ChevronRight size={16}/><strong>Manage Group</strong>
              </div>
              <div className="group-management-topbar-actions">
                <label className="group-dashboard-search">
                  <Search size={18}/>
                  <input type="search" aria-label="Search group members" placeholder="Search group members..." value={memberSearchTerm} onChange={event => setMemberSearchTerm(event.target.value)} />
                </label>
                <button type="button" className="group-dashboard-icon-button" aria-label="Open notifications" onClick={onOpenNotifications}><Bell size={19}/></button>
                <div className="group-dashboard-user">
                  <span className="group-dashboard-user-avatar">
                    {!failedAvatars[userImageKey] ? <img src={userImageUrl} alt="" onError={() => setFailedAvatars(prev => ({ ...prev, [userImageKey]: true }))}/> : getAvatarInitial(user && user.name, user && user.user_id)}
                  </span>
                  <span>{user && user.name ? user.name : 'Account'}</span>
                </div>
              </div>
            </header>

            <div className="group-management-content">
              <section className="group-management-summary-card">
                <div className="group-summary-avatar">
                  {groupImageSrc && !failedAvatars[groupImageKey] ? <img src={groupImageSrc} alt="" onError={() => setFailedAvatars(prev => ({ ...prev, [groupImageKey]: true }))}/> : <span>{getAvatarInitial(selectedChat.name, groupHandle)}</span>}
                </div>
                <div className="group-summary-copy">
                  <div className="group-summary-title-row"><h1>{selectedChat.name || 'Group'}</h1><span className="group-summary-verified" aria-label="Group"><Users size={15}/></span></div>
                  <div className="group-summary-meta">{groupHandle ? '@' + groupHandle : 'Group ID #' + selectedChat.id} <span>•</span> {currentMembers.length} Members</div>
                  <p>{groupDescription}</p>
                </div>
                <div className="group-summary-actions">
                  <button type="button" onClick={onEditGroup}><span>✎</span> Edit Group</button>
                  <button type="button" onClick={onEditGroup}><Settings size={17}/> Group Settings</button>
                </div>
              </section>

              <div className="group-management-columns">
                <section className="group-dashboard-card group-members-card" aria-labelledby="group-members-heading">
                  <div className="group-dashboard-section-heading">
                    <div><h2 id="group-members-heading"><Users size={21}/> Group Members</h2><p>Manage roles and membership</p></div>
                    <strong>{currentMembers.length} Members</strong>
                  </div>
                  {ownsGroup && <div className="group-admin-limit">Administrator limit: {adminCount}/3</div>}
                  <div className="group-member-filter-tabs" role="group" aria-label="Filter group members by role">
                    {[
                      ['all', 'All (' + currentMembers.length + ')'],
                      ['owner', 'Owner (' + currentMembers.filter(member => member.role === 'owner').length + ')'],
                      ['admin', 'Admins (' + adminCount + ')'],
                      ['member', 'Members (' + currentMembers.filter(member => (member.role || 'member') === 'member').length + ')']
                    ].map(([value, label]) => <button type="button" key={value} className={memberTypeFilter === value ? 'active' : ''} aria-pressed={memberTypeFilter === value} onClick={() => setMemberTypeFilter(value)}>{label}</button>)}
                  </div>

                  <div className="group-member-list" aria-live="polite">
                    {membersLoading ? <div className="group-dashboard-empty">Loading group members…</div> : visibleMembers.length === 0 ? <div className="group-dashboard-empty">No matching members found.</div> : visibleMembers.map(member => {
                      const memberId = Number(member.user_id || member.id);
                      const isOwner = member.role === 'owner';
                      const isSelf = memberId === currentUserId;
                      const palette = getAvatarPalette(memberId || member.name);
                      const avatarKey = 'member-' + (member.user_id || member.id) + '-' + (member.image_version || '');
                      const avatarUrl = member.image_version ? mediaUrl('user', memberId) + '&v=' + encodeURIComponent(member.image_version) : '';
                      return <article className="group-member-row" key={memberId}>
                        <button type="button" className="group-member-avatar" aria-label={'View ' + (member.name || 'member') + ' profile'} onClick={() => openMemberProfile(member)} disabled={loading}>
                          {avatarUrl && !failedAvatars[avatarKey] ? <img src={avatarUrl} alt="" onError={() => setFailedAvatars(prev => ({ ...prev, [avatarKey]: true }))}/> : <span style={{ background: palette.backgroundColor, color: palette.textColor }}>{getAvatarInitial(member.name, member.username)}</span>}
                        </button>
                        <div className="group-member-copy">
                          <strong>{member.name || member.username || 'Member'}{isSelf ? <small>YOU</small> : null}</strong>
                          <span>@{member.username || member.user_id || member.id}</span>
                        </div>
                        <span className={'group-role-badge role-' + (member.role || 'member')}>{(member.role || 'member').charAt(0).toUpperCase() + (member.role || 'member').slice(1)}</span>
                        {!isOwner && canManageMembers ? <details className="group-member-actions">
                          <summary aria-label={'Actions for ' + (member.name || 'member')}><MoreHorizontal size={19}/></summary>
                          <div className="group-member-actions-menu" role="menu">
                            {ownsGroup && <button type="button" role="menuitem" disabled={loading} onClick={() => transferOwnership(member)}><Crown size={15}/> Make owner</button>}
                            {ownsGroup && member.role !== 'admin' && <button type="button" role="menuitem" disabled={loading || adminLimitReached} title={adminLimitReached ? 'Maximum of three admins reached' : 'Promote to admin'} onClick={() => setMemberRole(member, 'promote_admin')}><ShieldCheck size={15}/> Make admin</button>}
                            {ownsGroup && member.role === 'admin' && <button type="button" role="menuitem" disabled={loading} onClick={() => setMemberRole(member, 'demote_admin')}><ShieldCheck size={15}/> Remove admin</button>}
                            <button type="button" role="menuitem" className="danger-action" disabled={loading} onClick={() => executeMemberAction(memberId, 'remove')}><UserMinus size={15}/>{isSelf ? 'Leave group' : 'Remove member'}</button>
                          </div>
                        </details> : isOwner ? <span className="group-owner-indicator"><Crown size={14}/> Owner</span> : null}
                      </article>;
                    })}
                  </div>
                  <div className="group-members-footnote"><ShieldCheck size={16}/> Only authorized group managers can change roles or remove members. Ownership transfer requires confirmation.</div>
                </section>

                <section className="group-dashboard-card group-attachment-card" aria-labelledby="attachment-access-heading">
                  <div className="group-dashboard-section-heading">
                    <div><h2 id="attachment-access-heading"><span className="group-attachment-icon">⌁</span> Attachment Access</h2><p>Manage group-wide and individual download/forward permissions. Temporary group access expires automatically; individual grants remain until revoked.</p></div>
                    <span className="group-attachment-grant-count">{attachmentLoading ? 'Loading…' : activeIndividualGrantCount + ' active grants'}</span>
                  </div>

                  {!ownsGroup ? <div className="group-access-owner-note"><ShieldCheck size={18}/> Attachment access controls are available to the group owner. Your existing chat permissions remain unchanged.</div> : <>
                    <section className="group-wide-access-panel" aria-label="Group-wide attachment access">
                      <div className="group-access-panel-heading">
                        <div><strong><ShieldCheck size={18}/> Group-wide attachment access</strong><small>Temporary access for all eligible group members</small></div>
                        <span className={'group-access-status ' + (groupGrantActive ? 'active' : 'inactive')}>{attachmentLoading ? 'Loading…' : groupGrantActive ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="group-access-state-grid">
                        <div><Download size={16}/><span>Download access</span><strong className={groupGrantActive && Number(groupGrant.download_enabled) === 1 ? 'status-open' : 'status-closed'}>{groupGrantActive && Number(groupGrant.download_enabled) === 1 ? 'Open' : 'Closed'}</strong></div>
                        <div><Share2 size={16}/><span>Forward access</span><strong className={groupGrantActive && Number(groupGrant.forward_enabled) === 1 ? 'status-open' : 'status-closed'}>{groupGrantActive && Number(groupGrant.forward_enabled) === 1 ? 'Open' : 'Closed'}</strong></div>
                        {groupGrantActive && groupGrant.expires_at ? <div className="group-access-expiry"><Clock3 size={16}/><span>Expires in</span><strong>{formatRemaining(groupGrant.expires_at, clockNow)}</strong></div> : null}
                      </div>
                      <div className="group-access-actions">
                        <button type="button" disabled={attachmentBusy || attachmentLoading} onClick={() => updateAttachmentAccess(null, 'group', 24)}><Clock3 size={17}/>{attachmentBusy ? 'Updating…' : 'Allow everyone for 24 hours'}</button>
                        <button type="button" disabled={attachmentBusy || attachmentLoading} onClick={() => updateAttachmentAccess(null, 'group', 48)}><Clock3 size={17}/>{attachmentBusy ? 'Updating…' : 'Allow everyone for 48 hours'}</button>
                        <button type="button" className="revoke" disabled={attachmentBusy || attachmentLoading || !groupGrantActive} onClick={() => updateAttachmentAccess(null, 'group')}><X size={17}/>{attachmentBusy ? 'Updating…' : 'Revoke group-wide access'}</button>
                      </div>
                    </section>

                    <section className="group-individual-access" aria-label="Individual member permissions">
                      <div className="group-individual-heading"><div><h3>Individual Member Permissions</h3><p>Grant or revoke access for each eligible member.</p></div><strong>{activeIndividualGrantCount} active grants</strong></div>
                      <div className="group-individual-tools">
                        <label className="group-attachment-search"><Search size={17}/><input type="search" aria-label="Search members by name or User ID" placeholder="Search members by name or User ID..." value={attachmentSearch} onChange={event => setAttachmentSearch(event.target.value)}/></label>
                        <select aria-label="Filter member attachment permissions" value={attachmentPermissionFilter} onChange={event => setAttachmentPermissionFilter(event.target.value)}>
                          <option value="all">All permissions</option><option value="can_download">Download allowed</option><option value="cannot_download">Download blocked</option><option value="can_forward">Forward allowed</option><option value="cannot_forward">Forward blocked</option>
                        </select>
                      </div>
                      <div className="group-individual-member-list">
                        {currentMembers.filter(member => member.role !== 'owner' && Number(member.user_id || member.id) !== currentUserId).filter(member => {
                          const term = attachmentSearch.trim().toLowerCase();
                          const matchesSearch = !term || [member.name, member.username, member.user_id, member.id].some(value => String(value || '').toLowerCase().includes(term));
                          const state = memberAccessState(member);
                          const filterMatches = attachmentPermissionFilter === 'all'
                            || (attachmentPermissionFilter === 'can_download' && state.download)
                            || (attachmentPermissionFilter === 'cannot_download' && !state.download)
                            || (attachmentPermissionFilter === 'can_forward' && state.forward)
                            || (attachmentPermissionFilter === 'cannot_forward' && !state.forward);
                          return matchesSearch && filterMatches;
                        }).map(member => {
                          const state = memberAccessState(member);
                          const memberId = Number(member.user_id || member.id);
                          const palette = getAvatarPalette(memberId || member.name);
                          const avatarKey = 'attachment-' + memberId + '-' + (member.image_version || '');
                          const avatarUrl = member.image_version ? mediaUrl('user', memberId) + '&v=' + encodeURIComponent(member.image_version) : '';
                          return <article className="group-individual-member-row" key={memberId}>
                            <span className="group-individual-avatar">{avatarUrl && !failedAvatars[avatarKey] ? <img src={avatarUrl} alt="" onError={() => setFailedAvatars(prev => ({ ...prev, [avatarKey]: true }))}/> : <span style={{ background: palette.backgroundColor, color: palette.textColor }}>{getAvatarInitial(member.name, member.username)}</span>}</span>
                            <div className="group-individual-copy"><strong>{member.name || member.username || 'Member'}</strong><span>@{member.username || member.user_id || member.id}</span><small><span className={state.download ? 'permission-open' : 'permission-closed'}>{state.download ? 'Download allowed' : 'Download blocked'}</span><i>·</i><span className={state.forward ? 'permission-open' : 'permission-closed'}>{state.forward ? 'Forward allowed' : 'Forward blocked'}</span>{state.inherited ? <em>Group-wide grant</em> : null}</small></div>
                            <button type="button" disabled={attachmentBusy || attachmentLoading} className={state.individualActive ? 'revoke' : ''} onClick={() => updateAttachmentAccess(memberId)}>{attachmentBusy ? 'Updating…' : state.individualActive ? 'Revoke Access' : 'Grant Individual Access'}</button>
                          </article>;
                        })}
                        {currentMembers.filter(member => member.role !== 'owner' && Number(member.user_id || member.id) !== currentUserId).length === 0 ? <p className="group-dashboard-empty">No eligible members available for individual permissions.</p> : null}
                      </div>
                      <div className="group-individual-note"><ShieldCheck size={16}/> Individual grants remain active until revoked, even after group-wide access expires.</div>
                    </section>
                  </>}
                </section>
              </div>
            </div>
          </div>
        )}

        {!isManagePage && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button onClick={close} style={{ padding: '8px 16px', background: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '13px', border: 'none' }}>Close Settings</button>
        </div>}
      </div>
      {selectedMemberProfile ? <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setSelectedMemberProfile(null); setProfileError(''); } }} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="group-member-profile-title" style={{ width: '100%', maxWidth: '360px', borderRadius: '18px', padding: '22px', background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', boxShadow: '0 18px 55px rgba(0,0,0,.28)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" aria-label="Close profile" onClick={() => { setSelectedMemberProfile(null); setProfileError(''); }} style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: '26px', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ width: '78px', height: '78px', margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', overflow:'hidden', background: 'var(--bg-directory)', color: 'var(--text-main)', fontSize: '28px', fontWeight: 800, border: '1px solid var(--border-color)' }}>
            {selectedMemberProfile.image_version && !failedAvatars[`profile-${selectedMemberProfile.id}-${selectedMemberProfile.image_version}`] ? <img src={mediaUrl('user', selectedMemberProfile.id) + `&v=${encodeURIComponent(selectedMemberProfile.image_version)}`} alt="" onError={() => setFailedAvatars(prev => ({...prev,[`profile-${selectedMemberProfile.id}-${selectedMemberProfile.image_version}`]:true}))} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span>{getAvatarInitial(selectedMemberProfile.name,selectedMemberProfile.user_id)}</span>}
          </div>
          <h3 id="group-member-profile-title" style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800 }}>{selectedMemberProfile.name || 'CloudComAI user'}</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>@{selectedMemberProfile.user_id || selectedMemberProfile.id} · {(selectedMemberProfile.role || 'member').charAt(0).toUpperCase()+(selectedMemberProfile.role || 'member').slice(1)}</p>
          {profileLoading ? <p style={{ marginTop: '18px', color: 'var(--text-muted)' }}>Loading profile…</p> : <>
            <div style={{ textAlign: 'left', marginTop: '18px', padding: '12px', borderRadius: '12px', background: 'var(--bg-directory)', display: 'grid', gap: '9px', fontSize: '13px' }}>
              <div>Age: {selectedMemberProfile.age == null ? (selectedMemberProfile.hidden_fields?.includes('age') ? 'Private' : 'Not set') : selectedMemberProfile.age}</div>
              <div>Gender: {selectedMemberProfile.gender || (selectedMemberProfile.hidden_fields?.includes('gender') ? 'Private' : 'Not set')}</div>
              <div>Status: {selectedMemberProfile.online ? 'Online' : 'Offline'}</div>
            </div>
            {profileError && <p role="alert" style={{ color: '#b91c1c', fontSize: '12px', marginTop: '12px' }}>{profileError}</p>}
            {selectedMemberProfile.relationship?.status === 'accepted' ? <p style={{ color: 'var(--primary-color)', fontWeight: 800, marginTop: '16px' }}>Already Friends</p> :
              selectedMemberProfile.relationship?.status === 'pending' && selectedMemberProfile.relationship?.direction === 'outgoing' ? <p style={{ color: 'var(--text-muted)', fontWeight: 800, marginTop: '16px' }}>Request Sent</p> :
              selectedMemberProfile.relationship?.status === 'self' ? <p style={{ color: 'var(--text-muted)', fontWeight: 800, marginTop: '16px' }}>This is you</p> : selectedMemberProfile.relationship?.status === 'unavailable' ? null : selectedMemberProfile.relationship?.status === 'blocked' ? <p role="alert" style={{ color: '#b91c1c', marginTop: '16px' }}>This profile is unavailable.</p> :
              selectedMemberProfile.relationship?.status === 'pending' && selectedMemberProfile.relationship?.direction === 'incoming' ? <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
                <button type="button" disabled={profileBusy} onClick={() => updateMemberFriendship('accept')} style={{ width: '100%', minHeight: '44px', border: 0, borderRadius: '10px', background: 'var(--primary-color)', color: '#fff', fontWeight: 800, cursor: profileBusy ? 'wait' : 'pointer', opacity: profileBusy ? .65 : 1 }}>{profileBusy ? 'Please wait…' : 'Accept Request'}</button>
                <button type="button" disabled={profileBusy} onClick={() => updateMemberFriendship('decline')} style={{ width: '100%', minHeight: '44px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, cursor: profileBusy ? 'wait' : 'pointer', opacity: profileBusy ? .65 : 1 }}>Reject Request</button>
              </div> : <button type="button" disabled={profileBusy} onClick={updateMemberFriendship} style={{ width: '100%', minHeight: '44px', marginTop: '16px', border: 0, borderRadius: '10px', background: 'var(--primary-color)', color: '#fff', fontWeight: 800, cursor: profileBusy ? 'wait' : 'pointer', opacity: profileBusy ? .65 : 1 }}>
                {profileBusy ? 'Please wait…' : 'Add Friend'}
              </button>}
          </>}
        </section>
      </div> : null}
    </div>
  );
}
