import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  batch_id: '',
  product_id: '',
  supplier_id: '',
  batch_number: '',
  manufacturer_batch_no: '',
  manufacture_date: '',
  expiry_date: '',
  quantity_received: '',
  unit_cost: '',
  receiving_document: '',
  batch_status: 'Active',
  is_active: true,
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

function toBoolean(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return Boolean(value);
}

function fieldError(errors, key) {
  return errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;
}

export default function ProductBatchForm({ currentUser, batchId = null, onSaved = () => {}, onCancel = () => {} }) {
  const { showError } = useGlobalPopup();
  const [selectedBatchId, setSelectedBatchId] = useState(batchId || '');
  const editingBatchId = selectedBatchId || batchId || '';
  const isEditMode = Boolean(editingBatchId);
  const userId = currentUser?.user_id || currentUser?.id || null;

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [statusChoices, setStatusChoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [statusForm, setStatusForm] = useState({ batch_status: 'Active', reason: '' });
  const [statusErrors, setStatusErrors] = useState({});
  const [adjustForm, setAdjustForm] = useState({ adjustment_qty: '', reason: '' });
  const [adjustErrors, setAdjustErrors] = useState({});
  const [deleteReason, setDeleteReason] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [batchRows, setBatchRows] = useState([]);
  const [batchTotalCount, setBatchTotalCount] = useState(0);
  const [batchPage, setBatchPage] = useState(1);
  const [batchListLoading, setBatchListLoading] = useState(true);

  const batchTotalPages = Math.max(1, Math.ceil(batchTotalCount / 10));

  const selectedProduct = useMemo(
    () => products.find((row) => row.product_id === form.product_id) || null,
    [form.product_id, products],
  );

  const loadBatchList = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    setBatchListLoading(true);
    try {
      const payload = await apiRequest(`/inventory/batch?page_number=${batchPage}&page_size=10&include_deleted=1`, currentUser.accessToken);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setBatchRows(rows);
      setBatchTotalCount(Number(payload.totalCount) || 0);
    } catch (error) {
      setBatchRows([]);
      setBatchTotalCount(0);
      showError(error.message || 'Unable to load batch list.');
    } finally {
      setBatchListLoading(false);
    }
  }, [batchPage, currentUser?.accessToken, showError]);

  const loadReferenceData = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    const [productPayload, supplierPayload, choicePayload, userPayload] = await Promise.all([
      apiRequest('/product-batch/meta/products', currentUser.accessToken),
      apiRequest('/product-batch/meta/suppliers', currentUser.accessToken),
      apiRequest('/inventory/batch/choice-values', currentUser.accessToken),
      apiRequest('/security/users?page_size=100', currentUser.accessToken),
    ]);

    setProducts(Array.isArray(productPayload.data) ? productPayload.data : []);
    setSuppliers(Array.isArray(supplierPayload.data) ? supplierPayload.data : []);
    setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);

    const choiceData = choicePayload.data || {};
    const nextChoices = Array.isArray(choiceData.batchStatuses)
      ? choiceData.batchStatuses
      : Array.isArray(choiceData.batchStatusOptions)
        ? choiceData.batchStatusOptions
        : [];
    setStatusChoices(nextChoices.length ? nextChoices : ['Active', 'Depleted', 'Expired', 'Quarantined', 'Recalled', 'On Hold']);
  }, [currentUser?.accessToken]);

  const loadBatch = useCallback(async () => {
    if (!editingBatchId || !currentUser?.accessToken) return null;
    const payload = await apiRequest(`/inventory/batch/${editingBatchId}`, currentUser.accessToken);
    const row = payload.data || {};
    setForm({
      batch_id: row.batch_id || '',
      product_id: row.product_id || '',
      supplier_id: row.supplier_id || '',
      batch_number: row.batch_number || '',
      manufacturer_batch_no: row.manufacturer_batch_no || '',
      manufacture_date: toDateInput(row.manufacture_date),
      expiry_date: toDateInput(row.expiry_date),
      quantity_received: row.quantity_received ?? '',
      unit_cost: row.unit_cost ?? '',
      receiving_document: row.receiving_document || '',
      batch_status: row.batch_status || 'Active',
      is_active: toBoolean(row.is_active),
    });
    setStatusForm({ batch_status: row.batch_status || 'Active', reason: '' });
    setAdjustForm({ adjustment_qty: '', reason: '' });
    setDeleteReason('');
    return row;
  }, [editingBatchId, currentUser?.accessToken]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!currentUser?.accessToken) return;
      setLoading(true);
      try {
        await loadReferenceData();
        if (isEditMode) {
          await loadBatch();
        } else {
          setForm(emptyForm);
          setStatusForm({ batch_status: 'Active', reason: '' });
        }
      } catch (error) {
        if (!active) return;
        showError(error.message || 'Unable to load product batch form.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.accessToken, isEditMode, loadBatch, loadReferenceData, showError]);

  useEffect(() => {
    if (!batchId) {
      setSelectedBatchId('');
    }
  }, [batchId]);

  useEffect(() => {
    if (!currentUser?.accessToken) return;
    loadBatchList();
  }, [currentUser?.accessToken, loadBatchList]);

  function validateMain(nextForm) {
    const nextErrors = {};
    if (!nextForm.product_id) nextErrors.product_id = 'Product is required.';
    if (!String(nextForm.batch_number || '').trim()) nextErrors.batch_number = 'Batch number is required.';
    if (!isEditMode && (nextForm.quantity_received === '' || Number(nextForm.quantity_received) <= 0)) {
      nextErrors.quantity_received = 'Quantity received must be greater than zero.';
    }
    if (nextForm.quantity_received !== '' && Number(nextForm.quantity_received) <= 0) {
      nextErrors.quantity_received = 'Quantity received must be greater than zero.';
    }
    if (nextForm.unit_cost !== '' && Number(nextForm.unit_cost) < 0) {
      nextErrors.unit_cost = 'Unit cost cannot be negative.';
    }
    if (nextForm.expiry_date && nextForm.manufacture_date && nextForm.expiry_date < nextForm.manufacture_date) {
      nextErrors.expiry_date = 'Expiry date cannot precede manufacture date.';
    }
    if (!nextForm.batch_status) nextErrors.batch_status = 'Batch status is required.';
    if ((nextForm.receiving_document || '').length > 50) nextErrors.receiving_document = 'Receiving document must not exceed 50 characters.';
    if ((nextForm.manufacturer_batch_no || '').length > 50) nextErrors.manufacturer_batch_no = 'Manufacturer batch no must not exceed 50 characters.';
    return nextErrors;
  }

  function validateStatus(nextStatusForm) {
    const nextErrors = {};
    if (!nextStatusForm.batch_status) nextErrors.batch_status = 'Status is required.';
    if ((nextStatusForm.reason || '').length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    return nextErrors;
  }

  function validateAdjust(nextAdjustForm) {
    const nextErrors = {};
    if (nextAdjustForm.adjustment_qty === '' || Number(nextAdjustForm.adjustment_qty) === 0) {
      nextErrors.adjustment_qty = 'Adjustment quantity is required.';
    }
    if ((nextAdjustForm.reason || '').length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    return nextErrors;
  }

  async function refreshAfterAction(message) {
    setSuccessMessage(message);
    if (editingBatchId) {
      await loadBatch();
    }
    await loadBatchList();
    onSaved();
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
        product_id: form.product_id,
        supplier_id: form.supplier_id || null,
        batch_number: String(form.batch_number || '').trim(),
        manufacturer_batch_no: String(form.manufacturer_batch_no || '').trim() || null,
        manufacture_date: form.manufacture_date || null,
        expiry_date: form.expiry_date || null,
        quantity_received: form.quantity_received === '' ? null : Number(form.quantity_received),
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        receiving_document: String(form.receiving_document || '').trim() || null,
        batch_status: form.batch_status,
        is_active: Boolean(form.is_active),
        user_id: userId,
      };

      if (isEditMode) {
        delete payload.product_id;
        delete payload.batch_number;
        delete payload.quantity_received;
      }

      const response = await apiRequest(isEditMode ? `/inventory/batch/${editingBatchId}` : '/inventory/batch', currentUser.accessToken, {
        method: isEditMode ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (!isEditMode && response?.data?.batch_id) {
        setSelectedBatchId(response.data.batch_id);
      }

      setSuccessMessage(isEditMode ? 'Product batch updated successfully.' : 'Product batch created successfully.');
      if (!isEditMode) {
        setForm(emptyForm);
      }
      await loadBatchList();
      onSaved();
    } catch (error) {
      showError(error.message || 'Unable to save product batch.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(event) {
    event.preventDefault();
    if (!editingBatchId) return;
    const validationErrors = validateStatus(statusForm);
    setStatusErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    try {
      await apiRequest(`/inventory/batch/${editingBatchId}/change-status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          batch_status: statusForm.batch_status,
          reason: statusForm.reason || null,
          user_id: userId,
        }),
      });
      await refreshAfterAction('Batch status updated successfully.');
      setStatusForm({ batch_status: form.batch_status || 'Active', reason: '' });
    } catch (error) {
      showError(error.message || 'Unable to update batch status.');
    }
  }

  async function handleAdjustQuantity(event) {
    event.preventDefault();
    if (!editingBatchId) return;
    const validationErrors = validateAdjust(adjustForm);
    setAdjustErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    try {
      await apiRequest(`/inventory/batch/${editingBatchId}/adjust-quantity`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          adjustment_qty: Number(adjustForm.adjustment_qty),
          reason: adjustForm.reason || null,
          user_id: userId,
        }),
      });
      await refreshAfterAction('Batch quantity adjusted successfully.');
      setAdjustForm({ adjustment_qty: '', reason: '' });
      setAdjustErrors({});
    } catch (error) {
      showError(error.message || 'Unable to adjust batch quantity.');
    }
  }

  async function handleDelete(event) {
    event.preventDefault();
    if (!editingBatchId) return;
    setDangerBusy(true);
    try {
      await apiRequest(`/inventory/batch/${editingBatchId}/delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          reason: deleteReason || 'Deleted from production batch form.',
          user_id: userId,
        }),
      });
      setSuccessMessage('Product batch deleted successfully.');
      setSelectedBatchId('');
      setForm(emptyForm);
      await loadBatchList();
      onSaved();
    } catch (error) {
      showError(error.message || 'Unable to delete batch.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleRestore() {
    if (!editingBatchId) return;
    try {
      await apiRequest(`/inventory/batch/${editingBatchId}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      await refreshAfterAction('Product batch restored successfully.');
    } catch (error) {
      showError(error.message || 'Unable to restore batch.');
    }
  }

  async function handleHardDelete() {
    if (!editingBatchId) return;
    if (!window.confirm('Permanently delete this batch? This cannot be undone.')) return;
    setDangerBusy(true);
    try {
      await apiRequest(`/inventory/batch/${editingBatchId}/hard-delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, user_id: userId }),
      });
      setSuccessMessage('Product batch permanently deleted.');
      setSelectedBatchId('');
      setForm(emptyForm);
      await loadBatchList();
      onSaved();
    } catch (error) {
      showError(error.message || 'Unable to hard-delete batch.');
    } finally {
      setDangerBusy(false);
    }
  }

  const canEditDelete = Boolean(editingBatchId);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1f2d2a]">Production Batch</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage batch lifecycle, expiry, status, and stock adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
          {canEditDelete && (
            <>
              <button
                type="button"
                onClick={handleRestore}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handleHardDelete}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Hard Delete
              </button>
            </>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2 text-sm font-semibold text-[#365148] hover:bg-[#f4f7f5]"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-8 text-center text-sm text-[#5d6d68] shadow-sm">
          Loading batch form...
        </div>
      ) : (
        <>
          <form onSubmit={handleMainSubmit} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap gap-2">
              {['details', 'status', 'adjustments', 'danger'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition ${
                    activeTab === tab
                      ? 'bg-[#0f8b3d] text-white'
                      : 'border border-[#dfe8e1] bg-white text-[#45615a] hover:bg-[#f5faf7]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Product</span>
                    <select
                      value={form.product_id}
                      onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}
                      disabled={isEditMode}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]"
                    >
                      <option value="">Select product</option>
                      {products.map((row) => (
                        <option key={row.product_id} value={row.product_id}>
                          {row.product_code} - {row.product_name}
                        </option>
                      ))}
                    </select>
                    {fieldError(errors, 'product_id')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Batch number</span>
                    <input
                      value={form.batch_number}
                      onChange={(event) => setForm((current) => ({ ...current, batch_number: event.target.value }))}
                      disabled={isEditMode}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]"
                    />
                    {fieldError(errors, 'batch_number')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Supplier</span>
                    <select
                      value={form.supplier_id}
                      onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((row) => (
                        <option key={row.supplier_id} value={row.supplier_id}>
                          {row.supplier_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Manufacturer batch no</span>
                    <input
                      value={form.manufacturer_batch_no}
                      onChange={(event) => setForm((current) => ({ ...current, manufacturer_batch_no: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                    {fieldError(errors, 'manufacturer_batch_no')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Manufacture date</span>
                    <input
                      type="date"
                      value={form.manufacture_date}
                      onChange={(event) => setForm((current) => ({ ...current, manufacture_date: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Expiry date</span>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(event) => setForm((current) => ({ ...current, expiry_date: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                    {fieldError(errors, 'expiry_date')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Quantity received</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.quantity_received}
                      onChange={(event) => setForm((current) => ({ ...current, quantity_received: event.target.value }))}
                      disabled={isEditMode}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]"
                    />
                    {fieldError(errors, 'quantity_received')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Unit cost</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.unit_cost}
                      onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                    {fieldError(errors, 'unit_cost')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Receiving document</span>
                    <input
                      value={form.receiving_document}
                      onChange={(event) => setForm((current) => ({ ...current, receiving_document: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                    {fieldError(errors, 'receiving_document')}
                  </label>

                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Batch status</span>
                    <select
                      value={form.batch_status}
                      onChange={(event) => setForm((current) => ({ ...current, batch_status: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    >
                      {statusChoices.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    {fieldError(errors, 'batch_status')}
                  </label>

                  <label className="flex items-center gap-2 pt-7 text-sm font-medium text-[#374744]">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                      className="h-4 w-4 accent-[#0f8b3d]"
                    />
                    <span>Active batch</span>
                  </label>
                </div>

                {selectedProduct && (
                  <div className="rounded-xl border border-[#eaf0ee] bg-[#f5faf7] p-3 text-sm text-[#38534d]">
                    <div className="font-semibold">Selected product</div>
                    <div className="mt-1">
                      {selectedProduct.product_code} • {selectedProduct.product_name}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatchId('');
                        setForm(emptyForm);
                        if (onCancel) onCancel();
                      }}
                      className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-60"
                  >
                    {submitting ? 'Saving...' : isEditMode ? 'Update batch' : 'Create batch'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <form onSubmit={handleStatusChange} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">New status</span>
                    <select
                      value={statusForm.batch_status}
                      onChange={(event) => setStatusForm((current) => ({ ...current, batch_status: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    >
                      {statusChoices.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    {fieldError(statusErrors, 'batch_status')}
                  </label>

                  <div className="flex items-end">
                    <div className="rounded-xl border border-[#dfe8e1] bg-[#f7faf8] px-3 py-2 text-sm text-[#51615d]">
                      Current: <span className="font-semibold">{form.batch_status || 'Active'}</span>
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Status reason</span>
                  <textarea
                    rows="4"
                    value={statusForm.reason}
                    onChange={(event) => setStatusForm((current) => ({ ...current, reason: event.target.value }))}
                    className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]"
                  />
                  {fieldError(statusErrors, 'reason')}
                </label>

                <div className="flex justify-end">
                  <button type="submit" className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">
                    Update status
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'adjustments' && (
              <form onSubmit={handleAdjustQuantity} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-[#374744]">
                    <span className="mb-1 block">Adjustment quantity</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={adjustForm.adjustment_qty}
                      onChange={(event) => setAdjustForm((current) => ({ ...current, adjustment_qty: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                    />
                    {fieldError(adjustErrors, 'adjustment_qty')}
                  </label>

                  <div className="flex items-end">
                    <div className="rounded-xl border border-[#dfe8e1] bg-[#f7faf8] px-3 py-2 text-sm text-[#51615d]">
                      Quantity remaining: <span className="font-semibold">{toNumber(form.quantity_received)}</span>
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Adjustment reason</span>
                  <textarea
                    rows="4"
                    value={adjustForm.reason}
                    onChange={(event) => setAdjustForm((current) => ({ ...current, reason: event.target.value }))}
                    className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]"
                  />
                  {fieldError(adjustErrors, 'reason')}
                </label>

                <div className="flex justify-end">
                  <button type="submit" className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133]">
                    Adjust quantity
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'danger' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <div className="font-bold">Danger zone</div>
                  <p className="mt-1">Soft delete removes the batch from active use without removing the underlying record.</p>
                </div>

                <label className="block text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Deletion reason</span>
                  <textarea
                    rows="4"
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                    className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!batchId || dangerBusy}
                    onClick={handleDelete}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {dangerBusy ? 'Processing...' : 'Soft delete'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1f2d2a]">Batch list</h3>
                <p className="text-xs text-[#5d6d68]">{batchTotalCount.toLocaleString()} total records</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchId('');
                  setForm(emptyForm);
                  setStatusForm({ batch_status: 'Active', reason: '' });
                  setActiveTab('details');
                }}
                className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2 text-sm font-semibold text-[#375249] hover:bg-[#f3faf6]"
              >
                New batch
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e9efe9] text-[#51615d]">
                    <th className="px-2 py-2">Product</th>
                    <th className="px-2 py-2">Batch</th>
                    <th className="px-2 py-2">Supplier</th>
                    <th className="px-2 py-2">Expiry</th>
                    <th className="px-2 py-2">Remaining</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Active</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchListLoading ? (
                    <tr>
                      <td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading batches...</td>
                    </tr>
                  ) : batchRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No batches found.</td>
                    </tr>
                  ) : (
                    batchRows.map((row) => (
                      <tr key={row.batch_id} className="border-b border-[#f0f3f1]">
                        <td className="px-2 py-2">{row.product_code || row.product_name || '-'}</td>
                        <td className="px-2 py-2">{row.batch_number || '-'}</td>
                        <td className="px-2 py-2">{row.supplier_name || '-'}</td>
                        <td className="px-2 py-2">{row.expiry_date ? String(row.expiry_date).slice(0, 10) : '-'}</td>
                        <td className="px-2 py-2">{row.quantity_remaining ?? '-'}</td>
                        <td className="px-2 py-2">
                          <span className="rounded-full bg-[#e9f8ee] px-2 py-1 text-xs font-semibold text-[#1a7a48]">
                            {row.batch_status || 'Active'}
                          </span>
                        </td>
                        <td className="px-2 py-2">{toBoolean(row.is_active) ? 'Yes' : 'No'}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBatchId(row.batch_id || '');
                                setForm({
                                  batch_id: row.batch_id || '',
                                  product_id: row.product_id || '',
                                  supplier_id: row.supplier_id || '',
                                  batch_number: row.batch_number || '',
                                  manufacturer_batch_no: row.manufacturer_batch_no || '',
                                  manufacture_date: toDateInput(row.manufacture_date),
                                  expiry_date: toDateInput(row.expiry_date),
                                  quantity_received: row.quantity_received ?? '',
                                  unit_cost: row.unit_cost ?? '',
                                  receiving_document: row.receiving_document || '',
                                  batch_status: row.batch_status || 'Active',
                                  is_active: toBoolean(row.is_active),
                                });
                                setStatusForm({ batch_status: row.batch_status || 'Active', reason: '' });
                                setActiveTab('details');
                                setSuccessMessage('');
                              }}
                              className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]"
                            >
                              Edit
                            </button>
                            {row.is_deleted ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBatchId(row.batch_id || '');
                                  handleRestore();
                                }}
                                className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBatchId(row.batch_id || '');
                                  setDeleteReason('');
                                  setActiveTab('danger');
                                  setForm({
                                    batch_id: row.batch_id || '',
                                    product_id: row.product_id || '',
                                    supplier_id: row.supplier_id || '',
                                    batch_number: row.batch_number || '',
                                    manufacturer_batch_no: row.manufacturer_batch_no || '',
                                    manufacture_date: toDateInput(row.manufacture_date),
                                    expiry_date: toDateInput(row.expiry_date),
                                    quantity_received: row.quantity_received ?? '',
                                    unit_cost: row.unit_cost ?? '',
                                    receiving_document: row.receiving_document || '',
                                    batch_status: row.batch_status || 'Active',
                                    is_active: toBoolean(row.is_active),
                                  });
                                  setStatusForm({ batch_status: row.batch_status || 'Active', reason: '' });
                                }}
                                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-[#44514d]">
              <span>Page {batchPage} of {batchTotalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBatchPage((current) => Math.max(1, current - 1))}
                  disabled={batchPage <= 1 || batchListLoading}
                  className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setBatchPage((current) => Math.min(batchTotalPages, current + 1))}
                  disabled={batchPage >= batchTotalPages || batchListLoading}
                  className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
