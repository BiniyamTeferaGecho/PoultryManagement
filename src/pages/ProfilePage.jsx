import { useEffect, useState } from 'react';
import UserAvatar from '../components/UserAvatar';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

async function authenticatedRequest(path, accessToken, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

function profileFormFromUser(user) {
  return {
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone_number: user?.phone_number || '',
    default_language: user?.default_language || 'en',
    date_format: user?.date_format || 'DD/MM/YYYY',
    timezone: user?.timezone || 'UTC',
  };
}

export default function ProfilePage({ currentUser, onUserUpdate, focusPicture = false }) {
  const [profile, setProfile] = useState(currentUser);
  const [form, setForm] = useState(() => profileFormFromUser(currentUser));
  const [pictureFile, setPictureFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const payload = await authenticatedRequest('/auth/me', currentUser.accessToken);
        if (!active) return;
        setProfile(payload.user);
        setForm(profileFormFromUser(payload.user));
        onUserUpdate(payload.user);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [currentUser.accessToken, onUserUpdate]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectPicture(event) {
    const file = event.target.files?.[0] || null;
    setError('');
    setMessage('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setPictureFile(null);
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setPictureFile(null);
      setError('Profile picture must not exceed 2 MB.');
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPictureFile(file);
    setPreviewUrl(nextPreviewUrl);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = await authenticatedRequest('/auth/me', currentUser.accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setProfile(payload.user);
      onUserUpdate(payload.user);
      setMessage('Profile details saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPicture() {
    if (!pictureFile) {
      setError('Choose an image before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    const formData = new FormData();
    formData.append('profile_picture', pictureFile);
    try {
      const payload = await authenticatedRequest('/auth/me/profile-picture', currentUser.accessToken, {
        method: 'POST',
        body: formData,
      });
      setProfile(payload.user);
      onUserUpdate(payload.user);
      setPictureFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMessage('Profile picture updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1f2d2a]">{focusPicture ? 'Change Profile Picture' : 'My Profile'}</h2>
        <p className="mt-1 text-sm text-[#5d6d68]">Manage your personal information and profile picture.</p>
      </div>

      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      {loading ? <div className="rounded-2xl border border-[#e3ebea] bg-white p-6 text-sm text-[#5d6d68] shadow-sm">Loading profile...</div> : (
        <div className="grid max-w-5xl gap-5 xl:grid-cols-3">
          <section className="rounded-2xl border border-[#e3ebea] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#1f2d2a]">Profile picture</h3>
            <div className="mt-5 flex flex-col items-center text-center">
              <UserAvatar user={profile} previewUrl={previewUrl} className="h-28 w-28 text-2xl" />
              <p className="mt-4 text-sm text-[#5d6d68]">JPEG, PNG, or WebP. Maximum 2 MB.</p>
              <label className="mt-4 cursor-pointer rounded-xl border border-[#b8d6c1] px-4 py-2.5 text-sm font-bold text-[#0f8b3d] hover:bg-[#edf9f0]">
                Choose picture
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPicture} className="sr-only" />
              </label>
              {pictureFile && <div className="mt-3 text-sm font-medium text-[#374744]">{pictureFile.name}</div>}
              <button type="button" disabled={!pictureFile || saving} onClick={uploadPicture} className="mt-3 rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:cursor-not-allowed disabled:opacity-50">Save picture</button>
            </div>
          </section>

          <form onSubmit={saveProfile} className="rounded-2xl border border-[#e3ebea] bg-white p-5 shadow-sm xl:col-span-2">
            <h3 className="text-lg font-bold text-[#1f2d2a]">Personal information</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['first_name', 'First name', 'text'],
                ['last_name', 'Last name', 'text'],
                ['phone_number', 'Phone number', 'tel'],
                ['default_language', 'Language', 'text'],
                ['date_format', 'Date format', 'text'],
                ['timezone', 'Timezone', 'text'],
              ].map(([field, label, type]) => (
                <label key={field} className="text-sm font-semibold text-[#374744]">
                  {label}
                  <input type={type} value={form[field]} onChange={(event) => updateField(field, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
                </label>
              ))}
              <label className="text-sm font-semibold text-[#374744]">Username<input readOnly value={profile?.username || ''} className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-[#e4e9e5] bg-[#f4f7f5] px-3 font-normal text-[#5d6d68]" /></label>
              <label className="text-sm font-semibold text-[#374744]">Email<input readOnly value={profile?.email || ''} className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-[#e4e9e5] bg-[#f4f7f5] px-3 font-normal text-[#5d6d68]" /></label>
            </div>
            <div className="mt-6 flex justify-end"><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save profile'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
