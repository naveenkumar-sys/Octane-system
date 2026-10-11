import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setTokens, clearTokens } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize Auth State on Mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const userData = await api.getProfile();
          setUser(userData);
        } catch (err) {
          console.error('Session restore failed:', err);
          clearTokens();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleLogoutEvent = () => {
      clearTokens();
      setUser(null);
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => window.removeEventListener('auth-logout', handleLogoutEvent);
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setTokens(data.access, data.refresh);
    const userData = await api.getProfile();
    setUser(userData);
    return userData;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const isAdmin = Boolean(user?.role === 'ADMIN' || user?.is_staff || user?.is_superuser);
  const isCashier = Boolean(user && !isAdmin);

  const value = {
    user,
    token: getToken(),
    loading,
    isAdmin,
    isCashier,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
