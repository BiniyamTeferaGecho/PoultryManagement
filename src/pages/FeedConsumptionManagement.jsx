import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  consumption_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  feed_type_id: '',
  consumption_date: '',
  feed_batch_number: '',
  supplier_id: '',
  quantity_consumed_kg: '',
  quantity_offered_kg: '',
  wastage_kg: '0',
  number_of_feeds: '1',
  feeding_method: '',
  feed_cost: '',
  cost_per_kg: '',
  age_days: '',
  remarks: '',
  row_version: '',
};

// Fields pre-filled from the most recent reading of the same flock and house.
const CARRY_OVER_FIELDS = ['feed_type_id', 'feed_batch_number', 'supplier_id', 'number_of_feeds', 'feeding_method', 'cost_per_kg'];

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function todayLocalIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysAgoLocalIsoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateAgeDays(hatchDateValue, consumptionDateValue) {
  if (!hatchDateValue || !consumptionDateValue) return '';
  const hatchDate = new Date(hatchDateValue);
  const consumptionDate = new Date(consumptionDateValue);
  if (Number.isNaN(hatchDate.getTime()) || Number.isNaN(consumptionDate.getTime())) return '';
  const diffDays = Math.floor((consumptionDate.getTime() - hatchDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? String(diffDays) : '';
}

function updateDerivedAge(currentForm, nextFields, flocks) {
  const nextForm = { ...currentForm, ...nextFields };
  const selectedFlock = flocks.find((row) => row.flock_id === nextForm.flock_id);
  return {
    ...nextForm,
    farm_id: selectedFlock?.farm_id || '',
    house_id: selectedFlock?.house_id || '',
    age_days: calculateAgeDays(selectedFlock?.hatch_date, nextForm.consumption_date),
  };
}

function toForm(row, flocks) {
  return updateDerivedAge(emptyForm, {
    consumption_id: row.consumption_id || '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    feed_type_id: row.feed_type_id || '',
    consumption_date: toDateInput(row.consumption_date),
    feed_batch_number: row.feed_batch_number || '',
    supplier_id: row.supplier_id || '',
    quantity_consumed_kg: row.quantity_consumed_kg ?? '',
    quantity_offered_kg: row.quantity_offered_kg ?? '',
    wastage_kg: row.wastage_kg ?? 0,
    number_of_feeds: row.number_of_feeds ?? 1,
    feeding_method: row.feeding_method || '',
    feed_cost: row.feed_cost ?? '',
    cost_per_kg: row.cost_per_kg ?? '',
    age_days: row.age_days ?? '',
    remarks: row.remarks || '',
    row_version: row.row_version || '',
  }, flocks);
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function validateForm(form, flocks) {
  const selectedFlock = flocks.find((row) => row.flock_id === form.flock_id);
  if (form.consumption_date > todayLocalIsoDate()) return { field: 'consumption_date', message: 'Consumption date cannot be in the future.' };
  if (!selectedFlock?.hatch_date) return { field: 'flock_id', message: 'Selected flock is missing hatch date; age cannot be calculated.' };
  if (!form.age_days) return { field: 'age_days', message: 'Age days must be calculated from hatch date and consumption date.' };
  if (Number(form.quantity_consumed_kg) < 0) return { field: 'quantity_consumed_kg', message: 'Consumed quantity must be zero or more.' };
  if (form.number_of_feeds && Number(form.number_of_feeds) <= 0) return { field: 'number_of_feeds', message: 'Number of feeds must be greater than zero.' };
  return null;
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

export default function FeedConsumptionManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [fromDate, setFromDate] = useState(() => daysAgoLocalIsoDate(30));
  const [toDate, setToDate] = useState(() => todayLocalIsoDate());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState(null);

  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const flockById = useMemo(() => new Map(flocks.map((row) => [row.flock_id, row])), [flocks]);
  const feedTypeById = useMemo(() => new Map(feedTypes.map((row) => [row.feed_type_id, row])), [feedTypes]);
  const supplierById = useMemo(() => new Map(suppliers.map((row) => [row.supplier_id, row])), [suppliers]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [consumptionPayload, flockPayload, farmPayload, housePayload, feedTypePayload, supplierPayload] = await Promise.all([
        apiRequest(`/feed/consumptions?from_date=${fromDate}&to_date=${toDate}&page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/feed/types?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/feed/suppliers', currentUser.accessToken),
      ]);
      setRows(Array.isArray(consumptionPayload.data) ? consumptionPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setFeedTypes(Array.isArray(feedTypePayload.data) ? feedTypePayload.data : []);
      setSuppliers(Array.isArray(supplierPayload.data) ? supplierPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted, fromDate, toDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Loads an existing reading for the flock/date for editing, or pre-fills the carry-over fields.
  async function applyFormInit(nextForm) {
    try {
      const params = new URLSearchParams({ flock_id: nextForm.flock_id, house_id: nextForm.house_id, for_date: nextForm.consumption_date });
      const payload = await apiRequest(`/feed/consumptions/form-init?${params}`, currentUser.accessToken);
      const initRow = payload.data;
      if (!initRow) return;
      const isSameSelection = (current) => current.flock_id === nextForm.flock_id && current.consumption_date === nextForm.consumption_date;
      if (initRow.is_existing) {
        setForm((current) => (isSameSelection(current) ? toForm(initRow, flocks) : current));
        setMessage('A reading already exists for this flock, house and date. You are editing it.');
        return;
      }
      setForm((current) => {
        if (!isSameSelection(current) || current.consumption_id) return current;
        const filled = { ...current };
        CARRY_OVER_FIELDS.forEach((field) => {
          const isEmpty = filled[field] === '' || (field === 'number_of_feeds' && filled[field] === '1');
          if (isEmpty && initRow[field] !== null && initRow[field] !== undefined) filled[field] = initRow[field];
        });
        return filled;
      });
    } catch {
      // Pre-fill is a convenience only; saving still validates everything.
    }
  }

  function handleKeyFieldChange(fields) {
    const nextForm = updateDerivedAge(form, fields, flocks);
    setFieldError(null);
    setError('');
    setMessage('');
    setForm(nextForm);
    if (!form.consumption_id && nextForm.flock_id && nextForm.house_id && nextForm.consumption_date) applyFormInit(nextForm);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);
    try {
      const validationError = validateForm(form, flocks);
      if (validationError) {
        setFieldError(validationError);
        return;
      }
      const isEditing = Boolean(form.consumption_id);
      await apiRequest(isEditing ? `/feed/consumptions/${form.consumption_id}` : '/feed/consumptions', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          feed_type_id: form.feed_type_id || null,
          supplier_id: form.supplier_id || null,
          feed_batch_number: form.feed_batch_number.trim() || null,
          quantity_consumed_kg: Number(form.quantity_consumed_kg),
          quantity_offered_kg: numberOrNull(form.quantity_offered_kg),
          wastage_kg: numberOrNull(form.wastage_kg) ?? 0,
          number_of_feeds: Number(form.number_of_feeds || 1),
          feeding_method: form.feeding_method.trim() || null,
          feed_cost: numberOrNull(form.feed_cost),
          cost_per_kg: numberOrNull(form.cost_per_kg),
          age_days: Number(form.age_days),
          remarks: form.remarks || null,
          ...(isEditing ? { modified_by: currentUser.user_id || null } : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Feed consumption updated successfully.' : 'Feed consumption created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function editRow(row) {
    setForm(toForm(row, flocks));
    setError('');
    setMessage('');
    setFieldError(null);
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete feed consumption dated ${toDateInput(row.consumption_date)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/feed/consumptions/${row.consumption_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.consumption_id === row.consumption_id) setForm(emptyForm);
      setMessage('Feed consumption deleted successfully.');
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
      await apiRequest(`/feed/consumptions/${row.consumption_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Feed consumption restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Feed Consumption Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Capture and maintain daily feed consumption entries.</p>
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
      {(fieldError || error) && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{fieldError?.message || error}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => handleKeyFieldChange({ flock_id: event.target.value })} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Consumption date</span><input required type="date" max={todayLocalIsoDate()} value={form.consumption_date} onChange={(event) => handleKeyFieldChange({ consumption_date: event.target.value })} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age (days)</span><input required readOnly type="number" value={form.age_days} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed type</span><select value={form.feed_type_id} onChange={(event) => setForm((current) => ({ ...current, feed_type_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select feed type</option>{feedTypes.map((row) => <option key={row.feed_type_id} value={row.feed_type_id}>{row.feed_code} - {row.feed_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Supplier</span><select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select supplier</option>{suppliers.map((row) => <option key={row.supplier_id} value={row.supplier_id}>{row.supplier_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed Batch Number</span><input value={form.feed_batch_number} onChange={(event) => setForm((current) => ({ ...current, feed_batch_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Consumed (kg)</span><input required min="0" step="0.01" type="number" value={form.quantity_consumed_kg} onChange={(event) => setForm((current) => ({ ...current, quantity_consumed_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Offered (kg)</span><input min="0" step="0.01" type="number" value={form.quantity_offered_kg} onChange={(event) => setForm((current) => ({ ...current, quantity_offered_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Wastage (kg)</span><input min="0" step="0.01" type="number" value={form.wastage_kg} onChange={(event) => setForm((current) => ({ ...current, wastage_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feeds/day</span><input min="1" type="number" value={form.number_of_feeds} onChange={(event) => setForm((current) => ({ ...current, number_of_feeds: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feeding method</span><input value={form.feeding_method} onChange={(event) => setForm((current) => ({ ...current, feeding_method: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed cost</span><input min="0" step="0.01" type="number" value={form.feed_cost} onChange={(event) => setForm((current) => ({ ...current, feed_cost: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Cost per kg</span><input min="0" step="0.01" type="number" value={form.cost_per_kg} onChange={(event) => setForm((current) => ({ ...current, cost_per_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <div className="mt-4 flex justify-end gap-2">
          {form.consumption_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.consumption_id ? 'Save consumption' : 'Save consumption record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Feed Consumption Records</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[#374744]">
            <label className="flex items-center gap-2">From<input type="date" max={toDate} value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 rounded-lg border border-[#dfe8e1] px-2 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            <label className="flex items-center gap-2">To<input type="date" min={fromDate} value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 rounded-lg border border-[#dfe8e1] px-2 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
              Include deleted
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Flock</th><th className="px-2 py-2">Feed type</th><th className="px-2 py-2">Consumed kg</th><th className="px-2 py-2">Offered kg</th><th className="px-2 py-2">Supplier</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading consumption records...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No feed consumption records found.</td></tr> : rows.map((row) => (
                <tr key={row.consumption_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{toDateInput(row.consumption_date)}</td>
                  <td className="px-2 py-2">{flockById.get(row.flock_id)?.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{feedTypeById.get(row.feed_type_id)?.feed_name || '—'}</td>
                  <td className="px-2 py-2">{row.quantity_consumed_kg ?? 0}</td>
                  <td className="px-2 py-2">{row.quantity_offered_kg ?? '—'}</td>
                  <td className="px-2 py-2">{supplierById.get(row.supplier_id)?.supplier_name || '—'}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : 'bg-[#eafaf0] text-[#198754]'}`}>{row.is_deleted ? 'Deleted' : 'Active'}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" onClick={() => editRow(row)} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
                      {!row.is_deleted && <button type="button" onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                      {row.is_deleted && <button type="button" onClick={() => restoreRow(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                    </div>
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
