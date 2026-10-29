import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;

const STATUS_COLORS = {
  Available: 'bg-emerald-100 text-emerald-800',
  'Partially-Allocated': 'bg-amber-100 text-amber-800',
  'Fully-Allocated': 'bg-sky-100 text-sky-800',
  Disposed: 'bg-slate-200 text-slate-800',
};

const QUALITY_COLORS = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-amber-100 text-amber-800',
  C: 'bg-orange-100 text-orange-800',
  Reject: 'bg-red-100 text-red-800',
  Mixed: 'bg-slate-100 text-slate-700',
};

const emptyForm = {
  chick_batch_id: '',
  chick_batch_number: '',
  hatchery_batch_id: '',
  hatch_date: '',
  total_chicks: '',
  female_chicks: '0',
  male_chicks: '0',
  expected_chicks: '',
  avg_chick_weight_g: '',
  avg_chick_size_cm: '',
  chick_quality_grade: '',
  grade_a_count: '0',
  grade_b_count: '0',
  grade_c_count: '0',
  sexing_method: '',
  sexing_accuracy_pct: '',
  vaccinations_applied: '',
  notes: '',
  total_allocated: 0,
  total_sold: 0,
  total_transferred: 0,
  total_disposed: 0,
  available_quantity: 0,
  allocation_percent: 0,
  status: 'Available',
  hatch_rate_variance: null,
  dispatch_started_at: '',
  dispatch_completed_at: '',
  dispatch_duration_minutes: null,
  sale_allocation_count: 0,
  transfer_count: 0,
  hatchery_batch_number: '',
  hatchery_code: '',
  hatchery_name: '',
  parent_flock_number: '',
  breed_code: '',
  breed_name: '',
  strain_code: '',
  strain_name: '',
  eggs_set_count: null,
  eggs_fertile_count: null,
  fertility_percent: null,
  hatchability_percent: null,
  created_by_username: '',
  modified_by_username: '',
  deleted_by_username: '',
  row_version: '',
  is_deleted: false,
};

const emptyFilters = {
  search_text: '',
  hatchery_batch_id: '',
  hatchery_id: '',
  status: '',
  quality_grade: '',
  available_only: false,
  from_hatch_date: '',
  to_hatch_date: '',
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
    chick_batch_id: row.chick_batch_id || '',
    chick_batch_number: row.chick_batch_number || '',
    hatchery_batch_id: row.hatchery_batch_id || '',
    hatch_date: toDateInput(row.hatch_date),
    total_chicks: row.total_chicks ?? '',
    female_chicks: row.female_chicks ?? 0,
    male_chicks: row.male_chicks ?? 0,
    expected_chicks: row.expected_chicks ?? '',
    avg_chick_weight_g: row.avg_chick_weight_g ?? '',
    avg_chick_size_cm: row.avg_chick_size_cm ?? '',
    chick_quality_grade: row.chick_quality_grade || '',
    grade_a_count: row.grade_a_count ?? 0,
    grade_b_count: row.grade_b_count ?? 0,
    grade_c_count: row.grade_c_count ?? 0,
    sexing_method: row.sexing_method || '',
    sexing_accuracy_pct: row.sexing_accuracy_pct ?? '',
    vaccinations_applied: row.vaccinations_applied || '',
    notes: row.notes || '',
    total_allocated: Number(row.total_allocated) || 0,
    total_sold: Number(row.total_sold) || 0,
    total_transferred: Number(row.total_transferred) || 0,
    total_disposed: Number(row.total_disposed) || 0,
    available_quantity: Number(row.available_quantity) || 0,
    allocation_percent: Number(row.allocation_percent) || 0,
    status: row.status || 'Available',
    hatch_rate_variance: row.hatch_rate_variance === null || row.hatch_rate_variance === undefined ? null : Number(row.hatch_rate_variance),
    dispatch_started_at: row.dispatch_started_at || '',
    dispatch_completed_at: row.dispatch_completed_at || '',
    dispatch_duration_minutes: row.dispatch_duration_minutes === null || row.dispatch_duration_minutes === undefined ? null : Number(row.dispatch_duration_minutes),
    sale_allocation_count: Number(row.sale_allocation_count) || 0,
    transfer_count: Number(row.transfer_count) || 0,
    hatchery_batch_number: row.hatchery_batch_number || '',
    hatchery_code: row.hatchery_code || '',
    hatchery_name: row.hatchery_name || '',
    parent_flock_number: row.parent_flock_number || '',
    breed_code: row.breed_code || '',
    breed_name: row.breed_name || '',
    strain_code: row.strain_code || '',
    strain_name: row.strain_name || '',
    eggs_set_count: row.eggs_set_count ?? null,
    eggs_fertile_count: row.eggs_fertile_count ?? null,
    fertility_percent: row.fertility_percent ?? null,
    hatchability_percent: row.hatchability_percent ?? null,
    created_by_username: row.created_by_username || '',
    modified_by_username: row.modified_by_username || '',
    deleted_by_username: row.deleted_by_username || '',
    row_version: normalizeRowVersion(row.row_version),
    is_deleted: Boolean(row.is_deleted),
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

export default function ChickBatchForm({ currentUser, chickBatchId = null, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [originalForm, setOriginalForm] = useState({ ...emptyForm });
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [listRows, setListRows] = useState([]);
  const [dashboard, setDashboard] = useState({ kpis: {} });
  const [availableRows, setAvailableRows] = useState([]);
  const [qualityRows, setQualityRows] = useState([]);
  const [reconciliationRows, setReconciliationRows] = useState([]);
  const [traceability, setTraceability] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState('form');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [hatcheryBatches, setHatcheryBatches] = useState([]);
  const [hatcheries, setHatcheries] = useState([]);
  const [users, setUsers] = useState([]);
  const [choiceValues, setChoiceValues] = useState({
    statuses: ['Available', 'Partially-Allocated', 'Fully-Allocated', 'Disposed'],
    qualityGrades: ['A', 'B', 'C', 'Reject', 'Mixed'],
    sexingMethods: ['Feather Sexing', 'Vent Sexing', 'Color Sexing', 'Not Sexed', 'Mixed'],
    dispatchEvents: ['Start', 'Complete'],
  });

  const [statusChange, setStatusChange] = useState({ new_status: '', notes: '' });
  const [disposeInput, setDisposeInput] = useState({ quantity: '', reason: '' });
  const [reconcileFix, setReconcileFix] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');

  const effectiveChickBatchId = form.chick_batch_id || chickBatchId || null;
  const isEditMode = Boolean(effectiveChickBatchId);
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / 10));

  const sexTotal = (Number(form.female_chicks) || 0) + (Number(form.male_chicks) || 0);
  const gradeTotal = (Number(form.grade_a_count) || 0) + (Number(form.grade_b_count) || 0) + (Number(form.grade_c_count) || 0);
  const totalChicksNum = Number(form.total_chicks) || 0;
  const expectedChicksNum = form.expected_chicks === '' ? null : Number(form.expected_chicks);
  const gradeAPercent = totalChicksNum > 0 ? ((Number(form.grade_a_count) || 0) / totalChicksNum) * 100 : 0;
  const isGradeLocked = Number(form.total_allocated) > 0;
  const gradeFieldsChanged = useMemo(() => (
    String(form.grade_a_count) !== String(originalForm.grade_a_count)
    || String(form.grade_b_count) !== String(originalForm.grade_b_count)
    || String(form.grade_c_count) !== String(originalForm.grade_c_count)
  ), [form.grade_a_count, form.grade_b_count, form.grade_c_count, originalForm.grade_a_count, originalForm.grade_b_count, originalForm.grade_c_count]);

  const hasUnsavedDraft = useMemo(() => (
    Boolean(form.hatchery_batch_id)
    || (Number(form.total_chicks) || 0) > 0
    || Boolean((form.chick_batch_number || '').trim())
  ), [form.hatchery_batch_id, form.total_chicks, form.chick_batch_number]);

  const canSoftDelete = !form.is_deleted && Number(form.sale_allocation_count) === 0 && Number(form.transfer_count) === 0;
  const canRestore = form.is_deleted;
  const canHardDelete = form.is_deleted
    && Number(form.sale_allocation_count) === 0
    && Number(form.transfer_count) === 0
    && hardDeleteConfirmText.trim() === (form.chick_batch_number || '').trim();

  function fieldError(name) {
    return fieldErrors[name] ? <div className="mt-1 text-xs text-red-600">{fieldErrors[name]}</div> : null;
  }

  const loadChickBatchDetail = useCallback(async (id) => {
    if (!currentUser?.accessToken || !id) return;
    const [detailPayload, availablePayload, reconPayload, tracePayload] = await Promise.all([
      apiRequest(`/hatchery/chick-batch/${id}`, currentUser.accessToken),
      apiRequest(`/hatchery/chick-batch/functions/${id}/available`, currentUser.accessToken),
      apiRequest(`/hatchery/chick-batch/functions/reconciliation?chick_batch_id=${encodeURIComponent(id)}`, currentUser.accessToken),
      apiRequest(`/hatchery/chick-batch/reports/parent-traceability?chick_batch_id=${encodeURIComponent(id)}`, currentUser.accessToken),
    ]);
    const nextForm = toForm({
      ...(detailPayload.data || {}),
      available_quantity: Number(availablePayload.data?.available_quantity ?? detailPayload.data?.available_quantity) || 0,
    });
    setForm(nextForm);
    setOriginalForm(nextForm);
    setReconciliationRows(Array.isArray(reconPayload.data) ? reconPayload.data : []);
    const traceRows = Array.isArray(tracePayload.data) ? tracePayload.data : [];
    setTraceability(traceRows[0] || null);
  }, [currentUser?.accessToken]);

  const loadListAndDashboard = useCallback(async () => {
    const params = new URLSearchParams({
      page_number: String(pageNumber),
      page_size: '10',
      include_deleted: filters.include_deleted ? '1' : '0',
    });
    if (filters.search_text) params.set('search_text', filters.search_text);
    if (filters.hatchery_batch_id) params.set('hatchery_batch_id', filters.hatchery_batch_id);
    if (filters.hatchery_id) params.set('hatchery_id', filters.hatchery_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.quality_grade) params.set('quality_grade', filters.quality_grade);
    if (filters.available_only) params.set('available_only', '1');
    if (filters.from_hatch_date) params.set('from_hatch_date', filters.from_hatch_date);
    if (filters.to_hatch_date) params.set('to_hatch_date', filters.to_hatch_date);

    const dashboardQuery = filters.hatchery_id ? `?hatchery_id=${encodeURIComponent(filters.hatchery_id)}` : '';
    const availableQuery = filters.hatchery_id ? `?hatchery_id=${encodeURIComponent(filters.hatchery_id)}` : '';
    const [listPayload, dashboardPayload, availablePayload, reconPayload] = await Promise.all([
      apiRequest(`/hatchery/chick-batch?${params.toString()}`, currentUser.accessToken),
      apiRequest(`/hatchery/chick-batch/reports/dashboard${dashboardQuery}`, currentUser.accessToken),
      apiRequest(`/hatchery/chick-batch/functions/available${availableQuery}`, currentUser.accessToken),
      apiRequest('/hatchery/chick-batch/functions/reconciliation', currentUser.accessToken),
    ]);

    setListRows(Array.isArray(listPayload.data) ? listPayload.data : []);
    setTotalCount(Number(listPayload.totalCount) || 0);
    setDashboard(dashboardPayload.data || { kpis: {} });
    setAvailableRows(Array.isArray(availablePayload.data) ? availablePayload.data : []);
    setQualityRows(Array.isArray(dashboardPayload.data?.recentQuality) ? dashboardPayload.data.recentQuality : []);
    setReconciliationRows(Array.isArray(reconPayload.data) ? reconPayload.data : []);
  }, [currentUser?.accessToken, filters, pageNumber]);

  const loadData = useCallback(async () => {
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setTabError('');
    try {
      const [batchPayload, hatcheryPayload, userPayload, choicePayload] = await Promise.all([
        apiRequest(`/hatchery/batch?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/hatchery?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest(`/security/users?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest('/hatchery/chick-batch/choice-values', currentUser.accessToken),
      ]);
      setHatcheryBatches(Array.isArray(batchPayload.data) ? batchPayload.data : []);
      setHatcheries(Array.isArray(hatcheryPayload.data) ? hatcheryPayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
      if (choicePayload.data) setChoiceValues(choicePayload.data);

      await loadListAndDashboard();
      if (effectiveChickBatchId) {
        await loadChickBatchDetail(effectiveChickBatchId);
      } else {
        setForm({ ...emptyForm });
        setOriginalForm({ ...emptyForm });
        setTraceability(null);
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load chick batch data.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.accessToken, effectiveChickBatchId, loadChickBatchDetail, loadListAndDashboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!currentUser?.accessToken) return;
    loadListAndDashboard().catch((requestError) => {
      setError(requestError.message || 'Failed to refresh chick batch list.');
    });
  }, [currentUser?.accessToken, loadListAndDashboard]);

  useEffect(() => {
    setTabError('');
    setFieldErrors({});
  }, [activeTab]);

  function resetFilters() {
    setFilters({ ...emptyFilters });
    setPageNumber(1);
  }

  function validateForm() {
    const nextErrors = {};
    const total = Number(form.total_chicks);
    const female = Number(form.female_chicks) || 0;
    const male = Number(form.male_chicks) || 0;
    const expected = form.expected_chicks === '' ? null : Number(form.expected_chicks);
    const weight = form.avg_chick_weight_g === '' ? null : Number(form.avg_chick_weight_g);
    const size = form.avg_chick_size_cm === '' ? null : Number(form.avg_chick_size_cm);
    const sexingAccuracy = form.sexing_accuracy_pct === '' ? null : Number(form.sexing_accuracy_pct);

    if (!form.hatchery_batch_id) nextErrors.hatchery_batch_id = 'Hatchery batch is required.';
    if (!form.hatch_date) nextErrors.hatch_date = 'Hatch date is required.';
    if (!Number.isFinite(total) || total <= 0) nextErrors.total_chicks = 'total_chicks must be > 0.';
    if ((female + male) !== total) nextErrors.female_chicks = 'female_chicks + male_chicks must equal total_chicks.';
    if (gradeTotal > total) nextErrors.grade_a_count = 'A + B + C must not exceed total_chicks.';
    if (form.sexing_method && !choiceValues.sexingMethods.includes(form.sexing_method)) nextErrors.sexing_method = 'Invalid sexing method.';
    if (sexingAccuracy !== null && (sexingAccuracy < 0 || sexingAccuracy > 100)) nextErrors.sexing_accuracy_pct = 'sexing_accuracy_pct must be between 0 and 100.';
    if (form.chick_quality_grade && !choiceValues.qualityGrades.includes(form.chick_quality_grade)) nextErrors.chick_quality_grade = 'Invalid quality grade.';
    if (expected !== null && expected < 0) nextErrors.expected_chicks = 'expected_chicks must be >= 0.';
    if (weight !== null && weight <= 0) nextErrors.avg_chick_weight_g = 'avg_chick_weight_g must be > 0.';
    if (size !== null && size <= 0) nextErrors.avg_chick_size_cm = 'avg_chick_size_cm must be > 0.';
    if (isEditMode && isGradeLocked && gradeFieldsChanged) nextErrors.grade_a_count = 'Grade counts are locked after allocation starts.';

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      return;
    }
    if (!validateForm()) {
      setError('Please correct the highlighted fields.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (!isEditMode) {
        const created = await apiRequest('/hatchery/chick-batch', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({
            hatchery_batch_id: form.hatchery_batch_id,
            chick_batch_number: (form.chick_batch_number || '').trim() || null,
            hatch_date: form.hatch_date,
            total_chicks: intOrNull(form.total_chicks),
            female_chicks: intOrNull(form.female_chicks) ?? 0,
            male_chicks: intOrNull(form.male_chicks) ?? 0,
            expected_chicks: intOrNull(form.expected_chicks),
            avg_chick_weight_g: numberOrNull(form.avg_chick_weight_g),
            avg_chick_size_cm: numberOrNull(form.avg_chick_size_cm),
            chick_quality_grade: form.chick_quality_grade || null,
            grade_a_count: intOrNull(form.grade_a_count) ?? 0,
            grade_b_count: intOrNull(form.grade_b_count) ?? 0,
            grade_c_count: intOrNull(form.grade_c_count) ?? 0,
            sexing_method: form.sexing_method || null,
            sexing_accuracy_pct: numberOrNull(form.sexing_accuracy_pct),
            vaccinations_applied: form.vaccinations_applied || null,
            notes: form.notes || null,
            user_id: currentUser.user_id || null,
          }),
        });
        const createdId = created.data?.chick_batch_id || created.data?.new_chick_batch_id;
        if (createdId) await loadChickBatchDetail(createdId);
        setMessage('Chick batch created successfully.');
      } else {
        await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify({
            expected_chicks: intOrNull(form.expected_chicks),
            avg_chick_weight_g: numberOrNull(form.avg_chick_weight_g),
            avg_chick_size_cm: numberOrNull(form.avg_chick_size_cm),
            chick_quality_grade: form.chick_quality_grade || null,
            grade_a_count: intOrNull(form.grade_a_count),
            grade_b_count: intOrNull(form.grade_b_count),
            grade_c_count: intOrNull(form.grade_c_count),
            sexing_method: form.sexing_method || null,
            sexing_accuracy_pct: numberOrNull(form.sexing_accuracy_pct),
            vaccinations_applied: form.vaccinations_applied || null,
            notes: form.notes || null,
            user_id: currentUser.user_id || null,
          }),
        });
        await loadChickBatchDetail(effectiveChickBatchId);
        setMessage('Chick batch updated successfully.');
      }
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Failed to save chick batch.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    setError('');
    setMessage('');
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  function startNewChickBatch() {
    if (hasUnsavedDraft && !window.confirm('You have unsaved draft values. Start a new chick batch anyway?')) return;
    setForm({ ...emptyForm });
    setOriginalForm({ ...emptyForm });
    setTraceability(null);
    setStatusChange({ new_status: '', notes: '' });
    setDisposeInput({ quantity: '', reason: '' });
    setReconcileFix(false);
    setDeleteReason('');
    setHardDeleteConfirmText('');
    setFieldErrors({});
    setTabError('');
    setMessage('');
    setWorkspaceTab('form');
    setActiveTab('overview');
  }

  function handleBack() {
    if (hasUnsavedDraft && !window.confirm('You have unsaved draft values. Leave this form?')) return;
    if (onCancel) onCancel();
  }

  async function openEdit(id, tab = 'overview') {
    setError('');
    setTabError('');
    setMessage('');
    try {
      await loadChickBatchDetail(id);
      setWorkspaceTab('form');
      setActiveTab(tab);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load chick batch detail.');
    }
  }

  async function submitStatusChange() {
    if (!effectiveChickBatchId) {
      setTabError('Save chick batch first.');
      return;
    }
    if (!statusChange.new_status) {
      setTabError('Select new status.');
      return;
    }
    if (statusChange.new_status === 'Disposed' && Number(form.available_quantity) > 0) {
      setTabError('Write off remaining quantity first. Cannot set Disposed while availability > 0.');
      return;
    }
    if (statusChange.new_status === 'Fully-Allocated' && Number(form.available_quantity) > 0) {
      setTabError('Cannot set Fully-Allocated while availability > 0.');
      return;
    }
    if (!window.confirm('Change chick batch status?')) return;

    setSaving(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: statusChange.new_status,
          notes: statusChange.notes || null,
          user_id: currentUser.user_id || null,
        }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setMessage('Status changed successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Status change failed.');
    } finally {
      setSaving(false);
    }
  }

  async function submitDispatch(eventName) {
    if (!effectiveChickBatchId) {
      setTabError('Save chick batch first.');
      return;
    }
    if (!window.confirm(`${eventName} dispatch event now?`)) return;
    setSaving(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/mark-dispatch`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ event: eventName, user_id: currentUser.user_id || null }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setMessage(`Dispatch ${eventName.toLowerCase()} recorded successfully.`);
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Dispatch action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function submitDispose() {
    if (!effectiveChickBatchId) {
      setTabError('Save chick batch first.');
      return;
    }
    const quantity = intOrNull(disposeInput.quantity);
    if (!quantity || quantity <= 0) {
      setTabError('quantity must be > 0.');
      return;
    }
    if (quantity > Number(form.available_quantity)) {
      setTabError('Dispose quantity cannot exceed available quantity.');
      return;
    }
    if (!(disposeInput.reason || '').trim()) {
      setTabError('Disposal reason is required.');
      return;
    }
    if (!window.confirm('Dispose chicks from this batch?')) return;

    setSaving(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/dispose`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          quantity,
          reason: disposeInput.reason.trim(),
          user_id: currentUser.user_id || null,
        }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setDisposeInput({ quantity: '', reason: '' });
      setMessage('Disposal applied successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Dispose action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function submitReconcile() {
    if (!effectiveChickBatchId) {
      setTabError('Save chick batch first.');
      return;
    }
    if (!window.confirm(reconcileFix ? 'Run reconciliation and apply fix?' : 'Run reconciliation check?')) return;
    setSaving(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/reconcile`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ fix: reconcileFix, user_id: currentUser.user_id || null }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setMessage(reconcileFix ? 'Reconciliation completed and totals were fixed.' : 'Reconciliation completed.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Reconciliation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSoftDelete() {
    if (!canSoftDelete) {
      setTabError(Number(form.sale_allocation_count) > 0
        ? 'Cannot delete: sale allocations exist.'
        : 'Cannot delete: farm transfers exist.');
      return;
    }
    if (!window.confirm('Soft delete this chick batch?')) return;

    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ reason: deleteReason || null, user_id: currentUser.user_id || null }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setMessage('Chick batch soft-deleted successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Soft delete failed.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleRestore() {
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      await loadChickBatchDetail(effectiveChickBatchId);
      await loadListAndDashboard();
      setMessage('Chick batch restored successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Restore failed.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleHardDelete() {
    if (!canHardDelete) {
      setTabError('Type chick batch number exactly, and ensure it is soft-deleted with no allocations/transfers.');
      return;
    }
    if (!window.confirm('Permanently delete this chick batch? This cannot be undone.')) return;

    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/hatchery/chick-batch/${effectiveChickBatchId}/hard-delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: 1 }),
      });
      setForm({ ...emptyForm });
      setOriginalForm({ ...emptyForm });
      setTraceability(null);
      setHardDeleteConfirmText('');
      await loadListAndDashboard();
      setMessage('Chick batch permanently deleted.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Hard delete failed.');
    } finally {
      setDangerBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-[#20392D]">Chicken Batch</h2>
            <p className="text-sm text-[#5d6d68]">Create and manage hatchery chick batches, allocations, dispatch, disposal, and reconciliation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleBack} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Back</button>
            <button type="button" onClick={refreshAll} disabled={refreshing || loading} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
            <button type="button" onClick={startNewChickBatch} className="h-11 rounded-xl bg-[#147D4A] px-4 text-sm font-bold text-white hover:bg-[#0f8b3d]">New Chick Batch</button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
        {tabError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{tabError}</div>}
        {isEditMode && isGradeLocked && gradeFieldsChanged && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Grade counts locked after allocation has begun (THROW 69021).
          </div>
        )}

        <div className="rounded-2xl border border-[#e2ebe3] bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setWorkspaceTab('form')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'form' ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#20392D] hover:bg-[#f4f7f5]'}`}>Record Form</button>
            <button type="button" onClick={() => setWorkspaceTab('datalist')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'datalist' ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#20392D] hover:bg-[#f4f7f5]'}`}>Data List</button>
          </div>
        </div>

        {workspaceTab === 'form' && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr,1fr]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Batch Identity</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]">
                      <span className="mb-1 block">Hatchery batch *</span>
                      <select value={form.hatchery_batch_id} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, hatchery_batch_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]">
                        <option value="">Select hatchery batch</option>
                        {hatcheryBatches.map((row) => <option key={row.batch_id} value={row.batch_id}>{row.batch_number} — {row.hatchery_name || row.hatchery_code || 'Hatchery'}</option>)}
                      </select>
                      {fieldError('hatchery_batch_id')}
                    </label>
                    <label className="text-sm font-medium text-[#374744]">
                      <span className="mb-1 block">Chick batch number</span>
                      <input value={form.chick_batch_number} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, chick_batch_number: event.target.value }))} placeholder="Auto-generated via GenerateBusinessCode — leave blank" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" />
                    </label>
                    <label className="text-sm font-medium text-[#374744]">
                      <span className="mb-1 block">Hatch date *</span>
                      <input type="date" value={form.hatch_date} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" />
                      {fieldError('hatch_date')}
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Bird Counts</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Total chicks *</span><input type="number" min="1" value={form.total_chicks} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, total_chicks: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" />{fieldError('total_chicks')}</label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Female chicks</span><input type="number" min="0" value={form.female_chicks} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, female_chicks: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" />{fieldError('female_chicks')}</label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Male chicks</span><input type="number" min="0" value={form.male_chicks} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, male_chicks: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" /></label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Expected chicks</span><input type="number" min="0" value={form.expected_chicks} onChange={(event) => setForm((current) => ({ ...current, expected_chicks: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />{fieldError('expected_chicks')}</label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-1 ${sexTotal === totalChicksNum ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>Sex split: {femaleChicks(form)} + {maleChicks(form)} = {sexTotal} {sexTotal === totalChicksNum ? 'OK' : '(must equal total_chicks)'}</span>
                    {expectedChicksNum !== null && Number.isFinite(expectedChicksNum) && (
                      <span className={`rounded-full px-2 py-1 ${(totalChicksNum - expectedChicksNum) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>Hatch-rate variance: {(totalChicksNum - expectedChicksNum) >= 0 ? '+' : ''}{totalChicksNum - expectedChicksNum}</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Quality Grades</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]">
                      <span className="mb-1 block">Quality grade</span>
                      <select value={form.chick_quality_grade} onChange={(event) => setForm((current) => ({ ...current, chick_quality_grade: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]">
                        <option value="">Select grade</option>
                        {choiceValues.qualityGrades.map((row) => <option key={row} value={row}>{row}</option>)}
                      </select>
                      {fieldError('chick_quality_grade')}
                    </label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Grade A count</span><input type="number" min="0" value={form.grade_a_count} disabled={isGradeLocked} onChange={(event) => setForm((current) => ({ ...current, grade_a_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" />{fieldError('grade_a_count')}</label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Grade B count</span><input type="number" min="0" value={form.grade_b_count} disabled={isGradeLocked} onChange={(event) => setForm((current) => ({ ...current, grade_b_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" /></label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Grade C count</span><input type="number" min="0" value={form.grade_c_count} disabled={isGradeLocked} onChange={(event) => setForm((current) => ({ ...current, grade_c_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A] disabled:bg-[#f4f7f5]" /></label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-1 ${gradeTotal <= totalChicksNum ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>Grades total: {gradeTotal} / {totalChicksNum || 0}</span>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">Grade A %: {gradeAPercent.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Sexing & Vaccination</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sexing method</span><select value={form.sexing_method} onChange={(event) => setForm((current) => ({ ...current, sexing_method: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">Select method</option>{choiceValues.sexingMethods.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('sexing_method')}</label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Sexing accuracy %</span><input type="number" min="0" max="100" step="0.01" value={form.sexing_accuracy_pct} onChange={(event) => setForm((current) => ({ ...current, sexing_accuracy_pct: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />{fieldError('sexing_accuracy_pct')}</label>
                  </div>
                  <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Vaccinations applied</span><textarea value={form.vaccinations_applied} onChange={(event) => setForm((current) => ({ ...current, vaccinations_applied: event.target.value }))} rows={3} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#147D4A]" /></label>
                </div>

                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Measurements & Notes</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Avg chick weight (g)</span><input type="number" min="0.01" step="0.01" value={form.avg_chick_weight_g} onChange={(event) => setForm((current) => ({ ...current, avg_chick_weight_g: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />{fieldError('avg_chick_weight_g')}</label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Avg chick size (cm)</span><input type="number" min="0.01" step="0.01" value={form.avg_chick_size_cm} onChange={(event) => setForm((current) => ({ ...current, avg_chick_size_cm: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />{fieldError('avg_chick_size_cm')}</label>
                  </div>
                  <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#147D4A]" /></label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className="h-11 rounded-xl bg-[#147D4A] px-5 text-sm font-bold text-white hover:bg-[#0f8b3d] disabled:opacity-50">{saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Chick Batch')}</button>
                  <button type="button" onClick={startNewChickBatch} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear</button>
                </div>
              </form>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[#e2ebe3] bg-[#f9fcfa] p-4 shadow-sm">
                  <h3 className="mb-3 text-base font-bold text-[#374744]">Computed Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Batch #</div><div className="font-semibold text-[#20392D]">{form.chick_batch_number || '—'}</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Status</div><div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[form.status] || 'bg-slate-100 text-slate-700'}`}>{form.status || 'N/A'}</span></div></div>
                    <div className="col-span-2 rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Available quantity</div><div className="text-xl font-bold text-[#147D4A]">{Number(form.available_quantity || 0).toLocaleString()}</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Allocated %</div><div className="font-semibold text-[#20392D]">{Number(form.allocation_percent || 0).toFixed(2)}%</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Hatch variance</div><div className={`font-semibold ${Number(form.hatch_rate_variance || 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{form.hatch_rate_variance === null || form.hatch_rate_variance === undefined ? '—' : `${Number(form.hatch_rate_variance) > 0 ? '+' : ''}${form.hatch_rate_variance}`}</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Dispatch duration</div><div className="font-semibold text-[#20392D]">{form.dispatch_duration_minutes === null || form.dispatch_duration_minutes === undefined ? '—' : `${form.dispatch_duration_minutes} min`}</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Sales allocations</div><div className="font-semibold text-[#20392D]">{Number(form.sale_allocation_count || 0)}</div></div>
                    <div className="rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Transfer rows</div><div className="font-semibold text-[#20392D]">{Number(form.transfer_count || 0)}</div></div>
                    <div className="col-span-2 rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Parent flock</div><div className="font-semibold text-[#20392D]">{form.parent_flock_number || traceability?.parent_flock_number || '—'}</div></div>
                    <div className="col-span-2 rounded-lg bg-white p-2"><div className="text-[#5d6d68]">Row version</div><div className="font-mono text-[11px] text-[#20392D] break-all">{form.row_version || '—'}</div></div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#e8f0ea]"><div className="h-2 rounded-full bg-[#147D4A]" style={{ width: `${Math.max(0, Math.min(100, Number(form.allocation_percent || 0)))}%` }} /></div>
                </div>

                <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-base font-bold text-[#374744]">Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-[#e2ebe3] bg-[#f9fcfa] p-2"><div className="text-[#5d6d68]">Allocated</div><div className="font-semibold">{Number(form.total_allocated || 0).toLocaleString()}</div></div>
                    <div className="rounded-lg border border-[#e2ebe3] bg-[#f9fcfa] p-2"><div className="text-[#5d6d68]">Sold</div><div className="font-semibold">{Number(form.total_sold || 0).toLocaleString()}</div></div>
                    <div className="rounded-lg border border-[#e2ebe3] bg-[#f9fcfa] p-2"><div className="text-[#5d6d68]">Transferred</div><div className="font-semibold">{Number(form.total_transferred || 0).toLocaleString()}</div></div>
                    <div className="rounded-lg border border-[#e2ebe3] bg-[#f9fcfa] p-2"><div className="text-[#5d6d68]">Disposed</div><div className="font-semibold">{Number(form.total_disposed || 0).toLocaleString()}</div></div>
                  </div>
                  {form.dispatch_started_at && !form.dispatch_completed_at && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Dispatch in progress</div>
                  )}
                </div>
              </div>
            </div>

            {isEditMode && (
              <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  {['overview', 'status', 'dispatch', 'dispose', 'reconcile', 'danger'].map((tab) => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === tab ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#374744] hover:bg-[#f4f7f5]'}`}>
                      {tab === 'overview' ? 'Overview' : tab === 'status' ? 'Status' : tab === 'dispatch' ? 'Dispatch' : tab === 'dispose' ? 'Dispose' : tab === 'reconcile' ? 'Reconcile' : 'Danger Zone'}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className="space-y-3 text-sm text-[#374744]">
                    <p>Use status changes only within business rules. Available → Partially/Fully allocated as quantities move; Disposed only when available quantity is zero.</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl bg-[#f9fcfa] p-3"><div className="text-xs text-[#5d6d68]">Current status</div><div className="mt-1"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[form.status] || 'bg-slate-100 text-slate-700'}`}>{form.status}</span></div></div>
                      <div className="rounded-xl bg-[#f9fcfa] p-3"><div className="text-xs text-[#5d6d68]">Available</div><div className="mt-1 text-lg font-bold text-[#147D4A]">{Number(form.available_quantity || 0).toLocaleString()}</div></div>
                      <div className="rounded-xl bg-[#f9fcfa] p-3"><div className="text-xs text-[#5d6d68]">Dispatch duration</div><div className="mt-1 font-semibold">{form.dispatch_duration_minutes === null || form.dispatch_duration_minutes === undefined ? '—' : `${form.dispatch_duration_minutes} min`}</div></div>
                    </div>
                    <div className="rounded-xl border border-[#e2ebe3] bg-[#f9fcfa] p-3">
                      <h4 className="mb-2 text-sm font-bold text-[#20392D]">Parent Traceability</h4>
                      <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                        <div>Parent Flock: <span className="font-semibold">{traceability?.parent_flock_number || '—'}</span></div>
                        <div>Poultry Type: <span className="font-semibold">{traceability?.parent_poultry_type || '—'}</span></div>
                        <div>Breed: <span className="font-semibold">{traceability?.breed_name || '—'}</span></div>
                        <div>Strain: <span className="font-semibold">{traceability?.strain_name || '—'}</span></div>
                        <div>Import #: <span className="font-semibold">{traceability?.import_number || '—'}</span></div>
                        <div>Origin: <span className="font-semibold">{traceability?.country_of_origin || '—'}</span></div>
                        <div>Parent Arrival: <span className="font-semibold">{formatDate(traceability?.parent_arrival_date)}</span></div>
                        <div>Eggs Set: <span className="font-semibold">{traceability?.eggs_set_count ?? '—'}</span></div>
                        <div>Hatchability %: <span className="font-semibold">{traceability?.hatchability_percent ?? '—'}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">New status</span><select value={statusChange.new_status} onChange={(event) => setStatusChange((current) => ({ ...current, new_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">Select status</option>{choiceValues.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Notes</span><textarea value={statusChange.notes} onChange={(event) => setStatusChange((current) => ({ ...current, notes: event.target.value }))} rows={2} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#147D4A]" /></label>
                    {statusChange.new_status === 'Disposed' && Number(form.available_quantity) > 0 && <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Write off remaining quantity first.</div>}
                    {statusChange.new_status === 'Fully-Allocated' && Number(form.available_quantity) > 0 && <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Availability must be zero before Fully-Allocated.</div>}
                    <div className="md:col-span-2"><button type="button" onClick={submitStatusChange} disabled={saving} className="h-11 rounded-xl bg-[#147D4A] px-4 text-sm font-bold text-white hover:bg-[#0f8b3d] disabled:opacity-50">{saving ? 'Submitting...' : 'Change Status'}</button></div>
                  </div>
                )}

                {activeTab === 'dispatch' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={saving || Boolean(form.dispatch_started_at)} onClick={() => submitDispatch('Start')} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">{form.dispatch_started_at ? 'Already started' : 'Start'}</button>
                      <button type="button" disabled={saving || Boolean(form.dispatch_completed_at)} onClick={() => submitDispatch('Complete')} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">{form.dispatch_completed_at ? 'Already completed' : 'Complete'}</button>
                    </div>
                    <div className="text-xs text-[#5d6d68]">Started: <span className="font-semibold text-[#20392D]">{formatDateTime(form.dispatch_started_at)}</span> · Completed: <span className="font-semibold text-[#20392D]">{formatDateTime(form.dispatch_completed_at)}</span> · Duration: <span className="font-semibold text-[#20392D]">{form.dispatch_duration_minutes === null || form.dispatch_duration_minutes === undefined ? '—' : `${form.dispatch_duration_minutes} min`}</span></div>
                  </div>
                )}

                {activeTab === 'dispose' && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quantity</span><input type="number" min="1" value={disposeInput.quantity} onChange={(event) => setDisposeInput((current) => ({ ...current, quantity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" /></label>
                    <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Reason</span><textarea value={disposeInput.reason} onChange={(event) => setDisposeInput((current) => ({ ...current, reason: event.target.value }))} maxLength={500} rows={2} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#147D4A]" /></label>
                    <div className="md:col-span-2 rounded-xl bg-[#f9fcfa] px-3 py-2 text-xs font-semibold text-[#374744]">
                      Available {Number(form.available_quantity || 0)} → {Math.max(0, Number(form.available_quantity || 0) - (Number(disposeInput.quantity) || 0))} · Disposed {Number(form.total_disposed || 0)} → {Number(form.total_disposed || 0) + (Number(disposeInput.quantity) || 0)}
                    </div>
                    <div className="md:col-span-2 text-xs text-[#5d6d68]">Status will update automatically.</div>
                    <div className="md:col-span-2"><button type="button" onClick={submitDispose} disabled={saving} className="h-11 rounded-xl bg-[#147D4A] px-4 text-sm font-bold text-white hover:bg-[#0f8b3d] disabled:opacity-50">{saving ? 'Submitting...' : 'Dispose Chicks'}</button></div>
                  </div>
                )}

                {activeTab === 'reconcile' && (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-180 text-left text-xs">
                        <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Batch #</th><th className="px-2 py-2 font-semibold">Sold (record/rows)</th><th className="px-2 py-2 font-semibold">Sold variance</th><th className="px-2 py-2 font-semibold">Transferred (record/rows)</th><th className="px-2 py-2 font-semibold">Transferred variance</th></tr></thead>
                        <tbody>
                          {reconciliationRows.filter((row) => row.chick_batch_id === effectiveChickBatchId).map((row) => (
                            <tr key={row.chick_batch_id} className="border-b border-[#f0f3f1]">
                              <td className="px-2 py-2 font-semibold">{row.chick_batch_number}</td>
                              <td className="px-2 py-2">{Number(row.total_sold || 0)} / {Number(row.actual_sold_rows || 0)}</td>
                              <td className={`px-2 py-2 font-semibold ${Number(row.sold_variance || 0) === 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(row.sold_variance || 0)}</td>
                              <td className="px-2 py-2">{Number(row.total_transferred || 0)} / {Number(row.actual_transferred_rows || 0)}</td>
                              <td className={`px-2 py-2 font-semibold ${Number(row.transferred_variance || 0) === 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(row.transferred_variance || 0)}</td>
                            </tr>
                          ))}
                          {reconciliationRows.filter((row) => row.chick_batch_id === effectiveChickBatchId).length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-[#5d6d68]">No reconciliation rows.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-[#374744]"><input type="checkbox" checked={reconcileFix} onChange={(event) => setReconcileFix(event.target.checked)} /> Apply fix (recalculate totals from child rows)</label>
                    <button type="button" onClick={submitReconcile} disabled={saving} className="h-11 rounded-xl bg-[#147D4A] px-4 text-sm font-bold text-white hover:bg-[#0f8b3d] disabled:opacity-50">{saving ? 'Running...' : 'Run Reconciliation'}</button>
                  </div>
                )}

                {activeTab === 'danger' && (
                  <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <label className="block text-sm font-medium text-red-700"><span className="mb-1 block">Delete reason</span><textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} rows={2} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400" /></label>
                    {!canSoftDelete && <div className="text-xs font-semibold text-red-700">{Number(form.sale_allocation_count) > 0 ? 'Cannot delete: sale allocations exist.' : Number(form.transfer_count) > 0 ? 'Cannot delete: farm transfers exist.' : ''}</div>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={dangerBusy || !canSoftDelete} onClick={handleSoftDelete} className="h-10 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Soft Delete</button>
                      <button type="button" disabled={dangerBusy || !canRestore} onClick={handleRestore} className="h-10 rounded-lg border border-[#147D4A] bg-white px-3 text-sm font-semibold text-[#147D4A] hover:bg-[#eafaf0] disabled:opacity-50">Restore</button>
                    </div>
                    <label className="block text-sm font-medium text-red-700"><span className="mb-1 block">Type {form.chick_batch_number || 'batch number'} to confirm hard delete</span><input value={hardDeleteConfirmText} onChange={(event) => setHardDeleteConfirmText(event.target.value)} className="h-10 w-full rounded-lg border border-red-200 bg-white px-3 text-sm outline-none focus:border-red-400" /></label>
                    <button type="button" disabled={dangerBusy || !canHardDelete} onClick={handleHardDelete} className="h-10 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">Hard Delete</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {workspaceTab === 'datalist' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <KpiCard label="Total Batches" value={dashboard.kpis?.total_batches ?? 0} />
              <KpiCard label="Available" value={dashboard.kpis?.available_batches ?? 0} />
              <KpiCard label="Partially-Allocated" value={dashboard.kpis?.partial_batches ?? 0} />
              <KpiCard label="Fully-Allocated" value={dashboard.kpis?.fully_allocated_batches ?? 0} />
              <KpiCard label="Total Chicks" value={dashboard.kpis?.total_chicks ?? 0} />
              <KpiCard label="Available Chicks" value={dashboard.kpis?.total_available ?? 0} highlight />
              <KpiCard label="Reconciliation Anomalies" value={(Array.isArray(reconciliationRows) ? reconciliationRows.filter((row) => Number(row.sold_variance || 0) !== 0 || Number(row.transferred_variance || 0) !== 0).length : 0)} danger />
            </div>

            <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-[#20392D]">Chick Batches</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <input value={filters.search_text} onChange={(event) => setFilters((current) => ({ ...current, search_text: event.target.value }))} placeholder="Search batch number" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />
                <select value={filters.hatchery_id} onChange={(event) => setFilters((current) => ({ ...current, hatchery_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">All hatcheries</option>{hatcheries.map((row) => <option key={row.hatchery_id} value={row.hatchery_id}>{row.hatchery_code} - {row.hatchery_name}</option>)}</select>
                <select value={filters.hatchery_batch_id} onChange={(event) => setFilters((current) => ({ ...current, hatchery_batch_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">All hatchery batches</option>{hatcheryBatches.map((row) => <option key={row.batch_id} value={row.batch_id}>{row.batch_number}</option>)}</select>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">All status</option>{choiceValues.statuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
                <select value={filters.quality_grade} onChange={(event) => setFilters((current) => ({ ...current, quality_grade: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#147D4A]"><option value="">All quality grades</option>{choiceValues.qualityGrades.map((row) => <option key={row} value={row}>{row}</option>)}</select>
                <input type="date" value={filters.from_hatch_date} onChange={(event) => setFilters((current) => ({ ...current, from_hatch_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />
                <input type="date" value={filters.to_hatch_date} onChange={(event) => setFilters((current) => ({ ...current, to_hatch_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#147D4A]" />
                <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.available_only} onChange={(event) => setFilters((current) => ({ ...current, available_only: event.target.checked }))} />Available only</label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.include_deleted} onChange={(event) => setFilters((current) => ({ ...current, include_deleted: event.target.checked }))} />Include deleted</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setPageNumber(1); loadListAndDashboard(); }} className="h-11 rounded-xl bg-[#147D4A] px-4 text-sm font-bold text-white hover:bg-[#0f8b3d]">Apply</button>
                  <button type="button" onClick={resetFilters} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear</button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-325 text-left text-sm">
                  <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Batch #</th><th className="px-2 py-2 font-semibold">Hatch Date</th><th className="px-2 py-2 font-semibold">Hatchery / Batch</th><th className="px-2 py-2 font-semibold">Total</th><th className="px-2 py-2 font-semibold">F / M</th><th className="px-2 py-2 font-semibold">Available</th><th className="px-2 py-2 font-semibold">Allocated %</th><th className="px-2 py-2 font-semibold">Quality</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 font-semibold">Dispatch</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
                  <tbody>
                    {listRows.map((row) => (
                      <tr key={row.chick_batch_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/60' : ''}`}>
                        <td className="px-2 py-2 font-semibold">{row.chick_batch_number}</td>
                        <td className="px-2 py-2">{formatDate(row.hatch_date)}</td>
                        <td className="px-2 py-2">{row.hatchery_name || row.hatchery_code || '—'} / {row.hatchery_batch_number || '—'}</td>
                        <td className="px-2 py-2">{Number(row.total_chicks || 0).toLocaleString()}</td>
                        <td className="px-2 py-2">{Number(row.female_chicks || 0)} / {Number(row.male_chicks || 0)}</td>
                        <td className="px-2 py-2 font-semibold text-[#147D4A]">{Number(row.available_quantity || 0).toLocaleString()}</td>
                        <td className="px-2 py-2"><span className="rounded-full bg-[#edf4ef] px-2 py-0.5 text-xs font-semibold text-[#147D4A]">{Number(row.allocation_percent || 0).toFixed(2)}%</span></td>
                        <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${QUALITY_COLORS[row.chick_quality_grade] || 'bg-slate-100 text-slate-700'}`}>{row.chick_quality_grade || 'N/A'}</span></td>
                        <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-700'}`}>{row.status || 'N/A'}</span></td>
                        <td className="px-2 py-2">{row.dispatch_duration_minutes ? `${row.dispatch_duration_minutes} min` : row.dispatch_started_at && !row.dispatch_completed_at ? 'In progress' : '—'}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap justify-end gap-1 text-xs">
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'overview')} className="rounded border border-[#dfe8e1] px-2 py-1 hover:bg-[#f4f7f5]">View / Edit</button>
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'status')} className="rounded border border-[#dfe8e1] px-2 py-1 hover:bg-[#f4f7f5]">Status</button>
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'dispatch')} className="rounded border border-[#dfe8e1] px-2 py-1 hover:bg-[#f4f7f5]">Dispatch</button>
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'dispose')} className="rounded border border-[#dfe8e1] px-2 py-1 hover:bg-[#f4f7f5]">Dispose</button>
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'reconcile')} className="rounded border border-[#dfe8e1] px-2 py-1 hover:bg-[#f4f7f5]">Reconcile</button>
                            <button type="button" onClick={() => openEdit(row.chick_batch_id, 'danger')} className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50">Admin</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {listRows.length === 0 && <tr><td colSpan={11} className="px-2 py-6 text-center text-[#5d6d68]">No chick batches found.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#5d6d68]">
                <div>Page {pageNumber} / {totalPages}</div>
                <div className="flex gap-2">
                  <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="h-9 rounded-lg border border-[#dfe8e1] bg-white px-3 text-sm font-semibold text-[#374744] disabled:opacity-50">Prev</button>
                  <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))} className="h-9 rounded-lg border border-[#dfe8e1] bg-white px-3 text-sm font-semibold text-[#374744] disabled:opacity-50">Next</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SimpleTableCard title="Available Inventory" emptyText="No available batches." columns={['Batch #', 'Hatch Date', 'Age Days', 'Total', 'Allocated', 'Available', 'Status', 'Quality', 'Avg Weight']} rows={availableRows.map((row) => [row.chick_batch_number, formatDate(row.hatch_date), row.age_days ?? '—', Number(row.total_chicks || 0), Number(row.total_allocated || 0), Number(row.available_quantity || 0), row.status, row.chick_quality_grade || '—', row.avg_chick_weight_g ?? '—'])} />
              <SimpleTableCard title="Quality Stats" emptyText="No quality rows." columns={['Batch #', 'Hatch Date', 'Expected', 'Actual', 'Variance', 'Hatchability %', 'Fertility %', 'Grade A/B/C', 'Grade A %', 'Sexing', 'Sexing %', 'Weight g', 'Size cm']} rows={qualityRows.map((row) => [row.chick_batch_number, formatDate(row.hatch_date), row.expected_chicks ?? '—', row.total_chicks ?? '—', row.hatch_rate_variance ?? '—', row.hatchability_percent ?? '—', row.fertility_percent ?? '—', `${row.grade_a_count ?? 0}/${row.grade_b_count ?? 0}/${row.grade_c_count ?? 0}`, row.grade_a_percent ?? '—', row.sexing_method || '—', row.sexing_accuracy_pct ?? '—', row.avg_chick_weight_g ?? '—', row.avg_chick_size_cm ?? '—'])} />
              <SimpleTableCard title="Reconciliation Anomalies" emptyText="All batches reconciled." columns={['Batch #', 'Hatch Date', 'Total', 'Allocated', 'Sold (record/rows)', 'Sold variance', 'Transferred (record/rows)', 'Transferred variance']} rows={reconciliationRows.filter((row) => Number(row.sold_variance || 0) !== 0 || Number(row.transferred_variance || 0) !== 0).map((row) => [row.chick_batch_number, formatDate(row.hatch_date), row.total_chicks ?? 0, row.total_allocated ?? 0, `${row.total_sold ?? 0}/${row.actual_sold_rows ?? 0}`, row.sold_variance ?? 0, `${row.total_transferred ?? 0}/${row.actual_transferred_rows ?? 0}`, row.transferred_variance ?? 0])} />
              <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-base font-bold text-[#20392D]">Users Loaded</h3>
                <div className="text-sm text-[#5d6d68]">Audit user lookup loaded: <span className="font-semibold text-[#20392D]">{users.length}</span> users.</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function femaleChicks(form) {
  return Number(form.female_chicks) || 0;
}

function maleChicks(form) {
  return Number(form.male_chicks) || 0;
}

function KpiCard({ label, value, highlight = false, danger = false }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${danger ? 'border-red-200 bg-red-50' : highlight ? 'border-emerald-200 bg-emerald-50' : 'border-[#e2ebe3] bg-white'}`}>
      <div className="text-xs font-semibold text-[#5d6d68]">{label}</div>
      <div className={`mt-1 text-xl font-bold ${danger ? 'text-red-700' : highlight ? 'text-[#147D4A]' : 'text-[#20392D]'}`}>{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function SimpleTableCard({ title, columns, rows, emptyText }) {
  return (
    <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-bold text-[#20392D]">{title}</h3>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-155 text-left text-xs">
          <thead><tr className="border-b border-[#e9efe9] text-[#51615d]">{columns.map((column) => <th key={column} className="px-2 py-2 font-semibold">{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[#f0f3f1]">{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-2 py-2">{cell}</td>)}</tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={columns.length} className="px-2 py-4 text-center text-[#5d6d68]">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
