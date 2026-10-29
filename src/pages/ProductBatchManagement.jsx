import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const BATCH_STATUSES = ['Active', 'Depleted', 'Expired', 'Quarantined', 'Recalled', 'On Hold'];

const emptyForm = {
  batch_id: '',
  product_id: '',
  supplier_id: '',
  batch_number: '',
  manufacturer_batch_no: '',
  manufacture_date: '',
  expiry_date: '',
  quantity_received: '',
  unit_cost: '',
  receiving_document: '',
  batch_status: 'Active',
  is_active: true,
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function toBool(value, defaultValue = false) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return defaultValue;
}

function toForm(row) {
  return {
    ...emptyForm,
    batch_id: row.batch_id || '',
    product_id: row.product_id || '',
    supplier_id: row.supplier_id || '',
    batch_number: row.batch_number || '',
    manufacturer_batch_no: row.manufacturer_batch_no || '',
    manufacture_date: toDateInput(row.manufacture_date),
    expiry_date: toDateInput(row.expiry_date),
    quantity_received: row.quantity_received ?? '',
    unit_cost: row.unit_cost ?? '',
    receiving_document: row.receiving_document || '',
    batch_status: row.batch_status || 'Active',
    is_active: toBool(row.is_active, true),
  };
}

function validateForm(form, isEditing = false) {
  if (!form.product_id) return 'Product is required.';
  if (!form.batch_number.trim()) return 'Batch number is required.';
  if (!isEditing && (form.quantity_received === '' || Number(form.quantity_received) <= 0)) return 'Quantity received must be greater than zero.';
  if (isEditing && form.quantity_received !== '' && Number(form.quantity_received) <= 0) return 'Quantity received must be greater than zero.';
  if (form.unit_cost !== '' && Number(form.unit_cost) < 0) return 'Unit cost cannot be negative.';
  if (form.expiry_date && form.manufacture_date && form.expiry_date < form.manufacture_date) {
    return 'Expiry date cannot be before manufacture date.';
  }
  if (!BATCH_STATUSES.includes(form.batch_status)) return 'Invalid batch status.';
  return '';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString();
}

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
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

export default function ProductBatchManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
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
    productId: '',
    supplierId: '',
    batchStatus: '',
    inStockOnly: false,
    expiringWithinDays: '',
  });

  const productOptions = useMemo(
    () => products.filter((row) => !filters.companyId || row.company_id === filters.companyId),
    [products, filters.companyId],
  );

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.companyId) params.set('company_id', filters.companyId);
      if (filters.productId) params.set('product_id', filters.productId);
      if (filters.supplierId) params.set('supplier_id', filters.supplierId);
      if (filters.batchStatus) params.set('batch_status', filters.batchStatus);
      if (filters.inStockOnly) params.set('in_stock_only', '1');
      if (filters.expiringWithinDays) params.set('expiring_within_days', filters.expiringWithinDays);
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, productPayload, supplierPayload, companyPayload] = await Promise.all([
        apiRequest(`/product-batch?${params.toString()}`, currentUser.accessToken),
        apiRequest('/product-batch/meta/products', currentUser.accessToken),
        apiRequest('/product-batch/meta/suppliers', currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
      ]);

      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setProducts(Array.isArray(productPayload.data) ? productPayload.data : []);
      setSuppliers(Array.isArray(supplierPayload.data) ? supplierPayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
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
      const isEditing = Boolean(form.batch_id);
      const validationError = validateForm(form, isEditing);
      if (validationError) throw new Error(validationError);
      const payload = {
        product_id: form.product_id,
        supplier_id: form.supplier_id || null,
        batch_number: form.batch_number.trim(),
        manufacturer_batch_no: form.manufacturer_batch_no.trim() || null,
        manufacture_date: form.manufacture_date || null,
        expiry_date: form.expiry_date || null,
        quantity_received: numberOrNull(form.quantity_received),
        unit_cost: numberOrNull(form.unit_cost),
        receiving_document: form.receiving_document.trim() || null,
        batch_status: form.batch_status,
        is_active: Boolean(form.is_active),
        user_id: currentUser.user_id || null,
      };
      if (isEditing) delete payload.product_id;
      if (isEditing) delete payload.batch_number;

      await apiRequest(isEditing ? `/product-batch/${form.batch_id}` : '/product-batch', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Product batch updated successfully.' : 'Product batch created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete batch ${row.batch_number}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product-batch/${row.batch_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Deleted from production batch form' }),
      });
      if (form.batch_id === row.batch_id) clearEditor();
      setMessage('Product batch deleted successfully.');
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
      await apiRequest(`/product-batch/${row.batch_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Product batch restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete batch ${row.batch_number}? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/product-batch/${row.batch_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.batch_id === row.batch_id) clearEditor();
      setMessage('Product batch permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Production Batch Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Manage product inventory batches and traceability records.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Product</span><select required value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))} disabled={Boolean(form.batch_id)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]"><option value="">Select product</option>{products.map((row) => <option key={row.product_id} value={row.product_id}>{row.product_code} - {row.product_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Batch number</span><input required value={form.batch_number} disabled={Boolean(form.batch_id)} onChange={(event) => setForm((current) => ({ ...current, batch_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Supplier</span><select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select supplier</option>{suppliers.map((row) => <option key={row.supplier_id} value={row.supplier_id}>{row.supplier_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Manufacturer batch no</span><input value={form.manufacturer_batch_no} onChange={(event) => setForm((current) => ({ ...current, manufacturer_batch_no: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Manufacture date</span><input type="date" value={form.manufacture_date} onChange={(event) => setForm((current) => ({ ...current, manufacture_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Expiry date</span><input type="date" value={form.expiry_date} onChange={(event) => setForm((current) => ({ ...current, expiry_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quantity received</span><input min="0" step="0.0001" type="number" required={!form.batch_id} disabled={Boolean(form.batch_id)} value={form.quantity_received} onChange={(event) => setForm((current) => ({ ...current, quantity_received: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Unit cost</span><input min="0" step="0.0001" type="number" value={form.unit_cost} onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Receiving document</span><input value={form.receiving_document} onChange={(event) => setForm((current) => ({ ...current, receiving_document: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Batch status</span><select value={form.batch_status} onChange={(event) => setForm((current) => ({ ...current, batch_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{BATCH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Active</span></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.batch_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save batch'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search batch, product..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <select value={filters.companyId} onChange={(event) => { updateFilter('companyId', event.target.value); updateFilter('productId', ''); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All companies</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>
          <select value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All products</option>{productOptions.map((row) => <option key={row.product_id} value={row.product_id}>{row.product_code} - {row.product_name}</option>)}</select>
          <select value={filters.supplierId} onChange={(event) => updateFilter('supplierId', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All suppliers</option>{suppliers.map((row) => <option key={row.supplier_id} value={row.supplier_id}>{row.supplier_name}</option>)}</select>
          <select value={filters.batchStatus} onChange={(event) => updateFilter('batchStatus', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All statuses</option>{BATCH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <input min="1" type="number" value={filters.expiringWithinDays} onChange={(event) => updateFilter('expiringWithinDays', event.target.value)} placeholder="Expiring in days" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <label className="flex items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm font-medium text-[#374744]"><input type="checkbox" checked={filters.inStockOnly} onChange={(event) => updateFilter('inStockOnly', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />In-stock only</label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Production Batches</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Supplier</th>
                <th className="px-2 py-2">Expiry</th>
                <th className="px-2 py-2">Days</th>
                <th className="px-2 py-2">Qty Remaining</th>
                <th className="px-2 py-2">Unit Cost</th>
                <th className="px-2 py-2">Value</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="10" className="px-2 py-6 text-center text-[#5d6d68]">Loading production batches...</td></tr> : rows.length === 0 ? <tr><td colSpan="10" className="px-2 py-6 text-center text-[#5d6d68]">No production batches found.</td></tr> : rows.map((row) => {
                const isDeleted = toBool(row.is_deleted, false);
                const isActive = toBool(row.is_active, true);
                return (
                  <tr key={row.batch_id} className={`border-b border-[#f0f3f1] ${isDeleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.product_code} - {row.product_name}</td>
                    <td className="px-2 py-2">{row.batch_number}</td>
                    <td className="px-2 py-2">{row.supplier_name || '-'}</td>
                    <td className="px-2 py-2">{formatDate(row.expiry_date)}</td>
                    <td className="px-2 py-2">{row.days_to_expiry ?? '-'}</td>
                    <td className="px-2 py-2">{formatNumber(row.quantity_remaining)}</td>
                    <td className="px-2 py-2">{formatNumber(row.unit_cost)}</td>
                    <td className="px-2 py-2">{formatNumber(row.current_value)}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${isDeleted ? 'bg-red-50 text-red-700' : isActive ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{isDeleted ? 'Deleted' : row.batch_status || (isActive ? 'Active' : 'Inactive')}</span></td>
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
