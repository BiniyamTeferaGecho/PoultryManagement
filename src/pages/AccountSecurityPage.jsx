import { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No recorded login';
}

export default function AccountSecurityPage({ currentUser, onPasswordChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function changePassword(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: form.currentPassword, new_password: form.newPassword }),
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(payload.message || 'Password update failed.');
      onPasswordChanged();
    } catch (requestError) {
      setError(requestError.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1f2d2a]">Login &amp; Account Security</h2>
        <p className="mt-1 text-sm text-[#5d6d68]">Review your account details and update your password.</p>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <div className="grid max-w-5xl gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#e3ebea] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Login information</h3>
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-[#5d6d68]">Username</dt><dd className="mt-1 font-semibold text-[#1f2d2a]">{currentUser.username}</dd></div>
            <div><dt className="text-[#5d6d68]">Email</dt><dd className="mt-1 font-semibold text-[#1f2d2a]">{currentUser.email || 'Not provided'}</dd></div>
            <div><dt className="text-[#5d6d68]">Last login</dt><dd className="mt-1 font-semibold text-[#1f2d2a]">{formatDate(currentUser.last_login_date)}</dd></div>
            <div><dt className="text-[#5d6d68]">Two-factor authentication</dt><dd className="mt-1 font-semibold text-[#1f2d2a]">{currentUser.two_factor_enabled ? 'Enabled' : 'Not enabled'}</dd></div>
          </dl>
        </section>
        <form onSubmit={changePassword} className="rounded-2xl border border-[#e3ebea] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Change password</h3>
          <p className="mt-1 text-sm text-[#5d6d68]">Changing your password signs you out of all devices.</p>
          {[
            ['currentPassword', 'Current password'],
            ['newPassword', 'New password'],
            ['confirmPassword', 'Confirm new password'],
          ].map(([field, label]) => (
            <label key={field} className="mt-4 block text-sm font-semibold text-[#374744]">
              {label}
              <input type="password" required minLength="8" maxLength="72" autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>
          ))}
          <div className="mt-6 flex justify-end"><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Updating...' : 'Update password'}</button></div>
        </form>
      </div>
    </div>
  );
}
