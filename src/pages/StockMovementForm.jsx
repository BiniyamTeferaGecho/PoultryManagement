import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  warehouse_id: '',
  batch_id: '',
  movement_type: 'Receipt',
  quantity: '',
  direction: 'In',
  unit_cost: '',
  movement_date: '',
  source_warehouse_id: '',
  destination_warehouse_id: '',
  idempotency_key: '',
  reference_table: '',
  reference_id: '',
  reason: '',
  movement_status: 'Draft',
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
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fieldError(errors, key) {
  return errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;
}

export default function StockMovementForm({
  currentUser,
  movementId = null,
  onSaved = () => {},
  onCancel = () => {},
}) {
  const { showError } = useGlobalPopup();
  const isEditMode = Boolean(movementId);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [movementTypes, setMovementTypes] = useState([]);
  const [movementStatuses, setMovementStatuses] = useState([]);
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [statusForm, setStatusForm] = useState({ new_status: '', reason: '' });
  const [statusErrors, setStatusErrors] = useState({});
  const [deleteReason, setDeleteReason] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [movementRows, setMovementRows] = useState([]);
  const [movementTotalCount, setMovementTotalCount] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementListLoading, setMovementListLoading] = useState(true);

  const movementTotalPages = Math.max(1, Math.ceil(movementTotalCount / 10));

  const selectionWarehouse = useMemo(
    () => warehouses.find((row) => row.warehouse_id === form.warehouse_id) || null,
    [warehouses, form.warehouse_id],
  );
  const sourceWarehouse = useMemo(
    () => warehouses.find((row) => row.warehouse_id === form.source_warehouse_id) || null,
    [warehouses, form.source_warehouse_id],
  );
  const destinationWarehouse = useMemo(
    () => warehouses.find((row) => row.warehouse_id === form.destination_warehouse_id) || null,
    [warehouses, form.destination_warehouse_id],
  );

  const batchLookup = useMemo(() => {
    const map = {};
    batches.forEach((row) => {
      if (row.batch_id) map[row.batch_id] = row;
    });
    return map;
  }, [batches]);

  const selectedBatch = batchLookup[form.batch_id] || null;
  const quantityValue = toNumber(form.quantity);
  const signedQuantity = form.direction === 'Out' ? -quantityValue : quantityValue;

  const loadMovementList = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setMovementListLoading(true);
    try {
      const payload = await apiRequest(`/inventory/stock-movement?page_number=${movementPage}&page_size=10&include_deleted=1`, currentUser.accessToken);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setMovementRows(rows);
      setMovementTotalCount(Number(payload.totalCount) || 0);
    } catch (error) {
      setMovementRows([]);
      setMovementTotalCount(0);
      showError(error.message || 'Unable to load stock movement list.');
    } finally {
      setMovementListLoading(false);
    }
  }, [currentUser.accessToken, movementPage, showError]);

  const loadReferenceData = useCallback(async () => {
    const [warehousePayload, batchPayload, choicesPayload, userPayload] = await Promise.all([
      apiRequest('/inventory/warehouse?page_size=100', currentUser.accessToken),
      apiRequest('/inventory/batch?page_size=100', currentUser.accessToken),
      apiRequest('/inventory/stock-movement/choice-values', currentUser.accessToken),
      apiRequest('/security/users?page_size=100', currentUser.accessToken),
    ]);

    setWarehouses(Array.isArray(warehousePayload.data) ? warehousePayload.data : []);
    setBatches(Array.isArray(batchPayload.data) ? batchPayload.data : []);
    setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);

    const choiceData = choicesPayload.data || {};
    setMovementTypes(Array.isArray(choiceData.movementTypes) ? choiceData.movementTypes : []);
    setMovementStatuses(Array.isArray(choiceData.movementStatuses) ? choiceData.movementStatuses : []);
    setDirections(Array.isArray(choiceData.directions) ? choiceData.directions : []);
  }, [currentUser.accessToken]);

  const loadMovement = useCallback(async () => {
    if (!movementId) return null;
    const payload = await apiRequest(`/inventory/stock-movement/${movementId}`, currentUser.accessToken);
    const row = payload.data || {};
    setForm({
      warehouse_id: row.warehouse_id || '',
      batch_id: row.batch_id || '',
      movement_type: row.movement_type || 'Receipt',
      quantity: row.quantity ?? '',
      direction: row.direction || 'In',
      unit_cost: row.unit_cost ?? '',
      movement_date: toDateInput(row.movement_date),
      source_warehouse_id: row.source_warehouse_id || '',
      destination_warehouse_id: row.destination_warehouse_id || '',
      idempotency_key: row.idempotency_key || '',
      reference_table: row.reference_table || '',
      reference_id: row.reference_id ?? '',
      reason: row.reason || '',
      movement_status: row.movement_status || 'Draft',
    });
    setStatusForm({ new_status: row.movement_status || 'Draft', reason: '' });
    return row;
  }, [currentUser.accessToken, movementId]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!currentUser.accessToken) return;
      setLoading(true);
      try {
        await loadReferenceData();
        if (isEditMode) {
          await loadMovement();
        } else {
          setForm(emptyForm);
          setStatusForm({ new_status: 'Draft', reason: '' });
        }
      } catch (error) {
        if (!active) return;
        showError(error.message || 'Unable to load stock movement form.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [currentUser.accessToken, isEditMode, loadMovement, loadReferenceData, showError]);

  useEffect(() => {
    if (!currentUser.accessToken) {
      setMovementRows([]);
      setMovementTotalCount(0);
      setMovementListLoading(false);
      return;
    }

    loadMovementList();
  }, [currentUser.accessToken, movementPage, loadMovementList]);

  function validateMain(nextForm) {
    const nextErrors = {};
    if (!nextForm.warehouse_id) nextErrors.warehouse_id = 'Warehouse is required.';
    if (!nextForm.batch_id) nextErrors.batch_id = 'Batch is required.';
    if (!nextForm.movement_type) nextErrors.movement_type = 'Movement type is required.';
    if (!nextForm.direction) nextErrors.direction = 'Direction is required.';
    if (nextForm.quantity === '' || Number(nextForm.quantity) <= 0) {
      nextErrors.quantity = 'Quantity must be greater than zero.';
    }
    if (nextForm.unit_cost !== '' && Number(nextForm.unit_cost) < 0) {
      nextErrors.unit_cost = 'Unit cost cannot be negative.';
    }
    if (nextForm.reference_id !== '' && (!Number.isFinite(Number(nextForm.reference_id)) || Number(nextForm.reference_id) < 0)) {
      nextErrors.reference_id = 'Reference ID must be a valid non-negative number.';
    }
    if ((nextForm.movement_type === 'Transfer Out' || nextForm.movement_type === 'Transfer In') && !nextForm.source_warehouse_id && !nextForm.destination_warehouse_id) {
      nextErrors.source_warehouse_id = 'Transfer movements need a warehouse reference.';
      nextErrors.destination_warehouse_id = 'Transfer movements need a warehouse reference.';
    }
    if ((nextForm.reason || '').length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    if (!nextForm.movement_status) nextErrors.movement_status = 'Movement status is required.';
    return nextErrors;
  }

  async function handleListAction(row, action) {
    const targetId = row?.movement_id;
    if (!targetId) return;

    if (action === 'edit') {
      setForm({
        warehouse_id: row.warehouse_id || '',
        batch_id: row.batch_id || '',
        movement_type: row.movement_type || 'Receipt',
        quantity: row.quantity ?? '',
        direction: row.direction || 'In',
        unit_cost: row.unit_cost ?? '',
        movement_date: toDateInput(row.movement_date),
        source_warehouse_id: row.source_warehouse_id || '',
        destination_warehouse_id: row.destination_warehouse_id || '',
        idempotency_key: row.idempotency_key || '',
        reference_table: row.reference_table || '',
        reference_id: row.reference_id ?? '',
        reason: row.reason || '',
        movement_status: row.movement_status || 'Draft',
      });
      setSuccessMessage('');
      setActiveTab('details');
      return;
    }

    const confirmMessages = {
      softDelete: 'Soft-delete this stock movement?',
      restore: 'Restore this stock movement?',
      hardDelete: 'This will permanently delete the stock movement. Continue?',
    };
    const actionMessages = {
      softDelete: 'Stock movement deleted successfully.',
      restore: 'Stock movement restored successfully.',
      hardDelete: 'Stock movement permanently deleted.',
    };

    if (confirmMessages[action] && !window.confirm(confirmMessages[action])) return;

    try {
      const endpoint = action === 'softDelete'
        ? `/inventory/stock-movement/${targetId}`
        : action === 'restore'
          ? `/inventory/stock-movement/${targetId}/restore`
          : `/inventory/stock-movement/${targetId}/hard`;
      const method = action === 'softDelete' || action === 'hardDelete' ? 'DELETE' : 'POST';
      await apiRequest(endpoint, currentUser.accessToken, {
        method,
        body: JSON.stringify({
          reason: action === 'softDelete' ? 'Deleted from stock movement list.' : 'Restored from stock movement list.',
          confirm: action === 'hardDelete',
          user_id: currentUser.user_id || null,
        }),
      });
      setSuccessMessage(actionMessages[action]);
      await loadMovementList();
      if (movementId === targetId) {
        await loadMovement();
      }
    } catch (error) {
      showError(error.message || 'Unable to complete the movement action.');
    }
  }

  async function refreshMovementAndNotify(message) {
    if (!movementId) return;
    setRefreshing(true);
    try {
      const row = await loadMovement();
      setSuccessMessage(message);
      onSaved(row);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMainSubmit(event) {
    event.preventDefault();
    setSuccessMessage('');
    const validationErrors = validateMain(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    try {
      const payload = {
        warehouse_id: form.warehouse_id,
        batch_id: form.batch_id,
        movement_type: form.movement_type,
        quantity: Number(form.quantity),
        direction: form.direction,
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        movement_date: form.movement_date || null,
        source_warehouse_id: form.source_warehouse_id || null,
        destination_warehouse_id: form.destination_warehouse_id || null,
        idempotency_key: form.idempotency_key.trim() || null,
        reference_table: form.reference_table.trim() || null,
        reference_id: form.reference_id === '' ? null : Number(form.reference_id),
        reason: form.reason.trim() || null,
        movement_status: form.movement_status,
        user_id: currentUser.user_id || null,
      };

      if (!isEditMode) {
        const response = await apiRequest('/inventory/stock-movement', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMessage('Stock movement created successfully.');
        onSaved(response.data);
        setForm(emptyForm);
        return;
      }

      const response = await apiRequest(`/inventory/stock-movement/${movementId}`, currentUser.accessToken, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccessMessage('Stock movement updated successfully.');
      onSaved(response.data);
      await loadMovement();
    } catch (error) {
      showError(error.message || 'Unable to save stock movement.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStatusChange() {
    const nextErrors = {};
    if (!statusForm.new_status) nextErrors.new_status = 'Status is required.';
    setStatusErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setRefreshing(true);
    try {
      await apiRequest(`/inventory/stock-movement/${movementId}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: statusForm.new_status,
          reason: statusForm.reason.trim() || null,
          user_id: currentUser.user_id || null,
        }),
      });
      await refreshMovementAndNotify('Movement status updated successfully.');
    } catch (error) {
      showError(error.message || 'Unable to change movement status.');
    } finally {
      setRefreshing(false);
    }
  }

  async function submitApprove() {
    if (!window.confirm('Approve this stock movement?')) return;
    try {
      setRefreshing(true);
      await apiRequest(`/inventory/stock-movement/${movementId}/approve`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Approved by user.' }),
      });
      await refreshMovementAndNotify('Movement approved successfully.');
    } catch (error) {
      showError(error.message || 'Unable to approve movement.');
    } finally {
      setRefreshing(false);
    }
  }

  async function submitReject() {
    if (!window.confirm('Reject this stock movement?')) return;
    try {
      setRefreshing(true);
      await apiRequest(`/inventory/stock-movement/${movementId}/reject`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Rejected by user.' }),
      });
      await refreshMovementAndNotify('Movement rejected successfully.');
    } catch (error) {
      showError(error.message || 'Unable to reject movement.');
    } finally {
      setRefreshing(false);
    }
  }

  async function submitPost() {
    if (!window.confirm('Post this stock movement?')) return;
    try {
      setRefreshing(true);
      await apiRequest(`/inventory/stock-movement/${movementId}/post`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null, post_date: new Date().toISOString().slice(0, 10) }),
      });
      await refreshMovementAndNotify('Movement posted successfully.');
    } catch (error) {
      showError(error.message || 'Unable to post movement.');
    } finally {
      setRefreshing(false);
    }
  }

  async function submitReverse() {
    if (!window.confirm('Reverse this stock movement?')) return;
    try {
      setRefreshing(true);
      await apiRequest(`/inventory/stock-movement/${movementId}/reverse`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Reversed by user.' }),
      });
      await refreshMovementAndNotify('Movement reversed successfully.');
    } catch (error) {
      showError(error.message || 'Unable to reverse movement.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete(action) {
    const isHardDelete = action === 'hard';
    const confirmationText = isHardDelete ? 'Permanent deletion cannot be undone. Continue?' : 'Soft delete this stock movement?';
    if (!window.confirm(confirmationText)) return;

    setDangerBusy(true);
    try {
      const endpoint = isHardDelete
        ? `/inventory/stock-movement/${movementId}/hard`
        : `/inventory/stock-movement/${movementId}`;
      const payload = isHardDelete ? { confirm: true, user_id: currentUser.user_id || null } : { reason: deleteReason.trim() || 'Deleted by user.', user_id: currentUser.user_id || null };
      await apiRequest(endpoint, currentUser.accessToken, {
        method: isHardDelete ? 'DELETE' : 'DELETE',
        body: JSON.stringify(payload),
      });
      setSuccessMessage(isHardDelete ? 'Stock movement permanently deleted.' : 'Stock movement deleted successfully.');
      if (onSaved) onSaved({ action: 'deleted', movementId });
    } catch (error) {
      showError(error.message || 'Unable to delete stock movement.');
    } finally {
      setDangerBusy(false);
    }
  }

  const editableFields = (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse</label>
        <select
          value={form.warehouse_id}
          onChange={(event) => setForm((current) => ({ ...current, warehouse_id: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">Select warehouse</option>
          {warehouses.map((row) => (
            <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_name || row.warehouse_code || 'Warehouse'}</option>
          ))}
        </select>
        {fieldError(errors, 'warehouse_id')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Batch</label>
        <select
          value={form.batch_id}
          onChange={(event) => setForm((current) => ({ ...current, batch_id: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">Select batch</option>
          {batches.map((row) => (
            <option key={row.batch_id} value={row.batch_id}>{row.batch_number || row.product_name || 'Batch'}</option>
          ))}
        </select>
        {fieldError(errors, 'batch_id')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Movement type</label>
        <select
          value={form.movement_type}
          onChange={(event) => setForm((current) => ({ ...current, movement_type: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {movementTypes.map((row) => (
            <option key={row.value} value={row.value}>{row.label || row.value}</option>
          ))}
        </select>
        {fieldError(errors, 'movement_type')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Movement status</label>
        <select
          value={form.movement_status}
          onChange={(event) => setForm((current) => ({ ...current, movement_status: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {movementStatuses.map((row) => (
            <option key={row.value} value={row.value}>{row.label || row.value}</option>
          ))}
        </select>
        {fieldError(errors, 'movement_status')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Direction</label>
        <select
          value={form.direction}
          onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {directions.map((row) => (
            <option key={row.value} value={row.value}>{row.label || row.value}</option>
          ))}
        </select>
        {fieldError(errors, 'direction')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.quantity}
          onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        {fieldError(errors, 'quantity')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Unit cost</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.unit_cost}
          onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        {fieldError(errors, 'unit_cost')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Movement date</label>
        <input
          type="date"
          value={form.movement_date}
          onChange={(event) => setForm((current) => ({ ...current, movement_date: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Source warehouse</label>
        <select
          value={form.source_warehouse_id}
          onChange={(event) => setForm((current) => ({ ...current, source_warehouse_id: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">Select source warehouse</option>
          {warehouses.map((row) => (
            <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_name || row.warehouse_code || 'Warehouse'}</option>
          ))}
        </select>
        {fieldError(errors, 'source_warehouse_id')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Destination warehouse</label>
        <select
          value={form.destination_warehouse_id}
          onChange={(event) => setForm((current) => ({ ...current, destination_warehouse_id: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">Select destination warehouse</option>
          {warehouses.map((row) => (
            <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_name || row.warehouse_code || 'Warehouse'}</option>
          ))}
        </select>
        {fieldError(errors, 'destination_warehouse_id')}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Reference table</label>
        <input
          type="text"
          value={form.reference_table}
          onChange={(event) => setForm((current) => ({ ...current, reference_table: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="e.g. sales.order"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Reference ID</label>
        <input
          type="number"
          min="0"
          step="1"
          value={form.reference_id}
          onChange={(event) => setForm((current) => ({ ...current, reference_id: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        {fieldError(errors, 'reference_id')}
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700">Idempotency key</label>
        <input
          type="text"
          value={form.idempotency_key}
          onChange={(event) => setForm((current) => ({ ...current, idempotency_key: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700">Reason / notes</label>
        <textarea
          rows="4"
          value={form.reason}
          onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        {fieldError(errors, 'reason')}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 rounded-3xl border border-[#dfe8e1] bg-white p-4 shadow-[0_15px_35px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Inventory</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{isEditMode ? 'Edit Stock Movement' : 'Create Stock Movement'}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-2">
        {['details', 'status', 'danger'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              activeTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab === 'details' ? 'Details' : tab === 'status' ? 'Status' : 'Danger Zone'}
          </button>
        ))}
      </div>

      {successMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="mb-6 rounded-3xl border border-[#dfe8e1] bg-white p-4 shadow-[0_15px_35px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#374744]">Movement List</h3>
            <p className="text-sm text-[#5d6d68]">Manage movement records directly from the list.</p>
          </div>
          <div className="text-sm text-[#5d6d68]">Total: {movementTotalCount.toLocaleString()}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Movement</th>
                <th className="px-2 py-2">Warehouse</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {movementListLoading ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading stock movements...</td></tr>
              ) : movementRows.length === 0 ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No stock movements found.</td></tr>
              ) : movementRows.map((row) => {
                const rowDeleted = Boolean(row.is_deleted);
                return (
                  <tr key={row.movement_id} className={`border-b border-[#f0f3f1] ${rowDeleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.movement_type || '—'} / {row.direction || '—'}</td>
                    <td className="px-2 py-2">{row.warehouse_name || row.warehouse_code || '-'}</td>
                    <td className="px-2 py-2">{row.batch_number || row.product_name || '-'}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${rowDeleted ? 'bg-red-50 text-red-700' : row.movement_status === 'Posted' ? 'bg-[#eafaf0] text-[#198754]' : row.movement_status === 'Rejected' ? 'bg-red-50 text-red-700' : row.movement_status === 'Approved' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                        {rowDeleted ? 'Deleted' : row.movement_status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-2 py-2">{Number(row.quantity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleListAction(row, 'edit')} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>
                        {!rowDeleted && <button type="button" onClick={() => handleListAction(row, 'softDelete')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                        {rowDeleted && <button type="button" onClick={() => handleListAction(row, 'restore')} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                        {rowDeleted && <button type="button" onClick={() => handleListAction(row, 'hardDelete')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Hard Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#44514d]">
          <span>Page {movementPage} of {movementTotalPages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMovementPage((current) => Math.max(1, current - 1))} disabled={movementPage <= 1 || movementListLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <button type="button" onClick={() => setMovementPage((current) => Math.min(movementTotalPages, current + 1))} disabled={movementPage >= movementTotalPages || movementListLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {activeTab === 'details' && (
        <div className="rounded-3xl border border-[#dfe8e1] bg-white p-4 shadow-[0_15px_35px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
            <div>
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading inventory data...</div>
              ) : (
                <form onSubmit={handleMainSubmit} className="space-y-6">
                  {editableFields}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitting || refreshing}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitting ? 'Saving...' : isEditMode ? 'Save movements' : 'Create movement'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </form>
              )}
            </div>

            <aside className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Movement summary</h3>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700">{form.movement_status || 'Draft'}</span>
              </div>

              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Warehouse</span><span className="font-semibold text-right">{selectionWarehouse?.warehouse_name || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Batch</span><span className="font-semibold text-right">{selectedBatch?.batch_number || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Direction</span><span className="font-semibold text-right">{form.direction || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Signed qty</span><span className="font-semibold text-right">{signedQuantity}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Unit cost</span><span className="font-semibold text-right">{form.unit_cost ? Number(form.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Source</span><span className="font-semibold text-right">{sourceWarehouse?.warehouse_name || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Destination</span><span className="font-semibold text-right">{destinationWarehouse?.warehouse_name || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Created by</span><span className="font-semibold text-right">{users.find((user) => user.user_id === currentUser.user_id)?.username || 'System'}</span></div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="rounded-3xl border border-[#dfe8e1] bg-white p-4 shadow-[0_15px_35px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Change status</label>
                <select
                  value={statusForm.new_status}
                  onChange={(event) => setStatusForm((current) => ({ ...current, new_status: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Select status</option>
                  {movementStatuses.map((row) => (
                    <option key={row.value} value={row.value}>{row.label || row.value}</option>
                  ))}
                </select>
                {fieldError(statusErrors, 'new_status')}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <textarea
                  rows="4"
                  value={statusForm.reason}
                  onChange={(event) => setStatusForm((current) => ({ ...current, reason: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={submitStatusChange}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Update status
                </button>
                <button type="button" onClick={submitApprove} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Approve</button>
                <button type="button" onClick={submitReject} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100">Reject</button>
                <button type="button" onClick={submitPost} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100">Post</button>
                <button type="button" onClick={submitReverse} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100">Reverse</button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-base font-bold text-slate-800">Current movement</h3>
              <dl className="space-y-3 text-sm text-slate-700">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="font-semibold text-right">{form.movement_type || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Direction</dt><dd className="font-semibold text-right">{form.direction || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Qty</dt><dd className="font-semibold text-right">{quantityValue || '0'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-semibold text-right">{form.movement_status || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Warehouse</dt><dd className="font-semibold text-right">{selectionWarehouse?.warehouse_name || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Batch</dt><dd className="font-semibold text-right">{selectedBatch?.batch_number || '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="rounded-3xl border border-red-200 bg-white p-4 shadow-[0_15px_35px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="max-w-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Danger Zone</h3>
              <p className="mt-1 text-sm text-slate-600">Delete or restore the stock movement when needed. Hard delete permanently removes the record.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Delete reason</label>
              <textarea
                rows="3"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleDelete('soft')}
                disabled={dangerBusy || !movementId}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete movement
              </button>
              <button
                type="button"
                onClick={() => handleDelete('hard')}
                disabled={dangerBusy || !movementId}
                className="rounded-xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hard delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
