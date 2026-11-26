import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hd_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('hd_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const r = await authApi.login({ email, password });
    localStorage.setItem('hd_token', r.data.token);
    setUser(r.data.user);
    return r.data.user;
  }

  async function signup(full_name, email, password) {
    const r = await authApi.signup({ full_name, email, password });
    localStorage.setItem('hd_token', r.data.token);
    setUser(r.data.user);
    return r.data.user;
  }

  function logout() {
    localStorage.removeItem('hd_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}