import { useState } from 'react';
import loginPic from '../assets/images/LoginPic.png';
import almaLogo from '../assets/images/alemalogo.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function TopBrandLogo() {
  return <img src={almaLogo} alt="Alema logo" className="h-14 w-auto max-w-27.5 object-contain sm:h-20 lg:h-24" />;
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#0f8b3d]" aria-hidden="true">
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#0f8b3d]" aria-hidden="true">
      <path d="M7 10V8a5 5 0 1 1 10 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeIcon({ visible = false }) {
  return visible ? (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-500" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 4 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-500" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

function normalizeLoginUser(rawUser, fallbackUsername) {
  const user = Array.isArray(rawUser) ? rawUser[0] : rawUser || {};
  const fullName = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ')
    || user.fullName
    || user.username
    || user.user_name
    || fallbackUsername;

  return {
    user_id: user.user_id || user.id || user.userId || null,
    username: user.username || user.user_name || fallbackUsername,
    email: user.email || '',
    profile_picture: user.profile_picture || user.profilePicture || null,
    last_login_date: user.last_login_date || user.lastLoginDate || null,
    two_factor_enabled: Boolean(user.two_factor_enabled ?? user.twoFactorEnabled),
    first_name: user.first_name || user.firstName || '',
    last_name: user.last_name || user.lastName || '',
    role: user.role || 'Administrator',
    fullName,
  };
}

export default function LoginPage({ initialStatus = '', onLoginSuccess }) {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [view, setView] = useState('login');
  const [status, setStatus] = useState(initialStatus);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus('');

    try {
      const payload = await apiRequest(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password,
          login_ip: 'frontend',
        }),
      });

      const rawUser = payload.user || payload.data || payload.output?.user || payload.output?.data || payload.userData || null;
      const accessToken = payload.access_token || payload.accessToken || payload.token || '';
      const refreshToken = payload.refresh_token || payload.refreshToken || '';
      const authenticated = Boolean(payload.success || payload.output?.authenticated || payload.authenticated || rawUser);

      if (authenticated) {
        const normalizedUser = normalizeLoginUser(rawUser, loginForm.username);
        const completeUser = {
          ...normalizedUser,
          accessToken,
          refreshToken,
        };

        if (onLoginSuccess) {
          onLoginSuccess(completeUser);
        }

        setStatus('Login successful.');
      } else {
        setStatus(payload.message || 'Invalid username or password.');
      }
    } catch (error) {
      setStatus(error.message || 'Login failed.');
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setStatus('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    try {
      const payload = await apiRequest(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          username: signupForm.username,
          email: signupForm.email,
          password: signupForm.password,
          first_name: signupForm.firstName,
          last_name: signupForm.lastName,
          phone_number: '',
          employee_id: '',
          default_language: 'en',
          date_format: 'DD/MM/YYYY',
          timezone: 'UTC',
          is_active: true,
          must_change_password: true,
          two_factor_enabled: false,
          remarks: 'Created from frontend signup form',
        }),
      });

      if (payload.success) {
        setStatus('Signup successful. You can login now.');
        setView('login');
      } else {
        setStatus(payload.message || 'Signup failed.');
      }
    } catch (error) {
      setStatus(error.message || 'Signup failed.');
    }
  };

  const renderLoginForm = () => (
    <form className="w-full" onSubmit={handleLogin}>
      <div className="mb-4">
        <label htmlFor="username" className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-slate-700">
          <UserIcon />
          <span>Username</span>
        </label>
        <input
          id="username"
          type="text"
          value={loginForm.username}
          onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
          placeholder="Username"
          className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none transition focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1] sm:h-14"
          aria-label="Username"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="password" className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-slate-700">
          <LockIcon />
          <span>Password</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={loginForm.password}
            onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            placeholder="Password"
            className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] py-0 pl-4 pr-12 text-base text-slate-700 outline-none transition focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1] sm:h-14"
            aria-label="Password"
          />
          <button
            type="button"
            className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-slate-500 transition hover:text-slate-700"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-row items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 sm:text-base">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 cursor-pointer rounded accent-[#0f8b3d]"
          />
          <span className="whitespace-nowrap"> Remember me</span>
        </label>
        <button
          type="button"
          onClick={() => setView('reset')}
          className="whitespace-nowrap text-left text-sm font-medium text-[#0f8b3d] hover:text-[#0c7133] sm:text-base"
        >
          Forgot password?
        </button>
      </div>

      <button type="submit" className="h-12 w-full rounded-xl bg-[#0f8b3d] text-[18px] font-bold text-white shadow-[0_8px_18px_rgba(15,139,61,0.22)] transition hover:bg-[#0d762f] sm:h-14">
        Login
      </button>

      <div className="mt-5 text-center text-sm text-slate-600">
        <span>Don&apos;t have an account? </span>
        <button type="button" onClick={() => setView('signup')} className="font-semibold text-[#0f8b3d] hover:text-[#0c7133]">
          Sign up
        </button>
      </div>
    </form>
  );

  const renderSignupForm = () => (
    <form className="w-full" onSubmit={handleSignup}>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-2 block text-[15px] font-semibold text-slate-700">First name</label>
          <input id="firstName" value={signupForm.firstName} onChange={(event) => setSignupForm({ ...signupForm, firstName: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-2 block text-[15px] font-semibold text-slate-700">Last name</label>
          <input id="lastName" value={signupForm.lastName} onChange={(event) => setSignupForm({ ...signupForm, lastName: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="signupUsername" className="mb-2 block text-[15px] font-semibold text-slate-700">Username</label>
        <input id="signupUsername" value={signupForm.username} onChange={(event) => setSignupForm({ ...signupForm, username: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
      </div>

      <div className="mb-4">
        <label htmlFor="signupEmail" className="mb-2 block text-[15px] font-semibold text-slate-700">Email</label>
        <input id="signupEmail" type="email" value={signupForm.email} onChange={(event) => setSignupForm({ ...signupForm, email: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
      </div>

      <div className="mb-4">
        <label htmlFor="signupPassword" className="mb-2 block text-[15px] font-semibold text-slate-700">Password</label>
        <input id="signupPassword" type="password" value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
      </div>

      <div className="mb-6">
        <label htmlFor="confirmSignupPassword" className="mb-2 block text-[15px] font-semibold text-slate-700">Confirm password</label>
        <input id="confirmSignupPassword" type="password" value={signupForm.confirmPassword} onChange={(event) => setSignupForm({ ...signupForm, confirmPassword: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-[#f7faf7] px-4 text-base text-slate-700 outline-none focus:border-[#1b7e3b] focus:ring-2 focus:ring-[#dfeee1]" />
      </div>

      <button type="submit" className="h-14 w-full rounded-xl bg-[#0f8b3d] text-[18px] font-bold text-white shadow-[0_8px_18px_rgba(15,139,61,0.22)] transition hover:bg-[#0d762f]">
        Create account
      </button>

      <div className="mt-5 text-center text-sm text-slate-600">
        <button type="button" onClick={() => setView('login')} className="font-semibold text-[#0f8b3d] hover:text-[#0c7133]">
          Back to login
        </button>
      </div>
    </form>
  );

  const renderResetForm = () => (
    <div className="w-full rounded-xl border border-[#dfeee1] bg-[#f4fbf5] p-5 text-center">
      <h2 className="text-lg font-bold text-[#1d2d1d]">Password reset</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Password resets are performed by a system administrator to protect your account. Please contact your administrator for assistance.
      </p>
      <div className="mt-5 text-center text-sm text-slate-600">
        <button type="button" onClick={() => setView('login')} className="font-semibold text-[#0f8b3d] hover:text-[#0c7133]">
          Back to login
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3ea] px-3 py-4 sm:px-5 lg:px-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:rounded-[28px]">
        <div className="flex flex-col lg:flex-row">
          <div className="relative order-1 h-40 overflow-hidden bg-[#214b2d] sm:h-52 lg:hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(111, 170, 95, 0.8), rgba(20, 68, 36, 0.7)), url(${loginPic})`,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="relative flex h-full items-center justify-center px-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3 shadow-lg backdrop-blur-sm">
                <TopBrandLogo />
              </div>
            </div>
          </div>

          <div className="order-2 flex w-full items-center justify-center bg-white px-4 py-5 sm:px-6 sm:py-7 lg:order-1 lg:w-[52%] lg:px-10 lg:py-10">
            <div className="w-full max-w-lg">
              <div className="mb-4 hidden items-center justify-center sm:mb-5 lg:flex">
                <div className="flex items-center justify-center rounded-2xl bg-[#f4faf5] p-3 shadow-sm ring-1 ring-[#dfeee1]">
                  <TopBrandLogo />
                </div>
              </div>

              <div className="mb-4 text-center sm:mb-5">
                <h1 className="text-[2rem] font-black leading-[0.95] tracking-[-0.06em] text-[#1d2d1d] sm:text-[2.5rem] lg:text-[3.1rem]">
                  Poultry Farm
                </h1>
                <p className="mt-2 text-[0.65rem] font-bold tracking-[0.22em] text-[#1b7e3b] uppercase sm:text-[0.75rem]">
                  Management System
                </p>
              </div>

              <p className="mb-4 text-center text-sm text-slate-700 sm:mb-6 sm:text-base">
                Manage your farm. Grow your business.
              </p>

              {view === 'login' && renderLoginForm()}
              {view === 'signup' && renderSignupForm()}
              {view === 'reset' && renderResetForm()}

              {status && (
                <div className="mt-4 rounded-lg border border-[#dfeee1] bg-[#f4fbf5] px-3 py-2 text-sm text-[#0d762f]">
                  {status}
                </div>
              )}

              <div className="mt-6 text-center text-[14px] text-slate-700 sm:mt-8">
                <div className="font-semibold text-[#1d2d1d]">Poultry Farm Management System</div>
                <div className="mt-1 text-slate-500">© 2026 All rights reserved.</div>
              </div>
            </div>
          </div>

          <div className="relative hidden w-[48%] bg-cover bg-center lg:block">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(111, 170, 95, 0.68), rgba(35, 100, 53, 0.58)), url(${loginPic})`,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%)]" />
            <div className="relative flex h-full min-h-128 items-end justify-center p-8">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-sm">
                <TopBrandLogo />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
