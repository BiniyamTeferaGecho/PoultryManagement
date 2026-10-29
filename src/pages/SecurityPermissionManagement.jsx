import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyPermission = {
  permission_id: '',
  permission_code: '',
  permission_name: '',
  description: '',
  resource_type: '',
  action: '',
  is_active: true,
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

export default function SecurityPermissionManagement({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [formData, setFormData] = useState(emptyPermission);
  const [filters, setFilters] = useState({
    permission_code: '',
    permission_name: '',
    resource_type: '',
    action: '',
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
        sort_column: 'permission_code',
        sort_direction: 'ASC',
        include_deleted: filters.include_deleted ? '1' : '0',
      });
      const countParams = new URLSearchParams({
        include_deleted: filters.include_deleted ? '1' : '0',
      });
      if (filters.permission_code.trim()) {
        listParams.set('permission_code', filters.permission_code.trim());
        countParams.set('permission_code', filters.permission_code.trim());
      }
      if (filters.permission_name.trim()) {
        listParams.set('permission_name', filters.permission_name.trim());
        countParams.set('permission_name', filters.permission_name.trim());
      }
      if (filters.resource_type.trim()) {
        listParams.set('resource_type', filters.resource_type.trim());
        countParams.set('resource_type', filters.resource_type.trim());
      }
      if (filters.action.trim()) {
        listParams.set('action', filters.action.trim());
        countParams.set('action', filters.action.trim());
      }
      if (filters.is_active !== 'all') {
        listParams.set('is_active', filters.is_active);
        countParams.set('is_active', filters.is_active);
      }

      const [listPayload, countPayload] = await Promise.all([
        apiRequest(`/security/permission?${listParams.toString()}`, currentUser.accessToken),
        apiRequest(`/security/permission/count?${countParams.toString()}`, currentUser.accessToken),
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
    setFormData(emptyPermission);
    setEditorOpen(true);
    setMessage('');
    setError('');
  }

  function openEdit(row) {
    setFormData({
      permission_id: row.permission_id,
      permission_code: row.permission_code || '',
      permission_name: row.permission_name || '',
      description: row.description || '',
      resource_type: row.resource_type || '',
      action: row.action || '',
      is_active: Boolean(row.is_active),
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
        permission_code: formData.permission_code.trim() || null,
        permission_name: formData.permission_name,
        description: formData.description.trim() || null,
        resource_type: formData.resource_type,
        action: formData.action,
        is_active: formData.is_active,
      };
      if (!formData.permission_id) {
        payload.created_by = currentUser.user_id || null;
        await apiRequest('/security/permission', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Permission created successfully.');
      } else {
        payload.modified_by = currentUser.user_id || null;
        await apiRequest(`/security/permission/${formData.permission_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Permission updated successfully.');
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
    if (!window.confirm(`Are you sure you want to ${isDeleted ? 'restore' : 'delete'} ${row.permission_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (isDeleted) {
        await apiRequest(`/security/permission/${row.permission_id}/undelete`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({ modified_by: currentUser.user_id || null }),
        });
        setMessage('Permission restored successfully.');
      } else {
        await apiRequest(`/security/permission/${row.permission_id}`, currentUser.accessToken, {
          method: 'DELETE',
          body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
        });
        setMessage('Permission deleted successfully.');
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
          <h2 className="text-xl font-bold text-[#1f2d2a]">Security Permissions</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Create and maintain permissions by resource and action.</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">
          + Add permission
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={filters.permission_code} onChange={(event) => { setFilters((current) => ({ ...current, permission_code: event.target.value })); setPage(1); }} placeholder="Code" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.permission_name} onChange={(event) => { setFilters((current) => ({ ...current, permission_name: event.target.value })); setPage(1); }} placeholder="Permission name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.resource_type} onChange={(event) => { setFilters((current) => ({ ...current, resource_type: event.target.value })); setPage(1); }} placeholder="Resource type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.action} onChange={(event) => { setFilters((current) => ({ ...current, action: event.target.value })); setPage(1); }} placeholder="Action" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
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
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Name</th><th className="px-3 py-3 font-semibold">Resource</th><th className="px-3 py-3 font-semibold">Action</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">Loading permissions...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">No permissions found.</td></tr> : rows.map((row) => (
                <tr key={row.permission_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3 font-medium">{row.permission_code}</td>
                  <td className="px-3 py-3">{row.permission_name}</td>
                  <td className="px-3 py-3">{row.resource_type}</td>
                  <td className="px-3 py-3">{row.action}</td>
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
          <span>{totalCount} permission{totalCount === 1 ? '' : 's'}</span>
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
              <h3 className="text-xl font-bold text-[#1f2d2a]">{formData.permission_id ? 'Edit permission' : 'Add permission'}</h3>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close permission editor">×</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#374744]">Permission code
                <input value={formData.permission_code} onChange={(event) => setFormData((current) => ({ ...current, permission_code: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">Permission name *
                <input required value={formData.permission_name} onChange={(event) => setFormData((current) => ({ ...current, permission_name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">Resource type *
                <input required value={formData.resource_type} onChange={(event) => setFormData((current) => ({ ...current, resource_type: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
              <label className="text-sm font-semibold text-[#374744]">Action *
                <input required value={formData.action} onChange={(event) => setFormData((current) => ({ ...current, action: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 outline-none focus:border-[#0f8b3d]" />
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#374744]">Description
              <textarea value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} rows="3" className="mt-1.5 w-full rounded-xl border border-[#dfe8e1] p-3 outline-none focus:border-[#0f8b3d]" />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-[#374744]">
              <input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
              Active
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save permission'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
