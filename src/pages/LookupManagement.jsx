import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const emptyLookup = {
  lookup_id: '',
  row_version: '',
  lookup_group: '',
  lookup_code: '',
  lookup_value: '',
  lookup_description: '',
  parent_lookup_id: '',
  sort_order: 0,
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

function lookupToForm(lookup) {
  return {
    ...emptyLookup,
    ...lookup,
    lookup_description: lookup.lookup_description || '',
    parent_lookup_id: lookup.parent_lookup_id || '',
    sort_order: lookup.sort_order ?? 0,
    is_active: Boolean(lookup.is_active),
  };
}

function lookupLabel(lookup) {
  return `${lookup.lookup_group} / ${lookup.lookup_code} - ${lookup.lookup_value}`;
}

export default function LookupManagement({ currentUser }) {
  const [lookups, setLookups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ group: '', search: '', active: 'all', includeDeleted: false });
  const [form, setForm] = useState(emptyLookup);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadLookups = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.group) params.set('lookup_group', filters.group);
      if (filters.search) params.set('lookup_code', filters.search);
      if (filters.active !== 'all') params.set('is_active', filters.active === 'active' ? '1' : '0');
      if (filters.includeDeleted) params.set('include_deleted', 'true');
      const [lookupPayload, groupPayload] = await Promise.all([
        apiRequest(`/lookup?${params}`, currentUser.accessToken),
        apiRequest('/lookup/groups', currentUser.accessToken),
      ]);
      setLookups(Array.isArray(lookupPayload.data) ? lookupPayload.data : []);
      setTotalCount(lookupPayload.totalCount ?? 0);
      const values = Array.isArray(groupPayload.data) ? groupPayload.data.map((group) => group.lookup_group || group.LookupGroup || Object.values(group)[0]).filter(Boolean) : [];
      setGroups([...new Set(values)].sort());
    } catch (requestError) {
      setError(requestError.message);
      setLookups([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  useEffect(() => {
    const timer = setTimeout(loadLookups, 250);
    return () => clearTimeout(timer);
  }, [loadLookups]);

  const parentOptions = useMemo(() => lookups.filter((lookup) => lookup.lookup_id !== form.lookup_id), [form.lookup_id, lookups]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setForm({ ...emptyLookup, lookup_group: filters.group });
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  function openEditForm(lookup) {
    setForm(lookupToForm(lookup));
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  async function saveLookup(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isNew = !form.lookup_id;
    const payload = {
      lookup_group: form.lookup_group.trim(),
      lookup_value: form.lookup_value.trim(),
      lookup_description: form.lookup_description.trim() || null,
      parent_lookup_id: form.parent_lookup_id || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    try {
      if (isNew) {
        payload.created_by = currentUser.user_id || null;
        const created = await apiRequest('/lookup', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`Lookup value created successfully${created.data?.lookup_code ? ` (${created.data.lookup_code})` : ''}.`);
      } else {
        payload.modified_by = currentUser.user_id || null;
        await apiRequest(`/lookup/${form.lookup_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Lookup value updated successfully.');
      }
      setIsEditorOpen(false);
      await loadLookups();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function setLookupActive(lookup) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/lookup/${lookup.lookup_id}/active`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ is_active: !lookup.is_active, modified_by: currentUser.user_id || null }),
      });
      setMessage(`Lookup value ${lookup.is_active ? 'deactivated' : 'activated'} successfully.`);
      await loadLookups();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLookup(lookup) {
    if (!window.confirm(`Delete ${lookupLabel(lookup)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/lookup/${lookup.lookup_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null, row_version: lookup.row_version }),
      });
      setMessage('Lookup value deleted successfully.');
      await loadLookups();
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
          <h2 className="text-xl font-bold text-[#1f2d2a]">Lookup Registration</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage master-data lookup groups, values, and hierarchies.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">+ Add lookup value</button>
      </div>

      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}
      {error && !isEditorOpen && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={filters.group} onChange={(event) => updateFilter('group', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">All lookup groups</option>
            {groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <input type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search by code" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <select value={filters.active} onChange={(event) => updateFilter('active', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm text-[#374744]">
            <input type="checkbox" checked={filters.includeDeleted} onChange={(event) => updateFilter('includeDeleted', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Group</th><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Value</th><th className="px-3 py-3 font-semibold">Parent</th><th className="px-3 py-3 font-semibold">Order</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">Loading lookup values...</td></tr> : lookups.length === 0 ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">No lookup values match the selected filters.</td></tr> : lookups.map((lookup) => (
                <tr key={lookup.lookup_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3 font-semibold">{lookup.lookup_group}</td><td className="px-3 py-3 font-mono text-xs">{lookup.lookup_code}</td><td className="px-3 py-3"><div>{lookup.lookup_value}</div>{lookup.lookup_description && <div className="mt-1 max-w-xs truncate text-xs text-[#6f7d78]">{lookup.lookup_description}</div>}</td><td className="px-3 py-3 text-xs text-[#5d6d68]">{lookup.parent_lookup_id || '—'}</td><td className="px-3 py-3">{lookup.sort_order}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${lookup.is_deleted ? 'bg-red-50 text-red-700' : lookup.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{lookup.is_deleted ? 'Deleted' : lookup.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={saving || lookup.is_deleted} onClick={() => openEditForm(lookup)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving || lookup.is_deleted} onClick={() => setLookupActive(lookup)} className="rounded-lg border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">{lookup.is_active ? 'Deactivate' : 'Activate'}</button><button type="button" disabled={saving || lookup.is_deleted} onClick={() => deleteLookup(lookup)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]"><span>{totalCount} lookup value{totalCount === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
      </div>

      {isEditorOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center"><form onSubmit={saveLookup} className="my-4 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-[#1f2d2a]">{form.lookup_id ? `Edit ${form.lookup_code}` : 'Add lookup value'}</h3><p className="mt-1 text-sm text-[#5d6d68]">The lookup code is generated automatically and cannot be changed.</p></div><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close lookup editor">×</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#374744]">Lookup group<input required maxLength="50" list="lookup-groups" value={form.lookup_group} onChange={(event) => updateForm('lookup_group', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /><datalist id="lookup-groups">{groups.map((group) => <option key={group} value={group} />)}</datalist></label>
          {form.lookup_id && <label className="text-sm font-semibold text-[#374744]">Lookup code<input readOnly value={form.lookup_code} className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 font-normal text-[#5d6d68] outline-none" /></label>}
          <label className="text-sm font-semibold text-[#374744]">Lookup value<input required maxLength="200" value={form.lookup_value} onChange={(event) => updateForm('lookup_value', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Parent lookup<select value={form.parent_lookup_id} onChange={(event) => updateForm('parent_lookup_id', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d]"><option value="">No parent</option>{parentOptions.map((lookup) => <option key={lookup.lookup_id} value={lookup.lookup_id}>{lookupLabel(lookup)}</option>)}</select></label>
          <label className="text-sm font-semibold text-[#374744]">Sort order<input type="number" min="0" value={form.sort_order} onChange={(event) => updateForm('sort_order', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" /> Active</label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-[#374744]">Description<textarea maxLength="500" value={form.lookup_description} onChange={(event) => updateForm('lookup_description', event.target.value)} rows="3" className="mt-1.5 w-full rounded-xl border border-[#dfe8e1] p-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save lookup value'}</button></div>
      </form></div>}
    </div>
  );
}
