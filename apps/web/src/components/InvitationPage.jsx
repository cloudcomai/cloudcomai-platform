import React, { useEffect, useState } from 'react';
import { LogIn, UserPlus, Users } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function InvitationPage({ inviteToken, user, invitationApi, onLogin, onRegister, onJoin, onHome }) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    invitationApi.previewInvitation(inviteToken)
      .then(({ data }) => { if (!cancelled) setGroup(data.group || null); })
      .catch(previewError => { if (!cancelled) setError(previewError.message || 'This invitation is unavailable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invitationApi, inviteToken]);

  const join = async () => {
    if (!group || joining) return;
    setJoining(true);
    setError('');
    setMessage('');
    try {
      const result = await invitationApi.acceptInvitation(inviteToken);
      if (result.data?.membership_status === 'pending') {
        setMessage(result.data.message || 'Your request was sent to the group owner.');
      } else {
        await onJoin(result.data);
      }
    } catch (joinError) {
      setError(joinError.message || 'Unable to join this group.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="auth-page invite-page">
      <div className="auth-card invite-card">
        <button type="button" className="auth-home-link" onClick={onHome}>← Back to home</button>
        <BrandLogo variant="dark" className="auth-brand-image" />
        {loading ? <div className="invite-status">Checking invitation...</div> : error && !group ? <>
          <h1>Invitation unavailable</h1>
          <div className="error">{error}</div>
        </> : <>
          <div className="invite-group-icon"><Users size={30} /></div>
          <p className="invite-eyebrow">You are invited to join</p>
          <h1>{group?.name}</h1>
          <p>{group?.group_category || 'CloudComAI group'}</p>
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          {user ? (
            <button type="button" className="primary wide invite-primary" onClick={join} disabled={joining || Boolean(message)}>
              <UserPlus size={18} /> {joining ? 'Joining...' : 'Join group'}
            </button>
          ) : <>
            <p className="invite-auth-note">Sign in or create an account to accept this invitation.</p>
            <div className="invite-auth-actions">
              <button type="button" className="primary" onClick={onLogin}><LogIn size={17} /> Sign in</button>
              <button type="button" className="filter-pill" onClick={onRegister}><UserPlus size={17} /> Register</button>
            </div>
          </>}
        </>}
      </div>
    </div>
  );
}
