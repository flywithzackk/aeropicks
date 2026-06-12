import { createContext, useContext, useEffect, useState } from 'react';
import GoTrue from 'gotrue-js';

const AuthContext = createContext(null);

// Use the Identity endpoint of the current site
const auth = new GoTrue({
  APIUrl: typeof window !== 'undefined' ? `${window.location.origin}/.netlify/identity` : '/.netlify/identity',
  audience: '',
  setCookie: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | 'signin' | 'signup' | 'forgot' | 'recover' | 'confirm'
  const [recoveryToken, setRecoveryToken] = useState(null);
  const [confirmToken, setConfirmToken] = useState(null);

  // Best-effort sync of user metadata to the profiles store.
  // Safe to call repeatedly - server-side merge preserves other fields.
  async function syncProfile(u) {
    try {
      const token = await u.jwt();
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: u.user_metadata?.username,
          photo: u.user_metadata?.photo,
        }),
      });
    } catch {}
  }

  useEffect(() => {
    // Check for tokens in the URL hash (Netlify Identity uses hash fragments)
    // Examples: #recovery_token=xxx, #confirmation_token=xxx, #invite_token=xxx
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const recovery = params.get('recovery_token');
      const confirmation = params.get('confirmation_token');
      const invite = params.get('invite_token');

      if (recovery) {
        setRecoveryToken(recovery);
        setAuthModal('recover');
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } else if (confirmation) {
        setConfirmToken(confirmation);
        // auto-confirm and notify
        auth.confirm(confirmation, true).then(u => {
          setUser(buildUserObj(u));
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }).catch(() => {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        });
      } else if (invite) {
        // Future: invite token flow
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    const current = auth.currentUser();
    if (current) {
      setUser(buildUserObj(current));
      // Self-heal: ensure profile is synced even for users who signed up before this fix shipped
      syncProfile(current);
    }
    setReady(true);
  }, []);

  function buildUserObj(gotrueUser) {
    return {
      raw: gotrueUser,
      id: gotrueUser.id,
      email: gotrueUser.email,
      username: gotrueUser.user_metadata?.username || gotrueUser.user_metadata?.full_name || gotrueUser.email?.split('@')[0],
      photo: gotrueUser.user_metadata?.photo || null,
      app_metadata: gotrueUser.app_metadata || {},
    };
  }

  const isAdmin = user?.app_metadata?.roles?.includes('admin') || false;

  const login = () => setAuthModal('signin');
  const signup = () => setAuthModal('signup');
  const closeAuth = () => {
    setAuthModal(null);
    setRecoveryToken(null);
  };
  const switchMode = (mode) => setAuthModal(mode);

  const doSignIn = async (email, password) => {
    const u = await auth.login(email, password, true);
    setUser(buildUserObj(u));
    // Self-heal: re-sync profile on every sign-in in case signup failed to do so
    syncProfile(u);
    return u;
  };

  const doExternalProvider = (provider) => {
    // gotrue-js opens the provider login URL in a popup/redirect
    // For Netlify Identity with Google enabled, this kicks off OAuth
    const url = `${window.location.origin}/.netlify/identity/authorize?provider=${provider}`;
    window.location.href = url;
  };

  // Handle redirect-back from external provider (Identity puts token in URL hash)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access = params.get('access_token');
    if (access) {
      // This is gotrue-js territory; the library typically handles it,
      // but we can refresh after the redirect
      setTimeout(() => {
        const u = auth.currentUser();
        if (u) setUser(buildUserObj(u));
      }, 100);
    }
  }, []);

  const doSignUp = async (email, password, username, photoUrl) => {
    // Step 1: create the account with metadata
    await auth.signup(email, password, {
      username,
      photo: photoUrl || null,
    });

    // Step 2: immediately sign in. With confirmation disabled in Netlify settings,
    // this should succeed and they're in. If it fails momentarily, retry once.
    let loggedIn;
    try {
      loggedIn = await auth.login(email, password, true);
    } catch (firstErr) {
      // Wait briefly and try again — Identity sometimes needs a tick to propagate
      await new Promise(r => setTimeout(r, 800));
      try {
        loggedIn = await auth.login(email, password, true);
      } catch (ex) {
        const m = ex.json?.error_description || ex.json?.msg || ex.json?.error || ex.message || '';
        if (/confirm/i.test(m) || /not yet confirmed/i.test(m)) {
          const err = new Error('Your account was created. Please check your email to confirm your account, then sign in.');
          err.confirmRequired = true;
          throw err;
        }
        const err = new Error(`Account created. Please sign in: ${m}`);
        throw err;
      }
    }

    setUser(buildUserObj(loggedIn));
    // Sync to profiles store so leaderboard can show username/photo
    try {
      const token = await loggedIn.jwt();
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username, photo: photoUrl }),
      });
    } catch {}
    return loggedIn;
  };

  const doForgotPassword = async (email) => {
    await auth.requestPasswordRecovery(email);
  };

  const doRecoverPassword = async (newPassword) => {
    if (!recoveryToken) throw new Error('no recovery token');
    // Recover() validates the token and returns a user; then update() sets new password
    const recoveredUser = await auth.recover(recoveryToken, true);
    const updated = await recoveredUser.update({ password: newPassword });
    setUser(buildUserObj(updated));
    setRecoveryToken(null);
    return updated;
  };

  const updateProfile = async (updates) => {
    const current = auth.currentUser();
    if (!current) throw new Error('not signed in');
    const updated = await current.update({
      data: {
        username: updates.username !== undefined ? updates.username : user.username,
        photo: updates.photo !== undefined ? updates.photo : user.photo,
      },
    });
    setUser(buildUserObj(updated));
    // Sync to profiles store
    try {
      const token = await updated.jwt();
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: updates.username !== undefined ? updates.username : user.username,
          photo: updates.photo !== undefined ? updates.photo : user.photo,
        }),
      });
    } catch {}
    return updated;
  };

  const logout = async () => {
    try {
      const current = auth.currentUser();
      if (current) await current.logout();
    } catch {}
    setUser(null);
  };

  const authFetch = async (url, options = {}) => {
    const current = auth.currentUser();
    let token = null;
    if (current) {
      try {
        token = await current.jwt();
      } catch (e) {
        setUser(null);
      }
    }
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isAdmin,
        login,
        signup,
        closeAuth,
        switchMode,
        authModal,
        recoveryToken,
        doSignIn,
        doExternalProvider,
        doSignUp,
        doForgotPassword,
        doRecoverPassword,
        updateProfile,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
