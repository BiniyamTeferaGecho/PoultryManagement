import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  strain_id: '',
  breed_id: '',
  strain_code: '',
  strain_name: '',
  generation: '',
  description: '',
  company_id: '',
  is_active: true,
};

function strainToForm(strain) {
  return {
    ...emptyForm,
    ...strain,
    strain_id: strain.strain_id || '',
    breed_id: strain.breed_id || '',
    strain_code: strain.strain_code || '',
    strain_name: strain.strain_name || '',
    generation: strain.generation || '',
    description: strain.description || '',
    company_id: strain.company_id || '',
    is_active: Boolean(strain.is_active),
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

export default function FlockStrainManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [strainPayload, breedPayload, companyPayload] = await Promise.all([
        apiRequest('/flock/strain?page_number=1&page_size=50&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock/breed?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
      ]);
      setRows(Array.isArray(strainPayload.data) ? strainPayload.data : []);
      setBreeds(Array.isArray(breedPayload.data) ? breedPayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
      setBreeds([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const isEditing = Boolean(form.strain_id);
      await apiRequest(isEditing ? `/flock/strain/${form.strain_id}` : '/flock/strain', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          company_id: form.company_id || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Strain updated successfully.' : 'Strain created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(strainToForm(row));
    setError('');
    setMessage('');
  }

  async function deleteStrain(row) {
    if (!window.confirm(`Delete ${row.strain_name} (${row.strain_code})?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/strain/${row.strain_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.strain_id === row.strain_id) setForm(emptyForm);
      setMessage('Strain deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Strain Setup</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and view flock strains.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Breed</span>
            <select required value={form.breed_id} onChange={(event) => setForm((current) => ({ ...current, breed_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select breed</option>{breeds.map((breed) => <option key={breed.breed_id} value={breed.breed_id}>{breed.breed_code} - {breed.breed_name}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Strain code</span>
            <input required value={form.strain_code} onChange={(event) => setForm((current) => ({ ...current, strain_code: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Strain name</span>
            <input required value={form.strain_name} onChange={(event) => setForm((current) => ({ ...current, strain_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Generation</span>
            <input value={form.generation} onChange={(event) => setForm((current) => ({ ...current, generation: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Company</span>
            <select value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select company (optional)</option>{companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}</select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Description</span>
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Active</label>
        <div className="mt-4 flex justify-end gap-2">
          {form.strain_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.strain_id ? 'Save strain changes' : 'Save strain'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Strains</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Code</th><th className="px-2 py-2 font-semibold">Name</th><th className="px-2 py-2 font-semibold">Breed</th><th className="px-2 py-2 font-semibold">Generation</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading strains...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No strains found.</td></tr> : rows.map((row) => (
                <tr key={row.strain_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.strain_code}</td><td className="px-2 py-2">{row.strain_name}</td><td className="px-2 py-2">{row.breed_code} - {row.breed_name}</td><td className="px-2 py-2">{row.generation || '—'}</td><td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteStrain(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
