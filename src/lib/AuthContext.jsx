import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ public_settings: {} });
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const localUser = {
      id: 'local-admin',
      full_name: 'Local Admin',
      email: 'local@aisafeguard.app',
      role: 'admin',
    };
    setUser(localUser);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    return localUser;
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
  };

  const navigateToLogin = () => {
    setAuthError(null);
    checkUserAuth();
  };

  const checkAppState = checkUserAuth;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
