import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const STATUS_OPTIONS = ['Active', 'Under Investigation', 'Resolved', 'Closed'];

const emptyForm = {
  incident_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  incident_date: '',
  incident_type: '',
  disease_id: '',
  symptom_description: '',
  severity_level: 'Medium',
  affected_females: '0',
  affected_males: '0',
  mortality_females: '0',
  mortality_males: '0',
  diagnosis_date: '',
  diagnosis_details: '',
  treatment_given: '',
  treatment_response: '',
  veterinarian_id: '',
  laboratory_test_requested: false,
  laboratory_test_reference: '',
  laboratory_test_result: '',
  incident_status: 'Active',
  resolution_date: '',
  resolution_notes: '',
  reported_by: '',
  remarks: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function updateDerivedFields(currentForm, nextFields, flocks) {
  const nextForm = { ...currentForm, ...nextFields };
  const selectedFlock = flocks.find((row) => row.flock_id === nextForm.flock_id);
  return {
    ...nextForm,
    farm_id: selectedFlock?.farm_id || '',
    house_id: selectedFlock?.house_id || '',
  };
}

function toForm(row, flocks, currentUserId) {
  return updateDerivedFields(emptyForm, {
    incident_id: row.incident_id || '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    incident_date: toDateInput(row.incident_date),
    incident_type: row.incident_type || '',
    disease_id: row.disease_id || '',
    symptom_description: row.symptom_description || '',
    severity_level: row.severity_level || 'Medium',
    affected_females: row.affected_females ?? 0,
    affected_males: row.affected_males ?? 0,
    mortality_females: row.mortality_females ?? 0,
    mortality_males: row.mortality_males ?? 0,
    diagnosis_date: toDateInput(row.diagnosis_date),
    diagnosis_details: row.diagnosis_details || '',
    treatment_given: row.treatment_given || '',
    treatment_response: row.treatment_response || '',
    veterinarian_id: row.veterinarian_id || '',
    laboratory_test_requested: row.laboratory_test_requested === true || row.laboratory_test_requested === 1,
    laboratory_test_reference: row.laboratory_test_reference || '',
    laboratory_test_result: row.laboratory_test_result || '',
    incident_status: row.incident_status || 'Active',
    resolution_date: toDateInput(row.resolution_date),
    resolution_notes: row.resolution_notes || '',
    reported_by: row.reported_by || currentUserId || '',
    remarks: row.remarks || '',
  }, flocks);
}

function validateForm(form) {
  if (!form.flock_id) return 'Flock is required.';
  if (!form.incident_date) return 'Incident date is required.';
  if (!form.incident_type.trim()) return 'Incident type is required.';
  if (!SEVERITY_OPTIONS.includes(form.severity_level)) return 'Severity level is invalid.';
  if (!STATUS_OPTIONS.includes(form.incident_status)) return 'Incident status is invalid.';
  if (numberOrZero(form.affected_females) + numberOrZero(form.affected_males) <= 0) {
    return 'Total affected birds must be greater than zero.';
  }
  if (numberOrZero(form.mortality_females) + numberOrZero(form.mortality_males) > numberOrZero(form.affected_females) + numberOrZero(form.affected_males)) {
    return 'Mortality total cannot exceed affected total.';
  }
  if (form.diagnosis_date && form.diagnosis_date < form.incident_date) {
    return 'Diagnosis date cannot be before incident date.';
  }
  if (form.resolution_date && form.resolution_date < form.incident_date) {
    return 'Resolution date cannot be before incident date.';
  }
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

export default function HealthIncidentManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [users, setUsers] = useState([]);
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
    incidentType: '',
    severityLevel: '',
    incidentStatus: '',
    fromDate: '',
    toDate: '',
  });

  const houseOptions = useMemo(
    () => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id),
    [houses, form.farm_id],
  );
  const activeUsers = useMemo(() => users.filter((row) => !row.is_deleted && row.is_active !== false), [users]);
  const affectedTotal = numberOrZero(form.affected_females) + numberOrZero(form.affected_males);
  const mortalityTotal = numberOrZero(form.mortality_females) + numberOrZero(form.mortality_males);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.incidentType) params.set('incident_type', filters.incidentType.trim());
      if (filters.severityLevel) params.set('severity_level', filters.severityLevel);
      if (filters.incidentStatus) params.set('incident_status', filters.incidentStatus);
      if (filters.fromDate) params.set('from_date', filters.fromDate);
      if (filters.toDate) params.set('to_date', filters.toDate);
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, flockPayload, farmPayload, housePayload, userPayload] = await Promise.all([
        apiRequest(`/healthincident?${params.toString()}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/user?page_number=1&page_size=500&is_deleted=0', currentUser.accessToken),
      ]);

      const loadedFlocks = Array.isArray(flockPayload.data) ? flockPayload.data : [];
      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setFlocks(loadedFlocks);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
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

  useEffect(() => {
    if (!currentUser.user_id) return;
    setForm((current) => ({
      ...current,
      reported_by: current.reported_by || currentUser.user_id,
    }));
  }, [currentUser.user_id]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function clearEditor() {
    setForm({
      ...emptyForm,
      reported_by: currentUser.user_id || '',
    });
    setFieldError(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);

    try {
      const validationError = validateForm(form);
      if (validationError) {
        setFieldError(validationError);
        return;
      }

      const isEditing = Boolean(form.incident_id);
      const payload = {
        flock_id: form.flock_id,
        farm_id: form.farm_id || null,
        house_id: form.house_id || null,
        incident_date: form.incident_date,
        incident_type: form.incident_type.trim(),
        disease_id: form.disease_id.trim() || null,
        clear_disease: isEditing && !form.disease_id.trim(),
        symptom_description: form.symptom_description.trim() || null,
        severity_level: form.severity_level,
        affected_females: numberOrZero(form.affected_females),
        affected_males: numberOrZero(form.affected_males),
        mortality_females: numberOrZero(form.mortality_females),
        mortality_males: numberOrZero(form.mortality_males),
        diagnosis_date: form.diagnosis_date || null,
        diagnosis_details: form.diagnosis_details.trim() || null,
        treatment_given: form.treatment_given.trim() || null,
        treatment_response: form.treatment_response.trim() || null,
        veterinarian_id: form.veterinarian_id || null,
        laboratory_test_requested: Boolean(form.laboratory_test_requested),
        laboratory_test_reference: form.laboratory_test_reference.trim() || null,
        laboratory_test_result: form.laboratory_test_result.trim() || null,
        incident_status: form.incident_status,
        resolution_date: form.resolution_date || null,
        resolution_notes: form.resolution_notes.trim() || null,
        reported_by: form.reported_by || currentUser.user_id || null,
        remarks: form.remarks.trim() || null,
        user_id: currentUser.user_id || null,
      };

      await apiRequest(isEditing ? `/healthincident/${form.incident_id}` : '/healthincident', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Health incident updated successfully.' : 'Health incident created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete incident "${row.incident_type}" on ${toDateInput(row.incident_date)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/healthincident/${row.incident_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: currentUser.user_id || null,
          reason: 'Deleted from health incident form',
        }),
      });
      if (form.incident_id === row.incident_id) clearEditor();
      setMessage('Health incident deleted successfully.');
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
      await apiRequest(`/healthincident/${row.incident_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Health incident restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete incident "${row.incident_type}"? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/healthincident/${row.incident_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.incident_id === row.incident_id) clearEditor();
      setMessage('Health incident permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Health Incident Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Capture and maintain flock health incident records.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}
      {fieldError && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {fieldError}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => setForm((current) => updateDerivedFields(current, { flock_id: event.target.value }, flocks))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select disabled required value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select disabled required value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incident date</span><input required type="date" value={form.incident_date} onChange={(event) => setForm((current) => ({ ...current, incident_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incident type</span><input required value={form.incident_type} onChange={(event) => setForm((current) => ({ ...current, incident_type: event.target.value }))} placeholder="Disease Outbreak / Respiratory / Injury..." className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Disease ID (optional)</span><input value={form.disease_id} onChange={(event) => setForm((current) => ({ ...current, disease_id: event.target.value }))} placeholder="GUID" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 font-mono text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Severity</span><select value={form.severity_level} onChange={(event) => setForm((current) => ({ ...current, severity_level: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{SEVERITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Status</span><select value={form.incident_status} onChange={(event) => setForm((current) => ({ ...current, incident_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Affected females</span><input required type="number" min="0" value={form.affected_females} onChange={(event) => setForm((current) => ({ ...current, affected_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Affected males</span><input required type="number" min="0" value={form.affected_males} onChange={(event) => setForm((current) => ({ ...current, affected_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Affected total</span><input readOnly value={affectedTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality females</span><input required type="number" min="0" value={form.mortality_females} onChange={(event) => setForm((current) => ({ ...current, mortality_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality males</span><input required type="number" min="0" value={form.mortality_males} onChange={(event) => setForm((current) => ({ ...current, mortality_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Mortality total</span><input readOnly value={mortalityTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Diagnosis date</span><input type="date" value={form.diagnosis_date} onChange={(event) => setForm((current) => ({ ...current, diagnosis_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Resolution date</span><input type="date" value={form.resolution_date} onChange={(event) => setForm((current) => ({ ...current, resolution_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Veterinarian</span><select value={form.veterinarian_id} onChange={(event) => setForm((current) => ({ ...current, veterinarian_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select veterinarian</option>{activeUsers.map((row) => <option key={row.user_id} value={row.user_id}>{row.username}{row.email ? ` - ${row.email}` : ''}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Reported by</span><select required value={form.reported_by} onChange={(event) => setForm((current) => ({ ...current, reported_by: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select reporter</option>{activeUsers.map((row) => <option key={row.user_id} value={row.user_id}>{row.username}{row.email ? ` - ${row.email}` : ''}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Treatment response</span><input value={form.treatment_response} onChange={(event) => setForm((current) => ({ ...current, treatment_response: event.target.value }))} placeholder="Improving / Stable / Worsening..." className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.laboratory_test_requested} onChange={(event) => setForm((current) => ({ ...current, laboratory_test_requested: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Laboratory test requested</span></label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Symptoms</span><textarea rows="3" value={form.symptom_description} onChange={(event) => setForm((current) => ({ ...current, symptom_description: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Diagnosis details</span><textarea rows="3" value={form.diagnosis_details} onChange={(event) => setForm((current) => ({ ...current, diagnosis_details: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Treatment given</span><textarea rows="3" value={form.treatment_given} onChange={(event) => setForm((current) => ({ ...current, treatment_given: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lab test result</span><textarea rows="3" value={form.laboratory_test_result} onChange={(event) => setForm((current) => ({ ...current, laboratory_test_result: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lab test reference</span><input value={form.laboratory_test_reference} onChange={(event) => setForm((current) => ({ ...current, laboratory_test_reference: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Resolution notes</span><input value={form.resolution_notes} onChange={(event) => setForm((current) => ({ ...current, resolution_notes: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>

        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea rows="2" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

        <div className="mt-4 flex justify-end gap-2">
          {form.incident_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.incident_id ? 'Save incident' : 'Save incident record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search symptoms, diagnosis, treatment..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <input value={filters.incidentType} onChange={(event) => updateFilter('incidentType', event.target.value)} placeholder="Filter by incident type" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.severityLevel} onChange={(event) => updateFilter('severityLevel', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All severities</option>{SEVERITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={filters.incidentStatus} onChange={(event) => updateFilter('incidentStatus', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All statuses</option>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Health Incidents</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Incident</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Affected</th>
                <th className="px-2 py-2">Mortality</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading health incidents...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No health incidents found.</td></tr> : rows.map((row) => (
                <tr key={row.incident_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{toDateInput(row.incident_date)}</td>
                  <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{row.incident_type}</td>
                  <td className="px-2 py-2">{row.severity_level || '-'}</td>
                  <td className="px-2 py-2">{row.incident_status || '-'}</td>
                  <td className="px-2 py-2">{row.affected_total ?? ((row.affected_females || 0) + (row.affected_males || 0))}</td>
                  <td className="px-2 py-2">{row.mortality_total ?? ((row.mortality_females || 0) + (row.mortality_males || 0))}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" onClick={() => { setForm(toForm(row, flocks, currentUser.user_id || '')); setFieldError(null); setError(''); setMessage(''); }} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
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
