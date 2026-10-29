import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;
const GENERATION_LOOKUP_GROUP = 'Generation';
const POULTRY_TYPE_LOOKUP_GROUP = 'Poultry Type';

const emptyBreed = {
  breed_code: '',
  breed_name: '',
  breed_type: '',
  poultry_category: 'Parent Stock',
  description: '',
  origin_country: '',
  company_id: '',
  is_active: true,
};

const emptyStrain = {
  breed_id: '',
  strain_code: '',
  strain_name: '',
  generation: '',
  description: '',
  company_id: '',
  is_active: true,
};

const emptyFlock = {
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
};

const emptyMortality = {
  flock_id: '',
  mortality_date: '',
  females: '',
  males: '',
  reason: '',
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

export default function FlockManagement({ currentUser }) {
  const [breedForm, setBreedForm] = useState(emptyBreed);
  const [strainForm, setStrainForm] = useState(emptyStrain);
  const [flockForm, setFlockForm] = useState(emptyFlock);
  const [mortalityForm, setMortalityForm] = useState(emptyMortality);
  const [breeds, setBreeds] = useState([]);
  const [strains, setStrains] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [generationLookups, setGenerationLookups] = useState([]);
  const [poultryTypeLookups, setPoultryTypeLookups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeFlocks = useMemo(() => flocks.filter((flock) => flock.status === 'Active'), [flocks]);
  const farmOptions = useMemo(() => farms.filter((farm) => !flockForm.company_id || farm.company_id === flockForm.company_id), [farms, flockForm.company_id]);
  const houseOptions = useMemo(() => houses.filter((house) => !flockForm.farm_id || house.farm_id === flockForm.farm_id), [houses, flockForm.farm_id]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [
        breedPayload,
        strainPayload,
        flockPayload,
        companyPayload,
        farmPayload,
        housePayload,
        generationLookupPayload,
        poultryTypeLookupPayload,
      ] = await Promise.all([
        apiRequest('/flock/breed?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock/strain?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=50', currentUser.accessToken),
        apiRequest(`/company?${new URLSearchParams({ page_number: '1', page_size: String(LOOKUP_PAGE_SIZE), include_deleted: '0' })}`, currentUser.accessToken),
        apiRequest(`/farm?${new URLSearchParams({ page_number: '1', page_size: String(LOOKUP_PAGE_SIZE), include_deleted: '0' })}`, currentUser.accessToken),
        apiRequest(`/house?${new URLSearchParams({ page_number: '1', page_size: String(LOOKUP_PAGE_SIZE), include_deleted: '0' })}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(GENERATION_LOOKUP_GROUP)}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(POULTRY_TYPE_LOOKUP_GROUP)}`, currentUser.accessToken),
      ]);
      setBreeds(Array.isArray(breedPayload.data) ? breedPayload.data : []);
      setStrains(Array.isArray(strainPayload.data) ? strainPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setGenerationLookups(Array.isArray(generationLookupPayload.data) ? generationLookupPayload.data : []);
      setPoultryTypeLookups(Array.isArray(poultryTypeLookupPayload.data) ? poultryTypeLookupPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setBreeds([]);
      setStrains([]);
      setFlocks([]);
      setGenerationLookups([]);
      setPoultryTypeLookups([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitBreed(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/flock/breed', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          ...breedForm,
          company_id: breedForm.company_id || null,
          created_by: currentUser.user_id || null,
        }),
      });
      setBreedForm(emptyBreed);
      setMessage('Breed created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitStrain(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/flock/strain', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          ...strainForm,
          company_id: strainForm.company_id || null,
          created_by: currentUser.user_id || null,
        }),
      });
      setStrainForm(emptyStrain);
      setMessage('Strain created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitFlockPlacement(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...flockForm,
        house_id: flockForm.house_id || null,
        strain_id: flockForm.strain_id || null,
        source_hatchery: flockForm.source_hatchery || null,
        source_flock_id: flockForm.source_flock_id || null,
        expected_production_start: flockForm.expected_production_start || null,
        expected_end_date: flockForm.expected_end_date || null,
        remarks: flockForm.remarks || null,
        initial_females: Number(flockForm.initial_females),
        initial_males: Number(flockForm.initial_males),
        created_by: currentUser.user_id || null,
      };
      const result = await apiRequest('/flock/place', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setFlockForm(emptyFlock);
      setMessage(`Flock placed successfully. Generated flock number: ${result.data?.flock_number || 'N/A'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitMortality(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/${mortalityForm.flock_id}/mortality`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          ...mortalityForm,
          females: Number(mortalityForm.females),
          males: Number(mortalityForm.males),
          created_by: currentUser.user_id || null,
        }),
      });
      setMortalityForm(emptyMortality);
      setMessage('Mortality recorded successfully.');
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
          <h2 className="text-xl font-bold text-[#1f2d2a]">Flock Management</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage breeds, strains, flock placement, and mortality.</p>
        </div>
        <button type="button" onClick={loadData} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f4f7f5]">Refresh</button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form onSubmit={submitBreed} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Create Breed</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input required value={breedForm.breed_code} onChange={(event) => setBreedForm((current) => ({ ...current, breed_code: event.target.value }))} placeholder="Breed code" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input required value={breedForm.breed_name} onChange={(event) => setBreedForm((current) => ({ ...current, breed_name: event.target.value }))} placeholder="Breed name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input required value={breedForm.breed_type} onChange={(event) => setBreedForm((current) => ({ ...current, breed_type: event.target.value }))} placeholder="Breed type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input value={breedForm.poultry_category} onChange={(event) => setBreedForm((current) => ({ ...current, poultry_category: event.target.value }))} placeholder="Poultry category" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input value={breedForm.origin_country} onChange={(event) => setBreedForm((current) => ({ ...current, origin_country: event.target.value }))} placeholder="Origin country" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={breedForm.company_id} onChange={(event) => setBreedForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Company (optional)</option>
              {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}
            </select>
          </div>
          <textarea value={breedForm.description} onChange={(event) => setBreedForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" rows="2" className="mt-3 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={breedForm.is_active} onChange={(event) => setBreedForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
            Active
          </label>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save breed'}</button>
          </div>
        </form>

        <form onSubmit={submitStrain} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Create Strain</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select required value={strainForm.breed_id} onChange={(event) => setStrainForm((current) => ({ ...current, breed_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select breed</option>
              {breeds.filter((breed) => !breed.is_deleted).map((breed) => <option key={breed.breed_id} value={breed.breed_id}>{breed.breed_code} - {breed.breed_name}</option>)}
            </select>
            <input required value={strainForm.strain_code} onChange={(event) => setStrainForm((current) => ({ ...current, strain_code: event.target.value }))} placeholder="Strain code" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input required value={strainForm.strain_name} onChange={(event) => setStrainForm((current) => ({ ...current, strain_name: event.target.value }))} placeholder="Strain name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={strainForm.generation} onChange={(event) => setStrainForm((current) => ({ ...current, generation: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Generation (optional)</option>
              {strainForm.generation && !generationLookups.some((row) => row.lookup_value === strainForm.generation) && <option value={strainForm.generation}>{strainForm.generation}</option>}
              {generationLookups.map((row) => <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}
            </select>
            <select value={strainForm.company_id} onChange={(event) => setStrainForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Company (optional)</option>
              {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}
            </select>
          </div>
          <textarea value={strainForm.description} onChange={(event) => setStrainForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" rows="2" className="mt-3 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={strainForm.is_active} onChange={(event) => setStrainForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
            Active
          </label>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save strain'}</button>
          </div>
        </form>

        <form onSubmit={submitFlockPlacement} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm xl:col-span-2">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Place Flock</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select required value={flockForm.company_id} onChange={(event) => setFlockForm((current) => ({ ...current, company_id: event.target.value, farm_id: '', house_id: '' }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Company</option>{companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}</select>
            <select required value={flockForm.farm_id} onChange={(event) => setFlockForm((current) => ({ ...current, farm_id: event.target.value, house_id: '' }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Farm</option>{farmOptions.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farm.farm_code} - {farm.farm_name}</option>)}</select>
            <select value={flockForm.house_id} onChange={(event) => setFlockForm((current) => ({ ...current, house_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">House (optional)</option>{houseOptions.map((house) => <option key={house.house_id} value={house.house_id}>{house.house_code} - {house.house_name}</option>)}</select>
            <select required value={flockForm.breed_id} onChange={(event) => setFlockForm((current) => ({ ...current, breed_id: event.target.value, strain_id: '' }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Breed</option>{breeds.filter((breed) => !breed.is_deleted).map((breed) => <option key={breed.breed_id} value={breed.breed_id}>{breed.breed_code} - {breed.breed_name}</option>)}</select>
            <select value={flockForm.strain_id} onChange={(event) => setFlockForm((current) => ({ ...current, strain_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Strain (optional)</option>{strains.filter((strain) => !flockForm.breed_id || strain.breed_id === flockForm.breed_id).map((strain) => <option key={strain.strain_id} value={strain.strain_id}>{strain.strain_code} - {strain.strain_name}</option>)}</select>
            <select required value={flockForm.generation} onChange={(event) => setFlockForm((current) => ({ ...current, generation: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Generation</option>
              {flockForm.generation && !generationLookups.some((row) => row.lookup_value === flockForm.generation) && <option value={flockForm.generation}>{flockForm.generation}</option>}
              {generationLookups.map((row) => <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}
            </select>
            <select required value={flockForm.poultry_type} onChange={(event) => setFlockForm((current) => ({ ...current, poultry_type: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Poultry type</option>
              {flockForm.poultry_type && !poultryTypeLookups.some((row) => row.lookup_value === flockForm.poultry_type) && <option value={flockForm.poultry_type}>{flockForm.poultry_type}</option>}
              {poultryTypeLookups.map((row) => <option key={row.lookup_id || row.lookup_code || row.lookup_value} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}
            </select>
            <input required value={flockForm.source_type} onChange={(event) => setFlockForm((current) => ({ ...current, source_type: event.target.value }))} placeholder="Source type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" required value={flockForm.hatch_date} onChange={(event) => setFlockForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" required value={flockForm.placement_date} onChange={(event) => setFlockForm((current) => ({ ...current, placement_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" required value={flockForm.initial_females} onChange={(event) => setFlockForm((current) => ({ ...current, initial_females: event.target.value }))} placeholder="Initial females" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" required value={flockForm.initial_males} onChange={(event) => setFlockForm((current) => ({ ...current, initial_males: event.target.value }))} placeholder="Initial males" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </div>
          <textarea value={flockForm.remarks} onChange={(event) => setFlockForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Remarks" rows="2" className="mt-3 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Place flock'}</button>
          </div>
        </form>

        <form onSubmit={submitMortality} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm xl:col-span-2">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Record Mortality</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select required value={mortalityForm.flock_id} onChange={(event) => setMortalityForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select active flock</option>
              {activeFlocks.map((flock) => <option key={flock.flock_id} value={flock.flock_id}>{flock.flock_number} - {flock.farm_name || 'Unknown farm'}</option>)}
            </select>
            <input type="date" required value={mortalityForm.mortality_date} onChange={(event) => setMortalityForm((current) => ({ ...current, mortality_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" required value={mortalityForm.females} onChange={(event) => setMortalityForm((current) => ({ ...current, females: event.target.value }))} placeholder="Female mortality" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" required value={mortalityForm.males} onChange={(event) => setMortalityForm((current) => ({ ...current, males: event.target.value }))} placeholder="Male mortality" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </div>
          <textarea value={mortalityForm.reason} onChange={(event) => setMortalityForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason" rows="2" className="mt-3 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Record mortality'}</button>
          </div>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Breeds</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Code</th><th className="px-2 py-2 font-semibold">Name</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-2 py-2 font-semibold">Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">Loading breeds...</td></tr> : breeds.length === 0 ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">No breeds found.</td></tr> : breeds.slice(0, 10).map((breed) => (
                  <tr key={breed.breed_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{breed.breed_code}</td>
                    <td className="px-2 py-2">{breed.breed_name}</td>
                    <td className="px-2 py-2">{breed.breed_type}</td>
                    <td className="px-2 py-2">{breed.is_active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Recent Flocks</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">Breed</th><th className="px-2 py-2 font-semibold">Current total</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">Loading flocks...</td></tr> : flocks.length === 0 ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">No flocks found.</td></tr> : flocks.slice(0, 10).map((flock) => (
                  <tr key={flock.flock_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{flock.flock_number}</td>
                    <td className="px-2 py-2">{flock.farm_name}</td>
                    <td className="px-2 py-2">{flock.breed_name}</td>
                    <td className="px-2 py-2">{flock.current_total ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
