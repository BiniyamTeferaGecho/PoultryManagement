import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  product_id: '',
  company_id: '',
  category_id: '',
  product_code: '',
  product_name: '',
  product_type: '',
  unit_of_measure: '',
  default_unit_cost: '',
  is_serialized: false,
  requires_batch_tracking: true,
  minimum_stock_quantity: '',
  reorder_quantity: '',
  shelf_life_days: '',
  is_active: true,
};

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function toForm(row) {
  return {
    ...emptyForm,
    product_id: row.product_id || '',
    company_id: row.company_id || '',
    category_id: row.category_id || '',
    product_code: row.product_code || '',
    product_name: row.product_name || '',
    product_type: row.product_type || '',
    unit_of_measure: row.unit_of_measure || '',
    default_unit_cost: row.default_unit_cost ?? '',
    is_serialized: row.is_serialized === true || row.is_serialized === 1,
    requires_batch_tracking: row.requires_batch_tracking === true || row.requires_batch_tracking === 1,
    minimum_stock_quantity: row.minimum_stock_quantity ?? '',
    reorder_quantity: row.reorder_quantity ?? '',
    shelf_life_days: row.shelf_life_days ?? '',
    is_active: row.is_active === true || row.is_active === 1,
  };
}

function validateForm(form) {
  if (!form.company_id) return 'Company is required.';
  if (!form.category_id) return 'Category is required.';
  if (!form.product_code.trim()) return 'Product code is required.';
  if (!form.product_name.trim()) return 'Product name is required.';
  if (!form.product_type.trim()) return 'Product type is required.';
  if (!form.unit_of_measure.trim()) return 'Unit of measure is required.';
  if (form.default_unit_cost !== '' && Number(form.default_unit_cost) < 0) return 'Default unit cost cannot be negative.';
  if (form.minimum_stock_quantity !== '' && Number(form.minimum_stock_quantity) < 0) return 'Minimum stock quantity cannot be negative.';
  if (form.reorder_quantity !== '' && Number(form.reorder_quantity) < 0) return 'Reorder quantity cannot be negative.';
  if (form.shelf_life_days !== '' && Number(form.shelf_life_days) < 0) return 'Shelf life days cannot be negative.';
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

export default function ProductManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
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
    categoryId: '',
    productType: '',
    isActive: 'all',
    requiresBatchTracking: 'all',
    lowStockOnly: false,
  });

  const categoryOptions = useMemo(
    () => categories.filter((row) => !form.company_id || row.company_id === form.company_id),
    [categories, form.company_id],
  );

  const filterCategoryOptions = useMemo(
    () => categories.filter((row) => !filters.companyId || row.company_id === filters.companyId),
    [categories, filters.companyId],
  );

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.companyId) params.set('company_id', filters.companyId);
      if (filters.categoryId) params.set('category_id', filters.categoryId);
      if (filters.productType) params.set('product_type', filters.productType.trim());
      if (filters.isActive !== 'all') params.set('is_active', filters.isActive === 'yes' ? '1' : '0');
      if (filters.requiresBatchTracking !== 'all') params.set('requires_batch_tracking', filters.requiresBatchTracking === 'yes' ? '1' : '0');
      if (filters.lowStockOnly) params.set('low_stock_only', '1');
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, companyPayload, categoryPayload] = await Promise.all([
        apiRequest(`/product?${params.toString()}`, currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/product/categories', currentUser.accessToken),
      ]);

      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setCategories(Array.isArray(categoryPayload.data) ? categoryPayload.data : []);
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
      const isEditing = Boolean(form.product_id);
      const payload = {
        company_id: form.company_id,
        category_id: form.category_id,
        product_code: form.product_code.trim(),
        product_name: form.product_name.trim(),
        product_type: form.product_type.trim(),
        unit_of_measure: form.unit_of_measure.trim(),
        default_unit_cost: numberOrNull(form.default_unit_cost),
        is_serialized: Boolean(form.is_serialized),
        requires_batch_tracking: Boolean(form.requires_batch_tracking),
        minimum_stock_quantity: numberOrNull(form.minimum_stock_quantity),
        reorder_quantity: numberOrNull(form.reorder_quantity),
        shelf_life_days: numberOrNull(form.shelf_life_days),
        is_active: Boolean(form.is_active),
        user_id: currentUser.user_id || null,
      };

      await apiRequest(isEditing ? `/product/${form.product_id}` : '/product', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Product updated successfully.' : 'Product created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete product ${row.product_code} - ${row.product_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product/${row.product_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Deleted from product form' }),
      });
      if (form.product_id === row.product_id) clearEditor();
      setMessage('Product deleted successfully.');
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
      await apiRequest(`/product/${row.product_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Product restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete ${row.product_code}? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product/${row.product_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.product_id === row.product_id) clearEditor();
      setMessage('Product permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Product Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Manage inventory product master records.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value, category_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Category</span><select required value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select category</option>{categoryOptions.map((row) => <option key={row.category_id} value={row.category_id}>{row.category_code} - {row.category_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Product code</span><input required value={form.product_code} onChange={(event) => setForm((current) => ({ ...current, product_code: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Product name</span><input required value={form.product_name} onChange={(event) => setForm((current) => ({ ...current, product_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Product type</span><input required value={form.product_type} onChange={(event) => setForm((current) => ({ ...current, product_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Unit of measure</span><input required value={form.unit_of_measure} onChange={(event) => setForm((current) => ({ ...current, unit_of_measure: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Default unit cost</span><input min="0" step="0.0001" type="number" value={form.default_unit_cost} onChange={(event) => setForm((current) => ({ ...current, default_unit_cost: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Min stock qty</span><input min="0" step="0.0001" type="number" value={form.minimum_stock_quantity} onChange={(event) => setForm((current) => ({ ...current, minimum_stock_quantity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Reorder qty</span><input min="0" step="0.0001" type="number" value={form.reorder_quantity} onChange={(event) => setForm((current) => ({ ...current, reorder_quantity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Shelf life days</span><input min="0" type="number" value={form.shelf_life_days} onChange={(event) => setForm((current) => ({ ...current, shelf_life_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.is_serialized} onChange={(event) => setForm((current) => ({ ...current, is_serialized: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Serialized</span></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.requires_batch_tracking} onChange={(event) => setForm((current) => ({ ...current, requires_batch_tracking: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Requires batch tracking</span></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Active</span></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.product_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.product_id ? 'Save product' : 'Save product'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search code or name..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <select value={filters.companyId} onChange={(event) => updateFilter('companyId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All companies</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>
          <select value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All categories</option>{filterCategoryOptions.map((row) => <option key={row.category_id} value={row.category_id}>{row.category_code} - {row.category_name}</option>)}</select>
          <input value={filters.productType} onChange={(event) => updateFilter('productType', event.target.value)} placeholder="Product type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.isActive} onChange={(event) => updateFilter('isActive', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All status</option><option value="yes">Active only</option><option value="no">Inactive only</option></select>
          <select value={filters.requiresBatchTracking} onChange={(event) => updateFilter('requiresBatchTracking', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All batch</option><option value="yes">Batch tracking</option><option value="no">No batch tracking</option></select>
          <label className="flex items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm font-medium text-[#374744]"><input type="checkbox" checked={filters.lowStockOnly} onChange={(event) => updateFilter('lowStockOnly', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Low stock only</label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Products</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">On Hand</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading products...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No products found.</td></tr> : rows.map((row) => (
                <tr key={row.product_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{row.product_code}</td>
                  <td className="px-2 py-2">{row.product_name}</td>
                  <td className="px-2 py-2">{row.company_name || '-'}</td>
                  <td className="px-2 py-2">{row.category_name || '-'}</td>
                  <td className="px-2 py-2">{row.product_type || '-'}</td>
                  <td className="px-2 py-2">{row.total_quantity_on_hand ?? 0}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : row.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{row.is_deleted ? 'Deleted' : row.is_active ? 'Active' : 'Inactive'}{row.is_low_stock ? ' • Low stock' : ''}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
                      {!row.is_deleted && <button type="button" onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                      {row.is_deleted && <button type="button" onClick={() => restoreRow(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                      {row.is_deleted && <button type="button" onClick={() => hardDeleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Hard Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
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
