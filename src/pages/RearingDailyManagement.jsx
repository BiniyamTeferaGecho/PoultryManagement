import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  record_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  record_date: '',
  age_days: '',
  opening_females: '',
  opening_males: '',
  mortality_females: '0',
  mortality_males: '0',
  culling_females: '0',
  culling_males: '0',
  transfers_in_females: '0',
  transfers_in_males: '0',
  transfers_out_females: '0',
  transfers_out_males: '0',
  feed_consumption_kg: '',
  water_consumption_liters: '',
  body_weight_females: '',
  body_weight_males: '',
  uniformity_percent: '',
  mortality_reason_id: '',
  environmental_temp: '',
  environmental_humidity: '',
  environmental_lighting: '',
  ventilation_rate: '',
  ammonia_level: '',
  litter_condition: '',
  vaccinations_given: '',
  treatments_given: '',
  remarks: '',
  approval_status: 'Pending',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    record_id: row.record_id ?? '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    record_date: toDateInput(row.record_date),
    age_days: row.age_days ?? '',
    opening_females: row.opening_females ?? '',
    opening_males: row.opening_males ?? '',
    mortality_females: row.mortality_females ?? 0,
    mortality_males: row.mortality_males ?? 0,
    culling_females: row.culling_females ?? 0,
    culling_males: row.culling_males ?? 0,
    transfers_in_females: row.transfers_in_females ?? 0,
    transfers_in_males: row.transfers_in_males ?? 0,
    transfers_out_females: row.transfers_out_females ?? 0,
    transfers_out_males: row.transfers_out_males ?? 0,
    feed_consumption_kg: row.feed_consumption_kg ?? '',
    water_consumption_liters: row.water_consumption_liters ?? '',
    body_weight_females: row.body_weight_females ?? '',
    body_weight_males: row.body_weight_males ?? '',
    uniformity_percent: row.uniformity_percent ?? '',
    mortality_reason_id: row.mortality_reason_id || '',
    environmental_temp: row.environmental_temp ?? '',
    environmental_humidity: row.environmental_humidity ?? '',
    environmental_lighting: row.environmental_lighting ?? '',
    ventilation_rate: row.ventilation_rate ?? '',
    ammonia_level: row.ammonia_level ?? '',
    litter_condition: row.litter_condition || '',
    vaccinations_given: row.vaccinations_given || '',
    treatments_given: row.treatments_given || '',
    remarks: row.remarks || '',
    approval_status: row.approval_status || 'Pending',
  };
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDailyForm(form, flocks) {
  const selectedFlock = flocks.find((row) => row.flock_id === form.flock_id);
  if (!selectedFlock?.hatch_date) return { field: 'flock_id', message: 'Selected flock is missing hatch date; age cannot be calculated.' };
  if (!form.age_days) return { field: 'age_days', message: 'Age days must be calculated from hatch date and record date.' };

  const ageDays = readNumber(form.age_days);
  if (ageDays === null || ageDays < 0 || !Number.isInteger(ageDays)) return { field: 'age_days', message: 'Age days must be a non-negative integer.' };

  const nonNegativeIntFields = [
    ['opening_females', form.opening_females],
    ['opening_males', form.opening_males],
    ['mortality_females', form.mortality_females || 0],
    ['mortality_males', form.mortality_males || 0],
    ['culling_females', form.culling_females || 0],
    ['culling_males', form.culling_males || 0],
    ['transfers_in_females', form.transfers_in_females || 0],
    ['transfers_in_males', form.transfers_in_males || 0],
    ['transfers_out_females', form.transfers_out_females || 0],
    ['transfers_out_males', form.transfers_out_males || 0],
  ];

  for (const [fieldName, fieldValue] of nonNegativeIntFields) {
    const parsed = readNumber(fieldValue);
    if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) return { field: fieldName, message: `${fieldName} must be a non-negative integer.` };
  }

  const nonNegativeDecimalFields = [
    ['feed_consumption_kg', form.feed_consumption_kg],
    ['water_consumption_liters', form.water_consumption_liters],
    ['body_weight_females', form.body_weight_females],
    ['body_weight_males', form.body_weight_males],
    ['environmental_temp', form.environmental_temp],
    ['environmental_humidity', form.environmental_humidity],
    ['environmental_lighting', form.environmental_lighting],
    ['ventilation_rate', form.ventilation_rate],
    ['ammonia_level', form.ammonia_level],
  ];

  for (const [fieldName, fieldValue] of nonNegativeDecimalFields) {
    if (fieldValue === '') continue;
    const parsed = readNumber(fieldValue);
    if (parsed === null || parsed < 0) return { field: fieldName, message: `${fieldName} must be a non-negative number.` };
  }

  if (form.uniformity_percent !== '') {
    const uniformityPercent = readNumber(form.uniformity_percent);
    if (uniformityPercent === null || uniformityPercent < 0 || uniformityPercent > 100) {
      return { field: 'uniformity_percent', message: 'uniformity_percent must be between 0 and 100.' };
    }
  }

  return null;
}

function calculateAgeDays(hatchDateValue, recordDateValue) {
  if (!hatchDateValue || !recordDateValue) return '';
  const hatchDate = new Date(hatchDateValue);
  const recordDate = new Date(recordDateValue);
  if (Number.isNaN(hatchDate.getTime()) || Number.isNaN(recordDate.getTime())) return '';
  const diffMs = recordDate.getTime() - hatchDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? String(diffDays) : '';
}

function updateDerivedAge(currentForm, nextFields, flocks) {
  const nextForm = { ...currentForm, ...nextFields };
  const selectedFlock = flocks.find((row) => row.flock_id === nextForm.flock_id);
  const derivedAge = calculateAgeDays(selectedFlock?.hatch_date, nextForm.record_date);
  return {
    ...nextForm,
    farm_id: selectedFlock?.farm_id || '',
    house_id: selectedFlock?.house_id || '',
    age_days: derivedAge,
    opening_females: selectedFlock ? String(selectedFlock.initial_females ?? 0) : '',
    opening_males: selectedFlock ? String(selectedFlock.initial_males ?? 0) : '',
  };
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

function mortalityReasonLabel(reason) {
  return `${reason.reason_code || 'N/A'} - ${reason.reason_name || 'Unnamed reason'} (${reason.category || 'General'})`;
}

export default function RearingDailyManagement({ currentUser }) {
  const { showError } = useGlobalPopup();
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [flockMortalityLive, setFlockMortalityLive] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [mortalityReasons, setMortalityReasons] = useState([]);
  const [mortalityReasonSearch, setMortalityReasonSearch] = useState('');
  const [isMortalityReasonDropdownOpen, setIsMortalityReasonDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const mortalityReasonDropdownRef = useRef(null);

  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const filteredMortalityReasons = useMemo(() => {
    const search = mortalityReasonSearch.trim().toLowerCase();
    const activeReasons = mortalityReasons.filter((reason) => !reason.is_deleted && reason.is_active !== false && reason.is_active !== 0);
    if (!search) return activeReasons;
    return activeReasons.filter((reason) => {
      const code = String(reason.reason_code || '').toLowerCase();
      const name = String(reason.reason_name || '').toLowerCase();
      const category = String(reason.category || '').toLowerCase();
      return code.includes(search) || name.includes(search) || category.includes(search);
    });
  }, [mortalityReasonSearch, mortalityReasons]);
  const selectedMortalityReason = useMemo(
    () => mortalityReasons.find((reason) => reason.mortality_reason_id === form.mortality_reason_id),
    [form.mortality_reason_id, mortalityReasons],
  );
  const selectedFlockMortalityLive = useMemo(
    () => flockMortalityLive.find((row) => row.flock_id === form.flock_id),
    [flockMortalityLive, form.flock_id],
  );
  const currentMale = selectedFlockMortalityLive?.current_male ?? Number(form.opening_males || 0);
  const currentFemale = selectedFlockMortalityLive?.current_female ?? Number(form.opening_females || 0);
  const currentLiveTotal = selectedFlockMortalityLive?.current_live_flock ?? (Number(currentMale || 0) + Number(currentFemale || 0));

  useEffect(() => {
    if (!isMortalityReasonDropdownOpen) return undefined;
    function handleOutsideClick(event) {
      if (!mortalityReasonDropdownRef.current?.contains(event.target)) {
        setIsMortalityReasonDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMortalityReasonDropdownOpen]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [dailyPayload, flockPayload, flockMortalityLivePayload, farmPayload, housePayload, mortalityReasonPayload] = await Promise.all([
        apiRequest(`/rearing/daily?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/production/reports/flock-mortality-live?include_negative_alert=0', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/mortalityreason?page_number=1&page_size=500&include_deleted=0&is_active=1', currentUser.accessToken),
      ]);
      setRows(Array.isArray(dailyPayload.data) ? dailyPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFlockMortalityLive(Array.isArray(flockMortalityLivePayload.data) ? flockMortalityLivePayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setMortalityReasons(Array.isArray(mortalityReasonPayload.data) ? mortalityReasonPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setFieldError(null);
      setRows([]);
      setFlockMortalityLive([]);
      setMortalityReasons([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);
    try {
      const validationError = validateDailyForm(form, flocks);
      if (validationError) {
        setFieldError(validationError);
        return;
      }

      const validMortalityReasonIds = new Set(
        mortalityReasons
          .filter((reason) => !reason.is_deleted && reason.is_active !== false && reason.is_active !== 0)
          .map((reason) => reason.mortality_reason_id),
      );
      const mortalityReasonId = validMortalityReasonIds.has(form.mortality_reason_id) ? form.mortality_reason_id : null;

      const isEditing = Boolean(form.record_id);
      if (isEditing) {
        const selectedRow = rows.find((row) => Number(row.record_id) === Number(form.record_id));
        if (selectedRow?.approval_status === 'Approved') {
          showError('Cannot modify an Approved record. Reject or reverse first.');
          return;
        }
      }
      const sharedPayload = {
        flock_id: form.flock_id,
        farm_id: form.farm_id,
        house_id: form.house_id,
        record_date: form.record_date,
        age_days: Number(form.age_days),
        opening_females: Number(form.opening_females),
        opening_males: Number(form.opening_males),
        mortality_females: Number(form.mortality_females || 0),
        mortality_males: Number(form.mortality_males || 0),
        culling_females: Number(form.culling_females || 0),
        culling_males: Number(form.culling_males || 0),
        transfers_in_females: Number(form.transfers_in_females || 0),
        transfers_in_males: Number(form.transfers_in_males || 0),
        transfers_out_females: Number(form.transfers_out_females || 0),
        transfers_out_males: Number(form.transfers_out_males || 0),
        feed_consumption_kg: numberOrNull(form.feed_consumption_kg),
        water_consumption_liters: numberOrNull(form.water_consumption_liters),
        body_weight_females: numberOrNull(form.body_weight_females),
        body_weight_males: numberOrNull(form.body_weight_males),
        uniformity_percent: numberOrNull(form.uniformity_percent),
        mortality_reason_id: mortalityReasonId,
        environmental_temp: numberOrNull(form.environmental_temp),
        environmental_humidity: numberOrNull(form.environmental_humidity),
        environmental_lighting: numberOrNull(form.environmental_lighting),
        ventilation_rate: numberOrNull(form.ventilation_rate),
        ammonia_level: numberOrNull(form.ammonia_level),
        litter_condition: form.litter_condition || null,
        vaccinations_given: form.vaccinations_given || null,
        treatments_given: form.treatments_given || null,
        remarks: form.remarks || null,
      };

      const createPayload = {
        flock_id: sharedPayload.flock_id,
        record_date: sharedPayload.record_date,
        mortality_females: sharedPayload.mortality_females,
        mortality_males: sharedPayload.mortality_males,
        mortality_reason_id: sharedPayload.mortality_reason_id,
        culling_females: sharedPayload.culling_females,
        culling_males: sharedPayload.culling_males,
        transfers_in_females: sharedPayload.transfers_in_females,
        transfers_in_males: sharedPayload.transfers_in_males,
        transfers_out_females: sharedPayload.transfers_out_females,
        transfers_out_males: sharedPayload.transfers_out_males,
        feed_consumption_kg: sharedPayload.feed_consumption_kg,
        water_consumption_liters: sharedPayload.water_consumption_liters,
        body_weight_females: sharedPayload.body_weight_females,
        body_weight_males: sharedPayload.body_weight_males,
        uniformity_percent: sharedPayload.uniformity_percent,
        environmental_temp: sharedPayload.environmental_temp,
        environmental_humidity: sharedPayload.environmental_humidity,
        environmental_lighting: sharedPayload.environmental_lighting,
        ventilation_rate: sharedPayload.ventilation_rate,
        ammonia_level: sharedPayload.ammonia_level,
        litter_condition: sharedPayload.litter_condition,
        vaccinations_given: sharedPayload.vaccinations_given,
        treatments_given: sharedPayload.treatments_given,
        remarks: sharedPayload.remarks,
        user_id: currentUser.user_id || null,
      };

      const updatePayload = {
        ...sharedPayload,
        approval_status: form.approval_status || 'Pending',
        modified_by: currentUser.user_id || null,
      };

      await apiRequest(isEditing ? `/rearing/daily/${form.record_id}` : '/rearing/daily', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(isEditing ? updatePayload : createPayload),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Rearing daily record updated successfully.' : 'Rearing daily record created successfully.');
      await loadData();
    } catch (requestError) {
      showError(requestError.message || 'Unable to save rearing daily record.');
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm((current) => updateDerivedAge(current, toForm(row), flocks));
    setError('');
    setMessage('');
    setFieldError(null);
  }

  async function runRowAction(path, successMessage, confirmationMessage) {
    if (confirmationMessage && !window.confirm(confirmationMessage)) return;
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);
    try {
      await apiRequest(path, currentUser.accessToken, { method: 'POST', body: JSON.stringify({ modified_by: currentUser.user_id || null }) });
      setForm(emptyForm);
      setMessage(successMessage);
      await loadData();
    } catch (requestError) {
      showError(requestError.message || 'Unable to complete the requested action.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(row) {
    if (!window.confirm(`Delete daily record #${row.record_id}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);
    try {
      await apiRequest(`/rearing/daily/${row.record_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (Number(form.record_id) === Number(row.record_id)) setForm(emptyForm);
      setMessage('Daily record deleted successfully.');
      await loadData();
    } catch (requestError) {
      showError(requestError.message || 'Unable to delete rearing daily record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Rearing Daily Records</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create, approve, and track daily rearing data.</p>
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedAge(current, { flock_id: event.target.value }, flocks)); }} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none ${fieldError?.field === 'flock_id' ? 'border-red-300 focus:border-red-500' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`}><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Record date</span><input required type="date" value={form.record_date} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedAge(current, { record_date: event.target.value }, flocks)); }} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'record_date' ? 'border-red-300 focus:border-red-500' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age (days)</span><input required readOnly min="0" type="number" value={form.age_days} className={`h-11 w-full rounded-xl border bg-[#f6faf7] px-3 text-sm outline-none ${fieldError?.field === 'age_days' ? 'border-red-300' : 'border-[#dfe8e1]'}`} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Opening females</span><input required readOnly min="0" type="number" value={form.opening_females} className={`h-11 w-full rounded-xl border bg-[#f6faf7] px-3 text-sm outline-none ${fieldError?.field === 'opening_females' ? 'border-red-300' : 'border-[#dfe8e1]'}`} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Opening males</span><input required readOnly min="0" type="number" value={form.opening_males} className={`h-11 w-full rounded-xl border bg-[#f6faf7] px-3 text-sm outline-none ${fieldError?.field === 'opening_males' ? 'border-red-300' : 'border-[#dfe8e1]'}`} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Current female</span><input readOnly min="0" type="number" value={currentFemale} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Current male</span><input readOnly min="0" type="number" value={currentMale} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Current total</span><input readOnly min="0" type="number" value={currentLiveTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality females</span><input min="0" type="number" value={form.mortality_females} onChange={(event) => setForm((current) => ({ ...current, mortality_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality males</span><input min="0" type="number" value={form.mortality_males} onChange={(event) => setForm((current) => ({ ...current, mortality_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Culling females</span><input min="0" type="number" value={form.culling_females} onChange={(event) => setForm((current) => ({ ...current, culling_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Culling males</span><input min="0" type="number" value={form.culling_males} onChange={(event) => setForm((current) => ({ ...current, culling_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transfers in females</span><input min="0" type="number" value={form.transfers_in_females} onChange={(event) => setForm((current) => ({ ...current, transfers_in_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transfers in males</span><input min="0" type="number" value={form.transfers_in_males} onChange={(event) => setForm((current) => ({ ...current, transfers_in_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transfers out females</span><input min="0" type="number" value={form.transfers_out_females} onChange={(event) => setForm((current) => ({ ...current, transfers_out_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transfers out males</span><input min="0" type="number" value={form.transfers_out_males} onChange={(event) => setForm((current) => ({ ...current, transfers_out_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed (kg)</span><input type="number" min="0" step="0.01" value={form.feed_consumption_kg} onChange={(event) => setForm((current) => ({ ...current, feed_consumption_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Water (L)</span><input type="number" min="0" step="0.01" value={form.water_consumption_liters} onChange={(event) => setForm((current) => ({ ...current, water_consumption_liters: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Body weight F</span><input type="number" min="0" step="0.01" value={form.body_weight_females} onChange={(event) => setForm((current) => ({ ...current, body_weight_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Body weight M</span><input type="number" min="0" step="0.01" value={form.body_weight_males} onChange={(event) => setForm((current) => ({ ...current, body_weight_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Uniformity %</span><input type="number" min="0" max="100" step="0.01" value={form.uniformity_percent} onChange={(event) => { setFieldError(null); setForm((current) => ({ ...current, uniformity_percent: event.target.value })); }} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'uniformity_percent' ? 'border-red-300 focus:border-red-500' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Temperature</span><input type="number" step="0.01" value={form.environmental_temp} onChange={(event) => setForm((current) => ({ ...current, environmental_temp: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Humidity</span><input type="number" step="0.01" value={form.environmental_humidity} onChange={(event) => setForm((current) => ({ ...current, environmental_humidity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lighting</span><input type="number" step="0.01" value={form.environmental_lighting} onChange={(event) => setForm((current) => ({ ...current, environmental_lighting: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Ventilation rate</span><input type="number" step="0.01" value={form.ventilation_rate} onChange={(event) => setForm((current) => ({ ...current, ventilation_rate: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Ammonia level</span><input type="number" step="0.01" value={form.ammonia_level} onChange={(event) => setForm((current) => ({ ...current, ammonia_level: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Litter condition</span><input value={form.litter_condition} onChange={(event) => setForm((current) => ({ ...current, litter_condition: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <div className="text-sm font-medium text-[#374744] md:col-span-2">
            <span className="mb-1 block">Mortality reason</span>
            <div ref={mortalityReasonDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMortalityReasonDropdownOpen((current) => !current);
                  setMortalityReasonSearch('');
                }}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[#dfe8e1] bg-white px-3 text-left text-sm outline-none transition hover:border-[#bed8c7] focus:border-[#0f8b3d]"
              >
                <span className={selectedMortalityReason ? 'text-[#1f2d2a]' : 'text-[#8aa19a]'}>
                  {selectedMortalityReason ? mortalityReasonLabel(selectedMortalityReason) : 'No mortality reason'}
                </span>
                <span className="text-[#5d6d68]">{isMortalityReasonDropdownOpen ? '⌃' : '⌄'}</span>
              </button>

              {isMortalityReasonDropdownOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-[#dfe8e1] bg-white p-2 shadow-xl">
                  <input
                    autoFocus
                    value={mortalityReasonSearch}
                    onChange={(event) => setMortalityReasonSearch(event.target.value)}
                    placeholder="Search by code, name, or category"
                    className="mb-2 h-10 w-full rounded-lg border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-[#edf3ef]">
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, mortality_reason_id: '' }));
                        setIsMortalityReasonDropdownOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${form.mortality_reason_id ? 'text-[#1f2d2a]' : 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]'}`}
                    >
                      No mortality reason
                    </button>
                    {filteredMortalityReasons.map((reason) => {
                      const isSelected = form.mortality_reason_id === reason.mortality_reason_id;
                      return (
                        <button
                          key={reason.mortality_reason_id}
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, mortality_reason_id: reason.mortality_reason_id }));
                            setIsMortalityReasonDropdownOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${isSelected ? 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]' : 'text-[#1f2d2a]'}`}
                        >
                          {mortalityReasonLabel(reason)}
                        </button>
                      );
                    })}
                    {filteredMortalityReasons.length === 0 && (
                      <div className="px-3 py-3 text-sm text-[#6f7d78]">No mortality reason found.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#5d6d68]">
                <span>{selectedMortalityReason ? `Selected: ${selectedMortalityReason.reason_code || 'N/A'} - ${selectedMortalityReason.reason_name || 'Unnamed reason'}` : 'No mortality reason selected'}</span>
                {form.mortality_reason_id && (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, mortality_reason_id: '' }))}
                    className="rounded-md border border-[#d7e4dd] px-2 py-1 font-semibold text-[#24443c] hover:bg-[#f3faf6]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Approval status</span><select value={form.approval_status} onChange={(event) => setForm((current) => ({ ...current, approval_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Vaccinations given</span><textarea value={form.vaccinations_given} onChange={(event) => setForm((current) => ({ ...current, vaccinations_given: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Treatments given</span><textarea value={form.treatments_given} onChange={(event) => setForm((current) => ({ ...current, treatments_given: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <div className="mt-4 flex justify-end gap-2">
          {form.record_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.record_id ? 'Save changes' : 'Save daily record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Daily Records</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">Age</th><th className="px-2 py-2 font-semibold">Opening</th><th className="px-2 py-2 font-semibold">Closing</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading daily records...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No daily records found.</td></tr> : rows.map((row) => (
                <tr key={row.record_id} className="border-b border-[#f0f3f1]">
                  <td className="px-2 py-2">{toDateInput(row.record_date)}</td>
                  <td className="px-2 py-2 font-mono text-xs">{row.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{row.farm_name || row.farm_id}</td>
                  <td className="px-2 py-2">{row.age_days}</td>
                  <td className="px-2 py-2">{row.opening_total ?? ((row.opening_females || 0) + (row.opening_males || 0))}</td>
                  <td className="px-2 py-2">{row.closing_total ?? ((row.closing_females || 0) + (row.closing_males || 0))}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.approval_status === 'Approved' ? 'bg-green-100 text-green-700' : row.approval_status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{row.approval_status}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={saving || row.is_deleted || row.approval_status === 'Approved'} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-50">Edit</button>
                      {row.is_deleted ? (
                        <button type="button" disabled={saving} onClick={() => runRowAction(`/rearing/daily/${row.record_id}/restore`, 'Daily record restored successfully.', 'Restore this daily record?')} className="rounded-lg border border-[#8fcf9f] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#edf9f2] disabled:opacity-50">Restore</button>
                      ) : (
                        <>
                          <button type="button" disabled={saving} onClick={() => deleteRecord(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                          <button type="button" disabled={saving || row.approval_status === 'Approved'} onClick={() => runRowAction(`/rearing/daily/${row.record_id}/approve`, 'Daily record approved successfully.', 'Approve this daily record?')} className="rounded-lg border border-green-200 px-3 py-1.5 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">Approve</button>
                          <button type="button" disabled={saving || row.approval_status === 'Rejected'} onClick={() => runRowAction(`/rearing/daily/${row.record_id}/reject`, 'Daily record rejected successfully.', 'Reject this daily record?')} className="rounded-lg border border-orange-200 px-3 py-1.5 font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50">Reject</button>
                          <button type="button" disabled={saving || row.approval_status === 'Pending'} onClick={() => runRowAction(`/rearing/daily/${row.record_id}/resubmit`, 'Daily record moved to pending successfully.', 'Set this daily record back to pending?')} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Resubmit</button>
                        </>
                      )}
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
