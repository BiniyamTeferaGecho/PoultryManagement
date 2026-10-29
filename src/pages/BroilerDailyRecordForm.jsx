import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const APPROVAL_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const LITTER_CONDITIONS = ['Dry', 'Slightly Damp', 'Damp', 'Wet', 'Caked'];

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
  mortality_reason_id: '',
  culling_females: '0',
  culling_males: '0',
  sample_size: '',
  avg_body_weight_g: '',
  min_weight_g: '',
  max_weight_g: '',
  weight_gain_g: '',
  uniformity_percent: '',
  target_weight_g: '',
  feed_consumption_kg: '',
  water_consumption_liters: '',
  environmental_temp: '',
  environmental_humidity: '',
  ammonia_level: '',
  ventilation_rate: '',
  litter_condition: '',
  footpad_score: '',
  hock_burn_score: '',
  gait_score: '',
  feather_condition_score: '',
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
    mortality_reason_id: row.mortality_reason_id || '',
    culling_females: row.culling_females ?? 0,
    culling_males: row.culling_males ?? 0,
    sample_size: row.sample_size ?? '',
    avg_body_weight_g: row.avg_body_weight_g ?? '',
    min_weight_g: row.min_weight_g ?? '',
    max_weight_g: row.max_weight_g ?? '',
    weight_gain_g: row.weight_gain_g ?? '',
    uniformity_percent: row.uniformity_percent ?? '',
    target_weight_g: row.target_weight_g ?? '',
    feed_consumption_kg: row.feed_consumption_kg ?? '',
    water_consumption_liters: row.water_consumption_liters ?? '',
    environmental_temp: row.environmental_temp ?? '',
    environmental_humidity: row.environmental_humidity ?? '',
    ammonia_level: row.ammonia_level ?? '',
    ventilation_rate: row.ventilation_rate ?? '',
    litter_condition: row.litter_condition || '',
    footpad_score: row.footpad_score ?? '',
    hock_burn_score: row.hock_burn_score ?? '',
    gait_score: row.gait_score ?? '',
    feather_condition_score: row.feather_condition_score ?? '',
    remarks: row.remarks || '',
    approval_status: row.approval_status || 'Pending',
  };
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    farm_id: selectedFlock?.farm_id || nextForm.farm_id || '',
    house_id: selectedFlock?.house_id || nextForm.house_id || '',
    age_days: derivedAge,
  };
}

function validateBroilerForm(form) {
  if (!form.flock_id) return { field: 'flock_id', message: 'Flock is required.' };
  if (!form.record_date) return { field: 'record_date', message: 'Record date is required.' };

  const nonNegativeIntFields = [
    ['mortality_females', form.mortality_females || 0],
    ['mortality_males', form.mortality_males || 0],
    ['culling_females', form.culling_females || 0],
    ['culling_males', form.culling_males || 0],
  ];
  for (const [fieldName, fieldValue] of nonNegativeIntFields) {
    const parsed = readNumber(fieldValue);
    if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) return { field: fieldName, message: `${fieldName} must be a non-negative integer.` };
  }

  if (form.uniformity_percent !== '') {
    const value = readNumber(form.uniformity_percent);
    if (value === null || value < 0 || value > 100) return { field: 'uniformity_percent', message: 'Uniformity must be between 0 and 100.' };
  }

  const tinyIntFields = [
    ['footpad_score', form.footpad_score, 4],
    ['hock_burn_score', form.hock_burn_score, 4],
    ['gait_score', form.gait_score, 5],
    ['feather_condition_score', form.feather_condition_score, 4],
  ];
  for (const [fieldName, fieldValue, max] of tinyIntFields) {
    if (fieldValue === '') continue;
    const value = readNumber(fieldValue);
    if (value === null || value < 0 || value > max || !Number.isInteger(value)) {
      return { field: fieldName, message: `${fieldName} must be an integer between 0 and ${max}.` };
    }
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

function mortalityReasonLabel(reason) {
  return `${reason.reason_code || 'N/A'} - ${reason.reason_name || 'Unnamed reason'} (${reason.category || 'General'})`;
}

export default function BroilerDailyRecordForm({ currentUser }) {
  const { showError } = useGlobalPopup();
  const [workspaceTab, setWorkspaceTab] = useState('form');
  const [activeTab, setActiveTab] = useState('details');
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(20);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [mortalityReasons, setMortalityReasons] = useState([]);
  const [mortalityReasonSearch, setMortalityReasonSearch] = useState('');
  const [isMortalityReasonDropdownOpen, setIsMortalityReasonDropdownOpen] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [flockKpis, setFlockKpis] = useState(null);
  const [mortalityTrend, setMortalityTrend] = useState([]);
  const [statusNotes, setStatusNotes] = useState('');
  const [filters, setFilters] = useState({ flock_id: '', farm_id: '', approval_status: '', from_date: '', to_date: '', search_text: '' });
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const mortalityReasonDropdownRef = useRef(null);

  const broilerFlocks = useMemo(() => flocks.filter((row) => row.poultry_type === 'Broiler' && !row.is_deleted), [flocks]);
  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const filteredMortalityReasons = useMemo(() => {
    const search = mortalityReasonSearch.trim().toLowerCase();
    const activeReasons = mortalityReasons.filter((reason) => !reason.is_deleted);
    if (!search) return activeReasons;
    return activeReasons.filter((reason) => {
      const code = String(reason.reason_code || '').toLowerCase();
      const name = String(reason.reason_name || '').toLowerCase();
      return code.includes(search) || name.includes(search);
    });
  }, [mortalityReasonSearch, mortalityReasons]);
  const selectedMortalityReason = useMemo(
    () => mortalityReasons.find((reason) => reason.mortality_reason_id === form.mortality_reason_id),
    [form.mortality_reason_id, mortalityReasons],
  );

  const computedClosingFemales = Math.max(0, Number(form.opening_females || 0) - Number(form.mortality_females || 0) - Number(form.culling_females || 0));
  const computedClosingMales = Math.max(0, Number(form.opening_males || 0) - Number(form.mortality_males || 0) - Number(form.culling_males || 0));
  const computedClosingTotal = computedClosingFemales + computedClosingMales;
  const computedWeightVariance = form.avg_body_weight_g !== '' && form.target_weight_g !== ''
    ? (Number(form.avg_body_weight_g) - Number(form.target_weight_g)).toFixed(2)
    : null;
  const computedFeedPerBird = form.feed_consumption_kg !== '' && computedClosingTotal > 0
    ? ((Number(form.feed_consumption_kg) * 1000) / computedClosingTotal).toFixed(2)
    : null;

  useEffect(() => {
    if (!isMortalityReasonDropdownOpen) return undefined;
    function handleOutsideClick(event) {
      if (!mortalityReasonDropdownRef.current?.contains(event.target)) setIsMortalityReasonDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMortalityReasonDropdownOpen]);

  const loadReferenceData = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    try {
      const [flockPayload, farmPayload, housePayload, mortalityReasonPayload, kpiPayload] = await Promise.all([
        apiRequest('/flock?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/mortalityreason?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/commercial/broiler-daily-record/reports/dashboard', currentUser.accessToken),
      ]);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setMortalityReasons(Array.isArray(mortalityReasonPayload.data) ? mortalityReasonPayload.data : []);
      setKpis(kpiPayload.data?.kpis || null);
    } catch (requestError) {
      showError(requestError.message || 'Unable to load reference data.');
    }
  }, [currentUser?.accessToken, showError]);

  const loadList = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page_number', String(pageNumber));
      params.set('page_size', String(pageSize));
      params.set('include_deleted', includeDeleted ? '1' : '0');
      if (filters.flock_id) params.set('flock_id', filters.flock_id);
      if (filters.farm_id) params.set('farm_id', filters.farm_id);
      if (filters.approval_status) params.set('approval_status', filters.approval_status);
      if (filters.from_date) params.set('from_date', filters.from_date);
      if (filters.to_date) params.set('to_date', filters.to_date);
      if (filters.search_text) params.set('search_text', filters.search_text);
      const payload = await apiRequest(`/commercial/broiler-daily-record?${params.toString()}`, currentUser.accessToken);
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(Number(payload.total_count || 0));
    } catch (requestError) {
      showError(requestError.message || 'Unable to load broiler daily records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.accessToken, filters, includeDeleted, pageNumber, pageSize, showError]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    async function loadFlockKpis() {
      if (!currentUser?.accessToken || !form.flock_id) {
        setFlockKpis(null);
        setMortalityTrend([]);
        return;
      }
      try {
        const [birds, fcr, epef, livability, trend] = await Promise.all([
          apiRequest(`/commercial/broiler-daily-record/functions/current-birds?flock_id=${form.flock_id}`, currentUser.accessToken),
          apiRequest(`/commercial/broiler-daily-record/functions/cumulative-fcr?flock_id=${form.flock_id}`, currentUser.accessToken),
          apiRequest(`/commercial/broiler-daily-record/functions/epef?flock_id=${form.flock_id}`, currentUser.accessToken),
          apiRequest(`/commercial/broiler-daily-record/functions/livability?flock_id=${form.flock_id}`, currentUser.accessToken),
          apiRequest(`/commercial/broiler-daily-record/functions/mortality-trend?flock_id=${form.flock_id}&last_days=7`, currentUser.accessToken),
        ]);
        setFlockKpis({ currentBirds: birds.data, cumulativeFcr: fcr.data, epef: epef.data, livability: livability.data });
        setMortalityTrend(Array.isArray(trend.data) ? trend.data : []);
      } catch {
        setFlockKpis(null);
        setMortalityTrend([]);
      }
    }
    loadFlockKpis();
  }, [currentUser?.accessToken, form.flock_id]);

  function resetMessages() {
    setMessage('');
    setFieldError(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    resetMessages();
    setSaving(true);
    try {
      const validationError = validateBroilerForm(form);
      if (validationError) {
        setFieldError(validationError);
        return;
      }

      const isEditing = Boolean(form.record_id);
      if (isEditing) {
        const selectedRow = rows.find((row) => Number(row.record_id) === Number(form.record_id));
        if (selectedRow?.approval_status === 'Approved') {
          showError('Cannot modify an Approved record. Reject it first.');
          return;
        }
      }

      const validReasonIds = new Set(mortalityReasons.filter((reason) => !reason.is_deleted).map((reason) => reason.mortality_reason_id));
      const mortalityReasonId = validReasonIds.has(form.mortality_reason_id) ? form.mortality_reason_id : null;

      const sharedPayload = {
        mortality_females: Number(form.mortality_females || 0),
        mortality_males: Number(form.mortality_males || 0),
        mortality_reason_id: mortalityReasonId,
        culling_females: Number(form.culling_females || 0),
        culling_males: Number(form.culling_males || 0),
        sample_size: numberOrNull(form.sample_size),
        avg_body_weight_g: numberOrNull(form.avg_body_weight_g),
        min_weight_g: numberOrNull(form.min_weight_g),
        max_weight_g: numberOrNull(form.max_weight_g),
        weight_gain_g: numberOrNull(form.weight_gain_g),
        uniformity_percent: numberOrNull(form.uniformity_percent),
        feed_consumption_kg: numberOrNull(form.feed_consumption_kg),
        water_consumption_liters: numberOrNull(form.water_consumption_liters),
        environmental_temp: numberOrNull(form.environmental_temp),
        environmental_humidity: numberOrNull(form.environmental_humidity),
        ammonia_level: numberOrNull(form.ammonia_level),
        ventilation_rate: numberOrNull(form.ventilation_rate),
        litter_condition: form.litter_condition || null,
        footpad_score: numberOrNull(form.footpad_score),
        hock_burn_score: numberOrNull(form.hock_burn_score),
        gait_score: numberOrNull(form.gait_score),
        feather_condition_score: numberOrNull(form.feather_condition_score),
        remarks: form.remarks || null,
        user_id: currentUser.user_id || null,
      };

      if (isEditing) {
        await apiRequest(`/commercial/broiler-daily-record/${form.record_id}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(sharedPayload),
        });
        setMessage('Broiler daily record updated successfully.');
      } else {
        await apiRequest('/commercial/broiler-daily-record', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({
            flock_id: form.flock_id,
            record_date: form.record_date,
            target_weight_g: numberOrNull(form.target_weight_g),
            ...sharedPayload,
          }),
        });
        setMessage('Broiler daily record created successfully.');
      }
      setForm(emptyForm);
      setActiveTab('details');
      await loadList();
    } catch (requestError) {
      showError(requestError.message || 'Unable to save broiler daily record.');
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(updateDerivedAge(emptyForm, toForm(row), flocks));
    setWorkspaceTab('form');
    setActiveTab('details');
    resetMessages();
  }

  async function changeStatus(newStatus) {
    if (!form.record_id) return;
    if (!window.confirm(`Set status to ${newStatus}?`)) return;
    resetMessages();
    setSaving(true);
    try {
      await apiRequest(`/commercial/broiler-daily-record/${form.record_id}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ new_status: newStatus, notes: statusNotes || null, user_id: currentUser.user_id || null }),
      });
      setMessage(`Record status changed to ${newStatus}.`);
      setStatusNotes('');
      await loadList();
      setForm(emptyForm);
    } catch (requestError) {
      showError(requestError.message || 'Unable to change status.');
    } finally {
      setSaving(false);
    }
  }

  async function runRowStatusAction(row, newStatus) {
    if (!window.confirm(`Set record #${row.record_id} status to ${newStatus}?`)) return;
    setSaving(true);
    try {
      await apiRequest(`/commercial/broiler-daily-record/${row.record_id}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ new_status: newStatus, user_id: currentUser.user_id || null }),
      });
      setMessage(`Record #${row.record_id} status changed to ${newStatus}.`);
      await loadList();
    } catch (requestError) {
      showError(requestError.message || 'Unable to change status.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(row) {
    if (!window.confirm(`Delete broiler daily record #${row.record_id}?`)) return;
    setSaving(true);
    try {
      await apiRequest(`/commercial/broiler-daily-record/${row.record_id}/delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      if (Number(form.record_id) === Number(row.record_id)) setForm(emptyForm);
      setMessage('Broiler daily record deleted successfully.');
      await loadList();
    } catch (requestError) {
      showError(requestError.message || 'Unable to delete broiler daily record.');
    } finally {
      setSaving(false);
    }
  }

  async function restoreRecord(row) {
    if (!window.confirm(`Restore broiler daily record #${row.record_id}?`)) return;
    setSaving(true);
    try {
      await apiRequest(`/commercial/broiler-daily-record/${row.record_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Broiler daily record restored successfully.');
      await loadList();
    } catch (requestError) {
      showError(requestError.message || 'Unable to restore broiler daily record.');
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRecord(row) {
    if (!window.confirm(`Permanently delete record #${row.record_id}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await apiRequest(`/commercial/broiler-daily-record/${row.record_id}/hard-delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, user_id: currentUser.user_id || null }),
      });
      if (Number(form.record_id) === Number(row.record_id)) setForm(emptyForm);
      setMessage('Broiler daily record permanently deleted.');
      await loadList();
    } catch (requestError) {
      showError(requestError.message || 'Unable to permanently delete broiler daily record.');
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Broiler Daily Records</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Record, approve, and monitor daily broiler flock performance.</p>
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-[#e3ebea] bg-white p-3"><p className="text-xs text-[#5d6d68]">Active Flocks</p><p className="text-lg font-bold text-[#1f2d2a]">{kpis.active_flocks ?? '-'}</p></div>
          <div className="rounded-xl border border-[#e3ebea] bg-white p-3"><p className="text-xs text-[#5d6d68]">Pending Approvals</p><p className="text-lg font-bold text-[#1f2d2a]">{kpis.pending_approvals ?? '-'}</p></div>
          <div className="rounded-xl border border-[#e3ebea] bg-white p-3"><p className="text-xs text-[#5d6d68]">Total Birds</p><p className="text-lg font-bold text-[#1f2d2a]">{kpis.total_live_birds ?? '-'}</p></div>
          <div className="rounded-xl border border-[#e3ebea] bg-white p-3"><p className="text-xs text-[#5d6d68]">Avg FCR</p><p className="text-lg font-bold text-[#1f2d2a]">{kpis.avg_fcr ?? '-'}</p></div>
          <div className="rounded-xl border border-[#e3ebea] bg-white p-3"><p className="text-xs text-[#5d6d68]">Avg EPEF</p><p className="text-lg font-bold text-[#1f2d2a]">{kpis.avg_epef ?? '-'}</p></div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setWorkspaceTab('form')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'form' ? 'bg-[#0f8b3d] text-white' : 'border border-[#dfe8e1] text-[#374744]'}`}>Record Form</button>
        <button type="button" onClick={() => setWorkspaceTab('datalist')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'datalist' ? 'bg-[#0f8b3d] text-white' : 'border border-[#dfe8e1] text-[#374744]'}`}>Data List</button>
      </div>

      {workspaceTab === 'form' && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {form.record_id && (
              <div className="mb-3 flex gap-2">
                {['details', 'status', 'trend', 'danger'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${activeTab === tab ? 'bg-[#0f8b3d] text-white' : 'border border-[#dfe8e1] text-[#374744]'}`}>
                    {tab === 'trend' ? 'Mortality Trend' : tab === 'danger' ? 'Danger Zone' : tab}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'details' && (
              <form onSubmit={onSubmit} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#1f2d2a]">Flock &amp; Date</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span>
                    <select required disabled={Boolean(form.record_id)} value={form.flock_id} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedAge(current, { flock_id: event.target.value }, flocks)); }} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none ${fieldError?.field === 'flock_id' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`}>
                      <option value="">Select broiler flock</option>
                      {broilerFlocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select disabled value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_name}</option>)}</select></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select disabled value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code}</option>)}</select></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Record date</span><input required disabled={Boolean(form.record_id)} type="date" value={form.record_date} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedAge(current, { record_date: event.target.value }, flocks)); }} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'record_date' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age (days)</span><input readOnly type="number" value={form.age_days} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Population Changes</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality females</span><input min="0" type="number" value={form.mortality_females} onChange={(event) => setForm((current) => ({ ...current, mortality_females: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'mortality_females' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality males</span><input min="0" type="number" value={form.mortality_males} onChange={(event) => setForm((current) => ({ ...current, mortality_males: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'mortality_males' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Culling females</span><input min="0" type="number" value={form.culling_females} onChange={(event) => setForm((current) => ({ ...current, culling_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Culling males</span><input min="0" type="number" value={form.culling_males} onChange={(event) => setForm((current) => ({ ...current, culling_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <div className="relative md:col-span-2" ref={mortalityReasonDropdownRef}>
                    <span className="mb-1 block text-sm font-medium text-[#374744]">Mortality reason</span>
                    <button type="button" onClick={() => setIsMortalityReasonDropdownOpen((open) => !open)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-left text-sm outline-none focus:border-[#0f8b3d]">
                      {selectedMortalityReason ? mortalityReasonLabel(selectedMortalityReason) : 'Select mortality reason (optional)'}
                    </button>
                    {isMortalityReasonDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#dfe8e1] bg-white p-2 shadow-lg">
                        <input autoFocus type="text" placeholder="Search reasons..." value={mortalityReasonSearch} onChange={(event) => setMortalityReasonSearch(event.target.value)} className="h-9 w-full rounded-lg border border-[#dfe8e1] px-2 text-sm outline-none" />
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          <button type="button" onClick={() => { setForm((current) => ({ ...current, mortality_reason_id: '' })); setIsMortalityReasonDropdownOpen(false); }} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#f4f7f5]">None</button>
                          {filteredMortalityReasons.map((reason) => (
                            <button key={reason.mortality_reason_id} type="button" onClick={() => { setForm((current) => ({ ...current, mortality_reason_id: reason.mortality_reason_id })); setIsMortalityReasonDropdownOpen(false); setMortalityReasonSearch(''); }} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#f4f7f5]">
                              {mortalityReasonLabel(reason)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Closing total (computed)</span><input readOnly type="number" value={computedClosingTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Weight &amp; Sample</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sample size</span><input min="0" type="number" value={form.sample_size} onChange={(event) => setForm((current) => ({ ...current, sample_size: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Avg body weight (g)</span><input min="0" step="0.01" type="number" value={form.avg_body_weight_g} onChange={(event) => setForm((current) => ({ ...current, avg_body_weight_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Min weight (g)</span><input min="0" step="0.01" type="number" value={form.min_weight_g} onChange={(event) => setForm((current) => ({ ...current, min_weight_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Max weight (g)</span><input min="0" step="0.01" type="number" value={form.max_weight_g} onChange={(event) => setForm((current) => ({ ...current, max_weight_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Weight gain (g)</span><input step="0.01" type="number" value={form.weight_gain_g} onChange={(event) => setForm((current) => ({ ...current, weight_gain_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Uniformity %</span><input min="0" max="100" step="0.01" type="number" value={form.uniformity_percent} onChange={(event) => setForm((current) => ({ ...current, uniformity_percent: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'uniformity_percent' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  {!form.record_id && (
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Target weight (g)</span><input min="0" step="0.01" type="number" value={form.target_weight_g} onChange={(event) => setForm((current) => ({ ...current, target_weight_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  )}
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Weight variance (computed)</span><input readOnly value={computedWeightVariance ?? ''} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Feed &amp; Water</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed (kg)</span><input min="0" step="0.01" type="number" value={form.feed_consumption_kg} onChange={(event) => setForm((current) => ({ ...current, feed_consumption_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Water (L)</span><input min="0" step="0.01" type="number" value={form.water_consumption_liters} onChange={(event) => setForm((current) => ({ ...current, water_consumption_liters: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feed/bird (g, computed)</span><input readOnly value={computedFeedPerBird ?? ''} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Environment</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Temp (°C)</span><input step="0.01" type="number" value={form.environmental_temp} onChange={(event) => setForm((current) => ({ ...current, environmental_temp: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Humidity %</span><input min="0" max="100" step="0.01" type="number" value={form.environmental_humidity} onChange={(event) => setForm((current) => ({ ...current, environmental_humidity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Ammonia (ppm)</span><input min="0" step="0.01" type="number" value={form.ammonia_level} onChange={(event) => setForm((current) => ({ ...current, ammonia_level: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Ventilation rate</span><input min="0" step="0.01" type="number" value={form.ventilation_rate} onChange={(event) => setForm((current) => ({ ...current, ventilation_rate: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Litter condition</span>
                    <select value={form.litter_condition} onChange={(event) => setForm((current) => ({ ...current, litter_condition: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                      <option value="">Select condition</option>
                      {LITTER_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                    </select>
                  </label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Welfare Scoring (0 = best)</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Footpad (0-4)</span><input min="0" max="4" type="number" value={form.footpad_score} onChange={(event) => setForm((current) => ({ ...current, footpad_score: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'footpad_score' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hock burn (0-4)</span><input min="0" max="4" type="number" value={form.hock_burn_score} onChange={(event) => setForm((current) => ({ ...current, hock_burn_score: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'hock_burn_score' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Gait (0-5)</span><input min="0" max="5" type="number" value={form.gait_score} onChange={(event) => setForm((current) => ({ ...current, gait_score: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'gait_score' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Feather condition (0-4)</span><input min="0" max="4" type="number" value={form.feather_condition_score} onChange={(event) => setForm((current) => ({ ...current, feather_condition_score: event.target.value }))} className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${fieldError?.field === 'feather_condition_score' ? 'border-red-300' : 'border-[#dfe8e1] focus:border-[#0f8b3d]'}`} /></label>
                </div>

                <h3 className="mt-4 text-sm font-bold text-[#1f2d2a]">Notes</h3>
                <div className="mt-2">
                  <textarea rows="3" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Remarks" className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                </div>

                <div className="mt-4 flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c7230] disabled:opacity-50">{form.record_id ? 'Update Record' : 'Create Record'}</button>
                  {form.record_id && <button type="button" onClick={() => setForm(emptyForm)} className="rounded-xl border border-[#dfe8e1] px-5 py-2.5 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Cancel</button>}
                </div>
              </form>
            )}

            {activeTab === 'status' && form.record_id && (
              <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#1f2d2a]">Change Status</h3>
                <p className="mt-1 text-xs text-[#5d6d68]">Current status: <span className={`rounded-full px-2 py-1 text-xs font-semibold ${APPROVAL_COLORS[form.approval_status] || 'bg-slate-100 text-slate-700'}`}>{form.approval_status}</span></p>
                <textarea rows="2" value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} placeholder="Notes (optional)" className="mt-3 w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => changeStatus('Pending')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Submit for Approval</button>
                  <button type="button" disabled={saving} onClick={() => changeStatus('Approved')} className="rounded-lg border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">Approve</button>
                  <button type="button" disabled={saving} onClick={() => changeStatus('Rejected')} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                  <button type="button" disabled={saving} onClick={() => changeStatus('Draft')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Revert to Draft</button>
                </div>
              </div>
            )}

            {activeTab === 'trend' && form.record_id && (
              <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#1f2d2a]">Mortality Trend (last 7 days)</h3>
                <table className="mt-3 w-full text-left text-sm">
                  <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Age</th><th className="px-2 py-2 font-semibold">Opening</th><th className="px-2 py-2 font-semibold">Mortality</th><th className="px-2 py-2 font-semibold">Mortality %</th></tr></thead>
                  <tbody>
                    {mortalityTrend.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No trend data.</td></tr> : mortalityTrend.map((trendRow, index) => (
                      <tr key={index} className="border-b border-[#f0f3f1]">
                        <td className="px-2 py-2">{toDateInput(trendRow.record_date)}</td>
                        <td className="px-2 py-2">{trendRow.age_days}</td>
                        <td className="px-2 py-2">{trendRow.opening_total}</td>
                        <td className="px-2 py-2">{trendRow.mortality_total}</td>
                        <td className="px-2 py-2">{trendRow.daily_mortality_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'danger' && form.record_id && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
                <p className="mt-1 text-xs text-red-600">These actions are irreversible or require caution.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => deleteRecord({ record_id: form.record_id })} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Soft Delete</button>
                  <button type="button" disabled={saving} onClick={() => restoreRecord({ record_id: form.record_id })} className="rounded-lg border border-green-300 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">Restore</button>
                  <button type="button" disabled={saving} onClick={() => hardDeleteRecord({ record_id: form.record_id })} className="rounded-lg border border-red-500 bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-200 disabled:opacity-50">Permanently Delete</button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#1f2d2a]">Flock Performance</h3>
              {!form.flock_id ? <p className="mt-2 text-xs text-[#5d6d68]">Select a flock to view KPIs.</p> : !flockKpis ? <p className="mt-2 text-xs text-[#5d6d68]">Loading...</p> : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#f6faf7] p-2"><p className="text-xs text-[#5d6d68]">Current Birds</p><p className="text-sm font-bold text-[#1f2d2a]">{flockKpis.currentBirds ?? '-'}</p></div>
                  <div className="rounded-lg bg-[#f6faf7] p-2"><p className="text-xs text-[#5d6d68]">Cumulative FCR</p><p className="text-sm font-bold text-[#1f2d2a]">{flockKpis.cumulativeFcr ?? '-'}</p></div>
                  <div className="rounded-lg bg-[#f6faf7] p-2"><p className="text-xs text-[#5d6d68]">EPEF</p><p className="text-sm font-bold text-[#1f2d2a]">{flockKpis.epef ?? '-'}</p></div>
                  <div className="rounded-lg bg-[#f6faf7] p-2"><p className="text-xs text-[#5d6d68]">Livability %</p><p className="text-sm font-bold text-[#1f2d2a]">{flockKpis.livability ?? '-'}</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {workspaceTab === 'datalist' && (
        <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <select value={filters.flock_id} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, flock_id: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All flocks</option>{broilerFlocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select>
            <select value={filters.farm_id} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, farm_id: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All farms</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_name}</option>)}</select>
            <select value={filters.approval_status} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, approval_status: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All statuses</option>{Object.keys(APPROVAL_COLORS).map((status) => <option key={status} value={status}>{status}</option>)}</select>
            <input type="date" value={filters.from_date} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, from_date: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={filters.to_date} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, to_date: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="text" placeholder="Search flock number" value={filters.search_text} onChange={(event) => { setPageNumber(1); setFilters((current) => ({ ...current, search_text: event.target.value })); }} className="h-10 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-[#5d6d68]"><input type="checkbox" checked={includeDeleted} onChange={(event) => { setPageNumber(1); setIncludeDeleted(event.target.checked); }} /> Include deleted</label>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">Age</th><th className="px-2 py-2 font-semibold">Closing</th><th className="px-2 py-2 font-semibold">FCR</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading broiler daily records...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No records found.</td></tr> : rows.map((row) => (
                  <tr key={row.record_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2">{toDateInput(row.record_date)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.flock_number || row.flock_id}</td>
                    <td className="px-2 py-2">{row.farm_name || row.farm_id}</td>
                    <td className="px-2 py-2">{row.age_days}</td>
                    <td className="px-2 py-2">{row.closing_total}</td>
                    <td className="px-2 py-2">{row.daily_fcr ?? '-'}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${APPROVAL_COLORS[row.approval_status] || 'bg-slate-100 text-slate-700'}`}>{row.approval_status}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">{row.approval_status === 'Approved' ? 'View' : 'Edit'}</button>
                        {row.is_deleted ? (
                          <button type="button" disabled={saving} onClick={() => restoreRecord(row)} className="rounded-lg border border-[#8fcf9f] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#edf9f2] disabled:opacity-50">Restore</button>
                        ) : (
                          <>
                            <button type="button" disabled={saving} onClick={() => deleteRecord(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
                            <button type="button" disabled={saving || row.approval_status === 'Approved'} onClick={() => runRowStatusAction(row, 'Approved')} className="rounded-lg border border-green-200 px-3 py-1.5 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">Approve</button>
                            <button type="button" disabled={saving || row.approval_status === 'Rejected'} onClick={() => runRowStatusAction(row, 'Rejected')} className="rounded-lg border border-orange-200 px-3 py-1.5 font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50">Reject</button>
                            <button type="button" disabled={saving || row.approval_status === 'Pending'} onClick={() => runRowStatusAction(row, 'Pending')} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Resubmit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[#5d6d68]">
            <span>Total: {totalCount} records</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
              <span>Page {pageNumber} of {totalPages}</span>
              <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
