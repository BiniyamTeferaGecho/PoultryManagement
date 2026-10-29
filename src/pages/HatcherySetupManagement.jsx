import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  hatchery_id: '',
  company_id: '',
  hatchery_name: '',
  location: '',
  capacity_eggs: '',
  capacity_chicks: '',
  incubator_count: '',
  hatcher_count: '',
  incubation_temp_default: '37.5',
  incubation_humidity_default: '55.0',
  hatchery_manager: '',
  status: 'Active',
};

function hatcheryToForm(hatchery) {
  return {
    ...emptyForm,
    ...hatchery,
    hatchery_id: hatchery.hatchery_id || '',
    company_id: hatchery.company_id || '',
    hatchery_name: hatchery.hatchery_name || '',
    location: hatchery.location || '',
    capacity_eggs: hatchery.capacity_eggs ?? '',
    capacity_chicks: hatchery.capacity_chicks ?? '',
    incubator_count: hatchery.incubator_count ?? '',
    hatcher_count: hatchery.hatcher_count ?? '',
    incubation_temp_default: hatchery.incubation_temp_default ?? '37.5',
    incubation_humidity_default: hatchery.incubation_humidity_default ?? '55.0',
    hatchery_manager: hatchery.hatchery_manager || '',
    status: hatchery.status || 'Active',
  };
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

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

export default function HatcherySetupManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [hatcheryPayload, companyPayload] = await Promise.all([
        apiRequest(`/hatchery?page_number=1&page_size=50&include_deleted=${includeDeleted ? '1' : '0'}`, currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
      ]);
      setRows(Array.isArray(hatcheryPayload.data) ? hatcheryPayload.data : []);
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
      const isEditing = Boolean(form.hatchery_id);
      const result = await apiRequest(isEditing ? `/hatchery/${form.hatchery_id}` : '/hatchery', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          capacity_eggs: numberOrNull(form.capacity_eggs),
          capacity_chicks: numberOrNull(form.capacity_chicks),
          incubator_count: numberOrNull(form.incubator_count),
          hatcher_count: numberOrNull(form.hatcher_count),
          incubation_temp_default: numberOrNull(form.incubation_temp_default) ?? 37.5,
          incubation_humidity_default: numberOrNull(form.incubation_humidity_default) ?? 55.0,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing
        ? 'Hatchery updated successfully.'
        : `Hatchery created successfully (${result.data?.hatchery_code || 'generated code'}).`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }

    function editHatchery(row) {
      setForm(hatcheryToForm(row));
      setError('');
      setMessage('');
    }

    async function deleteHatchery(row) {
      if (!window.confirm(`Delete ${row.hatchery_name} (${row.hatchery_code})?`)) return;
      setSaving(true);
      setError('');
      setMessage('');
      try {
        await apiRequest(`/hatchery/${row.hatchery_id}`, currentUser.accessToken, {
          method: 'DELETE',
          body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
        });
        if (form.hatchery_id === row.hatchery_id) setForm(emptyForm);
        setMessage('Hatchery deleted successfully.');
        await loadData();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }

    async function restoreHatchery(row) {
      setSaving(true);
      setError('');
      setMessage('');
      try {
        await apiRequest(`/hatchery/${row.hatchery_id}/restore`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({ modified_by: currentUser.user_id || null }),
        });
        setMessage('Hatchery restored successfully.');
        await loadData();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Hatchery Setup</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and view hatcheries.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatchery name</span><input required value={form.hatchery_name} onChange={(event) => setForm((current) => ({ ...current, hatchery_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Location</span><input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Egg capacity</span><input type="number" min="0" value={form.capacity_eggs} onChange={(event) => setForm((current) => ({ ...current, capacity_eggs: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chick capacity</span><input type="number" min="0" value={form.capacity_chicks} onChange={(event) => setForm((current) => ({ ...current, capacity_chicks: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubator count</span><input type="number" min="0" value={form.incubator_count} onChange={(event) => setForm((current) => ({ ...current, incubator_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatcher count</span><input type="number" min="0" value={form.hatcher_count} onChange={(event) => setForm((current) => ({ ...current, hatcher_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Default incubation temp</span><input type="number" step="0.01" value={form.incubation_temp_default} onChange={(event) => setForm((current) => ({ ...current, incubation_temp_default: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Default incubation humidity</span><input type="number" step="0.01" value={form.incubation_humidity_default} onChange={(event) => setForm((current) => ({ ...current, incubation_humidity_default: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatchery manager</span><input value={form.hatchery_manager} onChange={(event) => setForm((current) => ({ ...current, hatchery_manager: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option>Active</option><option>Inactive</option><option>Maintenance</option></select></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.hatchery_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.hatchery_id ? 'Save hatchery changes' : 'Save hatchery'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Hatcheries</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Code</th><th className="px-2 py-2 font-semibold">Name</th><th className="px-2 py-2 font-semibold">Location</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading hatcheries...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No hatcheries found.</td></tr> : rows.map((row) => (
                <tr key={row.hatchery_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.hatchery_code}</td><td className="px-2 py-2">{row.hatchery_name}</td><td className="px-2 py-2">{row.location || '—'}</td><td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : row.status === 'Active' ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{row.is_deleted ? 'Deleted' : row.status}</span></td><td className="px-2 py-2"><div className="flex justify-end gap-2">{row.is_deleted ? <button type="button" disabled={saving} onClick={() => restoreHatchery(row)} className="rounded-lg border border-[#0f8b3d] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#eafaf0] disabled:opacity-50">Restore</button> : <><button type="button" disabled={saving} onClick={() => editHatchery(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteHatchery(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></>}</div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
