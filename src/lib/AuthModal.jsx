import { useState, useRef } from 'react';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

export function AuthModal() {
  const { authModal, closeAuth, switchMode } = useAuth();
  if (!authModal) return null;

  // Only close if the click is DIRECTLY on the overlay backdrop, not bubbled from inside.
  // Use mousedown so it triggers before focus events can interfere.
  const onOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) closeAuth();
  };

  return (
    <div className="auth-overlay" onMouseDown={onOverlayMouseDown}>
      <div className="auth-card">
        <button className="auth-close" onClick={closeAuth} aria-label="Close" type="button">×</button>
        <div className="auth-brand">
          <img src="/logos/aeropickswordwbaggie.png" alt="Aeropicks" />
        </div>
        {authModal === 'signin' && <SignInForm switchMode={switchMode} closeAuth={closeAuth} />}
        {authModal === 'signup' && <SignUpForm switchMode={switchMode} closeAuth={closeAuth} />}
        {authModal === 'forgot' && <ForgotForm switchMode={switchMode} closeAuth={closeAuth} />}
        {authModal === 'recover' && <RecoverForm switchMode={switchMode} closeAuth={closeAuth} />}
      </div>
    </div>
  );
}

function SignInForm({ switchMode, closeAuth }) {
  const { doSignIn, doExternalProvider } = useAuth();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      let email = identifier.trim();

      // If it's not an email (no @), treat it as a username and look up the email
      if (!email.includes('@')) {
        try {
          const r = await fetch(`/api/lookup-username?username=${encodeURIComponent(email)}`);
          const data = await r.json();
          if (data.email) {
            email = data.email;
          } else {
            setErr('No account with that username');
            setLoading(false);
            return;
          }
        } catch {
          setErr('Could not look up username');
          setLoading(false);
          return;
        }
      }

      await doSignIn(email, password);
      showToast('Welcome back');
      closeAuth();
    } catch (ex) {
      // Pull the most useful error message available from gotrue
      let m = '';
      if (ex.json) {
        m = ex.json.error_description || ex.json.msg || ex.json.error;
      }
      if (!m) m = ex.message || 'Sign in failed';
      setErr(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-head">
        <div className="kicker">Sign In</div>
        <h2 className="h1-display" style={{ fontSize: 36 }}>Welcome back.</h2>
      </div>
      <button
        type="button"
        className="btn-google"
        onClick={() => doExternalProvider('google')}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
          <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/>
          <path d="M4.5 10.48a4.8 4.8 0 010-3.07V5.34H1.83a8 8 0 000 7.32l2.67-2.18z" fill="#FBBC05"/>
          <path d="M8.98 4.72c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.34L4.5 7.4a4.77 4.77 0 014.48-2.68z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or</span></div>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Username or Email</label>
          <input
            className="input"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="aeropilot or you@example.com"
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn btn-sky btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>
      </form>
      <div className="auth-foot">
        <button className="link-btn" onClick={() => switchMode('forgot')} type="button">Forgot password?</button>
        <span className="auth-foot-sep">·</span>
        <button className="link-btn" onClick={() => switchMode('signup')} type="button">Create account</button>
      </div>
    </>
  );
}

function SignUpForm({ switchMode, closeAuth }) {
  const { doSignUp, doExternalProvider } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const onPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setErr('Photo must be under 4 MB');
      return;
    }
    setErr('');
    // Resize/compress client-side to reduce upload size and standardize format
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => { img.src = ev.target.result; };
    img.onload = () => {
      const max = 400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto(dataUrl);
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (username.trim().length < 3) {
      setErr('Username must be at least 3 characters');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      let photoUrl = null;
      if (photo) {
        // Upload via function so the blob is stored centrally
        const res = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: photo }),
        });
        const data = await res.json();
        if (res.ok && data.url) photoUrl = data.url;
      }
      await doSignUp(email.trim(), password, username.trim(), photoUrl);
      showToast(`Welcome, ${username.trim()}`);
      closeAuth();
    } catch (ex) {
      setErr(ex.json?.error_description || ex.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-head">
        <div className="kicker">Create Account</div>
        <h2 className="h1-display" style={{ fontSize: 36 }}>Get on the floor.</h2>
        <p className="small" style={{ marginTop: 8 }}>1,000 points each round. Pick well.</p>
      </div>
      <button
        type="button"
        className="btn-google"
        onClick={() => doExternalProvider('google')}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
          <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/>
          <path d="M4.5 10.48a4.8 4.8 0 010-3.07V5.34H1.83a8 8 0 000 7.32l2.67-2.18z" fill="#FBBC05"/>
          <path d="M8.98 4.72c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.34L4.5 7.4a4.77 4.77 0 014.48-2.68z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or create with email</span></div>
      <form className="auth-form" onSubmit={submit}>
        <div className="signup-grid">
          <div className="signup-photo">
            <button
              type="button"
              className="photo-upload"
              onClick={() => fileRef.current?.click()}
              style={photoPreview ? { backgroundImage: `url(${photoPreview})` } : {}}
            >
              {!photoPreview && <span>+ Photo</span>}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPhotoSelect}
              style={{ display: 'none' }}
            />
            <p className="small" style={{ textAlign: 'center', marginTop: 6, fontSize: 11 }}>Optional</p>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="aeropilot"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
          </div>
        </div>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn btn-sky btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Creating…' : 'Claim 1,000 Points →'}
        </button>
      </form>
      <div className="auth-foot">
        <span className="small">Already have an account?</span>
        <button className="link-btn" onClick={() => switchMode('signin')}>Sign in</button>
      </div>
    </>
  );
}

function ForgotForm({ switchMode }) {
  const { doForgotPassword } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await doForgotPassword(email.trim());
      setSent(true);
      showToast('Check your email');
    } catch (ex) {
      setErr(ex.json?.error_description || ex.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-head">
        <div className="kicker">Password Reset</div>
        <h2 className="h1-display" style={{ fontSize: 36 }}>Reset it.</h2>
      </div>
      {!sent ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          {err && <div className="auth-err">{err}</div>}
          <button className="btn btn-sky btn-lg" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      ) : (
        <p className="body" style={{ textAlign: 'center', padding: '20px 0' }}>
          Check your email for a reset link.
        </p>
      )}
      <div className="auth-foot">
        <button className="link-btn" onClick={() => switchMode('signin')}>Back to sign in</button>
      </div>
    </>
  );
}

function RecoverForm({ closeAuth }) {
  const { doRecoverPassword } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPw) {
      setErr('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await doRecoverPassword(password);
      showToast('Password updated. You are signed in.');
      closeAuth();
    } catch (ex) {
      let m = '';
      if (ex.json) m = ex.json.error_description || ex.json.msg || ex.json.error;
      if (!m) m = ex.message || 'Could not reset password';
      setErr(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-head">
        <div className="kicker">Password Reset</div>
        <h2 className="h1-display" style={{ fontSize: 36 }}>Set a new one.</h2>
        <p className="small" style={{ marginTop: 8 }}>You will be signed in automatically.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>New Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input
            className="input"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {err && <div className="auth-err">{err}</div>}
        <button className="btn btn-sky btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Updating…' : 'Update Password →'}
        </button>
      </form>
    </>
  );
}
