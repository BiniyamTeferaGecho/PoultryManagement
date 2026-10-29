import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  category_id: '',
  company_id: '',
  category_code: '',
  category_name: '',
  parent_category_id: '',
  is_active: true,
};

function toBool(value, defaultValue = false) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return defaultValue;
}

function toForm(row) {
  return {
    ...emptyForm,
    category_id: row.category_id || '',
    company_id: row.company_id || '',
    category_code: row.category_code || '',
    category_name: row.category_name || '',
    parent_category_id: row.parent_category_id || '',
    is_active: toBool(row.is_active, true),
  };
}

function validateForm(form) {
  if (!form.company_id) return 'Company is required.';
  if (!form.category_code.trim()) return 'Category code is required.';
  if (!form.category_name.trim()) return 'Category name is required.';
  return '';
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

export default function ProductCategoryManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    searchText: '',
    companyId: '',
    parentCategoryId: '',
    rootOnly: false,
    isActive: 'all',
  });

  const filterParentOptions = useMemo(
    () => parentOptions.filter((row) => !filters.companyId || row.company_id === filters.companyId),
    [parentOptions, filters.companyId],
  );

  const formParentOptions = useMemo(
    () => parentOptions.filter((row) => row.company_id === form.company_id && row.category_id !== form.category_id),
    [parentOptions, form.company_id, form.category_id],
  );

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.companyId) params.set('company_id', filters.companyId);
      if (filters.parentCategoryId) params.set('parent_category_id', filters.parentCategoryId);
      if (filters.rootOnly) params.set('root_only', '1');
      if (filters.isActive !== 'all') params.set('is_active', filters.isActive === 'yes' ? '1' : '0');
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, companyPayload, parentPayload] = await Promise.all([
        apiRequest(`/product-category?${params.toString()}`, currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/product-category/meta/parents', currentUser.accessToken),
      ]);

      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setParentOptions(Array.isArray(parentPayload.data) ? parentPayload.data : []);
    } catch (requestError) {
      setRows([]);
      setTotalCount(0);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, includeDeleted, page]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function clearEditor() {
    setForm(emptyForm);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const validationError = validateForm(form);
      if (validationError) throw new Error(validationError);
      const isEditing = Boolean(form.category_id);
      const payload = {
        company_id: form.company_id,
        category_code: form.category_code.trim(),
        category_name: form.category_name.trim(),
        parent_category_id: form.parent_category_id || null,
        clear_parent: form.parent_category_id ? false : true,
        is_active: Boolean(form.is_active),
        user_id: currentUser.user_id || null,
      };
      if (isEditing) delete payload.company_id;

      await apiRequest(isEditing ? `/product-category/${form.category_id}` : '/product-category', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Product category updated successfully.' : 'Product category created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete category ${row.category_code} - ${row.category_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product-category/${row.category_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Deleted from production category form' }),
      });
      if (form.category_id === row.category_id) clearEditor();
      setMessage('Product category deleted successfully.');
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
      await apiRequest(`/product-category/${row.category_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Product category restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete ${row.category_code}? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product-category/${row.category_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.category_id === row.category_id) clearEditor();
      setMessage('Product category permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Production Category Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Manage product category hierarchy and category master records.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required value={form.company_id} disabled={Boolean(form.category_id)} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value, parent_category_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Category code</span><input required value={form.category_code} onChange={(event) => setForm((current) => ({ ...current, category_code: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Category name</span><input required value={form.category_name} onChange={(event) => setForm((current) => ({ ...current, category_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Parent category</span><select value={form.parent_category_id} onChange={(event) => setForm((current) => ({ ...current, parent_category_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">No parent (root)</option>{formParentOptions.map((row) => <option key={row.category_id} value={row.category_id}>{row.category_code} - {row.category_name}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Active</span></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.category_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save category'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search code or name..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <select value={filters.companyId} onChange={(event) => updateFilter('companyId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All companies</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>
          <select value={filters.parentCategoryId} onChange={(event) => updateFilter('parentCategoryId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All parent categories</option>{filterParentOptions.map((row) => <option key={row.category_id} value={row.category_id}>{row.category_code} - {row.category_name}</option>)}</select>
          <select value={filters.isActive} onChange={(event) => updateFilter('isActive', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All status</option><option value="yes">Active only</option><option value="no">Inactive only</option></select>
          <label className="flex items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm font-medium text-[#374744]"><input type="checkbox" checked={filters.rootOnly} onChange={(event) => updateFilter('rootOnly', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Root only</label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Production Categories</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Parent</th>
                <th className="px-2 py-2">Children</th>
                <th className="px-2 py-2">Products</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading categories...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No categories found.</td></tr> : rows.map((row) => {
                const isDeleted = toBool(row.is_deleted, false);
                const isActive = toBool(row.is_active, true);
                return (
                  <tr key={row.category_id} className={`border-b border-[#f0f3f1] ${isDeleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.category_code}</td>
                    <td className="px-2 py-2">{row.category_name}</td>
                    <td className="px-2 py-2">{row.company_name || '-'}</td>
                    <td className="px-2 py-2">{row.parent_category_name || '-'}</td>
                    <td className="px-2 py-2">{row.child_category_count ?? 0}</td>
                    <td className="px-2 py-2">{row.product_count ?? 0}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${isDeleted ? 'bg-red-50 text-red-700' : isActive ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{isDeleted ? 'Deleted' : isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {!isDeleted && <button type="button" onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
                        {!isDeleted && <button type="button" onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                        {isDeleted && <button type="button" onClick={() => restoreRow(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                        {isDeleted && <button type="button" onClick={() => hardDeleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Hard Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#44514d]">
          <span>Total: {totalCount.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
