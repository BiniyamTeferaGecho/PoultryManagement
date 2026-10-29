import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const FARM_PAGE_SIZE = 100;
const emptyHouse = {
  house_id: '',
  farm_id: '',
  house_code: '',
  house_name: '',
  house_type: '',
  width: '',
  length: '',
  height: '',
  floor_area: '',
  capacity_birds: '',
  capacity_females: '',
  capacity_males: '',
  stocking_density: '',
  construction_date: '',
  last_renovation: '',
  status: 'Active',
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

function houseToForm(house) {
  return {
    ...emptyHouse,
    ...house,
    house_name: house.house_name || '',
    house_type: house.house_type || '',
    width: house.width ?? '',
    length: house.length ?? '',
    height: house.height ?? '',
    floor_area: house.floor_area ?? '',
    capacity_birds: house.capacity_birds ?? '',
    capacity_females: house.capacity_females ?? '',
    capacity_males: house.capacity_males ?? '',
    stocking_density: house.stocking_density ?? '',
    construction_date: house.construction_date ? String(house.construction_date).slice(0, 10) : '',
    last_renovation: house.last_renovation ? String(house.last_renovation).slice(0, 10) : '',
    status: house.status || 'Active',
  };
}

function farmLabel(farm) {
  return `${farm.farm_code} - ${farm.farm_name}`;
}

export default function Houses({ currentUser }) {
  const [houses, setHouses] = useState([]);
  const [farms, setFarms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ house_code: '', house_name: '', status: 'all' });
  const [form, setForm] = useState(emptyHouse);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [farmSearch, setFarmSearch] = useState('');
  const [message, setMessage] = useState('');
  const [, setError] = useState('');
  const [farmError, setFarmError] = useState('');

  const loadHouses = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.house_code) params.set('house_code', filters.house_code);
      if (filters.house_name) params.set('house_name', filters.house_name);
      if (filters.status !== 'all') params.set('status', filters.status);
      const payload = await apiRequest(`/house?${params}`, currentUser.accessToken);
      setHouses(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setHouses([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  const loadActiveFarms = useCallback(async () => {
    if (!currentUser.accessToken) {
      setFarmError('Your session does not include an access token. Sign out and sign in again.');
      return;
    }
    setFarmsLoading(true);
    setFarmError('');
    try {
      const firstPage = await apiRequest(`/farm?${new URLSearchParams({
        status: 'Active',
        page_number: '1',
        page_size: String(FARM_PAGE_SIZE),
      })}`, currentUser.accessToken);
      const firstPageFarms = Array.isArray(firstPage.data) ? firstPage.data : [];
      const pageCount = Math.ceil((firstPage.totalCount ?? 0) / FARM_PAGE_SIZE);
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => apiRequest(`/farm?${new URLSearchParams({
          status: 'Active',
          page_number: String(index + 2),
          page_size: String(FARM_PAGE_SIZE),
        })}`, currentUser.accessToken)),
      );
      setFarms([...firstPageFarms, ...remainingPages.flatMap((payload) => Array.isArray(payload.data) ? payload.data : [])]);
    } catch (requestError) {
      setFarms([]);
      setFarmError(requestError.message);
    } finally {
      setFarmsLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => {
    const timer = setTimeout(loadHouses, 250);
    return () => clearTimeout(timer);
  }, [loadHouses]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));
  const filteredFarms = useMemo(() => {
    const search = farmSearch.trim().toLowerCase();
    if (!search) return farms;
    return farms.filter((farm) => farm.farm_code.toLowerCase().includes(search) || farm.farm_name.toLowerCase().includes(search));
  }, [farms, farmSearch]);
  const selectedFarm = farms.find((farm) => farm.farm_id === form.farm_id);
  const floorArea = form.width !== '' && form.length !== ''
    && Number.isFinite(Number(form.width)) && Number.isFinite(Number(form.length))
    ? (Number(form.width) * Number(form.length)).toFixed(2)
    : '';

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setForm(emptyHouse);
    setFarmSearch('');
    setError('');
    setMessage('');
    setIsEditorOpen(true);
    loadActiveFarms();
  }

  function openEditForm(house) {
    setForm(houseToForm(house));
    setFarmSearch('');
    setError('');
    setMessage('');
    setIsEditorOpen(true);
    loadActiveFarms();
  }

  async function saveHouse(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const isNew = !form.house_id;
    if (isNew && !form.farm_id) {
      setError('Select a farm before saving the house.');
      return;
    }
    const capacityBirds = form.capacity_birds === '' ? null : Number(form.capacity_birds);
    const capacityFemales = form.capacity_females === '' ? null : Number(form.capacity_females);
    const capacityMales = form.capacity_males === '' ? null : Number(form.capacity_males);
    if (capacityBirds !== null && capacityFemales !== null && capacityMales !== null && capacityFemales + capacityMales > capacityBirds) {
      setError('Female and male capacities cannot exceed the total bird capacity.');
      return;
    }
    setSaving(true);
    const payload = {
      house_name: form.house_name.trim() || null,
      house_type: form.house_type.trim() || null,
      width: form.width,
      length: form.length,
      height: form.height,
      capacity_birds: form.capacity_birds,
      capacity_females: form.capacity_females,
      capacity_males: form.capacity_males,
      stocking_density: form.stocking_density,
      construction_date: form.construction_date || null,
      last_renovation: form.last_renovation || null,
      status: form.status,
    };
    try {
      if (isNew) {
        payload.farm_id = form.farm_id;
        const result = await apiRequest('/house', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`House registered successfully with code ${result.data?.house_code || 'generated by the server'}.`);
      } else {
        await apiRequest(`/house/${form.house_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('House updated successfully.');
      }
      setIsEditorOpen(false);
      await loadHouses();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteHouse(house) {
    if (!window.confirm(`Delete ${house.house_name || house.house_code} (${house.house_code})?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/house/${house.house_id}`, currentUser.accessToken, { method: 'DELETE', body: JSON.stringify({}) });
      setMessage('House deleted successfully.');
      await loadHouses();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-[#1f2d2a]">House Registration</h2><p className="mt-1 text-sm text-[#5d6d68]">Manage poultry houses, dimensions, capacity, and operational status.</p></div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">+ Add house</button>
      </div>
      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}
      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="search" value={filters.house_code} onChange={(event) => updateFilter('house_code', event.target.value)} placeholder="Filter by house code" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <input type="search" value={filters.house_name} onChange={(event) => updateFilter('house_name', event.target.value)} placeholder="Filter by house name" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All statuses</option><option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Construction</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">House</th><th className="px-3 py-3 font-semibold">Farm</th><th className="px-3 py-3 font-semibold">Type</th><th className="px-3 py-3 font-semibold">Capacity</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">Loading houses...</td></tr> : houses.length === 0 ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">No houses match the selected filters.</td></tr> : houses.map((house) => <tr key={house.house_id} className="border-b border-[#f0f3f1] text-[#30433f]"><td className="px-3 py-3 font-mono text-xs font-semibold">{house.house_code}</td><td className="px-3 py-3 font-semibold">{house.house_name || '—'}</td><td className="px-3 py-3">{house.farm_name ? `${house.farm_code} - ${house.farm_name}` : house.farm_code}</td><td className="px-3 py-3">{house.house_type || '—'}</td><td className="px-3 py-3">{house.capacity_birds ?? '—'}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${house.status === 'Active' ? 'bg-[#eafaf0] text-[#198754]' : house.status === 'Under Construction' ? 'bg-amber-50 text-amber-700' : 'bg-[#f1f5f2] text-[#5d6d68]'}`}>{house.status}</span></td><td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(house)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteHouse(house)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]"><span>{totalCount} house{totalCount === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
      </div>
      {isEditorOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center"><form onSubmit={saveHouse} className="my-4 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-[#1f2d2a]">{form.house_id ? `Edit ${form.house_name || form.house_code}` : 'Add house'}</h3><p className="mt-1 text-sm text-[#5d6d68]">{form.house_id ? 'Update house details and operational status.' : 'Select an active farm before registering a house.'}</p></div><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close house editor">×</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="text-sm font-semibold text-[#374744]"><div className="flex items-center justify-between gap-2"><span>Farm</span><button type="button" onClick={loadActiveFarms} disabled={farmsLoading} className="text-xs font-semibold text-[#0f8b3d] hover:text-[#0c7133] disabled:opacity-50">{farmsLoading ? 'Loading...' : 'Refresh'}</button></div>{farms.length > 10 && <input type="search" value={farmSearch} onChange={(event) => setFarmSearch(event.target.value)} placeholder="Search farms" className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm font-normal outline-none focus:border-[#0f8b3d]" />}<select required={!form.house_id} disabled={farmsLoading || Boolean(form.house_id) || farms.length === 0} value={form.farm_id} onChange={(event) => updateForm('farm_id', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d] disabled:cursor-not-allowed disabled:bg-[#f4f7f5]"><option value="">{farmsLoading ? 'Loading farms...' : 'Select Farm'}</option>{form.house_id && form.farm_id && !selectedFarm && <option value={form.farm_id}>Current farm is unavailable</option>}{filteredFarms.map((farm) => <option key={farm.farm_id} value={farm.farm_id}>{farmLabel(farm)}</option>)}</select>{farmError ? <p className="mt-1.5 text-xs font-medium text-red-700">{farmError}</p> : !farmsLoading && farms.length === 0 ? <p className="mt-1.5 text-xs font-medium text-amber-700">No active farms are available. Create a farm before registering a house.</p> : null}</div>
          {form.house_id ? <label className="text-sm font-semibold text-[#374744]">House code<input readOnly value={form.house_code} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 font-mono font-normal text-[#5d6d68]" /></label> : <div className="rounded-xl border border-dashed border-[#b8d8c4] bg-[#f4fbf6] px-3 py-3 text-sm text-[#3d6750]"><span className="font-semibold">House code</span><p className="mt-1">Generated automatically after the house is saved.</p></div>}
          <label className="text-sm font-semibold text-[#374744]">House name<input maxLength="100" value={form.house_name} onChange={(event) => updateForm('house_name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">House type<input maxLength="30" value={form.house_type} onChange={(event) => updateForm('house_type', event.target.value)} placeholder="Layer, Broiler, Breeder..." className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Status<select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d]"><option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Construction</option></select></label>
          <label className="text-sm font-semibold text-[#374744]">Width<input type="number" min="0" step="0.01" value={form.width} onChange={(event) => updateForm('width', event.target.value)} placeholder="Meters" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Length<input type="number" min="0" step="0.01" value={form.length} onChange={(event) => updateForm('length', event.target.value)} placeholder="Meters" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Height<input type="number" min="0" step="0.01" value={form.height} onChange={(event) => updateForm('height', event.target.value)} placeholder="Meters" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Floor area<input readOnly value={floorArea} placeholder="Calculated from width × length" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 font-normal text-[#5d6d68]" /><span className="mt-1 block text-xs font-normal text-[#5d6d68]">Calculated automatically in square meters.</span></label>
          <label className="text-sm font-semibold text-[#374744]">Bird capacity<input type="number" min="0" step="1" value={form.capacity_birds} onChange={(event) => updateForm('capacity_birds', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Female capacity<input type="number" min="0" step="1" value={form.capacity_females} onChange={(event) => updateForm('capacity_females', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Male capacity<input type="number" min="0" step="1" value={form.capacity_males} onChange={(event) => updateForm('capacity_males', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Stocking density<input type="number" min="0" step="0.01" value={form.stocking_density} onChange={(event) => updateForm('stocking_density', event.target.value)} placeholder="Birds per m²" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Construction date<input type="date" value={form.construction_date} onChange={(event) => updateForm('construction_date', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Last renovation<input type="date" value={form.last_renovation} onChange={(event) => updateForm('last_renovation', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d]" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.house_id ? 'Save house changes' : 'Save house'}</button></div>
      </form></div>}
    </div>
  );
}
