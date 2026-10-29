import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  user_id: '',
  row_version: '',
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone_number: '',
  employee_id: '',
  default_language: 'en',
  date_format: 'DD/MM/YYYY',
  timezone: 'UTC',
  is_active: true,
  must_change_password: false,
  two_factor_enabled: false,
  remarks: '',
};

async function apiRequest(path, accessToken, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

function userToForm(user) {
  return {
    ...emptyForm,
    ...user,
    password: '',
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
    two_factor_enabled: Boolean(user.two_factor_enabled),
    row_version: user.row_version || '',
  };
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
}

export default function UserManagement({ currentUser, view }) {
  const [users, setUsers] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletedFilter, setDeletedFilter] = useState(view === 'users-deleted' ? 'deleted' : 'active');
  const [form, setForm] = useState(emptyForm);
  const [isEditorOpen, setIsEditorOpen] = useState(view === 'users-create');
  const [passwordReset, setPasswordReset] = useState({ user: null, password: '', confirmPassword: '' });
  const [bulkPasswordReset, setBulkPasswordReset] = useState({ open: false, password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [, setError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = useRef(null);

  const loadUsers = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page_number: String(page),
        page_size: '10',
      });
      if (deletedFilter !== 'all') params.set('is_deleted', deletedFilter === 'deleted' ? '1' : '0');
      if (search.trim()) params.set(search.includes('@') ? 'email' : 'username', search.trim());
      if (statusFilter !== 'all') params.set('is_active', statusFilter === 'active' ? '1' : '0');

      const payload = await apiRequest(`/user?${params}`, currentUser.accessToken);
      setUsers(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, deletedFilter, page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    async function loadEmployees() {
      if (!currentUser.accessToken) return;
      try {
        const payload = await apiRequest('/hr/employee?page_number=1&page_size=500&include_deleted=0', currentUser.accessToken);
        setEmployeeOptions(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setEmployeeOptions([]);
      }
    }
    loadEmployees();
  }, [currentUser.accessToken]);

  function openCreateForm() {
    setForm(emptyForm);
    setError('');
    setMessage('');
    setEmployeeSearch('');
    setIsEmployeeDropdownOpen(false);
    setIsEditorOpen(true);
  }

  function openEditForm(user) {
    setForm(userToForm(user));
    setError('');
    setMessage('');
    setEmployeeSearch('');
    setIsEmployeeDropdownOpen(false);
    setIsEditorOpen(true);
  }

  function openResetPasswordForm(user) {
    setPasswordReset({ user, password: '', confirmPassword: '' });
    setError('');
    setMessage('');
  }

  function openBulkResetPasswordForm() {
    setBulkPasswordReset({ open: true, password: '', confirmPassword: '' });
    setError('');
    setMessage('');
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isNewUser = !form.user_id;
    if (isNewUser && !form.password) {
      setSaving(false);
      setError('A password is required for a new user.');
      return;
    }

    const payload = {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      phone_number: form.phone_number || null,
      employee_id: form.employee_id || null,
      default_language: form.default_language,
      date_format: form.date_format,
      timezone: form.timezone,
      is_active: form.is_active,
      must_change_password: form.must_change_password,
      two_factor_enabled: form.two_factor_enabled,
      remarks: form.remarks || null,
    };

    if (form.password) payload.password = form.password;

    try {
      if (isNewUser) {
        payload.created_by = currentUser.user_id || null;
        await apiRequest('/security/user', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('User created successfully.');
      } else {
        payload.modified_by = currentUser.user_id || null;
        payload.row_version = form.row_version;
        await apiRequest(`/user/${form.user_id}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('User updated successfully.');
      }
      setIsEditorOpen(false);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    if (passwordReset.password !== passwordReset.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    async function submitBulkPasswordReset(event) {
      event.preventDefault();
      if (bulkPasswordReset.password !== bulkPasswordReset.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setSaving(true);
      setError('');
      setMessage('');
      try {
        const pageSize = 100;
        let pageNumber = 1;
        let resetCount = 0;

        while (true) {
          const params = new URLSearchParams({
            page_number: String(pageNumber),
            page_size: String(pageSize),
            is_deleted: '0',
          });
          const payload = await apiRequest(`/user?${params}`, currentUser.accessToken);
          const batch = Array.isArray(payload.data) ? payload.data : [];
          if (batch.length === 0) break;

          for (const user of batch) {
            await apiRequest('/user/change-password', currentUser.accessToken, {
              method: 'POST',
              body: JSON.stringify({
                user_id: user.user_id,
                new_password: bulkPasswordReset.password,
                modified_by: currentUser.user_id || null,
                force_password_change: true,
              }),
            });
            resetCount += 1;
          }

          const totalUsers = Number(payload.totalCount ?? 0);
          if (!totalUsers || resetCount >= totalUsers) break;
          pageNumber += 1;
        }

        setMessage(`Password reset completed for ${resetCount} user${resetCount === 1 ? '' : 's'}.`);
        setBulkPasswordReset({ open: false, password: '', confirmPassword: '' });
        await loadUsers();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/user/change-password', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          user_id: passwordReset.user.user_id,
          new_password: passwordReset.password,
          modified_by: currentUser.user_id || null,
          force_password_change: true,
        }),
      });
      setMessage(`Password reset successfully for ${passwordReset.user.username}.`);
      setPasswordReset({ user: null, password: '', confirmPassword: '' });
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function performUserAction(user, action) {
    const actionLabel = action === 'delete' ? 'delete' : 'restore';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (action === 'delete') {
        await apiRequest(`/user/${user.user_id}`, currentUser.accessToken, {
          method: 'DELETE',
          body: JSON.stringify({
            deleted_by: currentUser.user_id || null,
            row_version: user.row_version,
          }),
        });
      } else {
        await apiRequest(`/user/${user.user_id}/undelete`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({ modified_by: currentUser.user_id || null }),
        });
      }
      setMessage(`User ${action === 'delete' ? 'deleted' : 'restored'} successfully.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));
  const employeeOptionItems = useMemo(
    () => employeeOptions.filter((row) => !row.is_deleted),
    [employeeOptions],
  );
  const filteredEmployeeOptions = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    if (!search) return employeeOptionItems;
    return employeeOptionItems.filter((row) => {
      const empid = String(row.employee_code || row.employee_id || '').toLowerCase();
      const fullName = String(row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim()).toLowerCase();
      return empid.includes(search) || fullName.includes(search);
    });
  }, [employeeOptionItems, employeeSearch]);
  const selectedEmployee = employeeOptions.find((row) => (row.employee_code || row.employee_id) === form.employee_id);
  useEffect(() => {
    if (!isEmployeeDropdownOpen) return undefined;
    function handleOutsideClick(event) {
      if (!employeeDropdownRef.current?.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isEmployeeDropdownOpen]);

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">{view === 'users-deleted' ? 'Deleted Users' : view === 'users-create' ? 'Add User' : 'User List'}</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">{view === 'users-deleted' ? 'Restore user accounts that were previously deleted.' : 'Create and maintain user accounts and access status.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving} onClick={openBulkResetPasswordForm} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50">
            Reset all passwords
          </button>
          <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c7133]">
            + Add user
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      {passwordReset.user && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#15231f]/45 p-4">
          <form onSubmit={submitPasswordReset} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#1f2d2a]">Reset password</h3>
                <p className="mt-1 text-sm text-[#5d6d68]">Set a temporary password for <span className="font-semibold">{passwordReset.user.username}</span>.</p>
              </div>
              <button type="button" onClick={() => setPasswordReset({ user: null, password: '', confirmPassword: '' })} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close password reset">×</button>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              The user will be required to change this password after signing in.
            </div>

            <label className="mt-4 block text-sm font-semibold text-[#374744]">
              New temporary password
              <input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={passwordReset.password} onChange={(event) => setPasswordReset((current) => ({ ...current, password: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#374744]">
              Confirm temporary password
              <input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={passwordReset.confirmPassword} onChange={(event) => setPasswordReset((current) => ({ ...current, confirmPassword: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPasswordReset({ user: null, password: '', confirmPassword: '' })} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Resetting...' : 'Reset password'}</button>
            </div>
          </form>
        </div>
      )}

      {bulkPasswordReset.open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#15231f]/45 p-4">
          <form onSubmit={submitBulkPasswordReset} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#1f2d2a]">Reset all passwords</h3>
                <p className="mt-1 text-sm text-[#5d6d68]">Set one temporary password for all non-deleted users.</p>
              </div>
              <button type="button" onClick={() => setBulkPasswordReset({ open: false, password: '', confirmPassword: '' })} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close bulk password reset">×</button>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This will force every non-deleted user to change password after signing in.
            </div>

            <label className="mt-4 block text-sm font-semibold text-[#374744]">
              New temporary password
              <input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={bulkPasswordReset.password} onChange={(event) => setBulkPasswordReset((current) => ({ ...current, password: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#374744]">
              Confirm temporary password
              <input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={bulkPasswordReset.confirmPassword} onChange={(event) => setBulkPasswordReset((current) => ({ ...current, confirmPassword: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setBulkPasswordReset({ open: false, password: '', confirmPassword: '' })} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">{saving ? 'Resetting...' : 'Reset all passwords'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by username or email"
            className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]"
          />
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="all">All account statuses</option>
            <option value="active">Active accounts</option>
            <option value="inactive">Inactive accounts</option>
          </select>
          <select value={deletedFilter} onChange={(event) => { setDeletedFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="active">Current users</option>
            <option value="deleted">Deleted users</option>
            <option value="all">All users</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-3 py-3 font-semibold">User</th>
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Last login</th>
                <th className="px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">No users match the selected filters.</td></tr>
              ) : users.map((user) => (
                <tr key={user.user_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3">
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-xs text-[#6f7d78]">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name provided'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{user.email}</div>
                    <div className="text-xs text-[#6f7d78]">{user.phone_number || 'No phone number'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.is_deleted ? 'bg-red-50 text-red-700' : user.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>
                      {user.is_deleted ? 'Deleted' : user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.must_change_password && <div className="mt-1 text-xs text-amber-700">Password change required</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-[#5d6d68]">{formatDate(user.last_login_date)}</td>
                  <td className="px-3 py-3 text-right">
                    {user.is_deleted ? (
                      <button type="button" disabled={saving} onClick={() => performUserAction(user, 'restore')} className="rounded-lg border border-[#bce1c8] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#edf9f0] disabled:opacity-50">Restore</button>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={saving} onClick={() => openEditForm(user)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                        <button type="button" disabled={saving} onClick={() => openResetPasswordForm(user)} className="rounded-lg border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Reset password</button>
                        <button type="button" disabled={saving} onClick={() => performUserAction(user, 'delete')} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]">
          <span>{totalCount} user{totalCount === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center">
          <form onSubmit={submitForm} className="my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#1f2d2a]">{form.user_id ? `Edit ${form.username}` : 'Add user'}</h3>
                <p className="mt-1 text-sm text-[#5d6d68]">{form.user_id ? 'Leave password empty to keep it unchanged.' : 'A secure password is required for new accounts.'}</p>
              </div>
              <button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close user editor">×</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['username', 'Username', 'text', true],
                ['email', 'Email', 'email', true],
                ['first_name', 'First name', 'text', true],
                ['last_name', 'Last name', 'text', true],
                ['phone_number', 'Phone number', 'tel', false],
              ].map(([field, label, type, required]) => (
                <label key={field} className="text-sm font-semibold text-[#374744]">
                  {label}
                  <input type={type} required={required} value={form[field]} onChange={(event) => updateForm(field, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
                </label>
              ))}
              <div className="relative text-sm font-semibold text-[#374744]" ref={employeeDropdownRef}>
                <span>Employee (EMPID)</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEmployeeDropdownOpen((current) => !current);
                    setEmployeeSearch('');
                  }}
                  className="mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border border-[#dfe8e1] bg-white px-3 text-left font-normal outline-none transition hover:border-[#bed8c7] focus:border-[#0f8b3d]"
                >
                  <span className={selectedEmployee ? 'text-[#1f2d2a]' : 'text-[#8aa19a]'}>
                    {selectedEmployee
                      ? `${selectedEmployee.employee_code || selectedEmployee.employee_id} - ${selectedEmployee.full_name || `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim() || 'Unnamed employee'}`
                      : form.employee_id
                        ? `Current linked EMPID (${form.employee_id})`
                        : 'No employee link'}
                  </span>
                  <span className="text-[#5d6d68]">{isEmployeeDropdownOpen ? '⌃' : '⌄'}</span>
                </button>

                {isEmployeeDropdownOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-xl border border-[#dfe8e1] bg-white p-2 shadow-xl">
                    <input
                      autoFocus
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search EMPID or employee name"
                      className="mb-2 h-10 w-full rounded-lg border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm font-normal outline-none focus:border-[#0f8b3d]"
                    />
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-[#edf3ef]">
                      <button
                        type="button"
                        onClick={() => {
                          updateForm('employee_id', '');
                          setIsEmployeeDropdownOpen(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm font-normal transition hover:bg-[#f2f8f4] ${form.employee_id ? 'text-[#1f2d2a]' : 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]'}`}
                      >
                        No employee link
                      </button>
                      {filteredEmployeeOptions.map((row) => {
                        const empid = row.employee_code || row.employee_id;
                        const fullName = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
                        const isSelected = form.employee_id === empid;
                        return (
                          <button
                            key={row.employee_id}
                            type="button"
                            onClick={() => {
                              updateForm('employee_id', empid);
                              setIsEmployeeDropdownOpen(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm font-normal transition hover:bg-[#f2f8f4] ${isSelected ? 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]' : 'text-[#1f2d2a]'}`}
                          >
                            {empid} - {fullName || 'Unnamed employee'}
                          </button>
                        );
                      })}
                      {filteredEmployeeOptions.length === 0 && (
                        <div className="px-3 py-3 text-sm font-normal text-[#6f7d78]">No employee found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <label className="text-sm font-semibold text-[#374744]">
                {form.user_id ? 'New password' : 'Password'}
                <input type="password" required={!form.user_id} minLength="8" maxLength="72" value={form.password} onChange={(event) => updateForm('password', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">
                Language
                <input type="text" value={form.default_language} onChange={(event) => updateForm('default_language', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">
                Date format
                <input type="text" value={form.date_format} onChange={(event) => updateForm('date_format', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">
                Timezone
                <input type="text" value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
              </label>
            </div>

            <label className="mt-4 block text-sm font-semibold text-[#374744]">
              Notes
              <textarea value={form.remarks} onChange={(event) => updateForm('remarks', event.target.value)} rows="3" className="mt-1.5 w-full rounded-xl border border-[#dfe8e1] p-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
            </label>

            <div className="mt-4 flex flex-wrap gap-4">
              {[
                ['is_active', 'Account is active'],
                ['must_change_password', 'Require password change'],
                ['two_factor_enabled', 'Two-factor authentication enabled'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 text-sm font-medium text-[#374744]">
                  <input type="checkbox" checked={form[field]} onChange={(event) => updateForm(field, event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
                  {label}
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save user'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
