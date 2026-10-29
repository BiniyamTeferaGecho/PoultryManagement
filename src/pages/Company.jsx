import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const emptyCompany = {
  company_id: '',
  company_code: '',
  company_name: '',
  legal_name: '',
  registration_number: '',
  industry_type: 'Poultry',
  primary_phone: '',
  primary_email: '',
  website: '',
  timezone: 'UTC',
  date_format: 'DD/MM/YYYY',
  number_format: '###,###.##',
  status: 'Active',
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

function companyToForm(company) {
  return {
    ...emptyCompany,
    ...company,
    legal_name: company.legal_name || '',
    registration_number: company.registration_number || '',
    industry_type: company.industry_type || 'Poultry',
    primary_phone: company.primary_phone || '',
    primary_email: company.primary_email || '',
    website: company.website || '',
    timezone: company.timezone || 'UTC',
    date_format: company.date_format || 'DD/MM/YYYY',
    number_format: company.number_format || '###,###.##',
    status: company.status || 'Active',
    is_deleted: Boolean(company.is_deleted),
  };
}

export default function CompanyRegistration({ currentUser }) {
  const [companies, setCompanies] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ companyCode: '', companyName: '', status: 'all', industryType: '', includeDeleted: false });
  const [form, setForm] = useState(emptyCompany);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [, setError] = useState('');

  const loadCompanies = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.companyCode) params.set('company_code', filters.companyCode);
      if (filters.companyName) params.set('company_name', filters.companyName);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.industryType) params.set('industry_type', filters.industryType);
      if (filters.includeDeleted) params.set('include_deleted', 'true');
      const payload = await apiRequest(`/company?${params}`, currentUser.accessToken);
      setCompanies(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setCompanies([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  useEffect(() => {
    const timer = setTimeout(loadCompanies, 250);
    return () => clearTimeout(timer);
  }, [loadCompanies]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setForm(emptyCompany);
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  function openEditForm(company) {
    setForm(companyToForm(company));
    setError('');
    setMessage('');
    setIsEditorOpen(true);
  }

  async function saveCompany(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isNew = !form.company_id;
    const payload = {
      company_code: form.company_code.trim(),
      company_name: form.company_name.trim(),
      legal_name: form.legal_name.trim() || null,
      registration_number: form.registration_number.trim() || null,
      industry_type: form.industry_type.trim() || null,
      primary_phone: form.primary_phone.trim() || null,
      primary_email: form.primary_email.trim() || null,
      website: form.website.trim() || null,
      timezone: form.timezone.trim() || null,
      date_format: form.date_format.trim() || null,
      number_format: form.number_format.trim() || null,
      status: form.status,
    };

    try {
      if (isNew) {
        const result = await apiRequest('/company', currentUser.accessToken, { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`Company created successfully.${result.data?.company_id ? ` Company ID: ${result.data.company_id}` : ''}`);
      } else {
        await apiRequest(`/company/${form.company_id}`, currentUser.accessToken, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Company updated successfully.');
      }
      setIsEditorOpen(false);
      await loadCompanies();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany(company) {
    if (!window.confirm(`Delete ${company.company_name} (${company.company_code})?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/company/${company.company_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      setMessage('Company deleted successfully.');
      await loadCompanies();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreCompany(company) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/company/${company.company_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('Company restored successfully.');
      await loadCompanies();
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
          <h2 className="text-xl font-bold text-[#1f2d2a]">Company Registration</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage company profiles, registration details, and operating preferences.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">+ Add company</button>
      </div>

      {message && <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input type="search" value={filters.companyCode} onChange={(event) => updateFilter('companyCode', event.target.value)} placeholder="Search by company code" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <input type="search" value={filters.companyName} onChange={(event) => updateFilter('companyName', event.target.value)} placeholder="Search by company name" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
          <input value={filters.industryType} onChange={(event) => updateFilter('industryType', event.target.value)} placeholder="Filter by industry" className="h-11 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" />
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.includeDeleted} onChange={(event) => updateFilter('includeDeleted', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Code</th><th className="px-3 py-3 font-semibold">Company</th><th className="px-3 py-3 font-semibold">Industry</th><th className="px-3 py-3 font-semibold">Contact</th><th className="px-3 py-3 font-semibold">Timezone</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">Loading companies...</td></tr> : companies.length === 0 ? <tr><td colSpan="7" className="px-3 py-8 text-center text-[#5d6d68]">No companies match the selected filters.</td></tr> : companies.map((company) => (
                <tr key={company.company_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3 font-mono text-xs font-semibold">{company.company_code}</td><td className="px-3 py-3"><div className="font-semibold">{company.company_name}</div>{company.legal_name && <div className="mt-1 text-xs text-[#6f7d78]">{company.legal_name}</div>}</td><td className="px-3 py-3">{company.industry_type || '—'}</td><td className="px-3 py-3"><div>{company.primary_phone || '—'}</div>{company.primary_email && <div className="mt-1 text-xs text-[#6f7d78]">{company.primary_email}</div>}</td><td className="px-3 py-3">{company.timezone || 'UTC'}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${company.is_deleted ? 'bg-red-50 text-red-700' : company.status === 'Active' ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{company.is_deleted ? 'Deleted' : company.status}</span></td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2">{company.is_deleted ? <button type="button" disabled={saving} onClick={() => restoreCompany(company)} className="rounded-lg border border-[#0f8b3d] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#eafaf0] disabled:opacity-50">Restore</button> : <><button type="button" disabled={saving} onClick={() => openEditForm(company)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteCompany(company)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]"><span>{totalCount} compan{totalCount === 1 ? 'y' : 'ies'}</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button></div></div>
      </div>

      {isEditorOpen && <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#15231f]/45 p-4 md:items-center"><form onSubmit={saveCompany} className="my-4 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-[#1f2d2a]">{form.company_id ? `Edit ${form.company_name || form.company_code}` : 'Add company'}</h3><p className="mt-1 text-sm text-[#5d6d68]">Company code and company name must be unique.</p></div><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-lg p-2 text-xl text-[#5d6d68] hover:bg-[#f1f5f2]" aria-label="Close company editor">×</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[#374744]">Company code<input required maxLength="20" value={form.company_code} onChange={(event) => updateForm('company_code', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Company name<input required maxLength="100" value={form.company_name} onChange={(event) => updateForm('company_name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Legal name<input maxLength="200" value={form.legal_name} onChange={(event) => updateForm('legal_name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Registration number<input maxLength="50" value={form.registration_number} onChange={(event) => updateForm('registration_number', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Industry type<input required maxLength="50" value={form.industry_type} onChange={(event) => updateForm('industry_type', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Status<select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 font-normal outline-none focus:border-[#0f8b3d]"><option>Active</option><option>Inactive</option></select></label>
          <label className="text-sm font-semibold text-[#374744]">Primary phone<input maxLength="20" value={form.primary_phone} onChange={(event) => updateForm('primary_phone', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Primary email<input type="email" maxLength="100" value={form.primary_email} onChange={(event) => updateForm('primary_email', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Website<input type="url" maxLength="200" value={form.website} onChange={(event) => updateForm('website', event.target.value)} placeholder="https://example.com" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Timezone<input required maxLength="50" value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} placeholder="UTC" className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Date format<input required maxLength="20" value={form.date_format} onChange={(event) => updateForm('date_format', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
          <label className="text-sm font-semibold text-[#374744]">Number format<input required maxLength="20" value={form.number_format} onChange={(event) => updateForm('number_format', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-normal outline-none focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#dfeee1]" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsEditorOpen(false)} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.company_id ? 'Save company changes' : 'Save company'}</button></div>
      </form></div>}
    </div>
  );
}
