import { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';

export default function UserProfileMenu({ user, onNavigate, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function navigate(page) {
    setIsOpen(false);
    onNavigate(page);
  }

  function confirmLogout() {
    setIsOpen(false);
    if (window.confirm('Are you sure you want to log out?')) onLogout();
  }

  const displayName = user?.fullName || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Farm Admin';
  const detail = user?.role || user?.email || 'Administrator';

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-3 rounded-xl border border-[#dfe8e1] bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-[#b8d6c1] focus:outline-none focus:ring-2 focus:ring-[#9dd6ae]"
      >
        <UserAvatar user={user} />
        <span className="hidden max-w-40 sm:block">
          <span className="block truncate text-base font-bold leading-tight text-[#1f2d2a]">{displayName}</span>
          <span className="block truncate text-xs text-[#5d6d68]">{detail}</span>
        </span>
        <span className={`text-sm text-[#5d6d68] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
      </button>

      <div className={`absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-1rem))] origin-top-right rounded-2xl border border-[#dfe8e1] bg-white p-2 shadow-xl transition duration-150 ${isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`} role="menu" aria-label="User account menu">
        <div className="border-b border-[#edf1ee] px-3 py-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <div className="truncate font-bold text-[#1f2d2a]">{displayName}</div>
              <div className="truncate text-xs text-[#5d6d68]">{user?.email || detail}</div>
            </div>
          </div>
        </div>
        <button type="button" role="menuitem" onClick={() => navigate('profile')} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#374744] hover:bg-[#edf8f0] focus:bg-[#edf8f0] focus:outline-none">
          <span aria-hidden="true">👤</span> Profile
        </button>
        <button type="button" role="menuitem" onClick={() => navigate('profile-picture')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#374744] hover:bg-[#edf8f0] focus:bg-[#edf8f0] focus:outline-none">
          <span aria-hidden="true">🖼️</span> Change picture
        </button>
        <button type="button" role="menuitem" onClick={() => navigate('account-security')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#374744] hover:bg-[#edf8f0] focus:bg-[#edf8f0] focus:outline-none">
          <span aria-hidden="true">🔒</span> Login &amp; account security
        </button>
        <div className="my-1 border-t border-[#edf1ee]" />
        <button type="button" role="menuitem" onClick={confirmLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none">
          <span aria-hidden="true">↪</span> Logout
        </button>
      </div>
    </div>
  );
}
