import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const COMPANY_PAGE_SIZE = 100;
const emptyFarm = {
  farm_id: '',
  company_id: '',
  farm_code: '',
  farm_name: '',
  farm_type: '',
  latitude: '',
  longitude: '',
  elevation: '',
  total_area: '',
  operational_area: '',
  establishment_date: '',
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

function farmToForm(farm) {
  return {
    ...emptyFarm,
    ...farm,
    farm_type: farm.farm_type || '',
    latitude: farm.latitude ?? '',
    longitude: farm.longitude ?? '',
    elevation: farm.elevation ?? '',
    total_area: farm.total_area ?? '',
    operational_area: farm.operational_area ?? '',
    establishment_date: farm.establishment_date ? String(farm.establishment_date).slice(0, 10) : '',
    status: farm.status || 'Active',
  };
}

function companyLabel(company) {
  return `${company.company_code} - ${company.company_name}`;
}

export default function FarmRegistration({ currentUser }) {
  const [farms, setFarms] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ farm_code: '', farm_name: '', status: 'all' });
  const [form, setForm] = useState(emptyFarm);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [message, setMessage] = useState('');
  const [, setError] = useState('');
  const [companyError, setCompanyError] = useState('');

  const loadFarms = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.farm_code) params.set('farm_code', filters.farm_code);
      if (filters.farm_name) params.set('farm_name', filters.farm_name);
      if (filters.status !== 'all') params.set('status', filters.status);
      const payload = await apiRequest(`/farm?${params}`, currentUser.accessToken);
      setFarms(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setFarms([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  const loadActiveCompanies = useCallback(async () => {
    if (!currentUser.accessToken) {
      setCompanyError('Your session does not include an access token. Sign out and sign in again.');
      return;
    }

    setCompaniesLoading(true);
    setCompanyError('');
    try {
      const firstPage = await apiRequest(`/company?${new URLSearchParams({
        status: 'Active',
        page_number: '1',
        page_size: String(COMPANY_PAGE_SIZE),
      })}`, currentUser.accessToken);
      const firstPageCompanies = Array.isArray(firstPage.data) ? firstPage.data : [];
      const pageCount = Math.ceil((firstPage.totalCount ?? 0) / COMPANY_PAGE_SIZE);
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => apiRequest(`/company?${new URLSearchParams({
          status: 'Active',
          page_number: String(index + 2),
          page_size: String(COMPANY_PAGE_SIZE),
        })}`, currentUser.accessToken)),
      );
      setCompanies([
        ...firstPageCompanies,
        ...remainingPages.flatMap((payload) => Array.isArray(payload.data) ? payload.data : []),
      ]);
    } catch (requestError) {
      setCompanies([]);
      setCompanyError(requestError.message);
    } finally {
      setCompaniesLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => {
    const timer = setTimeout(loadFarms, 250);
    return () => clearTimeout(timer);
  }, [loadFarms]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));
  const filteredCompanies = useMemo(() => {
    const search = companySearch.trim().toLowerCase();
    if (!search) return companies;
    return companies.filter((company) => company.company_code.toLowerCase().includes(search) || company.company_name.toLowerCase().includes(search));
  }, [companies, companySearch]);
  const selectedCompany = companies.find((company) => company.company_id === form.company_id);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setForm(emptyFarm);
    setCompanySearch('');
    setError('');
    setMessage('');
    setIsEditorOpen(true);
    loadActiveCompanies();
  }

  function openEditForm(farm) {
    setForm(farmToForm(farm));
    setCompanySearch('');
    setError('');
    setMessage('');
    setIsEditorOpen(true);
    loadActiveCompanies();
  }

  async function saveFarm(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const isNew = !form.farm_id;
    if (isNew && !form.company_id) {
      setError('Select a company before saving the farm.');
      return;
    }
    setSaving(true);
    const payload = {
      farm_name: form.farm_name.trim(),
      farm_type: form.farm_type.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      elevation: form.elevation,
      total_area: form.total_area,
      operational_area: form.operational_area,
      establishment_date: form.establishment_date || null,
      status: form.status,
    };

    try {
      if (isNew) {
        payload.company_id = form.company_id;
        const result = await apiRequest('/farm', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`Farm registered successfully with code ${result.data?.farm_code || 'generated by the server'}.`);
      } else {
        await apiRequest(`/farm/${form.farm_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Farm updated successfully.');
      }
      setIsEditorOpen(false);
      await loadFarms();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFarm(farm) {
    if (!window.confirm(`Delete ${farm.farm_name} (${farm.farm_code})?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/farm/${farm.farm_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      setMessage('Farm deleted successfully.');
      await loadFarms();
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
          <h2 className="text-xl font-bold text-[#1f2d2a]">Farm Registration</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage farm master-data records, locations, and operational status.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">+ Add farm</button>
      </div>

      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="search" value={filters.farm_code} onChange={(event) => updateFilter('farm_code', event.target.value)} placeholder="Filter by farm code" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <input type="search" value={filters.farm_name} onChange={(event) => updateFilter('farm_name', event.target.value)} placeholder="Filter by farm name" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
            <option value="Under Construction">Under Construction</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Farm</th><th className="px-3 py-3 font-semibold">Type</th><th className="px-3 py-3 font-semibold">Operational Area</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">Loading farms...</td></tr> : farms.length === 0 ? <tr><td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">No farms match the selected filters.</td></tr> : farms.map((farm) => (
                <tr key={farm.farm_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3 font-mono text-xs font-semibold">{farm.farm_code}</td><td className="px-3 py-3 font-semibold">{farm.farm_name}</td><td className="px-3 py-3">{farm.farm_type || '—'}</td><td className="px-3 py-3">{farm.operational_area === null || farm.operational_area === undefined ? '—' : `${farm.operational_area} ha`}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${farm.status === 'Active' ? 'bg-[#eafaf0] text-[#198754]' : farm.status === 'Under Construction' ? 'bg-amber-50 text-amber-700' : 'bg-[#f1f5f2] text-[#5d6d68]'}`}>{farm.status}</span></td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(farm)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteFarm(farm)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]"><span>{totalCount} farm{totalCount === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
      </div>

      {isEditorOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center"><form onSubmit={saveFarm} className="my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-[#1f2d2a]">{form.farm_id ? `Edit ${form.farm_name || form.farm_code}` : 'Add farm'}</h3><p className="mt-1 text-sm text-[#5d6d68]">{form.farm_id ? 'Update the farm details and operational status.' : 'Select an active company before registering a farm.'}</p></div><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close farm editor">×</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="text-sm font-semibold text-[#374744]"><div className="flex items-center justify-between gap-2"><span>Company</span><button type="button" onClick={loadActiveCompanies} disabled={companiesLoading} className="text-xs font-semibold text-[#0f8b3d] hover:text-[#0c7133] disabled:opacity-50">{companiesLoading ? 'Loading...' : 'Refresh'}</button></div>{companies.length > 10 && <input type="search" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search companies" className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />}<select required={!form.farm_id} disabled={companiesLoading || Boolean(form.farm_id) || companies.length === 0} value={form.company_id} onChange={(event) => updateForm('company_id', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d] disabled:cursor-not-allowed disabled:bg-[#f4f7f5]"><option value="">{companiesLoading ? 'Loading companies...' : 'Select Company'}</option>{form.farm_id && form.company_id && !selectedCompany && <option value={form.company_id}>Current company is unavailable</option>}{filteredCompanies.map((company) => <option key={company.company_id} value={company.company_id}>{companyLabel(company)}</option>)}</select>{companyError ? <p className="mt-1.5 text-xs font-medium text-red-700">{companyError}</p> : !companiesLoading && companies.length === 0 ? <p className="mt-1.5 text-xs font-medium text-amber-700">No active companies are available. Create a company before registering a farm.</p> : !companiesLoading && filteredCompanies.length === 0 ? <p className="mt-1.5 text-xs text-[#5d6d68]">No companies match your search.</p> : null}</div>
          {form.farm_id ? <label className="text-sm font-semibold text-[#374744]">Farm code<input readOnly value={form.farm_code} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 font-mono font-normal text-[#5d6d68]" /></label> : <div className="rounded-xl border border-dashed border-[#b8d8c4] bg-[#f4fbf6] px-3 py-3 text-sm text-[#3d6750]"><span className="font-semibold">Farm code</span><p className="mt-1">Generated automatically after the farm is saved.</p></div>}
          <label className="text-sm font-semibold text-[#374744]">Farm name<input required maxLength="100" value={form.farm_name} onChange={(event) => updateForm('farm_name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Farm type<input maxLength="30" value={form.farm_type} onChange={(event) => updateForm('farm_type', event.target.value)} placeholder="Layer, Broiler, Breeder..." className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Status<select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d]"><option>Active</option><option>Inactive</option><option>Suspended</option><option>Under Construction</option></select></label>
          <label className="text-sm font-semibold text-[#374744]">Establishment date<input type="date" value={form.establishment_date} onChange={(event) => updateForm('establishment_date', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Latitude<input type="number" step="0.00000001" value={form.latitude} onChange={(event) => updateForm('latitude', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Longitude<input type="number" step="0.00000001" value={form.longitude} onChange={(event) => updateForm('longitude', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Elevation<input type="number" step="0.01" value={form.elevation} onChange={(event) => updateForm('elevation', event.target.value)} placeholder="Meters" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Total area<input type="number" min="0" step="0.01" value={form.total_area} onChange={(event) => updateForm('total_area', event.target.value)} placeholder="Hectares" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Operational area<input type="number" min="0" step="0.01" value={form.operational_area} onChange={(event) => updateForm('operational_area', event.target.value)} placeholder="Hectares" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.farm_id ? 'Save farm changes' : 'Save farm'}</button></div>
      </form></div>}
    </div>
  );
}
