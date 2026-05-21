import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
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
            <img src="/logos/aeropickswordwbaggie.png" alt="Aeropicks" className="brand-logo" />
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
    <Layout>
      <Routes>
        <Route path="/" element={user ? <Home /> : <Landing />} />
        <Route path="/competitions" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/competition/:id" element={<RequireAuth><Competition /></RequireAuth>} />
        <Route path="/my-bets" element={<RequireAuth><MyBets /></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Routes>
    </Layout>
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
