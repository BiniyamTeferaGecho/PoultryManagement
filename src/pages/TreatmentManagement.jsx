import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const EFFECTIVENESS_OPTIONS = ['Effective', 'Partial', 'Ineffective', 'Unknown'];

const emptyForm = {
  treatment_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  treatment_date: '',
  medication_name: '',
  medication_type: '',
  medication_batch_number: '',
  dosage: '',
  dosage_unit: '',
  route_of_administration: '',
  duration_days: '',
  birds_treated_females: '0',
  birds_treated_males: '0',
  age_at_treatment_days: '',
  treating_veterinarian: '',
  disease_being_treated: '',
  treatment_effectiveness: '',
  withdrawal_period_days: '',
  withdrawal_end_date: '',
  remarks: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateAgeDays(hatchDateValue, treatmentDateValue) {
  if (!hatchDateValue || !treatmentDateValue) return '';
  const hatchDate = new Date(hatchDateValue);
  const treatmentDate = new Date(treatmentDateValue);
  if (Number.isNaN(hatchDate.getTime()) || Number.isNaN(treatmentDate.getTime())) return '';
  const diffDays = Math.floor((treatmentDate.getTime() - hatchDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? String(diffDays) : '';
}

function updateDerivedFields(currentForm, nextFields, flocks) {
  const nextForm = { ...currentForm, ...nextFields };
  const selectedFlock = flocks.find((row) => row.flock_id === nextForm.flock_id);
  return {
    ...nextForm,
    farm_id: selectedFlock?.farm_id || '',
    house_id: selectedFlock?.house_id || '',
    age_at_treatment_days: calculateAgeDays(selectedFlock?.hatch_date, nextForm.treatment_date),
  };
}

function toForm(row, flocks) {
  return updateDerivedFields(emptyForm, {
    treatment_id: row.treatment_id || '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    treatment_date: toDateInput(row.treatment_date),
    medication_name: row.medication_name || '',
    medication_type: row.medication_type || '',
    medication_batch_number: row.medication_batch_number || '',
    dosage: row.dosage ?? '',
    dosage_unit: row.dosage_unit || '',
    route_of_administration: row.route_of_administration || '',
    duration_days: row.duration_days ?? '',
    birds_treated_females: row.birds_treated_females ?? 0,
    birds_treated_males: row.birds_treated_males ?? 0,
    age_at_treatment_days: row.age_at_treatment_days ?? '',
    treating_veterinarian: row.treating_veterinarian || '',
    disease_being_treated: row.disease_being_treated || '',
    treatment_effectiveness: row.treatment_effectiveness || '',
    withdrawal_period_days: row.withdrawal_period_days ?? '',
    withdrawal_end_date: toDateInput(row.withdrawal_end_date),
    remarks: row.remarks || '',
  }, flocks);
}

function validateForm(form, flocks) {
  const selectedFlock = flocks.find((row) => row.flock_id === form.flock_id);
  if (!selectedFlock?.hatch_date) {
    return { field: 'flock_id', message: 'Selected flock is missing hatch date; age cannot be calculated.' };
  }
  if (!form.age_at_treatment_days) {
    return { field: 'age_at_treatment_days', message: 'Age at treatment must be calculated from hatch date and treatment date.' };
  }
  if (!form.medication_name.trim()) return { field: 'medication_name', message: 'Medication name is required.' };
  if (!form.medication_type.trim()) return { field: 'medication_type', message: 'Medication type is required.' };
  if (!form.dosage_unit.trim()) return { field: 'dosage_unit', message: 'Dosage unit is required.' };
  if (!form.route_of_administration.trim()) return { field: 'route_of_administration', message: 'Route of administration is required.' };
  const dosage = readNumber(form.dosage);
  if (dosage === null || dosage < 0) return { field: 'dosage', message: 'Dosage must be zero or greater.' };
  const females = readNumber(form.birds_treated_females);
  const males = readNumber(form.birds_treated_males);
  if (!Number.isInteger(females) || females < 0) {
    return { field: 'birds_treated_females', message: 'Female birds treated must be a non-negative integer.' };
  }
  if (!Number.isInteger(males) || males < 0) {
    return { field: 'birds_treated_males', message: 'Male birds treated must be a non-negative integer.' };
  }
  if ((females + males) <= 0) {
    return { field: 'birds_treated_total', message: 'Total birds treated must be greater than zero.' };
  }
  if (form.withdrawal_end_date && form.treatment_date && form.withdrawal_end_date < form.treatment_date) {
    return { field: 'withdrawal_end_date', message: 'Withdrawal end date cannot be before treatment date.' };
  }
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

export default function TreatmentManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    searchText: '',
    medicationName: '',
    medicationType: '',
    treatmentEffectiveness: '',
    withdrawalActiveOnly: 'all',
    fromDate: '',
    toDate: '',
  });

  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const birdsTreatedTotal = (Number(form.birds_treated_females) || 0) + (Number(form.birds_treated_males) || 0);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.medicationName) params.set('medication_name', filters.medicationName.trim());
      if (filters.medicationType) params.set('medication_type', filters.medicationType.trim());
      if (filters.treatmentEffectiveness) params.set('treatment_effectiveness', filters.treatmentEffectiveness);
      if (filters.withdrawalActiveOnly !== 'all') params.set('withdrawal_active_only', filters.withdrawalActiveOnly === 'yes' ? '1' : '0');
      if (filters.fromDate) params.set('from_date', filters.fromDate);
      if (filters.toDate) params.set('to_date', filters.toDate);
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, flockPayload, farmPayload, housePayload] = await Promise.all([
        apiRequest(`/treatment?${params.toString()}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
      ]);

      const loadedFlocks = Array.isArray(flockPayload.data) ? flockPayload.data : [];
      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setFlocks(loadedFlocks);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setForm((current) => (current.flock_id ? updateDerivedFields(current, {}, loadedFlocks) : current));
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
    setFieldError(null);
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

      const isEditing = Boolean(form.treatment_id);
      const payload = {
        flock_id: form.flock_id,
        farm_id: form.farm_id,
        house_id: form.house_id,
        treatment_date: form.treatment_date,
        medication_name: form.medication_name.trim(),
        medication_type: form.medication_type.trim(),
        medication_batch_number: form.medication_batch_number.trim() || null,
        dosage: Number(form.dosage),
        dosage_unit: form.dosage_unit.trim(),
        route_of_administration: form.route_of_administration.trim(),
        duration_days: numberOrNull(form.duration_days),
        birds_treated_females: Number(form.birds_treated_females),
        birds_treated_males: Number(form.birds_treated_males),
        age_at_treatment_days: Number(form.age_at_treatment_days),
        treating_veterinarian: form.treating_veterinarian.trim() || null,
        disease_being_treated: form.disease_being_treated.trim() || null,
        treatment_effectiveness: form.treatment_effectiveness || null,
        withdrawal_period_days: numberOrNull(form.withdrawal_period_days),
        withdrawal_end_date: form.withdrawal_end_date || null,
        clear_withdrawal: isEditing ? !form.withdrawal_end_date : false,
        remarks: form.remarks.trim() || null,
        user_id: currentUser.user_id || null,
      };

      await apiRequest(isEditing ? `/treatment/${form.treatment_id}` : '/treatment', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Treatment record updated successfully.' : 'Treatment record created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete treatment record for ${row.medication_name} on ${toDateInput(row.treatment_date)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/treatment/${row.treatment_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Deleted from treatment form' }),
      });
      if (form.treatment_id === row.treatment_id) clearEditor();
      setMessage('Treatment record deleted successfully.');
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
      await apiRequest(`/treatment/${row.treatment_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Treatment record restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete ${row.medication_name}? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/treatment/${row.treatment_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.treatment_id === row.treatment_id) clearEditor();
      setMessage('Treatment record permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Treatment Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Capture and maintain flock treatment records.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}
      {fieldError?.message && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {fieldError.message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedFields(current, { flock_id: event.target.value }, flocks)); }} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Treatment date</span><input required type="date" value={form.treatment_date} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedFields(current, { treatment_date: event.target.value }, flocks)); }} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Medication name</span><input required value={form.medication_name} onChange={(event) => setForm((current) => ({ ...current, medication_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Medication type</span><input required value={form.medication_type} onChange={(event) => setForm((current) => ({ ...current, medication_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Batch number</span><input value={form.medication_batch_number} onChange={(event) => setForm((current) => ({ ...current, medication_batch_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Dosage</span><input required min="0" step="0.01" type="number" value={form.dosage} onChange={(event) => setForm((current) => ({ ...current, dosage: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Dosage unit</span><input required value={form.dosage_unit} onChange={(event) => setForm((current) => ({ ...current, dosage_unit: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Route of administration</span><input required value={form.route_of_administration} onChange={(event) => setForm((current) => ({ ...current, route_of_administration: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Duration (days)</span><input min="0" type="number" value={form.duration_days} onChange={(event) => setForm((current) => ({ ...current, duration_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age at treatment (days)</span><input required readOnly type="number" value={form.age_at_treatment_days} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Female birds treated</span><input required min="0" type="number" value={form.birds_treated_females} onChange={(event) => setForm((current) => ({ ...current, birds_treated_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Male birds treated</span><input required min="0" type="number" value={form.birds_treated_males} onChange={(event) => setForm((current) => ({ ...current, birds_treated_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Total birds treated</span><input readOnly value={birdsTreatedTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Treating veterinarian</span><input value={form.treating_veterinarian} onChange={(event) => setForm((current) => ({ ...current, treating_veterinarian: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Disease being treated</span><input value={form.disease_being_treated} onChange={(event) => setForm((current) => ({ ...current, disease_being_treated: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Treatment effectiveness</span><select value={form.treatment_effectiveness} onChange={(event) => setForm((current) => ({ ...current, treatment_effectiveness: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select effectiveness</option>{EFFECTIVENESS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Withdrawal period (days)</span><input min="0" type="number" value={form.withdrawal_period_days} onChange={(event) => setForm((current) => ({ ...current, withdrawal_period_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Withdrawal end date</span><input type="date" value={form.withdrawal_end_date} onChange={(event) => setForm((current) => ({ ...current, withdrawal_end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>

        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea rows="2" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

        <div className="mt-4 flex justify-end gap-2">
          {form.treatment_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.treatment_id ? 'Save treatment' : 'Save treatment record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search medication, disease, veterinarian..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <input value={filters.medicationName} onChange={(event) => updateFilter('medicationName', event.target.value)} placeholder="Medication name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.medicationType} onChange={(event) => updateFilter('medicationType', event.target.value)} placeholder="Medication type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.treatmentEffectiveness} onChange={(event) => updateFilter('treatmentEffectiveness', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All effectiveness</option>{EFFECTIVENESS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={filters.withdrawalActiveOnly} onChange={(event) => updateFilter('withdrawalActiveOnly', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All withdrawals</option><option value="yes">Active withdrawal only</option><option value="no">Not active only</option></select>
          <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Treatment Records</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Medication</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Birds</th>
                <th className="px-2 py-2">Effectiveness</th>
                <th className="px-2 py-2">Withdrawal</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading treatment records...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No treatment records found.</td></tr> : rows.map((row) => (
                <tr key={row.treatment_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{toDateInput(row.treatment_date)}</td>
                  <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{row.medication_name}</td>
                  <td className="px-2 py-2">{row.medication_type || '-'}</td>
                  <td className="px-2 py-2">{row.birds_treated_total ?? ((row.birds_treated_females || 0) + (row.birds_treated_males || 0))}</td>
                  <td className="px-2 py-2">{row.treatment_effectiveness || 'Unknown'}</td>
                  <td className="px-2 py-2">{row.withdrawal_status || (row.withdrawal_end_date ? toDateInput(row.withdrawal_end_date) : 'N/A')}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" onClick={() => { setForm(toForm(row, flocks)); setFieldError(null); setError(''); setMessage(''); }} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
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
