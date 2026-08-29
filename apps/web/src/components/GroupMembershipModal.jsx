import React, { useState, useEffect } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { UserPlus, UserMinus, Search, X } from 'lucide-react';

export default function GroupMembershipModal({ type, selectedChat, apiBridge, close, onActionComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentMembers, setCurrentMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if ((type === 'manage_members' || type === 'add_member') && selectedChat) {
      apiBridge(ApiRoute.GROUP_MEMBERS, { query: { chat_id: selectedChat.id } })
        .then(data => { if (data.members) setCurrentMembers(data.members); })
        .catch(err => console.error("Error loading group members:", err));
    }
  }, [type, selectedChat, apiBridge]);

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
    setLoading(true);
    try {
      await apiBridge(ApiRoute.GROUP_MEMBERS, {
        method: 'POST',
        body: JSON.stringify({
          chat_id: selectedChat.id,
          user_id: targetUserId,
          action: actionType
        })
      });
      alert(`User successfully ${actionType === 'add' ? 'added to' : 'removed from'} group.`);
      setSearchTerm('');
      setSearchResults([]);
      setHasSearched(false);
      onActionComplete();
    } catch (err) {
      alert(err.message || "Failed to update membership states.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedChat) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>
            {type === 'add_member' ? '👥 Add New Member' : '⚙️ Manage Group Members'}
          </h3>
          <button onClick={close} style={{ color: 'var(--text-light)', background: 'none', border: 'none' }}>
            <X size={20}/>
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Group Target: <strong>{selectedChat.name}</strong>
        </p>

        {type === 'add_member' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  Type a name or email address above to begin searching.
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

        {type === 'manage_members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h5 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Active Group Participants ({currentMembers.length})</h5>
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {!currentMembers || currentMembers.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-light)', textAlign: 'center', padding: '20px' }}>No active participants found in this group chat.</p>
              ) : (
                currentMembers.map(m => {
                  const isOwner = m.role === 'owner';
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-directory)', borderRadius: '8px', marginBottom: '4px' }}>
                      <div>
                        <h5 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{m.name}</h5>
                        <span style={{ fontSize: '10px', color: 'var(--text-light)', textTransform: 'uppercase' }}>Role: {m.role || 'member'}</span>
                      </div>
                      {isOwner ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>Owner</span>
                      ) : (
                        <button style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none' }} onClick={() => executeMemberAction(m.user_id || m.id, 'remove')} disabled={loading}>
                          <UserMinus size={14} /> Remove
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button onClick={close} style={{ padding: '8px 16px', background: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '13px', border: 'none' }}>Close Settings</button>
        </div>
      </div>
    </div>
  );
}
