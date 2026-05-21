import { createContext, useContext, useEffect, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    netlifyIdentity.on('init', (u) => {
      setUser(u);
      setReady(true);
    });
    netlifyIdentity.on('login', (u) => {
      setUser(u);
      netlifyIdentity.close();
    });
    netlifyIdentity.on('logout', () => setUser(null));
    netlifyIdentity.init({ logo: false });
    return () => {
      netlifyIdentity.off('login');
      netlifyIdentity.off('logout');
      netlifyIdentity.off('init');
    };
  }, []);

  const login = () => netlifyIdentity.open('login');
  const signup = () => netlifyIdentity.open('signup');
  const logout = () => netlifyIdentity.logout();

  const isAdmin = user?.app_metadata?.roles?.includes('admin');

  const authFetch = async (url, options = {}) => {
    const token = user ? await netlifyIdentity.refresh() : null;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, ready, isAdmin, login, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
