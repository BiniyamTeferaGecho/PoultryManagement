import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;

const STATUS_COLORS = {
  'In Transit': 'bg-amber-100 text-amber-800',
  Quarantine: 'bg-sky-100 text-sky-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const APPROVAL_COLORS = {
  Draft: 'bg-slate-100 text-slate-800',
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
};

const emptyForm = {
  import_shipment_id: '',
  company_id: '',
  supplier_id: '',
  import_number: '',
  import_date: '',
  arrival_date: '',
  hatch_date: '',
  country_of_origin: '',
  breed_id: '',
  strain_id: '',
  generation: '',
  females_imported: '',
  males_imported: '',
  transport_mortality_females: '0',
  transport_mortality_males: '0',
  arrival_weight_females: '',
  arrival_weight_males: '',
  quarantine_duration: '',
  quarantine_start_date: '',
  quarantine_end_date: '',
  health_inspection_date: '',
  health_inspection_result: '',
  vaccination_details: '',
  import_cost: '',
  customs_reference: '',
  import_document: '',
  transport_company: '',
  vehicle_info: '',
  waybill_number: '',
  supplier_invoice_number: '',
  receiving_farm_id: '',
  receiving_house_id: '',
  status: 'In Transit',
  approval_status: 'Pending',
  remarks: '',
  notes: '',
  approved_by_username: '',
  approved_date: '',
  created_flock_id: '',
  created_flock_number: '',
  quarantine_record_count: 0,
  row_version: '',
  is_deleted: false,
};

const emptyFilters = {
  search_text: '',
  supplier_id: '',
  breed_id: '',
  status: '',
  approval_status: '',
  country: '',
  from_arrival: '',
  to_arrival: '',
  include_deleted: false,
  pending_approvals_only: false,
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
    import_shipment_id: row.import_shipment_id || '',
    company_id: row.company_id || '',
    supplier_id: row.supplier_id || '',
    import_number: row.import_number || '',
    import_date: toDateInput(row.import_date),
    arrival_date: toDateInput(row.arrival_date),
    hatch_date: toDateInput(row.hatch_date),
    country_of_origin: row.country_of_origin || '',
    breed_id: row.breed_id || '',
    strain_id: row.strain_id || '',
    generation: row.generation || '',
    females_imported: row.females_imported ?? '',
    males_imported: row.males_imported ?? '',
    transport_mortality_females: row.transport_mortality_females ?? 0,
    transport_mortality_males: row.transport_mortality_males ?? 0,
    arrival_weight_females: row.arrival_weight_females ?? '',
    arrival_weight_males: row.arrival_weight_males ?? '',
    quarantine_duration: row.quarantine_duration ?? '',
    quarantine_start_date: toDateInput(row.quarantine_start_date),
    quarantine_end_date: toDateInput(row.quarantine_end_date),
    health_inspection_date: toDateInput(row.health_inspection_date),
    health_inspection_result: row.health_inspection_result || '',
    vaccination_details: row.vaccination_details || '',
    import_cost: row.import_cost ?? '',
    customs_reference: row.customs_reference || '',
    import_document: row.import_document || '',
    transport_company: row.transport_company || '',
    vehicle_info: row.vehicle_info || '',
    waybill_number: row.waybill_number || '',
    supplier_invoice_number: row.supplier_invoice_number || '',
    receiving_farm_id: row.receiving_farm_id || '',
    receiving_house_id: row.receiving_house_id || '',
    status: row.status || 'In Transit',
    approval_status: row.approval_status || 'Pending',
    remarks: row.remarks || '',
    notes: row.notes || '',
    approved_by_username: row.approved_by_username || '',
    approved_date: row.approved_date || '',
    created_flock_id: row.created_flock_id || '',
    created_flock_number: row.created_flock_number || '',
    quarantine_record_count: Number(row.quarantine_record_count) || 0,
    row_version: normalizeRowVersion(row.row_version),
    is_deleted: Boolean(row.is_deleted),
  };
}

export default function ImportShipmentForm({ currentUser, importShipmentId = null, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [listRows, setListRows] = useState([]);
  const [pendingApprovalRows, setPendingApprovalRows] = useState([]);
  const [dashboard, setDashboard] = useState({ kpis: {}, quarantineMonitor: [] });
  const [birdMetrics, setBirdMetrics] = useState({ birds_arrived: 0, cost_per_bird: null });
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState('form');
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusChange, setStatusChange] = useState({ new_status: '', reason: '' });
  const [approval, setApproval] = useState({ decision: 'Approved', comments: '' });
  const [linkFlock, setLinkFlock] = useState({ flock_id: '', search: '' });
  const [deleteReason, setDeleteReason] = useState('');
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');

  const [companies, setCompanies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [strains, setStrains] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [users, setUsers] = useState([]);
  const [choiceValues, setChoiceValues] = useState({
    statuses: ['In Transit', 'Quarantine', 'Completed', 'Cancelled'],
    approvalStatuses: ['Draft', 'Pending', 'Approved', 'Rejected'],
    inspectionResults: ['Pass', 'Fail', 'Conditional', 'Pending'],
  });

  const effectiveShipmentId = form.import_shipment_id || importShipmentId || null;
  const isEditMode = Boolean(effectiveShipmentId);
  const isApproved = form.approval_status === 'Approved';

  const totalImported = (Number(form.females_imported) || 0) + (Number(form.males_imported) || 0);
  const transportMortalityTotal = (Number(form.transport_mortality_females) || 0) + (Number(form.transport_mortality_males) || 0);

  const filteredLinkFlocks = useMemo(() => {
    const search = linkFlock.search.trim().toLowerCase();
    const source = Array.isArray(flocks) ? flocks : [];
    if (!search) return source;
    return source.filter((row) => {
      const flockNumber = String(row.flock_number || '').toLowerCase();
      const farmName = String(row.farm_name || '').toLowerCase();
      return flockNumber.includes(search) || farmName.includes(search);
    });
  }, [flocks, linkFlock.search]);

  const legalStatusTransitions = useMemo(() => {
    if (form.status === 'In Transit') return ['Quarantine', 'Cancelled'];
    if (form.status === 'Quarantine') return ['Completed', 'Cancelled'];
    return [];
  }, [form.status]);

  const canSoftDelete = !form.is_deleted && form.status !== 'Completed' && !form.created_flock_id && Number(form.quarantine_record_count || 0) === 0;
  const canRestore = form.is_deleted;
  const canHardDelete = form.is_deleted && !form.created_flock_id && Number(form.quarantine_record_count || 0) === 0;

  function fieldError(name) {
    return fieldErrors[name] ? <div className="mt-1 text-xs text-red-600">{fieldErrors[name]}</div> : null;
  }

  const loadStrainsByBreed = useCallback(async (breedId) => {
    if (!currentUser?.accessToken || !breedId) {
      setStrains([]);
      return;
    }
    try {
      const payload = await apiRequest(`/flock/strain?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&breed_id=${encodeURIComponent(breedId)}`, currentUser.accessToken);
      setStrains(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setStrains([]);
    }
  }, [currentUser?.accessToken]);

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

  const loadListAndDashboard = useCallback(async () => {
    const listParams = new URLSearchParams({
      page_number: String(pageNumber),
      page_size: '10',
      include_deleted: filters.include_deleted ? '1' : '0',
    });
    if (filters.supplier_id) listParams.set('supplier_id', filters.supplier_id);
    if (filters.breed_id) listParams.set('breed_id', filters.breed_id);
    if (filters.status) listParams.set('status', filters.status);
    if (filters.approval_status) listParams.set('approval_status', filters.approval_status);
    if (filters.country) listParams.set('country', filters.country);
    if (filters.from_arrival) listParams.set('from_arrival', filters.from_arrival);
    if (filters.to_arrival) listParams.set('to_arrival', filters.to_arrival);
    if (filters.search_text) listParams.set('search_text', filters.search_text);

    const [listPayload, dashboardPayload, pendingPayload] = await Promise.all([
      apiRequest(`/livestock/import-shipment?${listParams}`, currentUser.accessToken),
      // Do not block page load/refresh on quarantine monitor/dashboard fetch issues.
      apiRequest('/livestock/import-shipment/reports/dashboard', currentUser.accessToken).catch(() => ({ data: { kpis: {}, quarantineMonitor: [] } })),
      apiRequest('/livestock/import-shipment/functions/pending-approvals', currentUser.accessToken).catch(() => ({ data: [] })),
    ]);

    if (filters.pending_approvals_only) {
      const pendingRows = Array.isArray(pendingPayload.data) ? pendingPayload.data : [];
      setListRows(pendingRows);
      setTotalCount(pendingRows.length);
    } else {
      setListRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
    }
    setPendingApprovalRows(Array.isArray(pendingPayload.data) ? pendingPayload.data : []);
    setDashboard({
      kpis: dashboardPayload.data?.kpis || {},
      quarantineMonitor: Array.isArray(dashboardPayload.data?.quarantineMonitor) ? dashboardPayload.data.quarantineMonitor : [],
    });
  }, [currentUser.accessToken, filters, pageNumber]);

  const loadShipmentDetail = useCallback(async (shipmentId) => {
    if (!shipmentId || !currentUser?.accessToken) return;
    const [detailPayload, birdsPayload, costPayload] = await Promise.all([
      apiRequest(`/livestock/import-shipment/${shipmentId}`, currentUser.accessToken),
      apiRequest(`/livestock/import-shipment/functions/${shipmentId}/birds-arrived`, currentUser.accessToken),
      apiRequest(`/livestock/import-shipment/functions/${shipmentId}/cost-per-bird`, currentUser.accessToken),
    ]);
    const nextForm = toForm(detailPayload.data);
    setForm(nextForm);
    setBirdMetrics({
      birds_arrived: Number(birdsPayload.data?.birds_arrived) || 0,
      cost_per_bird: costPayload.data?.cost_per_bird === null || costPayload.data?.cost_per_bird === undefined
        ? null
        : Number(costPayload.data.cost_per_bird),
    });
    await Promise.all([
      loadStrainsByBreed(nextForm.breed_id),
      loadHousesByFarm(nextForm.receiving_farm_id),
    ]);
  }, [currentUser?.accessToken, loadHousesByFarm, loadStrainsByBreed]);

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
      const [companyPayload, supplierPayload, breedPayload, farmPayload, flockPayload, userPayload, choicePayload] = await Promise.all([
        apiRequest(`/company?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest(`/livestock/supplier?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest(`/flock/breed?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest(`/core/farm?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100&status=Active', currentUser.accessToken),
        apiRequest(`/security/users?page_number=1&page_size=${LOOKUP_PAGE_SIZE}&include_deleted=0`, currentUser.accessToken),
        apiRequest('/livestock/import-shipment/choice-values', currentUser.accessToken),
      ]);

      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setSuppliers(Array.isArray(supplierPayload.data) ? supplierPayload.data : []);
      setBreeds(Array.isArray(breedPayload.data) ? breedPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
      if (choicePayload.data) setChoiceValues(choicePayload.data);

      await loadListAndDashboard();

      if (effectiveShipmentId) {
        await loadShipmentDetail(effectiveShipmentId);
      } else {
        setForm({ ...emptyForm });
        setBirdMetrics({ birds_arrived: 0, cost_per_bird: null });
        setStrains([]);
        setHouses([]);
      }
    } catch (requestError) {
      const errorMessage = requestError?.message || 'Request failed.';
      // Hide quarantine-related load errors from the global popup as requested.
      if (!/quarantine/i.test(errorMessage)) {
        setError(errorMessage);
      }
      setListRows([]);
      setPendingApprovalRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.accessToken, effectiveShipmentId, loadListAndDashboard, loadShipmentDetail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTabError('');
    setFieldErrors({});
  }, [activeTab]);

  useEffect(() => {
    if (!form.breed_id) {
      setStrains([]);
      setForm((current) => ({ ...current, strain_id: '' }));
      return;
    }
    loadStrainsByBreed(form.breed_id);
  }, [form.breed_id, loadStrainsByBreed]);

  useEffect(() => {
    if (!form.receiving_farm_id) {
      setHouses([]);
      setForm((current) => ({ ...current, receiving_house_id: '' }));
      return;
    }
    loadHousesByFarm(form.receiving_farm_id);
  }, [form.receiving_farm_id, loadHousesByFarm]);

  function validateForm() {
    const nextErrors = {};
    const females = Number(form.females_imported) || 0;
    const males = Number(form.males_imported) || 0;
    const mortalityF = Number(form.transport_mortality_females) || 0;
    const mortalityM = Number(form.transport_mortality_males) || 0;

    if (!form.company_id) nextErrors.company_id = 'Company is required.';
    if (!form.supplier_id) nextErrors.supplier_id = 'Supplier is required.';
    if (!form.breed_id) nextErrors.breed_id = 'Breed is required.';
    if (!form.country_of_origin.trim()) nextErrors.country_of_origin = 'Country of origin is required.';
    if (!form.import_date) nextErrors.import_date = 'Import date is required.';
    if (!form.arrival_date) nextErrors.arrival_date = 'Arrival date is required.';
    if (!form.generation.trim()) nextErrors.generation = 'Generation is required.';
    if ((females + males) <= 0) nextErrors.females_imported = 'Females + males must be greater than 0.';
    if (form.arrival_date && form.import_date && form.arrival_date < form.import_date) nextErrors.arrival_date = 'Arrival date cannot be before import date.';
    if (mortalityF > females) nextErrors.transport_mortality_females = 'Transport mortality females cannot exceed females imported.';
    if (mortalityM > males) nextErrors.transport_mortality_males = 'Transport mortality males cannot exceed males imported.';
    if (form.quarantine_duration !== '' && Number(form.quarantine_duration) < 0) nextErrors.quarantine_duration = 'Quarantine duration must be 0 or more.';
    if (form.quarantine_start_date && form.quarantine_end_date && form.quarantine_end_date < form.quarantine_start_date) nextErrors.quarantine_end_date = 'Quarantine end date cannot be before start date.';
    if (form.arrival_weight_females !== '' && Number(form.arrival_weight_females) <= 0) nextErrors.arrival_weight_females = 'Arrival female weight must be greater than 0.';
    if (form.arrival_weight_males !== '' && Number(form.arrival_weight_males) <= 0) nextErrors.arrival_weight_males = 'Arrival male weight must be greater than 0.';
    if (form.import_cost !== '' && Number(form.import_cost) < 0) nextErrors.import_cost = 'Import cost cannot be negative.';
    if (form.health_inspection_result && !choiceValues.inspectionResults.includes(form.health_inspection_result)) nextErrors.health_inspection_result = 'Invalid inspection result.';
    if (form.status && !choiceValues.statuses.includes(form.status)) nextErrors.status = 'Invalid shipment status.';
    if (form.approval_status && !choiceValues.approvalStatuses.includes(form.approval_status)) nextErrors.approval_status = 'Invalid approval status.';

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setTabError('');

    try {
      if (!validateForm()) throw new Error('Please correct the highlighted fields.');
      if (isEditMode && isApproved) throw new Error('Reject first to edit.');

      const payload = {
        ...form,
        user_id: currentUser.user_id || null,
        import_number: form.import_number.trim() || null,
        country_of_origin: form.country_of_origin.trim(),
        generation: form.generation.trim(),
        females_imported: intOrNull(form.females_imported),
        males_imported: intOrNull(form.males_imported),
        transport_mortality_females: intOrNull(form.transport_mortality_females) ?? 0,
        transport_mortality_males: intOrNull(form.transport_mortality_males) ?? 0,
        arrival_weight_females: numberOrNull(form.arrival_weight_females),
        arrival_weight_males: numberOrNull(form.arrival_weight_males),
        quarantine_duration: intOrNull(form.quarantine_duration),
        import_cost: numberOrNull(form.import_cost),
        hatch_date: form.hatch_date || null,
        quarantine_start_date: form.quarantine_start_date || null,
        quarantine_end_date: form.quarantine_end_date || null,
        health_inspection_date: form.health_inspection_date || null,
        health_inspection_result: form.health_inspection_result || null,
        vaccination_details: form.vaccination_details || null,
        customs_reference: form.customs_reference || null,
        import_document: form.import_document || null,
        transport_company: form.transport_company || null,
        vehicle_info: form.vehicle_info || null,
        waybill_number: form.waybill_number || null,
        supplier_invoice_number: form.supplier_invoice_number || null,
        receiving_farm_id: form.receiving_farm_id || null,
        receiving_house_id: form.receiving_house_id || null,
        remarks: form.remarks || null,
        notes: form.notes || null,
        strain_id: form.strain_id || null,
      };

      if (isEditMode) {
        await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Import shipment updated successfully.');
      } else {
        const created = await apiRequest('/livestock/import-shipment', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const createdId = created.data?.import_shipment_id;
        if (createdId) {
          await loadShipmentDetail(createdId);
        } else {
          setForm({ ...emptyForm });
        }
        setMessage('Import shipment created successfully.');
      }

      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    setMessage('');
    setError('');
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }

  async function openEdit(id) {
    setError('');
    setTabError('');
    setMessage('');
    try {
      await loadShipmentDetail(id);
      setWorkspaceTab('form');
      setActiveTab('details');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitStatusChange() {
    setSaving(true);
    setTabError('');
    setMessage('');
    try {
      if (!effectiveShipmentId) throw new Error('Save shipment first.');
      if (!statusChange.new_status) throw new Error('Select new status.');
      if (!legalStatusTransitions.includes(statusChange.new_status)) throw new Error('Invalid status transition.');
      if (statusChange.new_status === 'Completed' && form.approval_status !== 'Approved') {
        throw new Error('Approval must be Approved before completion.');
      }
      await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: statusChange.new_status,
          reason: statusChange.reason || null,
          user_id: currentUser.user_id || null,
        }),
      });
      await loadShipmentDetail(effectiveShipmentId);
      await loadListAndDashboard();
      setStatusChange({ new_status: '', reason: '' });
      setMessage('Status changed successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitApproval() {
    setSaving(true);
    setTabError('');
    setMessage('');
    try {
      if (!effectiveShipmentId) throw new Error('Save shipment first.');
      if (!['Draft', 'Pending'].includes(form.approval_status)) throw new Error('Only Draft or Pending shipments can be approved/rejected.');
      if (!window.confirm(`Are you sure you want to mark this shipment as ${approval.decision}?`)) {
        throw new Error('Approval action cancelled.');
      }
      await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/approve`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          decision: approval.decision,
          comments: approval.comments || null,
          user_id: currentUser.user_id || null,
        }),
      });
      await loadShipmentDetail(effectiveShipmentId);
      await loadListAndDashboard();
      setApproval({ decision: 'Approved', comments: '' });
      setMessage('Approval decision submitted successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitLinkFlock() {
    setSaving(true);
    setTabError('');
    setMessage('');
    try {
      if (!effectiveShipmentId) throw new Error('Save shipment first.');
      if (form.created_flock_id) throw new Error('Shipment is already linked to a flock.');
      if (!linkFlock.flock_id) throw new Error('Select flock to link.');
      await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/link-flock`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          flock_id: linkFlock.flock_id,
          user_id: currentUser.user_id || null,
        }),
      });
      await loadShipmentDetail(effectiveShipmentId);
      await loadListAndDashboard();
      setLinkFlock({ flock_id: '', search: '' });
      setMessage('Flock linked successfully.');
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function runDangerAction(type) {
    if (!effectiveShipmentId) return;
    setDangerBusy(true);
    setTabError('');
    setMessage('');
    try {
      if (type === 'soft') {
        if (!canSoftDelete) throw new Error('Soft delete is blocked by current shipment state.');
        if (!window.confirm('Soft-delete this import shipment?')) throw new Error('Soft delete cancelled.');
        await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/delete`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({
            reason: deleteReason || null,
            user_id: currentUser.user_id || null,
          }),
        });
        setMessage('Import shipment soft-deleted successfully.');
      } else if (type === 'restore') {
        if (!canRestore) throw new Error('Only deleted shipment can be restored.');
        await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/restore`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.user_id || null }),
        });
        setMessage('Import shipment restored successfully.');
      } else if (type === 'hard') {
        if (!canHardDelete) throw new Error('Hard delete is blocked by linked data.');
        if (hardDeleteConfirmText !== form.import_number) throw new Error('Type the exact import number to unlock hard delete.');
        if (!window.confirm('Permanently delete this shipment? This cannot be undone.')) throw new Error('Hard delete cancelled.');
        await apiRequest(`/livestock/import-shipment/${effectiveShipmentId}/hard-delete`, currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify({
            user_id: currentUser.user_id || null,
            confirm: 1,
          }),
        });
        setForm({ ...emptyForm });
        setBirdMetrics({ birds_arrived: 0, cost_per_bird: null });
        setMessage('Import shipment permanently deleted.');
      }
      await loadListAndDashboard();
      if (effectiveShipmentId && type !== 'hard') {
        await loadShipmentDetail(effectiveShipmentId);
      }
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message);
    } finally {
      setDangerBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / 10));
  const mortalityExceedsImported = (Number(form.transport_mortality_females) || 0) > (Number(form.females_imported) || 0)
    || (Number(form.transport_mortality_males) || 0) > (Number(form.males_imported) || 0);
  const hasUnsavedDraft = !isEditMode && (
    form.company_id
    || form.supplier_id
    || form.breed_id
    || form.country_of_origin
    || form.generation
    || Number(form.females_imported || 0) > 0
    || Number(form.males_imported || 0) > 0
  );

  function startNewShipment() {
    if (hasUnsavedDraft && !window.confirm('Discard unsaved draft?')) return;
    setForm({ ...emptyForm });
    setBirdMetrics({ birds_arrived: 0, cost_per_bird: null });
    setStrains([]);
    setHouses([]);
    setFieldErrors({});
    setMessage('');
    setError('');
    setTabError('');
    setActiveTab('details');
  }

  function handleBack() {
    if (!onCancel) return;
    if (hasUnsavedDraft && !window.confirm('You have unsaved changes. Leave this page?')) return;
    onCancel();
  }

  return (
    <div className="min-h-screen bg-[#F6F8F6] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5d6d68]">Operations / Livestock / Import Shipments</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[#20392D]">Import Shipments</h2>
              <p className="mt-1 text-sm text-[#5d6d68]">Create, track, approve, and manage import shipments with quarantine and flock workflows.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onCancel && <button type="button" onClick={handleBack} className="h-10 rounded-lg border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#20392D] hover:bg-[#f4f7f5]">Back</button>}
              <button type="button" onClick={refreshAll} disabled={refreshing} className="h-10 rounded-lg border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#20392D] hover:bg-[#f4f7f5] disabled:opacity-50">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
              <button type="button" onClick={startNewShipment} className="h-10 rounded-lg bg-[#147D4A] px-4 text-sm font-semibold text-white hover:bg-[#116b40]">New Shipment</button>
            </div>
          </div>
        </div>

        {/* <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {loading ? Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-[#e2ebe3] bg-white p-3" />
          )) : (
            <>
              <div className="rounded-xl border border-[#e2ebe3] bg-white p-3 shadow-sm"><div className="text-xs text-[#5d6d68]">Total Shipments</div><div className="mt-1 text-xl font-bold text-[#20392D]">{dashboard.kpis.total_shipments ?? 0}</div></div>
              <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm"><div className="text-xs text-[#5d6d68]">In Transit</div><div className="mt-1 text-xl font-bold text-blue-700">{dashboard.kpis.in_transit_count ?? 0}</div></div>
              <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm"><div className="text-xs text-[#5d6d68]">Pending Approvals</div><div className="mt-1 text-xl font-bold text-amber-700">{dashboard.kpis.pending_approval ?? 0}</div></div>
              <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm"><div className="text-xs text-[#5d6d68]">Completed</div><div className="mt-1 text-xl font-bold text-emerald-700">{dashboard.kpis.completed_count ?? 0}</div></div>
              <div className="rounded-xl border border-[#e2ebe3] bg-white p-3 shadow-sm"><div className="text-xs text-[#5d6d68]">Birds Arrived (API)</div><div className="mt-1 text-xl font-bold text-[#20392D]">{birdMetrics.birds_arrived ?? 0}</div><div className="text-[11px] text-[#7a8a82]">Selected shipment</div></div>
              <div className="rounded-xl border border-red-200 bg-white p-3 shadow-sm">
                <div className="text-xs text-[#5d6d68]">Quarantine alerts summary</div>
                <div className="mt-1 text-sm font-semibold text-[#20392D]">
                  {`Quarantine alerts: ${dashboard.quarantineMonitor.length} — ${dashboard.quarantineMonitor.length > 0 ? 'Active alerts' : 'No active alerts'}`}
                </div>
              </div>
            </>
          )}
        </div> */}

        {message && <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

        <div className="rounded-2xl border border-[#e2ebe3] bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceTab('form')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'form' ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#20392D] hover:bg-[#f4f7f5]'}`}
            >
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true">🧾</span>
                <span>Record Form</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${workspaceTab === 'form' ? 'bg-white/20 text-white' : 'bg-[#edf4ef] text-[#147D4A]'}`}>
                  {isEditMode ? 'Editing' : 'New'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('datalist')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${workspaceTab === 'datalist' ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#20392D] hover:bg-[#f4f7f5]'}`}
            >
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true">📋</span>
                <span>Data List</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${workspaceTab === 'datalist' ? 'bg-white/20 text-white' : 'bg-[#edf4ef] text-[#147D4A]'}`}>
                  {totalCount || listRows.length || 0}
                </span>
              </span>
            </button>
          </div>
        </div>

      {workspaceTab === 'form' && (
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">1) Shipment Identity</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Company *</span>
                <select value={form.company_id} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">
                  <option value="">Select company</option>
                  {companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}
                </select>
                {fieldError('company_id')}
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Import number</span>
                <input value={form.import_number} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, import_number: event.target.value }))} placeholder="Auto-generated via GenerateBusinessCode" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Import date *</span>
                <input type="date" value={form.import_date} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, import_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
                {fieldError('import_date')}
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Arrival date *</span>
                <input type="date" value={form.arrival_date} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, arrival_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
                {fieldError('arrival_date')}
              </label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2">
                <span className="mb-1 block">Hatch date</span>
                <input type="date" value={form.hatch_date} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">2) Origin and Breed</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Country of origin *</span>
                <input value={form.country_of_origin} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, country_of_origin: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
                {fieldError('country_of_origin')}
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Supplier *</span>
                <select value={form.supplier_id} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">
                  <option value="">Select supplier</option>
                  {suppliers.map((row) => <option key={row.supplier_id} value={row.supplier_id}>{row.supplier_code} - {row.supplier_name}</option>)}
                </select>
                {fieldError('supplier_id')}
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Breed *</span>
                <select value={form.breed_id} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, breed_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">
                  <option value="">Select breed</option>
                  {breeds.map((row) => <option key={row.breed_id} value={row.breed_id}>{row.breed_code} - {row.breed_name}</option>)}
                </select>
                {fieldError('breed_id')}
              </label>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Strain</span>
                <select value={form.strain_id} disabled={isEditMode || !form.breed_id} onChange={(event) => setForm((current) => ({ ...current, strain_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">
                  <option value="">Select strain</option>
                  {strains.map((row) => <option key={row.strain_id} value={row.strain_id}>{row.strain_code} - {row.strain_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2">
                <span className="mb-1 block">Generation *</span>
                <input value={form.generation} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, generation: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />
                {fieldError('generation')}
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">3) Bird Quantities and Transport Mortality</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Females imported *</span><input type="number" min="0" value={form.females_imported} onChange={(event) => setForm((current) => ({ ...current, females_imported: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('females_imported')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Males imported *</span><input type="number" min="0" value={form.males_imported} onChange={(event) => setForm((current) => ({ ...current, males_imported: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transport mortality females</span><input type="number" min="0" value={form.transport_mortality_females} onChange={(event) => setForm((current) => ({ ...current, transport_mortality_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('transport_mortality_females')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transport mortality males</span><input type="number" min="0" value={form.transport_mortality_males} onChange={(event) => setForm((current) => ({ ...current, transport_mortality_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('transport_mortality_males')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Arrival weight females</span><input type="number" min="0" step="0.01" value={form.arrival_weight_females} onChange={(event) => setForm((current) => ({ ...current, arrival_weight_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('arrival_weight_females')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Arrival weight males</span><input type="number" min="0" step="0.01" value={form.arrival_weight_males} onChange={(event) => setForm((current) => ({ ...current, arrival_weight_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('arrival_weight_males')}</label>
              <div className="rounded-xl border border-[#dfe8e1] bg-[#f9fcfa] px-3 py-2 text-sm text-[#374744]"><div className="text-xs text-[#5d6d68]">Local total imported</div><div className="font-semibold">{totalImported}</div></div>
              <div className="rounded-xl border border-[#dfe8e1] bg-[#f9fcfa] px-3 py-2 text-sm text-[#374744]"><div className="text-xs text-[#5d6d68]">Local transport mortality</div><div className="font-semibold">{transportMortalityTotal}</div></div>
            </div>
            {mortalityExceedsImported && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Mortality cannot exceed imported counts. Please correct before saving.</div>}
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">4) Quarantine and Health</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quarantine duration (days)</span><input type="number" min="0" value={form.quarantine_duration} onChange={(event) => setForm((current) => ({ ...current, quarantine_duration: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('quarantine_duration')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Health inspection date</span><input type="date" value={form.health_inspection_date} onChange={(event) => setForm((current) => ({ ...current, health_inspection_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quarantine start date</span><input type="date" value={form.quarantine_start_date} onChange={(event) => setForm((current) => ({ ...current, quarantine_start_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Quarantine end date</span><input type="date" value={form.quarantine_end_date} onChange={(event) => setForm((current) => ({ ...current, quarantine_end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('quarantine_end_date')}</label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2">
                <span className="mb-1 block">Health inspection result</span>
                <select value={form.health_inspection_result} onChange={(event) => setForm((current) => ({ ...current, health_inspection_result: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                  <option value="">Select result</option>
                  {choiceValues.inspectionResults.map((row) => <option key={row} value={row}>{row}</option>)}
                </select>
                {fieldError('health_inspection_result')}
              </label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Vaccination details</span><textarea rows="3" value={form.vaccination_details} onChange={(event) => setForm((current) => ({ ...current, vaccination_details: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            </div>
            {['Fail', 'Conditional'].includes(form.health_inspection_result) && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Inspection outcome needs additional approval attention.</div>}
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">5) Logistics and Documents</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Import cost</span><input type="number" min="0" step="0.01" value={form.import_cost} onChange={(event) => setForm((current) => ({ ...current, import_cost: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('import_cost')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Customs reference</span><input value={form.customs_reference} onChange={(event) => setForm((current) => ({ ...current, customs_reference: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Import document</span><input value={form.import_document} onChange={(event) => setForm((current) => ({ ...current, import_document: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transport company</span><input value={form.transport_company} onChange={(event) => setForm((current) => ({ ...current, transport_company: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Vehicle info</span><input value={form.vehicle_info} onChange={(event) => setForm((current) => ({ ...current, vehicle_info: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Waybill number</span><input value={form.waybill_number} onChange={(event) => setForm((current) => ({ ...current, waybill_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Supplier invoice number</span><input value={form.supplier_invoice_number} onChange={(event) => setForm((current) => ({ ...current, supplier_invoice_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">6) Receiving Farm and House</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Receiving farm</span><select value={form.receiving_farm_id} onChange={(event) => setForm((current) => ({ ...current, receiving_farm_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select farm</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Receiving house</span><select value={form.receiving_house_id} disabled={!form.receiving_farm_id} onChange={(event) => setForm((current) => ({ ...current, receiving_house_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select house</option>{houses.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code}</option>)}</select></label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#20392D]">7) Workflow and Notes</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">{choiceValues.statuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('status')}</label>
              <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Approval status</span><select value={form.approval_status} disabled={!isEditMode} onChange={(event) => setForm((current) => ({ ...current, approval_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">{choiceValues.approvalStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('approval_status')}</label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Remarks</span><textarea rows="2" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Notes</span><textarea rows="2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            </div>
            {isApproved && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Reject first to edit.</div>}
          </div>

          <div className="flex justify-end gap-2">
            {isEditMode && <button type="button" onClick={() => { setForm({ ...emptyForm }); setBirdMetrics({ birds_arrived: 0, cost_per_bird: null }); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear</button>}
            <button type="submit" disabled={saving || loading || (isEditMode && isApproved)} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditMode ? 'Save changes' : 'Create shipment'}</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e3ebea] bg-[#f9fcfa] p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-[#374744]">Computed &amp; Detail Snapshot</h3>
            {isEditMode ? (
              <div className="grid grid-cols-1 gap-2 text-sm text-[#374744]">
                <div><span className="text-[#5d6d68]">Import #:</span> <span className="font-semibold">{form.import_number || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Country:</span> <span className="font-semibold">{form.country_of_origin || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Breed:</span> <span className="font-semibold">{form.breed_code ? `${form.breed_code} - ${form.breed_name}` : (form.breed_name || '—')}</span></div>
                <div><span className="text-[#5d6d68]">Strain:</span> <span className="font-semibold">{form.strain_code ? `${form.strain_code} - ${form.strain_name}` : (form.strain_name || '—')}</span></div>
                <div><span className="text-[#5d6d68]">Supplier:</span> <span className="font-semibold">{form.supplier_code ? `${form.supplier_code} - ${form.supplier_name}` : (form.supplier_name || '—')}</span></div>
                <div><span className="text-[#5d6d68]">Supplier country:</span> <span className="font-semibold">{form.supplier_country || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Company:</span> <span className="font-semibold">{form.company_code ? `${form.company_code} - ${form.company_name}` : (form.company_name || '—')}</span></div>
                <div><span className="text-[#5d6d68]">Receiving farm / house:</span> <span className="font-semibold">{form.receiving_farm_name || '—'} / {form.receiving_house_code || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Created flock:</span> <span className="font-semibold">{form.created_flock_number || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Approved by:</span> <span className="font-semibold">{form.approved_by_username || '—'}</span></div>
                <div><span className="text-[#5d6d68]">Approved date:</span> <span className="font-semibold">{form.approved_date ? new Date(form.approved_date).toLocaleString() : '—'}</span></div>
                <div><span className="text-[#5d6d68]">Age at arrival (days):</span> <span className="font-semibold">{form.age_at_arrival_days ?? '—'}</span></div>
                <div><span className="text-[#5d6d68]">Transport duration (days):</span> <span className="font-semibold">{form.transport_duration_days ?? '—'}</span></div>
                <div><span className="text-[#5d6d68]">Quarantine records:</span> <span className="font-semibold">{form.quarantine_record_count ?? 0}</span></div>
                <div><span className="text-[#5d6d68]">Created by/date:</span> <span className="font-semibold">{form.created_by_username || '—'} / {form.created_date ? new Date(form.created_date).toLocaleString() : '—'}</span></div>
                <div><span className="text-[#5d6d68]">Modified by/date:</span> <span className="font-semibold">{form.modified_by_username || '—'} / {form.modified_date ? new Date(form.modified_date).toLocaleString() : '—'}</span></div>
                <div><span className="text-[#5d6d68]">Deleted by/date:</span> <span className="font-semibold">{form.deleted_by_username || '—'} / {form.deleted_date ? new Date(form.deleted_date).toLocaleString() : '—'}</span></div>
                <div><span className="text-[#5d6d68]">Row version:</span> <span className="font-semibold">{form.row_version || '—'}</span></div>
                <div><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${form.is_deleted ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{form.is_deleted ? 'Deleted' : 'Active'}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2">
                    <div className="text-xs text-[#5d6d68]">Birds Arrived</div>
                    <div className="text-base font-bold text-[#374744]">{birdMetrics.birds_arrived}</div>
                  </div>
                  <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2">
                    <div className="text-xs text-[#5d6d68]">Cost per Bird</div>
                    <div className="text-base font-bold text-[#374744]">{birdMetrics.cost_per_bird === null ? '—' : Number(birdMetrics.cost_per_bird).toFixed(4)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#5d6d68]">Save shipment first to view detail, metrics, and workflow tabs.</p>
            )}
          </div>

          {isEditMode && (
            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap gap-2">
                {['details', 'status', 'approve', 'link', 'danger'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab ? 'bg-[#147D4A] text-white' : 'border border-[#dfe8e1] text-[#374744] hover:bg-[#f4f7f5]'}`}>
                    {tab === 'details' ? 'Overview' : tab === 'status' ? 'Status Transition' : tab === 'approve' ? 'Approve / Reject' : tab === 'link' ? 'Link Flock' : 'Administrative Actions'}
                  </button>
                ))}
              </div>

              {tabError && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{tabError}</div>}

              {activeTab === 'details' && (
                <div className="text-sm text-[#5d6d68]">
                  <p>Permitted transitions: In Transit to Quarantine/Cancelled and Quarantine to Completed/Cancelled. Completion requires Approved status.</p>
                </div>
              )}

              {activeTab === 'status' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">New status</span>
                    <select value={statusChange.new_status} onChange={(event) => setStatusChange((current) => ({ ...current, new_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                      <option value="">Select status</option>
                      {legalStatusTransitions.map((row) => <option key={row} value={row}>{row}</option>)}
                    </select>
                  </label>
                  {statusChange.new_status === 'Completed' && form.approval_status !== 'Approved' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Approval must be Approved before completion.</div>
                  )}
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Reason</span>
                    <textarea rows="2" value={statusChange.reason} onChange={(event) => setStatusChange((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  </label>
                  <div className="flex justify-end">
                    <button type="button" onClick={submitStatusChange} disabled={saving || (statusChange.new_status === 'Completed' && form.approval_status !== 'Approved')} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">Change Status</button>
                  </div>
                </div>
              )}

              {activeTab === 'approve' && (
                <div className="space-y-3">
                  {['Draft', 'Pending'].includes(form.approval_status) ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setApproval((current) => ({ ...current, decision: 'Approved' }))} className={`h-11 rounded-xl border ${approval.decision === 'Approved' ? 'border-green-500 bg-green-50 text-green-700' : 'border-[#dfe8e1] text-[#374744]'}`}>Approved</button>
                        <button type="button" onClick={() => setApproval((current) => ({ ...current, decision: 'Rejected' }))} className={`h-11 rounded-xl border ${approval.decision === 'Rejected' ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#dfe8e1] text-[#374744]'}`}>Rejected</button>
                      </div>
                      <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Comments</span><textarea rows="2" value={approval.comments} onChange={(event) => setApproval((current) => ({ ...current, comments: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                      <div className="flex justify-end"><button type="button" onClick={submitApproval} disabled={saving} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">Submit Decision</button></div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Already {form.approval_status} by {form.approved_by_username || 'N/A'} on {form.approved_date ? new Date(form.approved_date).toLocaleString() : 'N/A'}.</div>
                  )}
                </div>
              )}

              {activeTab === 'link' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Search flock</span><input value={linkFlock.search} onChange={(event) => setLinkFlock((current) => ({ ...current, search: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Flock</span>
                    <select value={linkFlock.flock_id} onChange={(event) => setLinkFlock((current) => ({ ...current, flock_id: event.target.value }))} disabled={Boolean(form.created_flock_id)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]">
                      <option value="">Select flock</option>
                      {filteredLinkFlocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number} - {row.farm_name || 'Farm'}</option>)}
                    </select>
                  </label>
                  {form.created_flock_number && <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">Current linked flock: {form.created_flock_number}</div>}
                  <div className="flex justify-end"><button type="button" onClick={submitLinkFlock} disabled={saving || Boolean(form.created_flock_id)} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">Link Flock</button></div>
                </div>
              )}

              {activeTab === 'danger' && (
                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Delete reason</span><textarea rows="2" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="w-full rounded-xl border border-[#f3b7b7] p-3 text-sm outline-none focus:border-red-400" /></label>
                  <div className="text-xs text-red-700">Hard delete requires soft-deleted shipment with no quarantine records and no linked flock.</div>
                  <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Type import number to confirm hard delete</span><input value={hardDeleteConfirmText} onChange={(event) => setHardDeleteConfirmText(event.target.value)} className="h-11 w-full rounded-xl border border-[#f3b7b7] px-3 text-sm outline-none focus:border-red-400" /></label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => runDangerAction('soft')} disabled={dangerBusy || !canSoftDelete} className="h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Soft Delete</button>
                    <button type="button" onClick={() => runDangerAction('restore')} disabled={dangerBusy || !canRestore} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Restore</button>
                    <button type="button" onClick={() => runDangerAction('hard')} disabled={dangerBusy || !canHardDelete || hardDeleteConfirmText !== form.import_number} className="h-11 rounded-xl bg-[#7f1d1d] px-4 text-sm font-semibold text-white hover:bg-[#6b1515] disabled:opacity-50">Hard Delete</button>
                  </div>
                  {!canSoftDelete && <div className="text-xs text-red-700">Soft delete blocked: Completed status, linked flock, or quarantine records exist.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </form>
      )}

      {workspaceTab === 'datalist' && (
      <>
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#20392D]">Quarantine Monitor</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-[#dfe8e1] bg-[#f9fcfa] px-3 py-2 md:col-span-4"><div className="text-xs text-[#5d6d68]">Informational data from quarantine monitor</div><div className="text-sm text-[#374744]">Use this area to track quarantine-related activity from existing API responses.</div></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#20392D]">Quarantine Alerts</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${dashboard.quarantineMonitor.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {dashboard.quarantineMonitor.length > 0 ? `${dashboard.quarantineMonitor.length} Active` : '0 Active'}
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2">
            {dashboard.quarantineMonitor.length === 0 ? <p className="text-sm text-[#5d6d68]">No active quarantine alerts.</p> : dashboard.quarantineMonitor.map((row) => (
              <div key={row.import_shipment_id} className="rounded-xl border border-[#dfe8e1] bg-[#f9fcfa] p-2 text-xs text-[#20392D]">
                <div className="font-semibold">{row.import_number}</div>
                <div>Quarantine days: {row.actual_quarantine_days ?? 0} • Health: {row.latest_health_status || 'N/A'}</div>
                <div>Related records: {row.quarantine_record_count ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#20392D]">Shipment List &amp; Search</h3>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4 lg:grid-cols-5">
          <input value={filters.search_text} onChange={(event) => setFilters((current) => ({ ...current, search_text: event.target.value }))} placeholder="Search import#, country, ref, waybill..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.supplier_id} onChange={(event) => setFilters((current) => ({ ...current, supplier_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All suppliers</option>{suppliers.map((row) => <option key={row.supplier_id} value={row.supplier_id}>{row.supplier_name}</option>)}</select>
          <select value={filters.breed_id} onChange={(event) => setFilters((current) => ({ ...current, breed_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All breeds</option>{breeds.map((row) => <option key={row.breed_id} value={row.breed_id}>{row.breed_code} - {row.breed_name}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All statuses</option>{choiceValues.statuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
          <select value={filters.approval_status} onChange={(event) => setFilters((current) => ({ ...current, approval_status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All approvals</option>{choiceValues.approvalStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
          <input type="date" value={filters.from_arrival} onChange={(event) => setFilters((current) => ({ ...current, from_arrival: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input type="date" value={filters.to_arrival} onChange={(event) => setFilters((current) => ({ ...current, to_arrival: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input value={filters.country} onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))} placeholder="Country filter" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.include_deleted} onChange={(event) => setFilters((current) => ({ ...current, include_deleted: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /> Include deleted</label>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm text-[#374744]"><input type="checkbox" checked={filters.pending_approvals_only} onChange={(event) => setFilters((current) => ({ ...current, pending_approvals_only: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" /> Pending approvals only</label>
        </div>
        <div className="mb-3 flex justify-end gap-2">
          <button type="button" onClick={() => { setPageNumber(1); loadListAndDashboard(); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Apply filters</button>
          <button type="button" onClick={() => { setFilters({ ...emptyFilters }); setPageNumber(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear filters</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-300 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#5d6d68]">
                <th className="px-2 py-2 font-semibold">Import #</th>
                <th className="px-2 py-2 font-semibold">Arrival</th>
                <th className="px-2 py-2 font-semibold">Country</th>
                <th className="px-2 py-2 font-semibold">Breed / Strain</th>
                <th className="px-2 py-2 font-semibold">Supplier</th>
                <th className="px-2 py-2 font-semibold">Imported (F/M)</th>
                <th className="px-2 py-2 font-semibold">Mortality</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Approval</th>
                <th className="px-2 py-2 font-semibold">Created flock</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="11" className="px-2 py-6 text-center text-[#5d6d68]">Loading import shipments...</td></tr>
              ) : listRows.length === 0 ? (
                <tr><td colSpan="11" className="px-2 py-6 text-center text-[#5d6d68]">No import shipments found.</td></tr>
              ) : (
                listRows.map((row) => (
                  <tr key={row.import_shipment_id || `${row.import_number}-${row.import_date}`} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.import_number}</td>
                    <td className="px-2 py-2">{toDateInput(row.arrival_date)}</td>
                    <td className="px-2 py-2">{row.country_of_origin}</td>
                    <td className="px-2 py-2">{row.breed_name || row.breed_code || '—'}{row.strain_name ? ` / ${row.strain_name}` : ''}</td>
                    <td className="px-2 py-2">{row.supplier_name || '—'}</td>
                    <td className="px-2 py-2">{Number(row.females_imported) || 0} / {Number(row.males_imported) || 0}</td>
                    <td className="px-2 py-2">{Number(row.transport_mortality_total) || 0}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-700'}`}>{row.status || 'N/A'}</span></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${APPROVAL_COLORS[row.approval_status] || 'bg-slate-100 text-slate-700'}`}>{row.approval_status || 'N/A'}</span></td>
                    <td className="px-2 py-2">{row.created_flock_number ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{row.created_flock_number}</span> : '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        {row.import_shipment_id && <button type="button" onClick={() => openEdit(row.import_shipment_id)} className="rounded-lg border border-[#dfe8e1] px-2 py-1 text-xs font-semibold text-[#374744] hover:bg-[#f4f7f5]">View / Edit</button>}
                        {row.import_shipment_id && (
                          <button type="button" onClick={() => openEdit(row.import_shipment_id).then(() => setActiveTab('approve'))} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50">Approval</button>
                        )}
                        {row.import_shipment_id && (
                          <button type="button" onClick={() => openEdit(row.import_shipment_id).then(() => setActiveTab('danger'))} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Admin</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!filters.pending_approvals_only && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-[#5d6d68]">Page {pageNumber} of {pageCount}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={pageNumber <= 1} className="h-10 rounded-xl border border-[#dfe8e1] px-3 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Previous</button>
              <button type="button" onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))} disabled={pageNumber >= pageCount} className="h-10 rounded-xl border border-[#dfe8e1] px-3 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-[#e2ebe3] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#20392D]">Pending Approvals</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-225 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#5d6d68]">
                <th className="px-2 py-2 font-semibold">Import #</th>
                <th className="px-2 py-2 font-semibold">Import Date</th>
                <th className="px-2 py-2 font-semibold">Country</th>
                <th className="px-2 py-2 font-semibold">Total Imported</th>
                <th className="px-2 py-2 font-semibold">Approval</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Supplier</th>
                <th className="px-2 py-2 font-semibold">Created By</th>
                <th className="px-2 py-2 font-semibold">Days Pending</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovalRows.length === 0 ? (
                <tr><td colSpan="9" className="px-2 py-6 text-center text-[#5d6d68]">No pending approvals.</td></tr>
              ) : (
                pendingApprovalRows.map((row) => (
                  <tr key={row.import_shipment_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.import_number}</td>
                    <td className="px-2 py-2">{toDateInput(row.import_date)}</td>
                    <td className="px-2 py-2">{row.country_of_origin}</td>
                    <td className="px-2 py-2">{row.total_imported ?? 0}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${APPROVAL_COLORS[row.approval_status] || 'bg-slate-100 text-slate-700'}`}>{row.approval_status}</span></td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="px-2 py-2">{row.supplier_name || '—'}</td>
                    <td className="px-2 py-2">{row.created_by_username || '—'}</td>
                    <td className="px-2 py-2">{row.days_pending ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
        )}
        </div>
      </div>
  );
}
