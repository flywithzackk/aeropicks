import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { AuthModal } from './lib/AuthModal.jsx';
import { ToastProvider } from './lib/toast.jsx';
import Home from './pages/Home.jsx';
import Competition from './pages/Competition.jsx';
import MyBets from './pages/MyBets.jsx';
import Admin from './pages/Admin.jsx';
import Landing from './pages/Landing.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

function Layout({ children }) {
  const { user, isAdmin, login, signup, logout, authFetch } = useAuth();
  const loc = useLocation();
  const [you, setYou] = useState(null);

  useEffect(() => {
    if (user) {
      authFetch('/api/leaderboard').then(r => r.json()).then(d => setYou(d.you)).catch(() => {});
    }
  }, [user, loc.pathname]);

  if (!user && loc.pathname === '/') {
    return <>{children}</>;
  }

  return (
    <>
      <nav className="nav">
        <div className="shell nav-inner">
          <Link to="/" className="brand">
            <img src="/logos/aeropickswordwbaggie.png" alt="" className="brand-logo" />
          </Link>
          <div className="nav-links">
            {user && (
              <>
                <NavLink to="/competitions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Competitions</NavLink>
                <NavLink to="/my-bets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>My Picks</NavLink>
                <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Leaderboard</NavLink>
                {isAdmin && <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Admin</NavLink>}
                {you && (
                  <div className="points-chip">
                    <span className="pts-num">{you.total.toLocaleString()}</span>
                    <span className="pts-badge">WON</span>
                  </div>
                )}
                <NavLink to="/profile" className={({ isActive }) => `user-chip ${isActive ? 'active' : ''}`}>
                  {user.photo ? (
                    <img src={user.photo} alt="" className="user-chip-avatar" />
                  ) : (
                    <div className="user-chip-avatar user-chip-initial">{user.username?.[0]?.toUpperCase() || '?'}</div>
                  )}
                </NavLink>
                <button className="nav-link" onClick={logout}>Sign Out</button>
              </>
            )}
            {!user && (
              <>
                <button className="nav-link" onClick={login}>Sign In</button>
                <button className="btn btn-sky btn-sm" onClick={signup}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="shell">{children}</main>
      <footer className="shell footer">
        <span className="footer-brand">AEROPICKS</span>
        <span className="small">Pick your pilots. Drop your marks.</span>
      </footer>
    </>
  );
}

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, isAdmin, ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function LoadingScreen() {
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;
}

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Landing />} />
          <Route path="/competitions" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/competition/:id" element={<RequireAuth><Competition /></RequireAuth>} />
          <Route path="/my-bets" element={<RequireAuth><MyBets /></RequireAuth>} />
          <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
        </Routes>
      </Layout>
      <AuthModal />
    </>
  );
}

function Profile() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user.username || '');
  const [photo, setPhoto] = useState(user.photo || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const onPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setMsg('Photo must be under 4 MB'); return; }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => { img.src = ev.target.result; };
    img.onload = async () => {
      const max = 400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const res = await fetch('/api/upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dataUrl }) });
      const data = await res.json();
      if (res.ok && data.url) setPhoto(data.url);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try { await updateProfile({ username, photo }); setMsg('Saved'); }
    catch (e) { setMsg(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <section className="hero">
        <div className="eyebrow"><span className="dot" />Profile</div>
        <h1 className="display">Your <span style={{ color: 'var(--sky)' }}>profile.</span></h1>
      </section>
      <div className="panel" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            {photo ? (
              <img src={photo} alt="" style={{ width: 100, height: 100, borderRadius: 'var(--r-pill)', objectFit: 'cover', border: '2px solid var(--line)' }} />
            ) : (
              <div style={{ width: 100, height: 100, borderRadius: 'var(--r-pill)', background: 'var(--bg-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: 44, color: 'var(--ink-mute)' }}>
                {username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <input type="file" accept="image/*" onChange={onPhotoSelect} id="profile-photo" style={{ display: 'none' }} />
            <label htmlFor="profile-photo" className="btn btn-ghost btn-sm" style={{ marginTop: 10, display: 'inline-block' }}>Change photo</label>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field">
              <label>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" value={user.email} disabled />
            </div>
          </div>
        </div>
        <button className="btn btn-sky" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
        {msg && <span className="small" style={{ marginLeft: 12 }}>{msg}</span>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
