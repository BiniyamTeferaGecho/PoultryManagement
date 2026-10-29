import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const GENERATION_LOOKUP_GROUP = 'Generation';
const POULTRY_TYPE_LOOKUP_GROUP = 'Poultry Type';

const emptyForm = {
  flock_id: '',
  company_id: '',
  farm_id: '',
  house_id: '',
  breed_id: '',
  strain_id: '',
  generation: '',
  poultry_type: '',
  sex_composition: 'Mixed',
  hatch_date: '',
  source_type: '',
  source_hatchery: '',
  source_flock_id: '',
  initial_females: '',
  initial_males: '',
  placement_date: '',
  expected_production_start: '',
  expected_end_date: '',
  lifecycle_stage: 'Quarantine',
  status: 'Active',
  remarks: '',
  is_deleted: false,
};

function flockToForm(flock) {
  return {
    ...emptyForm,
    flock_id: flock.flock_id || '',
    company_id: flock.company_id || '',
    farm_id: flock.farm_id || '',
    house_id: flock.house_id || '',
    breed_id: flock.breed_id || '',
    strain_id: flock.strain_id || '',
    generation: flock.generation || '',
    poultry_type: flock.poultry_type || '',
    sex_composition: flock.sex_composition || 'Mixed',
    hatch_date: flock.hatch_date ? String(flock.hatch_date).slice(0, 10) : '',
    source_type: flock.source_type || '',
    source_hatchery: flock.source_hatchery || '',
    source_flock_id: flock.source_flock_id || '',
    initial_females: flock.initial_females ?? '',
    initial_males: flock.initial_males ?? '',
    placement_date: flock.placement_date ? String(flock.placement_date).slice(0, 10) : '',
    expected_production_start: flock.expected_production_start ? String(flock.expected_production_start).slice(0, 10) : '',
    expected_end_date: flock.expected_end_date ? String(flock.expected_end_date).slice(0, 10) : '',
    lifecycle_stage: flock.lifecycle_stage || 'Quarantine',
    status: flock.status || 'Active',
    remarks: flock.remarks || '',
    is_deleted: Boolean(flock.is_deleted),
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

export default function CreateFlockManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [strains, setStrains] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [generationLookups, setGenerationLookups] = useState([]);
  const [poultryTypeLookups, setPoultryTypeLookups] = useState([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const farmOptions = useMemo(() => farms.filter((farm) => !form.company_id || farm.company_id === form.company_id), [farms, form.company_id]);
  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const strainOptions = useMemo(() => strains.filter((strain) => !form.breed_id || strain.breed_id === form.breed_id), [strains, form.breed_id]);
  const sourceFlockOptions = useMemo(
    () => flocks.filter((row) => row.flock_id !== form.flock_id && (!form.company_id || row.company_id === form.company_id)),
    [flocks, form.company_id, form.flock_id],
  );
  const companyNameById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.company_id, `${company.company_code} - ${company.company_name}`])),
    [companies],
  );
  const farmNameById = useMemo(
    () => Object.fromEntries(farms.map((farm) => [farm.farm_id, `${farm.farm_code} - ${farm.farm_name}`])),
    [farms],
  );

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [
        companyPayload,
        farmPayload,
        housePayload,
        breedPayload,
        strainPayload,
        flockPayload,
        generationLookupPayload,
        poultryTypeLookupPayload,
      ] = await Promise.all([
        apiRequest('/company?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock/breed?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock/strain?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest(`/flock?page_number=1&page_size=100&include_deleted=${includeDeleted ? '1' : '0'}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(GENERATION_LOOKUP_GROUP)}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(POULTRY_TYPE_LOOKUP_GROUP)}`, currentUser.accessToken),
      ]);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setBreeds(Array.isArray(breedPayload.data) ? breedPayload.data : []);
      setStrains(Array.isArray(strainPayload.data) ? strainPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setGenerationLookups(Array.isArray(generationLookupPayload.data) ? generationLookupPayload.data : []);
      setPoultryTypeLookups(Array.isArray(poultryTypeLookupPayload.data) ? poultryTypeLookupPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setCompanies([]);
      setFarms([]);
      setHouses([]);
      setBreeds([]);
      setStrains([]);
      setFlocks([]);
      setGenerationLookups([]);
      setPoultryTypeLookups([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const isEditing = Boolean(form.flock_id);
    try {
      const result = await apiRequest(isEditing ? `/flock/${form.flock_id}` : '/flock', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          house_id: form.house_id || null,
          strain_id: form.strain_id || null,
          source_hatchery: form.source_hatchery || null,
          source_flock_id: form.source_flock_id || null,
          expected_production_start: form.expected_production_start || null,
          expected_end_date: form.expected_end_date || null,
          remarks: form.remarks || null,
          initial_females: Number(form.initial_females),
          initial_males: Number(form.initial_males),
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing
        ? 'Flock updated successfully.'
        : `Flock created successfully. Generated flock number: ${result.data?.flock_number || 'N/A'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(flockToForm(row));
    setError('');
    setMessage('');
  }

  async function deleteFlock(row) {
    if (!window.confirm(`Delete flock ${row.flock_number || row.flock_id}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/${row.flock_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.flock_id === row.flock_id) setForm(emptyForm);
      setMessage('Flock deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreFlock(row) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/${row.flock_id}/undelete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Flock restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Create Flock</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Create and manage flock records.</p>
        </div>
        <button type="button" onClick={loadData} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f4f7f5]">Refresh</button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value, farm_id: '', house_id: '', source_flock_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select company</option>{companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required value={form.farm_id} onChange={(event) => setForm((current) => ({ ...current, farm_id: event.target.value, house_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select farm</option>{farmOptions.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.farm_code} - {farm.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select value={form.house_id} onChange={(event) => setForm((current) => ({ ...current, house_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select house (optional)</option>{houseOptions.map((house) => <option key={house.house_id} value={house.house_id}>{house.house_code} - {house.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Breed</span><select required value={form.breed_id} onChange={(event) => setForm((current) => ({ ...current, breed_id: event.target.value, strain_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select breed</option>{breeds.map((breed) => <option key={breed.breed_id} value={breed.breed_id}>{breed.breed_code} - {breed.breed_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Strain</span><select value={form.strain_id} onChange={(event) => setForm((current) => ({ ...current, strain_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select strain (optional)</option>{strainOptions.map((strain) => <option key={strain.strain_id} value={strain.strain_id}>{strain.strain_code} - {strain.strain_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Generation</span><select required value={form.generation} onChange={(event) => setForm((current) => ({ ...current, generation: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select generation</option>{form.generation && !generationLookups.some((row) => row.lookup_value === form.generation) && <option value={form.generation}>{form.generation}</option>}{generationLookups.map((row) => <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Poultry type</span><select required value={form.poultry_type} onChange={(event) => setForm((current) => ({ ...current, poultry_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select poultry type</option>{form.poultry_type && !poultryTypeLookups.some((row) => row.lookup_value === form.poultry_type) && <option value={form.poultry_type}>{form.poultry_type}</option>}{poultryTypeLookups.map((row) => <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sex composition</span><select required value={form.sex_composition} onChange={(event) => setForm((current) => ({ ...current, sex_composition: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Mixed">Mixed</option><option value="Female">Female</option><option value="Male">Male</option></select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatch date</span><input type="date" required value={form.hatch_date} onChange={(event) => setForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Source type</span><input required value={form.source_type} onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Source hatchery</span><input value={form.source_hatchery} onChange={(event) => setForm((current) => ({ ...current, source_hatchery: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Source flock</span><select value={form.source_flock_id} onChange={(event) => setForm((current) => ({ ...current, source_flock_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select source flock (optional)</option>{sourceFlockOptions.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number} - {farmNameById[row.farm_id] || row.farm_id || 'Unknown farm'}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Initial females</span><input type="number" min="0" required value={form.initial_females} onChange={(event) => setForm((current) => ({ ...current, initial_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Initial males</span><input type="number" min="0" required value={form.initial_males} onChange={(event) => setForm((current) => ({ ...current, initial_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Placement date</span><input type="date" required value={form.placement_date} onChange={(event) => setForm((current) => ({ ...current, placement_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Expected production start</span><input type="date" value={form.expected_production_start} onChange={(event) => setForm((current) => ({ ...current, expected_production_start: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Expected end date</span><input type="date" value={form.expected_end_date} onChange={(event) => setForm((current) => ({ ...current, expected_end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lifecycle stage</span><select value={form.lifecycle_stage} onChange={(event) => setForm((current) => ({ ...current, lifecycle_stage: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Quarantine">Quarantine</option><option value="Rearing">Rearing</option><option value="Production">Production</option><option value="Completed">Completed</option></select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Remarks</span>
          <textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="3" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          {form.flock_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving || loading} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.flock_id ? 'Save flock changes' : 'Create flock'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Flocks</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Show deleted
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Flock #</th><th className="px-2 py-2 font-semibold">Company</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading flocks...</td></tr> : flocks.length === 0 ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No flocks found.</td></tr> : flocks.map((row) => (
                <tr key={row.flock_id} className="border-b border-[#f0f3f1]">
                  <td className="px-2 py-2 font-mono text-xs">{row.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{companyNameById[row.company_id] || row.company_id}</td>
                  <td className="px-2 py-2">{farmNameById[row.farm_id] || row.farm_id}</td>
                  <td className="px-2 py-2">{row.poultry_type || '—'}</td>
                  <td className="px-2 py-2">{row.is_deleted ? 'Deleted' : (row.status || 'Active')}</td>
                  <td className="px-2 py-2">
                    {row.is_deleted ? (
                      <div className="flex justify-end">
                        <button type="button" disabled={saving} onClick={() => restoreFlock(row)} className="rounded-lg border border-[#bce1c8] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#edf9f0] disabled:opacity-50">Restore</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                        <button type="button" disabled={saving} onClick={() => deleteFlock(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                      </div>
                    )}
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
