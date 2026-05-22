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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      authFetch('/api/leaderboard').then(r => r.json()).then(d => setYou(d.you)).catch(() => {});
    }
  }, [user, loc.pathname]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

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

          {/* Desktop links */}
          <div className="nav-links nav-links-desktop">
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

          {/* Mobile hamburger button */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            {user && user.photo ? (
              <img src={user.photo} alt="" className="hamburger-avatar" />
            ) : user ? (
              <div className="hamburger-avatar hamburger-avatar-initial">{user.username?.[0]?.toUpperCase() || '?'}</div>
            ) : null}
            <span className="hamburger-lines">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="drawer-overlay" onClick={() => setMenuOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close" type="button">×</button>
            {user && (
              <>
                <div className="drawer-user">
                  {user.photo ? (
                    <img src={user.photo} alt="" className="drawer-avatar" />
                  ) : (
                    <div className="drawer-avatar drawer-avatar-initial">{user.username?.[0]?.toUpperCase() || '?'}</div>
                  )}
                  <div>
                    <div className="drawer-username">{user.username}</div>
                    {you && (
                      <div className="drawer-won">
                        <span className="drawer-won-num">{you.total.toLocaleString()}</span>
                        <span className="drawer-won-label">PTS WON</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="drawer-links">
                  <NavLink to="/competitions" className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}>
                    <span>Competitions</span>
                    <span className="drawer-link-arrow">→</span>
                  </NavLink>
                  <NavLink to="/my-bets" className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}>
                    <span>My Picks</span>
                    <span className="drawer-link-arrow">→</span>
                  </NavLink>
                  <NavLink to="/leaderboard" className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}>
                    <span>Leaderboard</span>
                    <span className="drawer-link-arrow">→</span>
                  </NavLink>
                  <NavLink to="/profile" className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}>
                    <span>Profile</span>
                    <span className="drawer-link-arrow">→</span>
                  </NavLink>
                  {isAdmin && (
                    <NavLink to="/admin" className={({ isActive }) => `drawer-link drawer-link-admin ${isActive ? 'active' : ''}`}>
                      <span>Admin</span>
                      <span className="drawer-link-arrow">→</span>
                    </NavLink>
                  )}
                </div>
                <div className="drawer-foot">
                  <button className="btn btn-ghost" onClick={() => { setMenuOpen(false); logout(); }} style={{ width: '100%' }}>Sign Out</button>
                </div>
              </>
            )}
            {!user && (
              <>
                <div className="drawer-user" style={{ paddingTop: 30 }}>
                  <img src="/logos/aeropickswordwbaggie.png" alt="Aeropicks" style={{ height: 36 }} />
                </div>
                <div className="drawer-foot" style={{ marginTop: 'auto' }}>
                  <button className="btn btn-sky btn-lg" onClick={() => { setMenuOpen(false); signup(); }} style={{ width: '100%', marginBottom: 12 }}>Sign Up</button>
                  <button className="btn btn-ghost btn-lg" onClick={() => { setMenuOpen(false); login(); }} style={{ width: '100%' }}>Sign In</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
  const { user, updateProfile, authFetch } = useAuth();
  const [username, setUsername] = useState(user.username || '');
  const [photo, setPhoto] = useState(user.photo || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch('/api/leaderboard').then(r => r.json()).catch(() => null),
      authFetch('/api/bets').then(r => r.json()).catch(() => ({ bets: [] })),
    ]).then(([lb, bets]) => {
      setStats(lb?.you || { rank: null, total: 0, competitionsWon: 0 });
      // Sort bets newest first (assume each has competitionId; settled bets in order received)
      const all = bets.bets || [];
      // Split into settled vs pending
      const settled = all.filter(b => b.status === 'won' || b.status === 'lost');
      const pending = all.filter(b => b.status === 'pending');
      setActivity({ settled: settled.slice(0, 12), pending, totals: {
        pending: pending.reduce((s, b) => s + b.points, 0),
        pendingCount: pending.length,
        settledCount: settled.length,
        won: settled.filter(b => b.status === 'won').length,
      }});
      setLoading(false);
    });
  }, []);

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
      if (res.ok && data.url) {
        setPhoto(data.url);
        try { await updateProfile({ photo: data.url }); setMsg('Photo updated'); } catch {}
      }
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try { await updateProfile({ username, photo }); setMsg('Saved'); }
    catch (e) { setMsg(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 80 }}><div className="spinner" /></div>;

  const rankDisplay = stats?.rank ? `#${stats.rank}` : '—';

  return (
    <div>
      {/* HERO: Big avatar, username, key stats */}
      <section className="hero" style={{ paddingBottom: 24 }}>
        <div className="profile-hero-grid">
          <div className="profile-hero-identity">
            <div className="profile-avatar-wrap">
              {photo ? (
                <img src={photo} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar profile-avatar-initial">
                  {username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <input type="file" accept="image/*" onChange={onPhotoSelect} id="profile-avatar-input" style={{ display: 'none' }} />
              <label htmlFor="profile-avatar-input" className="profile-avatar-edit">Change</label>
            </div>
            <div>
              <div className="eyebrow"><span className="dot" />Your Floor</div>
              <h1 className="display fade-up" style={{ fontSize: 'clamp(48px, 9vw, 92px)', lineHeight: 0.95, marginTop: 8 }}>
                {username || 'You'}
              </h1>
              <p className="small" style={{ marginTop: 8 }}>{user.email}</p>
            </div>
          </div>
          <div className="stat-panel fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="stat-row">
              <span className="stat-label">Total Won</span>
              <span className="stat-value" style={{ color: 'var(--lime)' }}>{(stats?.total || 0).toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Rank</span>
              <span className="stat-value" style={{ color: 'var(--sky)' }}>{rankDisplay}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Comps Won</span>
              <span className="stat-value">{stats?.competitionsWon || 0}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Picks In Play</span>
              <span className="stat-value" style={{ color: 'var(--electric)' }}>{activity.totals?.pending || 0}</span>
            </div>
          </div>
        </div>
      </section>

      {/* PENDING PICKS (only if any) */}
      {activity.pending && activity.pending.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--electric)' }} />
              <h2 className="h2-display">In Play</h2>
            </div>
            <span className="small">{activity.pending.length} active</span>
          </div>
          <div className="activity-grid">
            {activity.pending.map((b, i) => (
              <div key={i} className="activity-card activity-pending">
                {b.pilotPhoto ? (
                  <img src={b.pilotPhoto} alt="" className="activity-photo" />
                ) : (
                  <div className="activity-photo activity-photo-placeholder">?</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="activity-pilot">{b.pilotName}</div>
                  <div className="small">{b.competitionName} · <span style={{ color: 'var(--coral)' }}>{ordinal(b.place)}</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--electric)' }}>{b.points}</div>
                  <div className="small">@ {b.odds}×</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RECENT ACTIVITY (settled) */}
      {activity.settled && activity.settled.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-head">
            <div className="section-title">
              <div className="section-bar" style={{ background: 'var(--coral)' }} />
              <h2 className="h2-display">Recent Activity</h2>
            </div>
            <span className="small">{activity.totals.won} of {activity.totals.settledCount} hit</span>
          </div>
          <div className="activity-grid">
            {activity.settled.map((b, i) => (
              <div key={i} className={`activity-card activity-${b.status}`}>
                {b.pilotPhoto ? (
                  <img src={b.pilotPhoto} alt="" className="activity-photo" />
                ) : (
                  <div className="activity-photo activity-photo-placeholder">?</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="activity-pilot">{b.pilotName}</div>
                  <div className="small">{b.competitionName} · <span style={{ color: 'var(--coral)' }}>{ordinal(b.place)}</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {b.status === 'won' ? (
                    <>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--lime)' }}>+{b.payout}</div>
                      <div className="small" style={{ color: 'var(--lime)' }}>Won</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--ink-mute)' }}>{b.points}</div>
                      <div className="small" style={{ color: 'var(--red)' }}>Lost</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* If absolutely nothing - friendly empty state */}
      {(!activity.pending || activity.pending.length === 0) && (!activity.settled || activity.settled.length === 0) && (
        <div className="empty" style={{ marginBottom: 28 }}>
          <div className="empty-icon">🎈</div>
          <div className="empty-title">No picks yet</div>
          <p className="small" style={{ marginBottom: 16 }}>Browse competitions and make your first picks.</p>
          <Link to="/competitions" className="btn btn-sky btn-sm">Browse Competitions →</Link>
        </div>
      )}

      {/* EDITABLE PROFILE - tucked at the bottom */}
      <section style={{ marginTop: 40 }}>
        <div className="section-head">
          <div className="section-title">
            <div className="section-bar" style={{ background: 'var(--violet)' }} />
            <h2 className="h2-display">Edit Profile</h2>
          </div>
        </div>
        <div className="panel" style={{ maxWidth: 560 }}>
          <div className="field">
            <label>Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" value={user.email} disabled />
          </div>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
          {msg && <span className="small" style={{ marginLeft: 12 }}>{msg}</span>}
        </div>
      </section>
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
