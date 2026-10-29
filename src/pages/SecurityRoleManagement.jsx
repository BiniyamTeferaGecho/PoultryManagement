import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyRole = {
  role_id: '',
  role_name: '',
  display_name: '',
  description: '',
  is_system: false,
  is_active: true,
  priority: '',
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

export default function SecurityRoleManagement({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [formData, setFormData] = useState(emptyRole);
  const [filters, setFilters] = useState({
    role_name: '',
    display_name: '',
    is_active: 'all',
    include_deleted: false,
  });

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const listParams = new URLSearchParams({
        page_number: String(page),
        page_size: '10',
        sort_column: 'role_name',
        sort_direction: 'ASC',
        include_deleted: filters.include_deleted ? '1' : '0',
      });
      const countParams = new URLSearchParams({
        include_deleted: filters.include_deleted ? '1' : '0',
      });
      if (filters.role_name.trim()) {
        listParams.set('role_name', filters.role_name.trim());
        countParams.set('role_name', filters.role_name.trim());
      }
      if (filters.display_name.trim()) {
        listParams.set('display_name', filters.display_name.trim());
        countParams.set('display_name', filters.display_name.trim());
      }
      if (filters.is_active !== 'all') {
        listParams.set('is_active', filters.is_active);
        countParams.set('is_active', filters.is_active);
      }

      const [listPayload, countPayload] = await Promise.all([
        apiRequest(`/security/role?${listParams.toString()}`, currentUser.accessToken),
        apiRequest(`/security/role/count?${countParams.toString()}`, currentUser.accessToken),
      ]);

      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(countPayload.data?.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  function openCreate() {
    setFormData(emptyRole);
    setEditorOpen(true);
    setMessage('');
    setError('');
  }

  function openEdit(row) {
    setFormData({
      role_id: row.role_id,
      role_name: row.role_name || '',
      display_name: row.display_name || '',
      description: row.description || '',
      is_system: Boolean(row.is_system),
      is_active: Boolean(row.is_active),
      priority: row.priority ?? '',
    });
    setEditorOpen(true);
    setMessage('');
    setError('');
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        role_name: formData.role_name,
        display_name: formData.display_name,
        description: formData.description.trim() || null,
        is_system: formData.is_system,
        is_active: formData.is_active,
        priority: formData.priority === '' ? null : Number(formData.priority),
      };
      if (!formData.role_id) {
        payload.created_by = currentUser.user_id || null;
        await apiRequest('/security/role', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Role created successfully.');
      } else {
        payload.modified_by = currentUser.user_id || null;
        await apiRequest(`/security/role/${formData.role_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Role updated successfully.');
      }
      setEditorOpen(false);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDelete(row) {
    const isDeleted = Boolean(row.is_deleted);
    if (!window.confirm(`Are you sure you want to ${isDeleted ? 'restore' : 'delete'} ${row.display_name || row.role_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (isDeleted) {
        await apiRequest(`/security/role/${row.role_id}/undelete`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({ modified_by: currentUser.user_id || null }),
        });
        setMessage('Role restored successfully.');
      } else {
        await apiRequest(`/security/role/${row.role_id}`, currentUser.accessToken, {
          method: 'DELETE',
          body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
        });
        setMessage('Role deleted successfully.');
      }
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Security Roles</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Create and maintain system/application roles.</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">
          + Add role
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input value={filters.role_name} onChange={(event) => { setFilters((current) => ({ ...current, role_name: event.target.value })); setPage(1); }} placeholder="Role name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.display_name} onChange={(event) => { setFilters((current) => ({ ...current, display_name: event.target.value })); setPage(1); }} placeholder="Display name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.is_active} onChange={(event) => { setFilters((current) => ({ ...current, is_active: event.target.value })); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="all">All statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={filters.include_deleted} onChange={(event) => { setFilters((current) => ({ ...current, include_deleted: event.target.checked })); setPage(1); }} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Display</th><th className="px-3 py-3 font-semibold">Priority</th><th className="px-3 py-3 font-semibold">System</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">Loading roles...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">No roles found.</td></tr> : rows.map((row) => (
                <tr key={row.role_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3 font-medium">{row.role_name}</td>
                  <td className="px-3 py-3">{row.display_name}</td>
                  <td className="px-3 py-3">{row.priority ?? '—'}</td>
                  <td className="px-3 py-3">{row.is_system ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : row.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>
                      {row.is_deleted ? 'Deleted' : row.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={saving || row.is_deleted} onClick={() => openEdit(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                      <button type="button" disabled={saving} onClick={() => toggleDelete(row)} className={`rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50 ${row.is_deleted ? 'border-[#bce1c8] text-[#0f8b3d] hover:bg-[#edf9f0]' : 'border-red-200 text-red-700 hover:bg-red-50'}`}>{row.is_deleted ? 'Restore' : 'Delete'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]">
          <span>{totalCount} role{totalCount === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#15231f]/45 p-4">
          <form onSubmit={submitForm} className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-[#1f2d2a]">{formData.role_id ? 'Edit role' : 'Add role'}</h3>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close role editor">×</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#374744]">Role name *
                <input required value={formData.role_name} onChange={(event) => setFormData((current) => ({ ...current, role_name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">Display name *
                <input required value={formData.display_name} onChange={(event) => setFormData((current) => ({ ...current, display_name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">Priority
                <input type="number" value={formData.priority} onChange={(event) => setFormData((current) => ({ ...current, priority: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#374744]">Description
              <textarea value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} rows="3" className="mt-1.5 w-full rounded-xl border border-[#dfe8e1] p-3 outline-none focus:border-[#0f8b3d]" />
            </label>
            <div className="mt-4 flex gap-5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
                <input type="checkbox" checked={formData.is_system} onChange={(event) => setFormData((current) => ({ ...current, is_system: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
                System role
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
                <input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save role'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
