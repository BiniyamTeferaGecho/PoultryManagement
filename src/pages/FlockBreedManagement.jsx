import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const POULTRY_CATEGORY_LOOKUP_GROUP = 'Poultry category';

const emptyForm = {
  breed_id: '',
  breed_code: '',
  breed_name: '',
  breed_type: '',
  poultry_category: 'Parent Stock',
  origin_country: '',
  description: '',
  company_id: '',
  is_active: true,
};

function breedToForm(breed) {
  return {
    ...emptyForm,
    ...breed,
    breed_id: breed.breed_id || '',
    breed_code: breed.breed_code || '',
    breed_name: breed.breed_name || '',
    breed_type: breed.breed_type || '',
    poultry_category: breed.poultry_category || 'Parent Stock',
    origin_country: breed.origin_country || '',
    description: breed.description || '',
    company_id: breed.company_id || '',
    is_active: Boolean(breed.is_active),
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

export default function FlockBreedManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [poultryCategories, setPoultryCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [breedPayload, companyPayload, poultryCategoryPayload] = await Promise.all([
        apiRequest('/flock/breed?page_number=1&page_size=50&include_deleted=0', currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(POULTRY_CATEGORY_LOOKUP_GROUP)}`, currentUser.accessToken),
      ]);
      setRows(Array.isArray(breedPayload.data) ? breedPayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setPoultryCategories(Array.isArray(poultryCategoryPayload.data) ? poultryCategoryPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
      setCompanies([]);
      setPoultryCategories([]);
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
    const isEditing = Boolean(form.breed_id);
    try {
      const normalizedBreedCode = form.breed_code.trim();
      await apiRequest(isEditing ? `/flock/breed/${form.breed_id}` : '/flock/breed', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          breed_code: normalizedBreedCode || null,
          company_id: form.company_id || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Breed updated successfully.' : 'Breed created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(breedToForm(row));
    setError('');
    setMessage('');
  }

  async function deleteBreed(row) {
    if (!window.confirm(`Delete ${row.breed_name} (${row.breed_code})?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/breed/${row.breed_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({
          deleted_by: currentUser.user_id || null,
        }),
      });
      setMessage('Breed deleted successfully.');
      if (form.breed_id === row.breed_id) setForm(emptyForm);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Breed Setup</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and view flock breeds.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Breed code (optional)</span>
            <input value={form.breed_code} onChange={(event) => setForm((current) => ({ ...current, breed_code: event.target.value }))} placeholder="Leave empty to auto-generate" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Breed name</span>
            <input required value={form.breed_name} onChange={(event) => setForm((current) => ({ ...current, breed_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Breed type</span>
            <input required value={form.breed_type} onChange={(event) => setForm((current) => ({ ...current, breed_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Poultry category</span>
            <select value={form.poultry_category} onChange={(event) => setForm((current) => ({ ...current, poultry_category: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select poultry category</option>
              {form.poultry_category && !poultryCategories.some((row) => row.lookup_value === form.poultry_category) && (
                <option value={form.poultry_category}>{form.poultry_category}</option>
              )}
              {poultryCategories.map((row) => (
                <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>
                  {row.lookup_code} - {row.lookup_value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Origin country</span>
            <input value={form.origin_country} onChange={(event) => setForm((current) => ({ ...current, origin_country: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Company</span>
            <select value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select company (optional)</option>
              {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Description</span>
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Active</label>
        <div className="mt-4 flex justify-end gap-2">
          {form.breed_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.breed_id ? 'Save breed changes' : 'Save breed'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Breeds</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Code</th><th className="px-2 py-2 font-semibold">Name</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading breeds...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No breeds found.</td></tr> : rows.map((row) => (
                <tr key={row.breed_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.breed_code}</td><td className="px-2 py-2">{row.breed_name}</td><td className="px-2 py-2">{row.breed_type}</td><td className="px-2 py-2">{row.is_active ? 'Active' : 'Inactive'}</td><td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteBreed(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
