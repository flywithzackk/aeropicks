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
  const [authModal, setAuthModal] = useState(null); // null | 'signin' | 'signup' | 'forgot'

  useEffect(() => {
    const current = auth.currentUser();
    if (current) {
      setUser(buildUserObj(current));
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
  const closeAuth = () => setAuthModal(null);
  const switchMode = (mode) => setAuthModal(mode);

  const doSignIn = async (email, password) => {
    const u = await auth.login(email, password, true);
    setUser(buildUserObj(u));
    return u;
  };

  const doSignUp = async (email, password, username, photoUrl) => {
    const u = await auth.signup(email, password, {
      username,
      photo: photoUrl || null,
    });
    // After signup, auto-login (Identity may require email confirmation depending on setup)
    try {
      const loggedIn = await auth.login(email, password, true);
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
    } catch {
      // Email confirmation likely required
      return u;
    }
  };

  const doForgotPassword = async (email) => {
    await auth.requestPasswordRecovery(email);
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
        // Token refresh failed - sign out
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
        doSignIn,
        doSignUp,
        doForgotPassword,
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
