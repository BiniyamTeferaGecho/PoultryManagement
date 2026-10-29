import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const GlobalPopupContext = createContext(null);

export function GlobalPopupProvider({ children }) {
  const [activeMessage, setActiveMessage] = useState('');
  const [queue, setQueue] = useState([]);

  const showError = useCallback((message) => {
    const text = String(message || '').trim();
    if (!text) return;

    setQueue((currentQueue) => {
      if (!activeMessage && currentQueue.length === 0) {
        setActiveMessage(text);
        return currentQueue;
      }
      return [...currentQueue, text];
    });
  }, [activeMessage]);

  const closePopup = useCallback(() => {
    setQueue((currentQueue) => {
      const [nextMessage, ...rest] = currentQueue;
      setActiveMessage(nextMessage || '');
      return rest;
    });
  }, []);

  const value = useMemo(() => ({
    activeMessage,
    showError,
    closePopup,
  }), [activeMessage, closePopup, showError]);

  return <GlobalPopupContext.Provider value={value}>{children}</GlobalPopupContext.Provider>;
}

export function useGlobalPopup() {
  const context = useContext(GlobalPopupContext);
  if (!context) throw new Error('useGlobalPopup must be used inside GlobalPopupProvider.');
  return context;
}
