import { useCallback, useEffect, useState } from 'react';
import LoginPage from './pages/login';
import DashboardPage from './pages/Dashboard';
import GlobalErrorPopupBridge from './components/common/GlobalErrorPopupBridge';
import GlobalPopupHost from './components/common/GlobalPopupHost';
import { GlobalPopupProvider } from './context/GlobalPopupContext';
import { installSessionExpiryInterceptor, SESSION_EXPIRED_EVENT } from './utils/sessionExpiry';

installSessionExpiryInterceptor();

function AuthenticatedApp({ currentUser, handlePasswordChanged, setCurrentUser, updateCurrentUser }) {
  return (
    <>
      <GlobalPopupHost />
      <GlobalErrorPopupBridge />
      <DashboardPage
        user={currentUser}
        onLogout={() => setCurrentUser(null)}
        onUserUpdate={updateCurrentUser}
        onPasswordChanged={handlePasswordChanged}
      />
    </>
  );
}

function UnauthenticatedApp({ authNotice, setAuthNotice, setCurrentUser }) {
  return (
    <>
      <GlobalPopupHost />
      <GlobalErrorPopupBridge />
      <LoginPage initialStatus={authNotice} onLoginSuccess={(user) => {
        setAuthNotice('');
        setCurrentUser(user);
      }} />
    </>
  );
}

function App() {
  const [authNotice, setAuthNotice] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('farmUser');
      const user = savedUser ? JSON.parse(savedUser) : null;
      return user?.accessToken ? user : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('farmUser', JSON.stringify(currentUser));
      return;
    }

    localStorage.removeItem('farmUser');
  }, [currentUser]);

  const updateCurrentUser = useCallback((updatedUser) => {
    setCurrentUser((existingUser) => {
      if (!existingUser) return existingUser;
      const mergedUser = { ...existingUser, ...updatedUser };
      return {
        ...mergedUser,
        fullName: [mergedUser.first_name, mergedUser.last_name].filter(Boolean).join(' ') || mergedUser.username,
      };
    });
  }, []);

  const handlePasswordChanged = useCallback(() => {
    setAuthNotice('Password changed. Please sign in with your new password.');
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      setCurrentUser((existingUser) => (existingUser ? null : existingUser));
      setAuthNotice((existingNotice) => existingNotice || 'Your session has expired. Please sign in again.');
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  if (currentUser) {
    return (
      <GlobalPopupProvider>
        <AuthenticatedApp
          currentUser={currentUser}
          handlePasswordChanged={handlePasswordChanged}
          setCurrentUser={setCurrentUser}
          updateCurrentUser={updateCurrentUser}
        />
      </GlobalPopupProvider>
    );
  }

  return (
    <GlobalPopupProvider>
      <UnauthenticatedApp
        authNotice={authNotice}
        setAuthNotice={setAuthNotice}
        setCurrentUser={setCurrentUser}
      />
    </GlobalPopupProvider>
  );
}

export default App;
