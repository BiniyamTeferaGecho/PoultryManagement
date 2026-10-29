import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;

const emptyForm = {
  quarantine_id: '',
  import_shipment_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  health_incident_id: '',
  start_date: '',
  expected_duration_days: '',
  quarantine_type: 'Initial',
  severity_level: '',
  veterinarian_name: '',
  inspection_frequency: 'Daily',
  entry_temperature_c: '',
  observations: '',
  laboratory_samples: '',
  sample_count: '',
  remarks: '',
  clearance_status: 'Pending',
  health_status: 'Under Observation',
  end_date: '',
  clearance_date: '',
  clearance_by: '',
  extension_reason: '',
  extension_count: 0,
  is_deleted: false,
  is_extended: false,
  is_active: true,
  import_shipment_number: '',
  import_arrival_date: '',
  country_of_origin: '',
  flock_number: '',
  poultry_type: '',
  flock_lifecycle_stage: '',
  flock_status: '',
  farm_name: '',
  house_code: '',
  health_incident_type: '',
  health_incident_severity: '',
  created_by_username: '',
  created_date: '',
  modified_by_username: '',
  modified_date: '',
  deleted_by_username: '',
  deleted_date: '',
  clearance_by_username: '',
  duration_variance_days: null,
  row_version: '',
};

const emptyFilters = {
  search_text: '',
  farm_id: '',
  house_id: '',
  import_shipment_id: '',
  flock_id: '',
  health_status: '',
  clearance_status: '',
  quarantine_type: '',
  severity_level: '',
  active_only: false,
  overdue_only: false,
  from_date: '',
  to_date: '',
  include_deleted: false,
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

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function intOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function normalizeRowVersion(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;

  const bytes = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' && Array.isArray(value.data) ? value.data : null);

  if (bytes) {
    return bytes
      .map((byte) => Number(byte).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  return String(value);
}

function toForm(row) {
  if (!row) return { ...emptyForm };
  return {
    ...emptyForm,
    ...row,
    quarantine_id: row.quarantine_id || '',
    import_shipment_id: row.import_shipment_id || '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    health_incident_id: row.health_incident_id || '',
    start_date: toDateInput(row.start_date),
    expected_duration_days: row.expected_duration_days ?? '',
    quarantine_type: row.quarantine_type || 'Initial',
    severity_level: row.severity_level || '',
    veterinarian_name: row.veterinarian_name || '',
    inspection_frequency: row.inspection_frequency || 'Daily',
    entry_temperature_c: row.entry_temperature_c ?? '',
    observations: row.observations || '',
    laboratory_samples: row.laboratory_samples || '',
    sample_count: row.sample_count ?? '',
    remarks: row.remarks || '',
    clearance_status: row.clearance_status || 'Pending',
    health_status: row.health_status || 'Under Observation',
    end_date: toDateInput(row.end_date),
    clearance_date: toDateInput(row.clearance_date),
    clearance_by: row.clearance_by || '',
    extension_reason: row.extension_reason || '',
    extension_count: Number(row.extension_count) || 0,
    is_deleted: Boolean(row.is_deleted),
    is_extended: Boolean(row.is_extended),
    is_active: Boolean(row.is_active),
    import_arrival_date: toDateInput(row.import_arrival_date),
    created_date: row.created_date || '',
    modified_date: row.modified_date || '',
    deleted_date: row.deleted_date || '',
    duration_variance_days: row.duration_variance_days ?? null,
    row_version: normalizeRowVersion(row.row_version),
  };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

const severityClass = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
};

const healthClass = {
  'Under Observation': 'bg-sky-100 text-sky-800',
  Cleared: 'bg-emerald-100 text-emerald-800',
  'Suspected Disease': 'bg-amber-100 text-amber-800',
  'Confirmed Disease': 'bg-red-100 text-red-800',
};

const clearanceClass = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Revoked: 'bg-slate-100 text-slate-700',
};

export default function QuarantineRecordForm({ currentUser, quarantineId = null, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [listRows, setListRows] = useState([]);
  const [pendingClearanceRows, setPendingClearanceRows] = useState([]);
  const [dashboard, setDashboard] = useState({ kpis: {}, activeQuarantines: [], bySeverity: [], recentClearances: [] });
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeTab, setActiveTab] = useState('details');
  const [computed, setComputed] = useState({ days_in_quarantine: null, is_overdue: false });

  const [importShipments, setImportShipments] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [healthIncidents, setHealthIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [choiceValues, setChoiceValues] = useState({
    quarantineTypes: ['Initial', 'Re-entry', 'Disease Response', 'Preventive', 'Movement'],
    severityLevels: ['Low', 'Medium', 'High', 'Critical'],
    healthStatuses: ['Under Observation', 'Cleared', 'Suspected Disease', 'Confirmed Disease'],
    clearanceStatuses: ['Pending', 'Approved', 'Rejected', 'Revoked'],
    inspectionFrequencies: ['Daily', 'Every 2 days', 'Weekly'],
  });

  const [healthChange, setHealthChange] = useState({ new_status: 'Under Observation', notes: '' });
  const [extendForm, setExtendForm] = useState({ additional_days: '', extension_reason: '' });
  const [clearanceForm, setClearanceForm] = useState({ decision: 'Approved', clearance_date: '', comments: '' });
  const [revokeForm, setRevokeForm] = useState({ revoke_reason: '' });
  const [deleteReason, setDeleteReason] = useState('');
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');

  const effectiveQuarantineId = form.quarantine_id || quarantineId || null;
  const isEditMode = Boolean(effectiveQuarantineId);
  const isPending = form.clearance_status === 'Pending';
  const selectedImportShipment = useMemo(
    () => importShipments.find((row) => row.import_shipment_id === form.import_shipment_id),
    [importShipments, form.import_shipment_id],
  );

  function fieldError(name) {
    return fieldErrors[name] ? <div className="mt-1 text-xs text-red-600">{fieldErrors[name]}</div> : null;
  }

  const loadHousesByFarm = useCallback(async (farmId) => {
    if (!currentUser?.accessToken || !farmId) {
      setHouses([]);
      return;
    }
    try {
      const payload = await apiRequest(`/core/house?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&farm_id=${encodeURIComponent(farmId)}`, currentUser.accessToken);
      setHouses(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setHouses([]);
    }
  }, [currentUser?.accessToken]);

  const loadQuarantineDetail = useCallback(async (id) => {
    if (!currentUser?.accessToken || !id) return;
    const [detailPayload, daysPayload, overduePayload] = await Promise.all([
      apiRequest(`/livestock/quarantine-record/${id}`, currentUser.accessToken),
      apiRequest(`/livestock/quarantine-record/functions/${id}/days-active`, currentUser.accessToken),
      apiRequest(`/livestock/quarantine-record/functions/${id}/is-overdue`, currentUser.accessToken),
    ]);
    setForm(toForm(detailPayload.data));
    setComputed({
      days_in_quarantine: daysPayload.data?.days_in_quarantine ?? null,
      is_overdue: Boolean(overduePayload.data?.is_overdue),
    });
    if (detailPayload.data?.farm_id) {
      await loadHousesByFarm(detailPayload.data.farm_id);
    }
  }, [currentUser?.accessToken, loadHousesByFarm]);

  const loadListAndDashboard = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    const params = new URLSearchParams({
      page_number: String(pageNumber),
      page_size: '10',
      include_deleted: filters.include_deleted ? '1' : '0',
      active_only: filters.active_only ? '1' : '0',
      overdue_only: filters.overdue_only ? '1' : '0',
    });
    ['search_text', 'farm_id', 'house_id', 'import_shipment_id', 'flock_id', 'health_status', 'clearance_status', 'quarantine_type', 'severity_level', 'from_date', 'to_date']
      .forEach((key) => {
        if (filters[key]) params.set(key, filters[key]);
      });
    const [listPayload, dashboardPayload, pendingPayload] = await Promise.all([
      apiRequest(`/livestock/quarantine-record?${params}`, currentUser.accessToken),
      apiRequest('/livestock/quarantine-record/reports/dashboard', currentUser.accessToken),
      apiRequest(`/livestock/quarantine-record/functions/pending-clearances${filters.farm_id ? `?farm_id=${encodeURIComponent(filters.farm_id)}` : ''}`, currentUser.accessToken),
    ]);
    setListRows(Array.isArray(listPayload.data) ? listPayload.data : []);
    setTotalCount(Number(listPayload.totalCount) || 0);
    setDashboard(dashboardPayload.data || { kpis: {}, activeQuarantines: [], bySeverity: [], recentClearances: [] });
    setPendingClearanceRows(Array.isArray(pendingPayload.data) ? pendingPayload.data : []);
  }, [currentUser?.accessToken, filters, pageNumber]);

  const loadData = useCallback(async () => {
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [shipmentPayload, flockPayload, farmPayload, healthIncidentPayload, userPayload, choicePayload] = await Promise.all([
        apiRequest(`/livestock/import-shipment?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/flock?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/core/farm?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/health/health-incident?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/security/users?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest('/livestock/quarantine-record/choice-values', currentUser.accessToken),
      ]);
      const shipmentRows = Array.isArray(shipmentPayload.data) ? shipmentPayload.data : [];
      setImportShipments(shipmentRows.filter((row) => ['Quarantine', 'Completed'].includes(row.status)));
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHealthIncidents(Array.isArray(healthIncidentPayload.data) ? healthIncidentPayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
      setChoiceValues((choicePayload.data && typeof choicePayload.data === 'object') ? choicePayload.data : choiceValues);

      await loadListAndDashboard();
      if (quarantineId) await loadQuarantineDetail(quarantineId);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load quarantine references.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.accessToken, loadListAndDashboard, loadQuarantineDetail, quarantineId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!currentUser?.accessToken) return;
    loadListAndDashboard().catch((requestError) => {
      setError(requestError.message || 'Failed to refresh quarantine list.');
    });
  }, [currentUser?.accessToken, loadListAndDashboard]);

  useEffect(() => {
    setTabError('');
    setFieldErrors({});
  }, [activeTab]);

  useEffect(() => {
    if (!form.farm_id) {
      setHouses([]);
      setForm((current) => ({ ...current, house_id: '' }));
      return;
    }
    loadHousesByFarm(form.farm_id);
  }, [form.farm_id, loadHousesByFarm]);

  function resetFilters() {
    setFilters({ ...emptyFilters });
    setPageNumber(1);
  }

  function validateForm() {
    const nextErrors = {};
    if (!form.import_shipment_id) nextErrors.import_shipment_id = 'Import shipment is required.';
    if (!form.flock_id) nextErrors.flock_id = 'Flock is required.';
    if (!form.farm_id) nextErrors.farm_id = 'Farm is required.';
    if (!form.house_id) nextErrors.house_id = 'House is required.';
    if (!form.start_date) nextErrors.start_date = 'Start date is required.';
    if (!form.quarantine_type) nextErrors.quarantine_type = 'Quarantine type is required.';
    if (form.quarantine_type && !choiceValues.quarantineTypes.includes(form.quarantine_type)) nextErrors.quarantine_type = 'Invalid quarantine type.';
    if (form.severity_level && !choiceValues.severityLevels.includes(form.severity_level)) nextErrors.severity_level = 'Invalid severity level.';
    if (form.expected_duration_days !== '' && (intOrNull(form.expected_duration_days) === null || Number(form.expected_duration_days) < 0)) {
      nextErrors.expected_duration_days = 'Expected duration must be a non-negative integer.';
    }
    if (form.sample_count !== '' && (intOrNull(form.sample_count) === null || Number(form.sample_count) < 0)) {
      nextErrors.sample_count = 'Sample count must be a non-negative integer.';
    }
    if (form.entry_temperature_c !== '' && (Number(form.entry_temperature_c) < 0 || Number(form.entry_temperature_c) > 50)) {
      nextErrors.entry_temperature_c = 'Entry temperature must be between 0 and 50.';
    }
    const shipmentArrivalDate = selectedImportShipment?.arrival_date ? String(selectedImportShipment.arrival_date).slice(0, 10) : null;
    if (shipmentArrivalDate && form.start_date && form.start_date < shipmentArrivalDate) {
      nextErrors.start_date = 'Start date cannot precede import arrival date.';
    }
    if (!isEditMode) {
      const hasPendingForFlock = listRows.some((row) => row.flock_id === form.flock_id && row.clearance_status === 'Pending' && !row.is_deleted);
      if (hasPendingForFlock) nextErrors.flock_id = 'An active quarantine already exists for this flock.';
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      return;
    }
    if (isEditMode && !isPending) {
      setTabError('Cannot update: quarantine is no longer Pending (THROW 67031).');
      return;
    }
    if (!validateForm()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        expected_duration_days: intOrNull(form.expected_duration_days),
        severity_level: form.severity_level || null,
        veterinarian_name: form.veterinarian_name || null,
        inspection_frequency: form.inspection_frequency || null,
        entry_temperature_c: numberOrNull(form.entry_temperature_c),
        observations: form.observations || null,
        laboratory_samples: form.laboratory_samples || null,
        sample_count: intOrNull(form.sample_count),
        remarks: form.remarks || null,
        user_id: currentUser.user_id,
      };

      if (!isEditMode) {
        const createPayload = {
          ...payload,
          import_shipment_id: form.import_shipment_id,
          flock_id: form.flock_id,
          farm_id: form.farm_id,
          house_id: form.house_id,
          start_date: form.start_date,
          quarantine_type: form.quarantine_type || 'Initial',
          health_incident_id: form.health_incident_id || null,
        };
        const created = await apiRequest('/livestock/quarantine-record', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });
        const createdId = created.data?.quarantine_id;
        setMessage('Quarantine record created successfully.');
        if (createdId) await loadQuarantineDetail(createdId);
      } else {
        await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Quarantine record updated successfully.');
        await loadQuarantineDetail(effectiveQuarantineId);
      }
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Failed to save quarantine record.');
    } finally {
      setSaving(false);
    }
  }

  async function runTabAction(action, successMessage) {
    if (!currentUser?.accessToken || !effectiveQuarantineId) {
      setTabError('Sign out and sign in again.');
      return;
    }
    setSaving(true);
    setTabError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      await loadQuarantineDetail(effectiveQuarantineId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeHealthStatus() {
    if (!isPending) {
      setTabError('Cannot change health_status: quarantine is not Pending.');
      return;
    }
    await runTabAction(async () => {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/change-health-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: healthChange.new_status,
          notes: healthChange.notes || null,
          user_id: currentUser.user_id,
        }),
      });
    }, 'Health status updated successfully.');
  }

  async function handleExtend() {
    const additionalDays = intOrNull(extendForm.additional_days);
    if (additionalDays === null || additionalDays <= 0) {
      setTabError('additional_days must be > 0.');
      return;
    }
    if (!extendForm.extension_reason.trim()) {
      setTabError('extension_reason is required.');
      return;
    }
    if (!window.confirm('Extend this quarantine?')) return;
    await runTabAction(async () => {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/extend`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          additional_days: additionalDays,
          extension_reason: extendForm.extension_reason.trim(),
          user_id: currentUser.user_id,
        }),
      });
    }, 'Quarantine extended successfully.');
  }

  async function handleRecordClearance() {
    if (!isPending) {
      setTabError('Only Pending quarantines can be cleared or rejected.');
      return;
    }
    if (!clearanceForm.clearance_date) {
      setTabError('clearance_date is required.');
      return;
    }
    if (form.start_date && clearanceForm.clearance_date < form.start_date) {
      setTabError('clearance_date cannot precede start_date.');
      return;
    }
    if (!window.confirm('Record this clearance decision?')) return;
    await runTabAction(async () => {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/record-clearance`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          decision: clearanceForm.decision,
          clearance_date: clearanceForm.clearance_date,
          comments: clearanceForm.comments || null,
          user_id: currentUser.user_id,
        }),
      });
    }, 'Clearance recorded successfully.');
  }

  async function handleRevoke() {
    if (form.clearance_status !== 'Approved') {
      setTabError('Only Approved quarantines can be revoked.');
      return;
    }
    if (!revokeForm.revoke_reason.trim()) {
      setTabError('revoke_reason is required.');
      return;
    }
    if (!window.confirm('Revoke clearance for this quarantine?')) return;
    await runTabAction(async () => {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/revoke`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          revoke_reason: revokeForm.revoke_reason.trim(),
          user_id: currentUser.user_id,
        }),
      });
    }, 'Quarantine clearance revoked successfully.');
  }

  async function handleSoftDelete() {
    if (form.clearance_status === 'Pending') {
      setTabError('Cannot delete: quarantine is still active.');
      return;
    }
    if (!window.confirm('Soft delete this quarantine record?')) return;
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ reason: deleteReason || null, user_id: currentUser.user_id }),
      });
      setMessage('Quarantine record deleted successfully.');
      await loadQuarantineDetail(effectiveQuarantineId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to delete record.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleRestore() {
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id }),
      });
      setMessage('Quarantine record restored successfully.');
      await loadQuarantineDetail(effectiveQuarantineId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to restore record.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleHardDelete() {
    if (hardDeleteConfirmText.trim() !== (form.flock_number || '').trim()) {
      setTabError('Type the flock number exactly to enable hard delete.');
      return;
    }
    if (!window.confirm('Permanently delete this quarantine record? This cannot be undone.')) return;
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/quarantine-record/${effectiveQuarantineId}/hard-delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id, confirm: 1 }),
      });
      setMessage('Quarantine record hard-deleted successfully.');
      setForm({ ...emptyForm });
      setComputed({ days_in_quarantine: null, is_overdue: false });
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to hard delete record.');
    } finally {
      setDangerBusy(false);
    }
  }

  function openEdit(row) {
    setMessage('');
    setError('');
    setTabError('');
    loadQuarantineDetail(row.quarantine_id).catch((requestError) => setError(requestError.message || 'Failed to load detail.'));
  }

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / 10));
  const expectedPreviewBase = Number(form.expected_duration_days || 0);
  const expectedPreviewAdded = Number(extendForm.additional_days || 0);
  const canHardDelete = form.is_deleted && hardDeleteConfirmText.trim() === (form.flock_number || '').trim();

  return (
    <div className="p-3 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-[#1f2d2a]">Quarantine Record</h2>
            <p className="text-sm text-[#5d6d68]">Create, monitor, extend, clear, revoke, and govern flock quarantine records.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} disabled={refreshing || loading} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
            <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Back</button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
        {tabError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{tabError}</div>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr,1fr]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Linkage</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Import shipment</span><select required disabled={isEditMode} value={form.import_shipment_id} onChange={(event) => setForm((current) => ({ ...current, import_shipment_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select import shipment</option>{importShipments.map((row) => <option key={row.import_shipment_id} value={row.import_shipment_id}>{row.import_number} / {toDateInput(row.arrival_date)}</option>)}</select>{fieldError('import_shipment_id')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required disabled={isEditMode} value={form.flock_id} onChange={(event) => setForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number || row.flock_id}</option>)}</select>{fieldError('flock_id')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled={isEditMode} value={form.farm_id} onChange={(event) => setForm((current) => ({ ...current, farm_id: event.target.value, house_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select farm</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select>{fieldError('farm_id')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled={isEditMode || !form.farm_id} value={form.house_id} onChange={(event) => setForm((current) => ({ ...current, house_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select house</option>{houses.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code}</option>)}</select>{fieldError('house_id')}</label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Health incident (optional)</span><select disabled={isEditMode} value={form.health_incident_id} onChange={(event) => setForm((current) => ({ ...current, health_incident_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select health incident</option>{healthIncidents.map((row) => <option key={row.incident_id} value={row.incident_id}>{row.incident_type || row.incident_id}</option>)}</select></label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Quarantine Details</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Start date</span><input type="date" required disabled={isEditMode} value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />{fieldError('start_date')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Expected duration (days)</span><input type="number" min="0" value={form.expected_duration_days} onChange={(event) => setForm((current) => ({ ...current, expected_duration_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('expected_duration_days')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quarantine type</span><select required disabled={isEditMode} value={form.quarantine_type} onChange={(event) => setForm((current) => ({ ...current, quarantine_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">{choiceValues.quarantineTypes.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('quarantine_type')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Severity</span><select value={form.severity_level} onChange={(event) => setForm((current) => ({ ...current, severity_level: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select severity</option>{choiceValues.severityLevels.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('severity_level')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Veterinarian name</span><input maxLength="100" value={form.veterinarian_name} onChange={(event) => setForm((current) => ({ ...current, veterinarian_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Inspection frequency</span><select value={form.inspection_frequency} onChange={(event) => setForm((current) => ({ ...current, inspection_frequency: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{choiceValues.inspectionFrequencies.map((row) => <option key={row} value={row}>{row}</option>)}</select></label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Entry temperature (°C)</span><input type="number" min="0" max="50" step="0.01" value={form.entry_temperature_c} onChange={(event) => setForm((current) => ({ ...current, entry_temperature_c: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('entry_temperature_c')}</label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Clinical</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Observations</span><textarea rows="2" value={form.observations} onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Laboratory samples</span><textarea rows="2" value={form.laboratory_samples} onChange={(event) => setForm((current) => ({ ...current, laboratory_samples: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sample count</span><input type="number" min="0" value={form.sample_count} onChange={(event) => setForm((current) => ({ ...current, sample_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('sample_count')}</label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Workflow</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Clearance status</span><select disabled value={form.clearance_status} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 text-sm text-[#5d6d68]">{choiceValues.clearanceStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">End date</span><input type="date" readOnly value={form.end_date} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 text-sm text-[#5d6d68]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Clearance date</span><input type="date" readOnly value={form.clearance_date} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 text-sm text-[#5d6d68]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Clearance by</span><input readOnly value={form.clearance_by_username || ''} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] px-3 text-sm text-[#5d6d68]" /></label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Notes</h3>
              <div className="grid grid-cols-1 gap-3">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea rows="2" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Extension reason</span><textarea rows="2" readOnly value={form.extension_reason || ''} className="w-full rounded-xl border border-[#dfe8e1] bg-[#f4f7f5] p-3 text-sm text-[#5d6d68]" /></label>
              </div>
            </div>

            {isEditMode && !isPending && <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Cannot update: quarantine is no longer Pending (THROW 67031).</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setForm({ ...emptyForm }); setComputed({ days_in_quarantine: null, is_overdue: false }); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear</button>
              <button type="submit" disabled={saving || loading || (isEditMode && !isPending)} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditMode ? 'Save changes' : 'Create quarantine'}</button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e3ebea] bg-[#f9fcfa] p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Computed &amp; Detail Snapshot</h3>
              {isEditMode ? (
                <div className="grid grid-cols-1 gap-2 text-sm text-[#374744]">
                  <div><span className="text-[#5d6d68]">Import shipment:</span> <span className="font-semibold">{form.import_shipment_number || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Import arrival:</span> <span className="font-semibold">{formatDate(form.import_arrival_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Country:</span> <span className="font-semibold">{form.country_of_origin || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Flock:</span> <span className="font-semibold">{form.flock_number || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Poultry type:</span> <span className="font-semibold">{form.poultry_type || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Lifecycle stage:</span> <span className="font-semibold">{form.flock_lifecycle_stage || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Flock status:</span> <span className="font-semibold">{form.flock_status || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Farm / House:</span> <span className="font-semibold">{form.farm_name || '—'} / {form.house_code || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Health incident:</span> <span className="font-semibold">{form.health_incident_type || '—'} / {form.health_incident_severity || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Created by/date:</span> <span className="font-semibold">{form.created_by_username || '—'} / {formatDateTime(form.created_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Modified by/date:</span> <span className="font-semibold">{form.modified_by_username || '—'} / {formatDateTime(form.modified_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Deleted by/date:</span> <span className="font-semibold">{form.deleted_by_username || '—'} / {formatDateTime(form.deleted_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Clearance by:</span> <span className="font-semibold">{form.clearance_by_username || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Row version:</span> <span className="font-semibold">{form.row_version || '—'}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${form.is_deleted ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{form.is_deleted ? 'Deleted' : 'Active row'}</span>
                    {form.is_extended ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Extended</span> : null}
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${form.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{form.is_active ? 'Active quarantine' : 'Inactive quarantine'}</span>
                    {computed.is_overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">OVERDUE</span> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Days in quarantine</div><div className="text-base font-bold text-[#374744]">{computed.days_in_quarantine ?? '—'}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Duration variance</div><div className="text-base font-bold text-[#374744]">{form.duration_variance_days === null || form.duration_variance_days === undefined ? '—' : `${Number(form.duration_variance_days) > 0 ? '+' : ''}${form.duration_variance_days}`}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Extension count</div><div className="text-base font-bold text-[#374744]">{form.extension_count || 0}x</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Workflow status</div><div className="text-base font-bold text-[#374744]">{form.clearance_status || '—'}</div></div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5d6d68]">Save a quarantine record first to view computed metadata.</p>
              )}
            </div>

            {isEditMode && (
              <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  {['details', 'health', 'extend', 'clearance', 'revoke', 'danger'].map((tab) => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab ? 'bg-[#0f8b3d] text-white' : 'border border-[#dfe8e1] text-[#374744] hover:bg-[#f4f7f5]'}`}>
                      {tab === 'details' ? 'Details' : tab === 'health' ? 'Health Status' : tab === 'extend' ? 'Extend' : tab === 'clearance' ? 'Clearance' : tab === 'revoke' ? 'Revoke' : 'Danger Zone'}
                    </button>
                  ))}
                </div>

                {activeTab === 'details' && <div className="text-sm text-[#5d6d68]">Use tabs to manage quarantine lifecycle operations.</div>}

                {activeTab === 'health' && (
                  <div className="space-y-3">
                    <div className="text-xs text-[#5d6d68]">Current status: <span className={`rounded-full px-2 py-1 font-semibold ${healthClass[form.health_status] || 'bg-slate-100 text-slate-700'}`}>{form.health_status || '—'}</span></div>
                    {!isPending && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Cannot change health_status: quarantine is not Pending.</div>}
                    <label className="block text-sm font-medium text-[#374744]">New status<select value={healthChange.new_status} onChange={(event) => setHealthChange((current) => ({ ...current, new_status: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{choiceValues.healthStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select></label>
                    <label className="block text-sm font-medium text-[#374744]">Notes<textarea rows="2" value={healthChange.notes} onChange={(event) => setHealthChange((current) => ({ ...current, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <button type="button" disabled={saving || !isPending} onClick={handleChangeHealthStatus} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Change Health Status'}</button>
                  </div>
                )}

                {activeTab === 'extend' && (
                  <div className="space-y-3">
                    {!isPending && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Only Pending quarantines can be extended.</div>}
                    <label className="block text-sm font-medium text-[#374744]">Additional days<input type="number" min="1" value={extendForm.additional_days} onChange={(event) => setExtendForm((current) => ({ ...current, additional_days: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <label className="block text-sm font-medium text-[#374744]">Extension reason<textarea rows="2" maxLength="500" value={extendForm.extension_reason} onChange={(event) => setExtendForm((current) => ({ ...current, extension_reason: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <div className="rounded-lg border border-[#dfe8e1] bg-[#f9fcfa] px-3 py-2 text-xs text-[#5d6d68]">Expected duration {expectedPreviewBase} → {expectedPreviewBase + (Number.isFinite(expectedPreviewAdded) ? expectedPreviewAdded : 0)} days. Extension count {form.extension_count || 0} → {(form.extension_count || 0) + 1}.</div>
                    <button type="button" disabled={saving || !isPending} onClick={handleExtend} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Extend Quarantine'}</button>
                  </div>
                )}

                {activeTab === 'clearance' && (
                  <div className="space-y-3">
                    {!isPending && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Only Pending quarantines can be cleared or rejected.</div>}
                    <label className="block text-sm font-medium text-[#374744]">Decision<select value={clearanceForm.decision} onChange={(event) => setClearanceForm((current) => ({ ...current, decision: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></label>
                    <label className="block text-sm font-medium text-[#374744]">Clearance date<input type="date" value={clearanceForm.clearance_date} min={form.start_date || ''} onChange={(event) => setClearanceForm((current) => ({ ...current, clearance_date: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <label className="block text-sm font-medium text-[#374744]">Comments<textarea rows="2" value={clearanceForm.comments} onChange={(event) => setClearanceForm((current) => ({ ...current, comments: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">Setting Approved also sets health_status = Cleared and end_date = clearance_date.</div>
                    <button type="button" disabled={saving || !isPending} onClick={handleRecordClearance} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Record Clearance'}</button>
                  </div>
                )}

                {activeTab === 'revoke' && (
                  <div className="space-y-3">
                    {form.clearance_status !== 'Approved' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Only Approved quarantines can be revoked.</div>}
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Revoking clears end_date + duration_days + cleared_at, and increments extension_count.</div>
                    <label className="block text-sm font-medium text-[#374744]">Revoke reason<textarea rows="2" maxLength="500" value={revokeForm.revoke_reason} onChange={(event) => setRevokeForm({ revoke_reason: event.target.value })} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <button type="button" disabled={saving || form.clearance_status !== 'Approved'} onClick={handleRevoke} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Revoke Clearance'}</button>
                  </div>
                )}

                {activeTab === 'danger' && (
                  <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    {form.clearance_status === 'Pending' && <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">Cannot delete: quarantine is still active.</div>}
                    <label className="block text-sm font-medium text-[#7f1d1d]">Delete reason<textarea rows="2" maxLength="500" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="mt-1 w-full rounded-xl border border-red-200 p-3 text-sm outline-none" /></label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={dangerBusy || form.clearance_status === 'Pending'} onClick={handleSoftDelete} className="h-10 rounded-lg bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50">Soft Delete</button>
                      <button type="button" disabled={dangerBusy || !form.is_deleted} onClick={handleRestore} className="h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-700 disabled:opacity-50">Restore</button>
                    </div>
                    <label className="block text-sm font-medium text-[#7f1d1d]">Type flock number ({form.flock_number || 'N/A'}) to confirm hard delete<input value={hardDeleteConfirmText} onChange={(event) => setHardDeleteConfirmText(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm outline-none" /></label>
                    <button type="button" disabled={dangerBusy || !form.is_deleted || !canHardDelete} onClick={handleHardDelete} className="h-10 rounded-lg bg-[#6a1818] px-3 text-sm font-bold text-white disabled:opacity-50">Hard Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Total Quarantines', dashboard.kpis?.total_quarantines ?? 0, ''],
              ['Pending', dashboard.kpis?.pending ?? 0, ''],
              ['Approved', dashboard.kpis?.approved ?? 0, ''],
              ['Rejected', dashboard.kpis?.rejected ?? 0, ''],
              ['Revoked', dashboard.kpis?.revoked ?? 0, ''],
              ['Overdue', dashboard.kpis?.overdue ?? 0, 'text-red-700'],
              ['Extended', dashboard.kpis?.extended ?? 0, ''],
              ['Avg Duration (days)', dashboard.kpis?.avg_duration_days ?? '—', ''],
            ].map(([label, value, valueClass]) => (
              <div key={label} className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold text-[#5d6d68]">{label}</div>
                <div className={`mt-1 text-xl font-bold text-[#374744] ${valueClass}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#e3ebea] bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-[#374744]">Active Quarantine Monitor</h3>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {(dashboard.activeQuarantines || []).map((row) => (
                <div key={row.quarantine_id} className="rounded-xl border border-[#edf2ee] bg-[#f9fcfa] px-3 py-2 text-xs">
                  <div className="font-semibold text-[#374744]">{row.flock_number || row.flock_id}</div>
                  <div className="text-[#5d6d68]">Start: {formatDate(row.start_date)} • Days: {row.days_active ?? 0}</div>
                  <div className="mt-1 flex gap-1">{row.is_overdue ? <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">OVERDUE</span> : null}{row.severity_level ? <span className={`rounded-full px-2 py-0.5 font-semibold ${severityClass[row.severity_level] || 'bg-slate-100 text-slate-700'}`}>{row.severity_level}</span> : null}</div>
                </div>
              ))}
              {(!dashboard.activeQuarantines || dashboard.activeQuarantines.length === 0) && <div className="text-xs text-[#5d6d68]">No active quarantines found.</div>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input value={filters.search_text} onChange={(event) => setFilters((current) => ({ ...current, search_text: event.target.value }))} placeholder="Search flock / veterinarian" className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={filters.farm_id} onChange={(event) => setFilters((current) => ({ ...current, farm_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All farms</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select>
            <select value={filters.import_shipment_id} onChange={(event) => setFilters((current) => ({ ...current, import_shipment_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All import shipments</option>{importShipments.map((row) => <option key={row.import_shipment_id} value={row.import_shipment_id}>{row.import_number}</option>)}</select>
            <select value={filters.health_status} onChange={(event) => setFilters((current) => ({ ...current, health_status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All health statuses</option>{choiceValues.healthStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <select value={filters.clearance_status} onChange={(event) => setFilters((current) => ({ ...current, clearance_status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All clearance statuses</option>{choiceValues.clearanceStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <select value={filters.quarantine_type} onChange={(event) => setFilters((current) => ({ ...current, quarantine_type: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All types</option>{choiceValues.quarantineTypes.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <select value={filters.severity_level} onChange={(event) => setFilters((current) => ({ ...current, severity_level: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All severities</option>{choiceValues.severityLevels.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <input type="date" value={filters.from_date} onChange={(event) => setFilters((current) => ({ ...current, from_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={filters.to_date} onChange={(event) => setFilters((current) => ({ ...current, to_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[#374744]">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.active_only} onChange={(event) => setFilters((current) => ({ ...current, active_only: event.target.checked }))} /> Active only</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.overdue_only} onChange={(event) => setFilters((current) => ({ ...current, overdue_only: event.target.checked }))} /> Overdue only</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.include_deleted} onChange={(event) => setFilters((current) => ({ ...current, include_deleted: event.target.checked }))} /> Include deleted</label>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setPageNumber(1); loadListAndDashboard().catch((requestError) => setError(requestError.message)); }} className="h-10 rounded-lg bg-[#0f8b3d] px-4 text-sm font-semibold text-white hover:bg-[#0c7133]">Apply</button>
            <button type="button" onClick={resetFilters} className="h-10 rounded-lg border border-[#dfe8e1] px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Reset</button>
          </div>

          <div className="responsive-table-shell overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2 font-semibold">Flock</th>
                  <th className="px-2 py-2 font-semibold">Farm / House</th>
                  <th className="px-2 py-2 font-semibold">Import #</th>
                  <th className="px-2 py-2 font-semibold">Start</th>
                  <th className="px-2 py-2 font-semibold">Expected</th>
                  <th className="px-2 py-2 font-semibold">Duration</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Severity</th>
                  <th className="px-2 py-2 font-semibold">Health</th>
                  <th className="px-2 py-2 font-semibold">Clearance</th>
                  <th className="px-2 py-2 font-semibold">Flags</th>
                  <th className="px-2 py-2 font-semibold">Days</th>
                  <th className="px-2 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 ? (
                  <tr><td colSpan="13" className="px-2 py-6 text-center text-[#5d6d68]">No quarantine records found for selected filters.</td></tr>
                ) : listRows.map((row) => (
                  <tr key={row.quarantine_id} className={`border-b border-[#f0f3f1] text-[#30433f] ${row.is_overdue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                    <td className="px-2 py-2">{row.farm_name || row.farm_id} / {row.house_code || row.house_id}</td>
                    <td className="px-2 py-2">{row.import_shipment_number || '—'}</td>
                    <td className="px-2 py-2">{formatDate(row.start_date)}</td>
                    <td className="px-2 py-2">{row.expected_duration_days ?? '—'}</td>
                    <td className="px-2 py-2">{row.duration_days ?? '—'}</td>
                    <td className="px-2 py-2">{row.quarantine_type || '—'}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityClass[row.severity_level] || 'bg-slate-100 text-slate-700'}`}>{row.severity_level || '—'}</span></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${healthClass[row.health_status] || 'bg-slate-100 text-slate-700'}`}>{row.health_status || '—'}</span></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${clearanceClass[row.clearance_status] || 'bg-slate-100 text-slate-700'}`}>{row.clearance_status || '—'}</span></td>
                    <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{row.is_extended ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Extended</span> : null}{row.is_overdue ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">OVERDUE</span> : null}</div></td>
                    <td className="px-2 py-2">{row.days_in_quarantine ?? '—'}</td>
                    <td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5]">Edit</button><button type="button" onClick={() => { openEdit(row); setActiveTab('danger'); }} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">Danger</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-[#5d6d68]">
            <span>{totalCount} record{totalCount === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span>Page {pageNumber} of {totalPages}</span>
              <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-[#374744]">Pending Clearances</h3>
          <div className="responsive-table-shell overflow-x-auto">
            <table className="w-full min-w-140 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2 font-semibold">Flock</th>
                  <th className="px-2 py-2 font-semibold">Start Date</th>
                  <th className="px-2 py-2 font-semibold">Expected Days</th>
                  <th className="px-2 py-2 font-semibold">Health Status</th>
                  <th className="px-2 py-2 font-semibold">Veterinarian</th>
                  <th className="px-2 py-2 font-semibold">Days Active</th>
                  <th className="px-2 py-2 font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {pendingClearanceRows.length === 0 ? (
                  <tr><td colSpan="7" className="px-2 py-6 text-center text-[#5d6d68]">No pending clearances.</td></tr>
                ) : pendingClearanceRows.map((row) => (
                  <tr key={row.quarantine_id} className={`border-b border-[#f0f3f1] ${row.is_overdue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                    <td className="px-2 py-2">{formatDate(row.start_date)}</td>
                    <td className="px-2 py-2">{row.expected_duration_days ?? '—'}</td>
                    <td className="px-2 py-2">{row.health_status || '—'}</td>
                    <td className="px-2 py-2">{row.veterinarian_name || '—'}</td>
                    <td className="px-2 py-2">{row.days_active ?? '—'}</td>
                    <td className="px-2 py-2">{row.is_overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">OVERDUE</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
