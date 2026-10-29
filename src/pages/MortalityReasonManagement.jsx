import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyReason = {
  mortality_reason_id: '',
  reason_code: '',
  reason_name: '',
  category: '',
  description: '',
  disease_id: '',
  severity: 'Medium',
  is_notifiable: false,
  sort_order: 0,
  is_active: true,
  is_deleted: false,
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

function toBool(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function reasonToForm(reason) {
  return {
    ...emptyReason,
    ...reason,
    description: reason.description || '',
    disease_id: reason.disease_id || '',
    severity: reason.severity || 'Medium',
    is_notifiable: toBool(reason.is_notifiable),
    is_active: toBool(reason.is_active, true),
    is_deleted: toBool(reason.is_deleted),
    sort_order: reason.sort_order ?? 0,
  };
}

export default function MortalityReasonManagement({ currentUser }) {
  const [reasons, setReasons] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: '',
    severity: 'all',
    searchText: '',
    isActive: 'all',
    isNotifiable: 'all',
    includeDeleted: false,
  });
  const [form, setForm] = useState(emptyReason);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [, setError] = useState('');

  const loadReasons = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.category) params.set('category', filters.category);
      if (filters.severity !== 'all') params.set('severity', filters.severity);
      if (filters.searchText) params.set('search_text', filters.searchText);
      if (filters.isActive !== 'all') params.set('is_active', filters.isActive === 'active' ? '1' : '0');
      if (filters.isNotifiable !== 'all') params.set('is_notifiable', filters.isNotifiable === 'yes' ? '1' : '0');
      if (filters.includeDeleted) params.set('include_deleted', 'true');

      const payload = await apiRequest(`/mortalityreason?${params}`, currentUser.accessToken);
      setReasons(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setReasons([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  useEffect(() => {
    const timer = setTimeout(loadReasons, 250);
    return () => clearTimeout(timer);
  }, [loadReasons]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setForm(emptyReason);
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  function openEditForm(reason) {
    setForm(reasonToForm(reason));
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  async function saveReason(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isNew = !form.mortality_reason_id;
    const payload = {
      reason_code: form.reason_code.trim(),
      reason_name: form.reason_name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      disease_id: form.disease_id.trim() || null,
      severity: form.severity,
      is_notifiable: form.is_notifiable,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      user_id: currentUser.user_id || null,
    };

    try {
      if (isNew) {
        await apiRequest('/mortalityreason', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Mortality reason created successfully.');
      } else {
        await apiRequest(`/mortalityreason/${form.mortality_reason_id}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Mortality reason updated successfully.');
      }
      setIsEditorOpen(false);
      await loadReasons();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteReason(reason) {
    if (!window.confirm(`Delete ${reason.reason_code} - ${reason.reason_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/mortalityreason/${reason.mortality_reason_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: currentUser.user_id || null,
          reason: 'Deleted from Mortality Reason management form',
        }),
      });
      setMessage('Mortality reason deleted successfully.');
      await loadReasons();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreReason(reason) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/mortalityreason/${reason.mortality_reason_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Mortality reason restored successfully.');
      await loadReasons();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteReason(reason) {
    if (!window.confirm(`Permanently delete ${reason.reason_code} - ${reason.reason_name}? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/mortalityreason/${reason.mortality_reason_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: currentUser.user_id || null,
          confirm: true,
        }),
      });
      setMessage('Mortality reason permanently deleted.');
      await loadReasons();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Mortality Reason</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage mortality reason master data used by production and rearing records.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">+ Add mortality reason</button>
      </div>

      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input type="search" value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search by code or name" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <input type="search" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} placeholder="Filter by category" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All severities</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select>
          <select value={filters.isActive} onChange={(event) => updateFilter('isActive', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All active states</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <select value={filters.isNotifiable} onChange={(event) => updateFilter('isNotifiable', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All notifiable states</option><option value="yes">Notifiable</option><option value="no">Non-notifiable</option></select>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.includeDeleted} onChange={(event) => updateFilter('includeDeleted', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Name</th><th className="px-3 py-3 font-semibold">Category</th><th className="px-3 py-3 font-semibold">Severity</th><th className="px-3 py-3 font-semibold">Notifiable</th><th className="px-3 py-3 font-semibold">Active</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-3 py-8 text-center text-[#5d6d68]">Loading mortality reasons...</td></tr> : reasons.length === 0 ? <tr><td colSpan="8" className="px-3 py-8 text-center text-[#5d6d68]">No mortality reasons match the selected filters.</td></tr> : reasons.map((reason) => {
                const deleted = toBool(reason.is_deleted);
                const active = toBool(reason.is_active, true);
                return (
                  <tr key={reason.mortality_reason_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                    <td className="px-3 py-3 font-mono text-xs font-semibold">{reason.reason_code}</td>
                    <td className="px-3 py-3"><div className="font-semibold">{reason.reason_name}</div>{reason.description && <div className="mt-1 text-xs text-[#6f7d78]">{reason.description}</div>}</td>
                    <td className="px-3 py-3">{reason.category || '—'}</td>
                    <td className="px-3 py-3">{reason.severity || 'Medium'}</td>
                    <td className="px-3 py-3">{toBool(reason.is_notifiable) ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3">{active ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${deleted ? 'bg-red-50 text-red-700' : 'bg-[#eafaf0] text-[#198754]'}`}>{deleted ? 'Deleted' : 'Active'}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {deleted ? (
                          <>
                            <button type="button" disabled={saving} onClick={() => restoreReason(reason)} className="rounded-lg border border-[#0f8b3d] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#eafaf0] disabled:opacity-50">Restore</button>
                            <button type="button" disabled={saving} onClick={() => hardDeleteReason(reason)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Hard Delete</button>
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={saving} onClick={() => openEditForm(reason)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                            <button type="button" disabled={saving} onClick={() => deleteReason(reason)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]"><span>{totalCount} mortality reason{totalCount === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
      </div>

      {isEditorOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center"><form onSubmit={saveReason} className="my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-[#1f2d2a]">{form.mortality_reason_id ? `Edit ${form.reason_code || 'mortality reason'}` : 'Add mortality reason'}</h3><p className="mt-1 text-sm text-[#5d6d68]">Reason code must be unique.</p></div><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close mortality reason editor">×</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#374744]">Reason code<input required maxLength="20" value={form.reason_code} onChange={(event) => updateForm('reason_code', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Reason name<input required maxLength="100" value={form.reason_name} onChange={(event) => updateForm('reason_name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Category<input required maxLength="50" value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Severity<select value={form.severity} onChange={(event) => updateForm('severity', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d]"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></label>
          <label className="text-sm font-semibold text-[#374744]">Disease ID (optional)<input value={form.disease_id} onChange={(event) => updateForm('disease_id', event.target.value)} placeholder="GUID" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-mono text-sm font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Sort order<input type="number" value={form.sort_order} onChange={(event) => updateForm('sort_order', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="flex items-center gap-2 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 py-3 text-sm font-semibold text-[#374744]"><input type="checkbox" checked={form.is_notifiable} onChange={(event) => updateForm('is_notifiable', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Is notifiable</label>
          <label className="flex items-center gap-2 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 py-3 text-sm font-semibold text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Is active</label>
          <label className="md:col-span-2 text-sm font-semibold text-[#374744]">Description<textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows="4" maxLength="500" className="mt-1.5 w-full rounded-xl border border-[#dfe8e1] p-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.mortality_reason_id ? 'Save changes' : 'Save mortality reason'}</button></div>
      </form></div>}
    </div>
  );
}
