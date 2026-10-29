import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  feed_type_id: '',
  company_id: '',
  feed_code: '',
  feed_name: '',
  category: '',
  form: '',
  crumble_size: '',
  pellet_size: '',
  manufacturer: '',
  protein_percent: '',
  fat_percent: '',
  fiber_percent: '',
  energy_me: '',
  calcium_percent: '',
  phosphorus_percent: '',
  sodium_percent: '',
  methionine_percent: '',
  lysine_percent: '',
  is_active: true,
};

function toForm(row) {
  return {
    ...emptyForm,
    feed_type_id: row.feed_type_id || '',
    company_id: row.company_id || '',
    feed_code: row.feed_code || '',
    feed_name: row.feed_name || '',
    category: row.category || '',
    form: row.form || '',
    crumble_size: row.crumble_size || '',
    pellet_size: row.pellet_size || '',
    manufacturer: row.manufacturer || '',
    protein_percent: row.protein_percent ?? '',
    fat_percent: row.fat_percent ?? '',
    fiber_percent: row.fiber_percent ?? '',
    energy_me: row.energy_me ?? '',
    calcium_percent: row.calcium_percent ?? '',
    phosphorus_percent: row.phosphorus_percent ?? '',
    sodium_percent: row.sodium_percent ?? '',
    methionine_percent: row.methionine_percent ?? '',
    lysine_percent: row.lysine_percent ?? '',
    is_active: Boolean(row.is_active),
  };
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

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

export default function FeedTypeManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [feedTypePayload, companyPayload] = await Promise.all([
        apiRequest(`/feed/types?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
      ]);
      setRows(Array.isArray(feedTypePayload.data) ? feedTypePayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const isEditing = Boolean(form.feed_type_id);
      await apiRequest(isEditing ? `/feed/types/${form.feed_type_id}` : '/feed/types', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          feed_code: form.feed_code.trim() || null,
          feed_name: form.feed_name.trim(),
          category: form.category.trim(),
          form: form.form.trim() || null,
          crumble_size: form.crumble_size.trim() || null,
          pellet_size: form.pellet_size.trim() || null,
          manufacturer: form.manufacturer.trim() || null,
          protein_percent: numberOrNull(form.protein_percent),
          fat_percent: numberOrNull(form.fat_percent),
          fiber_percent: numberOrNull(form.fiber_percent),
          energy_me: numberOrNull(form.energy_me),
          calcium_percent: numberOrNull(form.calcium_percent),
          phosphorus_percent: numberOrNull(form.phosphorus_percent),
          sodium_percent: numberOrNull(form.sodium_percent),
          methionine_percent: numberOrNull(form.methionine_percent),
          lysine_percent: numberOrNull(form.lysine_percent),
          ...(isEditing ? { modified_by: currentUser.user_id || null } : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Feed type updated successfully.' : 'Feed type created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function editRow(row) {
    setForm(toForm(row));
    setError('');
    setMessage('');
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete feed type ${row.feed_code || row.feed_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/feed/types/${row.feed_type_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.feed_type_id === row.feed_type_id) setForm(emptyForm);
      setMessage('Feed type deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreRow(row) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/feed/types/${row.feed_type_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Feed type restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Feed Type Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and manage feed definitions.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed code (optional)</span><input value={form.feed_code} onChange={(event) => setForm((current) => ({ ...current, feed_code: event.target.value }))} placeholder="Auto-generated if blank" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-mono text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed name</span><input required value={form.feed_name} onChange={(event) => setForm((current) => ({ ...current, feed_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Category</span><input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Form</span><input value={form.form} onChange={(event) => setForm((current) => ({ ...current, form: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Crumble size</span><input value={form.crumble_size} onChange={(event) => setForm((current) => ({ ...current, crumble_size: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Pellet size</span><input value={form.pellet_size} onChange={(event) => setForm((current) => ({ ...current, pellet_size: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Manufacturer</span><input value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Protein %</span><input min="0" max="100" step="0.01" type="number" value={form.protein_percent} onChange={(event) => setForm((current) => ({ ...current, protein_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Fat %</span><input min="0" max="100" step="0.01" type="number" value={form.fat_percent} onChange={(event) => setForm((current) => ({ ...current, fat_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Fiber %</span><input min="0" max="100" step="0.01" type="number" value={form.fiber_percent} onChange={(event) => setForm((current) => ({ ...current, fiber_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Energy ME</span><input min="0" step="0.01" type="number" value={form.energy_me} onChange={(event) => setForm((current) => ({ ...current, energy_me: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Calcium %</span><input min="0" max="100" step="0.01" type="number" value={form.calcium_percent} onChange={(event) => setForm((current) => ({ ...current, calcium_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Phosphorus %</span><input min="0" max="100" step="0.01" type="number" value={form.phosphorus_percent} onChange={(event) => setForm((current) => ({ ...current, phosphorus_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sodium %</span><input min="0" max="100" step="0.01" type="number" value={form.sodium_percent} onChange={(event) => setForm((current) => ({ ...current, sodium_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Methionine %</span><input min="0" max="100" step="0.01" type="number" value={form.methionine_percent} onChange={(event) => setForm((current) => ({ ...current, methionine_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lysine %</span><input min="0" max="100" step="0.01" type="number" value={form.lysine_percent} onChange={(event) => setForm((current) => ({ ...current, lysine_percent: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Active</span><select value={form.is_active ? '1' : '0'} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === '1' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="1">Yes</option><option value="0">No</option></select></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.feed_type_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.feed_type_id ? 'Save feed type' : 'Create feed type'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Feed Types</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Code</th><th className="px-2 py-2">Name</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Form</th><th className="px-2 py-2">Company</th><th className="px-2 py-2">Protein%</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading feed types...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No feed types found.</td></tr> : rows.map((row) => (
                <tr key={row.feed_type_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2 font-mono text-xs">{row.feed_code}</td>
                  <td className="px-2 py-2">{row.feed_name}</td>
                  <td className="px-2 py-2">{row.category}</td>
                  <td className="px-2 py-2">{row.form || '—'}</td>
                  <td className="px-2 py-2">{row.company_name || row.company_id}</td>
                  <td className="px-2 py-2">{row.protein_percent ?? '—'}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : row.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{row.is_deleted ? 'Deleted' : row.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => editRow(row)} className="rounded-lg border border-[#dfe8e1] px-2 py-1 text-xs font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>}
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
                      {row.is_deleted && <button type="button" disabled={saving} onClick={() => restoreRow(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Restore</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
