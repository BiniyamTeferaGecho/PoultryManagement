// Lightweight global fetch interceptor that notifies the app when the backend
// reports an unauthenticated/expired-session response (HTTP 401), so the UI
// can immediately log the user out instead of leaving stale screens up.

export const SESSION_EXPIRED_EVENT = 'app:session-expired';

let installed = false;

export function installSessionExpiryInterceptor() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return response;
  };
}
