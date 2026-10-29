import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  consumption_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  consumption_date: '',
  age_days: '',
  quantity_consumed_liters: '',
  water_source: '',
  water_treatment: '',
  water_quality_test_result: '',
  drinking_system: '',
  cleaning_frequency: '',
  number_of_drinkers: '',
  temperature_celsius: '',
  ph_level: '',
  pressure_level: '',
  remarks: '',
  row_version: '',
};

const emptyLookups = {
  water_sources: [],
  water_treatments: [],
  water_quality_test_results: [],
  drinking_systems: [],
  cleaning_frequencies: [],
};

// Fields pre-filled from the most recent reading of the same flock and house.
const CARRY_OVER_FIELDS = ['water_source', 'water_treatment', 'water_quality_test_result', 'drinking_system', 'number_of_drinkers', 'cleaning_frequency'];

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function todayLocalIsoDate() {
  const date = new Date();
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

function updateDerived(currentForm, nextFields, flocks) {
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
  return updateDerived(emptyForm, {
    consumption_id: row.consumption_id || '',
    flock_id: row.flock_id || '',
    consumption_date: toDateInput(row.consumption_date),
    quantity_consumed_liters: row.quantity_consumed_liters ?? '',
    water_source: row.water_source || '',
    water_treatment: row.water_treatment || '',
    water_quality_test_result: row.water_quality_test_result || '',
    drinking_system: row.drinking_system || '',
    cleaning_frequency: row.cleaning_frequency || '',
    number_of_drinkers: row.number_of_drinkers ?? '',
    temperature_celsius: row.temperature_celsius ?? '',
    ph_level: row.ph_level ?? '',
    pressure_level: row.pressure_level ?? '',
    remarks: row.remarks || '',
    row_version: row.row_version || '',
  }, flocks);
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function validateForm(form, flocks) {
  const selectedFlock = flocks.find((row) => row.flock_id === form.flock_id);
  if (!selectedFlock?.hatch_date) return 'Selected flock is missing hatch date; age cannot be calculated.';
  if (!form.age_days) return 'Age days must be calculated from hatch date and consumption date.';
  if (form.consumption_date > todayLocalIsoDate()) return 'Consumption date cannot be in the future.';
  if (Number(form.quantity_consumed_liters) < 0) return 'Water consumed must be zero or more.';
  if (form.ph_level !== '' && (Number(form.ph_level) < 0 || Number(form.ph_level) > 14)) return 'pH level must be between 0 and 14.';
  if (form.number_of_drinkers !== '' && Number(form.number_of_drinkers) < 0) return 'Number of drinkers must be zero or more.';
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

const inputClass = 'h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]';
const selectClass = 'h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]';
const readOnlyClass = 'h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none';

function LookupSelect({ label, value, options, placeholder, onChange }) {
  const hasUnknownValue = value && !options.some((option) => option.label === value);
  return (
    <label className="text-sm font-medium text-[#374744]">
      <span className="mb-1 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">{placeholder}</option>
        {hasUnknownValue && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option.code} value={option.label}>{option.code} - {option.label}</option>)}
      </select>
    </label>
  );
}

export default function WaterConsumptionManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [lookups, setLookups] = useState(emptyLookups);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isEditing = Boolean(form.consumption_id);
  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const flockById = useMemo(() => new Map(flocks.map((row) => [row.flock_id, row])), [flocks]);
  const houseById = useMemo(() => new Map(houses.map((row) => [row.house_id, row])), [houses]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [consumptionPayload, flockPayload, farmPayload, housePayload, lookupPayload] = await Promise.all([
        apiRequest(`/water/consumptions?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/water/consumptions/lookups', currentUser.accessToken),
      ]);
      setRows(Array.isArray(consumptionPayload.data) ? consumptionPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setLookups({ ...emptyLookups, ...(lookupPayload.data || {}) });
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // Loads an existing reading for the flock/date for editing, or pre-fills the carry-over fields.
  async function applyFormInit(nextForm) {
    try {
      const params = new URLSearchParams({ flock_id: nextForm.flock_id, house_id: nextForm.house_id, for_date: nextForm.consumption_date });
      const payload = await apiRequest(`/water/consumptions/form-init?${params}`, currentUser.accessToken);
      const initRow = payload.data;
      if (!initRow) return;
      if (initRow.is_existing) {
        setForm((current) => (current.flock_id === nextForm.flock_id && current.consumption_date === nextForm.consumption_date ? toForm(initRow, flocks) : current));
        setMessage('A reading already exists for this flock, house and date. You are editing it.');
        return;
      }
      setForm((current) => {
        if (current.flock_id !== nextForm.flock_id || current.consumption_date !== nextForm.consumption_date || current.consumption_id) return current;
        const filled = { ...current };
        CARRY_OVER_FIELDS.forEach((field) => {
          if (filled[field] === '' && initRow[field] !== null && initRow[field] !== undefined) filled[field] = initRow[field];
        });
        return filled;
      });
    } catch {
      // Pre-fill is a convenience only; saving still validates everything.
    }
  }

  function handleKeyFieldChange(fields) {
    const nextForm = updateDerived(form, fields, flocks);
    setForm(nextForm);
    setError('');
    setMessage('');
    if (!isEditing && nextForm.flock_id && nextForm.house_id && nextForm.consumption_date) applyFormInit(nextForm);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const validationError = validateForm(form, flocks);
      if (validationError) {
        setError(validationError);
        return;
      }
      await apiRequest(isEditing ? `/water/consumptions/${form.consumption_id}` : '/water/consumptions', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          flock_id: form.flock_id,
          farm_id: form.farm_id,
          house_id: form.house_id,
          consumption_date: form.consumption_date,
          age_days: Number(form.age_days),
          quantity_consumed_liters: Number(form.quantity_consumed_liters),
          water_source: form.water_source || null,
          water_treatment: form.water_treatment || null,
          water_quality_test_result: form.water_quality_test_result || null,
          drinking_system: form.drinking_system || null,
          cleaning_frequency: form.cleaning_frequency || null,
          number_of_drinkers: numberOrNull(form.number_of_drinkers),
          temperature_celsius: numberOrNull(form.temperature_celsius),
          ph_level: numberOrNull(form.ph_level),
          pressure_level: numberOrNull(form.pressure_level),
          remarks: form.remarks.trim() || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null, row_version: form.row_version || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Water consumption updated successfully.' : 'Water consumption created successfully.');
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
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete water consumption dated ${toDateInput(row.consumption_date)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/water/consumptions/${row.consumption_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.consumption_id === row.consumption_id) setForm(emptyForm);
      setMessage('Water consumption deleted successfully.');
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
      await apiRequest(`/water/consumptions/${row.consumption_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Water consumption restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Water Consumption Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Capture and maintain daily water consumption readings per flock and house.</p>
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => handleKeyFieldChange({ flock_id: event.target.value })} className={selectClass}><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled value={form.farm_id} className={readOnlyClass}><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled value={form.house_id} className={readOnlyClass}><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Consumption date</span><input required type="date" max={todayLocalIsoDate()} value={form.consumption_date} onChange={(event) => handleKeyFieldChange({ consumption_date: event.target.value })} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age (days)</span><input required readOnly type="number" value={form.age_days} className={readOnlyClass} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Water consumed (liters)</span><input required min="0" step="0.01" type="number" value={form.quantity_consumed_liters} onChange={(event) => updateField('quantity_consumed_liters', event.target.value)} className={inputClass} /></label>
          <LookupSelect label="Water source" value={form.water_source} options={lookups.water_sources} placeholder="Select water source" onChange={(value) => updateField('water_source', value)} />
          <LookupSelect label="Water treatment" value={form.water_treatment} options={lookups.water_treatments} placeholder="Select treatment" onChange={(value) => updateField('water_treatment', value)} />
          <LookupSelect label="Water quality test result" value={form.water_quality_test_result} options={lookups.water_quality_test_results} placeholder="Select test result" onChange={(value) => updateField('water_quality_test_result', value)} />
          <LookupSelect label="Drinking system" value={form.drinking_system} options={lookups.drinking_systems} placeholder="Select drinking system" onChange={(value) => updateField('drinking_system', value)} />
          <LookupSelect label="Cleaning frequency" value={form.cleaning_frequency} options={lookups.cleaning_frequencies} placeholder="Select frequency" onChange={(value) => updateField('cleaning_frequency', value)} />
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Number of drinkers</span><input min="0" step="1" type="number" value={form.number_of_drinkers} onChange={(event) => updateField('number_of_drinkers', event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Temperature (°C)</span><input step="0.01" type="number" value={form.temperature_celsius} onChange={(event) => updateField('temperature_celsius', event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">pH level</span><input min="0" max="14" step="0.01" type="number" value={form.ph_level} onChange={(event) => updateField('ph_level', event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Pressure level</span><input min="0" step="0.01" type="number" value={form.pressure_level} onChange={(event) => updateField('pressure_level', event.target.value)} className={inputClass} /></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <div className="mt-4 flex justify-end gap-2">
          {isEditing && <button type="button" onClick={() => { setForm(emptyForm); setMessage(''); }} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditing ? 'Save consumption' : 'Save consumption record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Water Consumption Records</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Flock</th><th className="px-2 py-2">House</th><th className="px-2 py-2">Age</th><th className="px-2 py-2">Liters</th><th className="px-2 py-2">Source</th><th className="px-2 py-2">pH</th><th className="px-2 py-2">Drinkers</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="10" className="px-2 py-6 text-center text-[#5d6d68]">Loading consumption records...</td></tr> : rows.length === 0 ? <tr><td colSpan="10" className="px-2 py-6 text-center text-[#5d6d68]">No water consumption records found.</td></tr> : rows.map((row) => (
                <tr key={row.consumption_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{toDateInput(row.consumption_date)}</td>
                  <td className="px-2 py-2">{flockById.get(row.flock_id)?.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{houseById.get(row.house_id)?.house_code || row.house_id}</td>
                  <td className="px-2 py-2">{row.age_days ?? '—'}</td>
                  <td className="px-2 py-2">{row.quantity_consumed_liters ?? 0}</td>
                  <td className="px-2 py-2">{row.water_source || '—'}</td>
                  <td className="px-2 py-2">{row.ph_level ?? '—'}</td>
                  <td className="px-2 py-2">{row.number_of_drinkers ?? '—'}</td>
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
