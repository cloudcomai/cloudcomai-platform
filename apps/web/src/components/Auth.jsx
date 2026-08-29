import React, { useRef, useState } from 'react';
import TermsModal from './TermsModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { Camera } from 'lucide-react';

export default function Auth({ onAuth, apiBridge }) {
  const initialResetToken = new URLSearchParams(window.location.search).get('reset_token') || '';
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login');
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', user_id: '', password: '', dob: '', gender: 'Male' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const chooseAvatar = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > 2 * 1024 * 1024) return setError('Profile image must be 2 MB or smaller.');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const submit = async e => {
    e.preventDefault();
    if (mode === 'register' && !acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let response;
      if (mode === 'register') {
        response = await apiBridge('/register.php', {
          method: 'POST',
          body: JSON.stringify({ name: form.name, email: form.email, mobile: form.mobile, user_id: form.user_id, password: form.password, dob: form.dob, gender: form.gender })
        });
        if (!response?.user || !response?.token) throw new Error('Invalid response received from server');

        let nextUser = response.user;
        localStorage.setItem('cc_token', response.token);
        if (avatarFile) {
          const formData = new FormData();
          formData.append('type', 'user');
          formData.append('id', String(response.user.id));
          formData.append('image', avatarFile);
          const upload = await apiBridge('/media_upload.php', { method: 'POST', body: formData });
          nextUser = { ...nextUser, image_url: upload.image_url, image_version: upload.updated_at };
        }
        onAuth(nextUser, response.token);
      } else if (mode === 'forgot') {
        response = await apiBridge('/forgot_password.php', { method: 'POST', body: JSON.stringify({ identifier: form.email }) });
        setSuccess(response?.message || 'If the account exists, password reset instructions have been sent.');
      } else if (mode === 'reset') {
        if (!resetToken) throw new Error('This password reset link is missing or invalid.');
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (form.password !== confirmPassword) throw new Error('Passwords do not match.');
        response = await apiBridge('/reset_password.php', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, password: form.password })
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        setResetToken('');
        setConfirmPassword('');
        setForm(prev => ({ ...prev, password: '' }));
        setMode('login');
        setSuccess(response?.message || 'Password has been reset successfully. You can now sign in.');
      } else {
        response = await apiBridge('/login.php', { method: 'POST', body: JSON.stringify({ identifier: form.email, password: form.password }) });
        if (!response?.user || !response?.token) throw new Error('Invalid response received from server');
        onAuth(response.user, response.token);
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = nextMode => {
    setError('');
    setSuccess('');
    setAvatarFile(null);
    setAvatarPreview('');
    setConfirmPassword('');
    setMode(nextMode);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand center"><div className="logo">C</div><div><strong>CloudComAI</strong><small>Secure Messenger</small></div></div>
        <h1>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h1>

        <form onSubmit={submit}>
          {mode === 'register' && <>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }} aria-label="Choose profile image (optional)">
                <div className="avatar-frame" style={{ width: 82, height: 82, position: 'relative' }}>
                  {avatarPreview ? <img src={avatarPreview} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <div className="avatar-placeholder" style={{ fontSize: 28 }}>{form.name?.[0] || 'U'}</div>}
                  <span style={{ position: 'absolute', right: -2, bottom: -2, background: 'var(--primary-color)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center' }}><Camera size={15}/></span>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseAvatar} />
            </div>
            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px' }}>Profile image (optional, max 2 MB)</div>
            <input required placeholder="Full name" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
            <input placeholder="CloudComAI User ID" value={form.user_id} onChange={e => setForm({...form, user_id:e.target.value})}/>
            <input type="date" required value={form.dob} onChange={e => setForm({...form, dob:e.target.value})}/>
            <select value={form.gender} onChange={e => setForm({...form, gender:e.target.value})}><option value="Male">Male</option><option value="Female">Female</option></select>
            <input required placeholder="Mobile number" value={form.mobile} onChange={e => setForm({...form, mobile:e.target.value})}/>
          </>}

          {mode !== 'reset' && <input required placeholder={mode === 'forgot' ? 'Registered email, mobile or User ID' : 'Email, mobile or User ID'} value={form.email} onChange={e => setForm({...form, email:e.target.value})}/>} 
          {(mode === 'login' || mode === 'register') && <input required type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password:e.target.value})}/>} 
          {mode === 'reset' && <>
            <input required type="password" minLength="8" placeholder="New password" value={form.password} onChange={e => setForm({...form, password:e.target.value})}/>
            <input required type="password" minLength="8" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/>
          </>}

          {mode === 'register' && <div className="terms-checkbox"><label>
            <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}/>
            <span>I agree to <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>Terms & Conditions</button> and <button type="button" className="terms-link" onClick={() => setShowPrivacy(true)}>Privacy Policy</button></span>
          </label></div>}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <button type="submit" className="primary wide" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Register' : mode === 'forgot' ? 'Send Reset Instructions' : 'Update Password'}</button>
        </form>

        {mode === 'login' && <button type="button" className="link" onClick={() => switchMode('forgot')}>Forgot Password?</button>}
        {mode === 'forgot' && <button type="button" className="link" onClick={() => switchMode('login')}>Back to Sign In</button>}
        {mode === 'reset' && <button type="button" className="link" onClick={() => switchMode('login')}>Back to Sign In</button>}
        {mode !== 'forgot' && mode !== 'reset' && <button type="button" className="link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}</button>}

        {showTerms && <TermsModal onClose={() => setShowTerms(false)}/>} 
        {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)}/>} 
      </div>
    </div>
  );
}
