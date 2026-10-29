import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  warehouse_id: '',
  batch_id: '',
  quantity_on_hand: '',
  quantity_reserved: '0',
  balance_status: 'Available',
  notes: '',
  last_count_date: '',
  last_count_by: '',
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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function fieldError(errors, key) {
  return errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;
}

export default function StockBalanceForm({
  currentUser,
  balanceId = null,
  onSaved = () => {},
  onCancel = () => {},
}) {
  const { showError } = useGlobalPopup();
  const isEditMode = Boolean(balanceId);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusChoices, setStatusChoices] = useState([]);
  const [batchSearchText, setBatchSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [adjustForm, setAdjustForm] = useState({ adjustment_qty: '', reason: '' });
  const [reserveForm, setReserveForm] = useState({ reserve_qty: '', reason: '' });
  const [transferForm, setTransferForm] = useState({ to_warehouse_id: '', quantity: '', reason: '' });
  const [adjustErrors, setAdjustErrors] = useState({});
  const [reserveErrors, setReserveErrors] = useState({});
  const [transferErrors, setTransferErrors] = useState({});

  const quantityOnHand = toNumber(form.quantity_on_hand);
  const quantityReserved = toNumber(form.quantity_reserved);
  const quantityAvailable = quantityOnHand - quantityReserved;
  const quantityEffectivelyAvailable = form.balance_status === 'Available' ? quantityAvailable : 0;

  const filteredBatches = useMemo(() => {
    if (!batchSearchText.trim()) return batches;
    const q = batchSearchText.trim().toLowerCase();
    return batches.filter((row) => {
      const name = `${row.batch_number || ''} ${row.product_code || ''} ${row.product_name || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [batchSearchText, batches]);

  const currentWarehouse = useMemo(
    () => warehouses.find((row) => row.warehouse_id === form.warehouse_id) || null,
    [warehouses, form.warehouse_id],
  );

  const loadReferenceData = useCallback(async () => {
    const [warehousePayload, batchPayload, statusPayload, usersPayload] = await Promise.all([
      apiRequest('/inventory/warehouse?page_size=100', currentUser.accessToken),
      apiRequest('/inventory/batch?page_size=100', currentUser.accessToken),
      apiRequest('/inventory/stock-balance/choice-values', currentUser.accessToken),
      apiRequest('/security/users?page_size=100', currentUser.accessToken),
    ]);
    setWarehouses(Array.isArray(warehousePayload.data) ? warehousePayload.data : []);
    setBatches(Array.isArray(batchPayload.data) ? batchPayload.data : []);
    setStatusChoices(Array.isArray(statusPayload.data) ? statusPayload.data : []);
    setUsers(Array.isArray(usersPayload.data) ? usersPayload.data : []);
  }, [currentUser.accessToken]);

  const loadBalance = useCallback(async () => {
    if (!balanceId) return null;
    const payload = await apiRequest(`/inventory/stock-balance/${balanceId}`, currentUser.accessToken);
    const row = payload.data || {};
    setForm({
      warehouse_id: row.warehouse_id || '',
      batch_id: row.batch_id || '',
      quantity_on_hand: row.quantity_on_hand ?? '',
      quantity_reserved: row.quantity_reserved ?? '0',
      balance_status: row.balance_status || 'Available',
      notes: row.notes || '',
      last_count_date: toDateInput(row.last_count_date),
      last_count_by: row.last_count_by || '',
    });
    return row;
  }, [balanceId, currentUser.accessToken]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentUser.accessToken) return;
      setLoading(true);
      try {
        await loadReferenceData();
        if (isEditMode) {
          await loadBalance();
        } else {
          setForm(emptyForm);
        }
      } catch (error) {
        if (!active) return;
        showError(error.message || 'Unable to load stock balance form.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.accessToken, isEditMode, loadBalance, loadReferenceData, showError]);

  function validateMain(nextForm) {
    const nextErrors = {};
    if (!nextForm.warehouse_id) nextErrors.warehouse_id = 'Warehouse is required.';
    if (!nextForm.batch_id) nextErrors.batch_id = 'Batch is required.';
    if (nextForm.quantity_on_hand === '' || Number(nextForm.quantity_on_hand) < 0) nextErrors.quantity_on_hand = 'Quantity on hand must be 0 or greater.';
    if (nextForm.quantity_reserved === '' || Number(nextForm.quantity_reserved) < 0) nextErrors.quantity_reserved = 'Quantity reserved must be 0 or greater.';
    if (Number(nextForm.quantity_reserved) > Number(nextForm.quantity_on_hand)) nextErrors.quantity_reserved = 'Reserved quantity cannot exceed on-hand quantity.';
    if (!nextForm.balance_status) nextErrors.balance_status = 'Balance status is required.';
    if ((nextForm.notes || '').length > 500) nextErrors.notes = 'Notes must not exceed 500 characters.';
    return nextErrors;
  }

  async function refreshBalanceAndNotify(message) {
    if (!balanceId) return;
    setRefreshing(true);
    try {
      const row = await loadBalance();
      setAdjustForm({ adjustment_qty: '', reason: '' });
      setReserveForm({ reserve_qty: '', reason: '' });
      setTransferForm({ to_warehouse_id: '', quantity: '', reason: '' });
      setAdjustErrors({});
      setReserveErrors({});
      setTransferErrors({});
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
      if (!isEditMode) {
        const payload = {
          warehouse_id: form.warehouse_id,
          batch_id: form.batch_id,
          quantity_on_hand: Number(form.quantity_on_hand),
          quantity_reserved: Number(form.quantity_reserved),
          balance_status: form.balance_status,
          notes: form.notes.trim() || null,
          user_id: currentUser.user_id || null,
        };
        const response = await apiRequest('/inventory/stock-balance', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMessage('Stock balance created successfully.');
        onSaved(response.data);
        return;
      }

      const payload = {
        balance_status: form.balance_status,
        notes: form.notes.trim() || null,
        last_count_date: form.last_count_date || null,
        last_count_by: form.last_count_by || null,
        user_id: currentUser.user_id || null,
      };
      const response = await apiRequest(`/inventory/stock-balance/${balanceId}`, currentUser.accessToken, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccessMessage('Stock balance updated successfully.');
      onSaved(response.data);
      if (isEditMode) await loadBalance();
    } catch (error) {
      showError(error.message || 'Unable to save stock balance.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdjust() {
    const nextErrors = {};
    const adjustmentQty = Number(adjustForm.adjustment_qty);
    if (!Number.isFinite(adjustmentQty) || adjustmentQty === 0) nextErrors.adjustment_qty = 'Adjustment quantity must be non-zero.';
    if (!adjustForm.reason.trim()) nextErrors.reason = 'Reason is required.';
    if (adjustForm.reason.length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    const projected = quantityOnHand + adjustmentQty;
    if (projected < 0 || projected < quantityReserved) nextErrors.adjustment_qty = 'Adjustment would violate on-hand or reserved constraints.';
    setAdjustErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!window.confirm('Post this stock adjustment?')) return;

    setRefreshing(true);
    setSuccessMessage('');
    try {
      await apiRequest(`/inventory/stock-balance/${balanceId}/adjust`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          warehouse_id: form.warehouse_id,
          batch_id: form.batch_id,
          adjustment_qty: adjustmentQty,
          reason: adjustForm.reason.trim(),
          user_id: currentUser.user_id || null,
        }),
      });
      await refreshBalanceAndNotify('Adjustment posted successfully.');
    } catch (error) {
      showError(error.message || 'Unable to post adjustment.');
      setRefreshing(false);
    }
  }

  async function submitReserve() {
    const nextErrors = {};
    const reserveQty = Number(reserveForm.reserve_qty);
    if (form.balance_status !== 'Available') nextErrors.reserve_qty = 'Balance must be Available.';
    if (!Number.isFinite(reserveQty) || reserveQty === 0) nextErrors.reserve_qty = 'Reserve quantity must be non-zero.';
    if (!reserveForm.reason.trim()) nextErrors.reason = 'Reason is required.';
    if (reserveForm.reason.length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    const projected = quantityReserved + reserveQty;
    if (projected < 0 || projected > quantityOnHand) nextErrors.reserve_qty = 'Reserve change would violate quantity constraints.';
    setReserveErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setRefreshing(true);
    setSuccessMessage('');
    try {
      await apiRequest(`/inventory/stock-balance/${balanceId}/reserve`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          balance_id: balanceId,
          reserve_qty: reserveQty,
          reason: reserveForm.reason.trim(),
          user_id: currentUser.user_id || null,
        }),
      });
      await refreshBalanceAndNotify('Reservation updated successfully.');
    } catch (error) {
      showError(error.message || 'Unable to reserve/release stock.');
      setRefreshing(false);
    }
  }

  async function submitTransfer() {
    const nextErrors = {};
    const quantity = Number(transferForm.quantity);
    if (!transferForm.to_warehouse_id) nextErrors.to_warehouse_id = 'Destination warehouse is required.';
    if (transferForm.to_warehouse_id && transferForm.to_warehouse_id === form.warehouse_id) nextErrors.to_warehouse_id = 'Destination must differ from source warehouse.';
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = 'Quantity must be greater than zero.';
    if (Number.isFinite(quantity) && quantity > quantityAvailable) nextErrors.quantity = `Quantity cannot exceed available stock (${quantityAvailable}).`;
    if (!transferForm.reason.trim()) nextErrors.reason = 'Reason is required.';
    if (transferForm.reason.length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    setTransferErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!window.confirm('Transfer this stock now?')) return;

    setRefreshing(true);
    setSuccessMessage('');
    try {
      await apiRequest('/inventory/stock-balance/transfer', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          from_warehouse_id: form.warehouse_id,
          to_warehouse_id: transferForm.to_warehouse_id,
          batch_id: form.batch_id,
          quantity,
          reason: transferForm.reason.trim(),
          user_id: currentUser.user_id || null,
        }),
      });
      await refreshBalanceAndNotify('Transfer posted successfully.');
    } catch (error) {
      showError(error.message || 'Unable to transfer stock.');
      setRefreshing(false);
    }
  }

  const [listRows, setListRows] = useState([]);
  const [listTotalCount, setListTotalCount] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);

  const loadList = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setListLoading(true);
    try {
      const payload = await apiRequest(`/inventory/stock-balance?page_number=${listPage}&page_size=10&include_deleted=1`, currentUser.accessToken);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setListRows(rows);
      setListTotalCount(Number(payload.totalCount) || 0);
    } catch (error) {
      setListRows([]);
      setListTotalCount(0);
      showError(error.message || 'Unable to load stock balance list.');
    } finally {
      setListLoading(false);
    }
  }, [currentUser.accessToken, listPage, showError]);

  useEffect(() => {
    if (!currentUser.accessToken) return;
    loadList();
  }, [currentUser.accessToken, loadList]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e3ebea] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5d6d68]">Loading stock balance form...</p>
      </div>
    );
  }

  const adjustQty = Number(adjustForm.adjustment_qty);
  const adjustProjectedOnHand = quantityOnHand + (Number.isFinite(adjustQty) ? adjustQty : 0);
  const reserveQty = Number(reserveForm.reserve_qty);
  const reserveProjected = quantityReserved + (Number.isFinite(reserveQty) ? reserveQty : 0);
  const reserveProjectedAvailable = quantityOnHand - reserveProjected;
  const reserveLocked = form.balance_status !== 'Available';
  const listTotalPages = Math.max(1, Math.ceil(listTotalCount / 10));

  async function handleListAction(row, action) {
    const targetId = row?.balance_id;
    if (!targetId) return;

    if (action === 'edit') {
      setForm({
        warehouse_id: row.warehouse_id || '',
        batch_id: row.batch_id || '',
        quantity_on_hand: row.quantity_on_hand ?? '',
        quantity_reserved: row.quantity_reserved ?? '0',
        balance_status: row.balance_status || 'Available',
        notes: row.notes || '',
        last_count_date: toDateInput(row.last_count_date),
        last_count_by: row.last_count_by || '',
      });
      setSuccessMessage('');
      return;
    }

    const confirmMessages = {
      delete: 'Soft-delete this stock balance?',
      hardDelete: 'This will permanently delete the stock balance. Continue?',
    };
    const actionMessages = {
      delete: 'Stock balance deleted successfully.',
      hardDelete: 'Stock balance permanently deleted.',
    };

    if (confirmMessages[action] && !window.confirm(confirmMessages[action])) return;

    try {
      const endpoint = action === 'delete'
        ? `/inventory/stock-balance/${targetId}`
        : `/inventory/stock-balance/${targetId}/hard`;
      await apiRequest(endpoint, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({
          reason: action === 'delete' ? 'Deleted from stock balance list.' : undefined,
          confirm: action === 'hardDelete',
          user_id: currentUser.user_id || null,
        }),
      });
      setSuccessMessage(actionMessages[action]);
      await loadList();
      if (balanceId === targetId) {
        await loadBalance();
      }
    } catch (error) {
      showError(error.message || 'Unable to complete the stock balance action.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#374744]">Stock Balance List</h3>
            <p className="text-sm text-[#5d6d68]">Manage row-level actions for stock balances.</p>
          </div>
          <div className="text-sm text-[#5d6d68]">Total: {listTotalCount.toLocaleString()}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Warehouse</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Qty On Hand</th>
                <th className="px-2 py-2">Available</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading stock balances...</td></tr>
              ) : listRows.length === 0 ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No stock balances found.</td></tr>
              ) : listRows.map((row) => {
                const rowDeleted = Boolean(row.is_deleted);
                return (
                  <tr key={row.balance_id} className={`border-b border-[#f0f3f1] ${rowDeleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{row.warehouse_name || row.warehouse_code || '-'}</td>
                    <td className="px-2 py-2">{row.batch_number || row.product_code || '-'}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${rowDeleted ? 'bg-red-50 text-red-700' : row.balance_status === 'Available' ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{rowDeleted ? 'Deleted' : row.balance_status || 'Available'}</span></td>
                    <td className="px-2 py-2">{Number(row.quantity_on_hand ?? 0).toFixed(4)}</td>
                    <td className="px-2 py-2">{Number((row.quantity_on_hand ?? 0) - (row.quantity_reserved ?? 0)).toFixed(4)}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleListAction(row, 'edit')} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>
                        {!rowDeleted && <button type="button" onClick={() => handleListAction(row, 'delete')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
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
          <span>Page {listPage} of {listTotalPages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setListPage((current) => Math.max(1, current - 1))} disabled={listPage <= 1 || listLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <button type="button" onClick={() => setListPage((current) => Math.min(listTotalPages, current + 1))} disabled={listPage >= listTotalPages || listLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <form onSubmit={handleMainSubmit} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#374744]">{isEditMode ? 'Edit Stock Balance' : 'Create Stock Balance'}</h2>
            <p className="mt-1 text-sm text-[#5d6d68]">Maintain stock balance metadata and availability.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-[#dfe8e1] px-4 text-sm font-semibold text-[#374744] hover:bg-[#f5f8f6]">Cancel</button>
            <button type="submit" disabled={submitting || refreshing} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-[#dfe8e1] p-4">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Balance</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Warehouse *</span>
                  <select value={form.warehouse_id} disabled={isEditMode} onChange={(event) => setForm((curr) => ({ ...curr, warehouse_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]">
                    <option value="">Select warehouse</option>
                    {warehouses.map((row) => <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_code} - {row.warehouse_name}</option>)}
                  </select>
                  {fieldError(errors, 'warehouse_id')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Batch search</span>
                  <input value={batchSearchText} onChange={(event) => setBatchSearchText(event.target.value)} placeholder="Search batch/product..." className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Batch *</span>
                  <select value={form.batch_id} disabled={isEditMode} onChange={(event) => setForm((curr) => ({ ...curr, batch_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]">
                    <option value="">Select batch</option>
                    {filteredBatches.map((row) => (
                      <option key={row.batch_id} value={row.batch_id}>
                        {row.batch_number} / {row.product_code} - {row.product_name}
                      </option>
                    ))}
                  </select>
                  {fieldError(errors, 'batch_id')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Quantity on hand *</span>
                  <input type="number" min="0" step="0.0001" value={form.quantity_on_hand} disabled={isEditMode} onChange={(event) => setForm((curr) => ({ ...curr, quantity_on_hand: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" />
                  {fieldError(errors, 'quantity_on_hand')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Quantity reserved</span>
                  <input type="number" min="0" step="0.0001" value={form.quantity_reserved} disabled={isEditMode} onChange={(event) => setForm((curr) => ({ ...curr, quantity_reserved: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" />
                  {fieldError(errors, 'quantity_reserved')}
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#dfe8e1] p-4">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Reservation & Status</h3>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Balance status *</span>
                <select value={form.balance_status} onChange={(event) => setForm((curr) => ({ ...curr, balance_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                  {(statusChoices.length ? statusChoices : [{ value: 'Available', label: 'Available' }, { value: 'On Hold', label: 'On Hold' }, { value: 'Quarantined', label: 'Quarantined' }, { value: 'Expired', label: 'Expired' }, { value: 'Depleted', label: 'Depleted' }]).map((row) => (
                    <option key={row.value} value={row.value}>{row.label || row.value}</option>
                  ))}
                </select>
                {fieldError(errors, 'balance_status')}
              </label>
            </div>

            <div className="rounded-xl border border-[#dfe8e1] p-4">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Cycle Count</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Last count date</span>
                  <input type="date" value={form.last_count_date} onChange={(event) => setForm((curr) => ({ ...curr, last_count_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Last count by</span>
                  <select value={form.last_count_by} onChange={(event) => setForm((curr) => ({ ...curr, last_count_by: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    <option value="">Select user</option>
                    {users.map((row) => <option key={row.user_id} value={row.user_id}>{row.username} ({row.first_name} {row.last_name})</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#dfe8e1] p-4">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Notes</h3>
              <label className="text-sm font-medium text-[#374744]">
                <textarea value={form.notes} maxLength={500} onChange={(event) => setForm((curr) => ({ ...curr, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                <div className="mt-1 text-xs text-[#5d6d68]">{form.notes.length}/500</div>
                {fieldError(errors, 'notes')}
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#e3ebea] bg-[#f9fcfa] p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Computed Values</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Warehouse</div>
                  <div className="mt-1 text-sm font-semibold text-[#374744]">{currentWarehouse ? `${currentWarehouse.warehouse_code} - ${currentWarehouse.warehouse_name}` : '-'}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Quantity Available (on-hand − reserved)</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{quantityAvailable.toFixed(4)}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Quantity Effectively Available</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{quantityEffectivelyAvailable.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {isEditMode && (
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-[#dfe8e1] bg-[#f7faf8] p-1">
            {[
              { key: 'details', label: 'Edit Details' },
              { key: 'adjust', label: 'Adjust' },
              { key: 'reserve', label: 'Reserve' },
              { key: 'transfer', label: 'Transfer' },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-[#0f8b3d] text-white' : 'text-[#374744] hover:bg-white'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <p className="text-sm text-[#5d6d68]">Use the main form above to edit status, cycle count, and notes.</p>
          )}

          {activeTab === 'adjust' && (
            <div className="space-y-3">
              <p className="text-sm text-[#5d6d68]">Positive = receipt, negative = issue. On-hand cannot go below 0 or reserved.</p>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adjustProjectedOnHand < 0 || adjustProjectedOnHand < quantityReserved ? 'border-red-300 bg-red-50 text-red-700' : 'border-[#dfe8e1] bg-[#f7faf8] text-[#374744]'}`}>
                On-hand {quantityOnHand.toFixed(4)} → {adjustProjectedOnHand.toFixed(4)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Adjustment qty</span>
                  <input type="number" step="0.0001" value={adjustForm.adjustment_qty} onChange={(event) => setAdjustForm((curr) => ({ ...curr, adjustment_qty: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(adjustErrors, 'adjustment_qty')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Reason</span>
                  <textarea rows={3} maxLength={500} value={adjustForm.reason} onChange={(event) => setAdjustForm((curr) => ({ ...curr, reason: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(adjustErrors, 'reason')}
                </label>
              </div>
              <button type="button" disabled={refreshing || adjustProjectedOnHand < 0 || adjustProjectedOnHand < quantityReserved} onClick={submitAdjust} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">Post Adjustment</button>
            </div>
          )}

          {activeTab === 'reserve' && (
            <div className="space-y-3">
              {reserveLocked && <p className="text-sm font-semibold text-amber-700">Balance must be Available</p>}
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${reserveProjected < 0 || reserveProjected > quantityOnHand ? 'border-red-300 bg-red-50 text-red-700' : 'border-[#dfe8e1] bg-[#f7faf8] text-[#374744]'}`}>
                Reserved {quantityReserved.toFixed(4)} → {reserveProjected.toFixed(4)} · Available {quantityAvailable.toFixed(4)} → {reserveProjectedAvailable.toFixed(4)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Reserve qty (+/-)</span>
                  <input type="number" step="0.0001" value={reserveForm.reserve_qty} disabled={reserveLocked} onChange={(event) => setReserveForm((curr) => ({ ...curr, reserve_qty: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" />
                  {fieldError(reserveErrors, 'reserve_qty')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Reason</span>
                  <textarea rows={3} maxLength={500} value={reserveForm.reason} disabled={reserveLocked} onChange={(event) => setReserveForm((curr) => ({ ...curr, reason: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]" />
                  {fieldError(reserveErrors, 'reason')}
                </label>
              </div>
              <button type="button" disabled={refreshing || reserveLocked || reserveProjected < 0 || reserveProjected > quantityOnHand} onClick={submitReserve} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">Reserve / Release</button>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="space-y-3">
              <p className="text-sm text-[#5d6d68]">Max: {quantityAvailable.toFixed(4)}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">From warehouse</span>
                  <input value={currentWarehouse ? `${currentWarehouse.warehouse_code} - ${currentWarehouse.warehouse_name}` : ''} readOnly className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6f8f7] px-3 text-sm text-[#5d6d68]" />
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">To warehouse</span>
                  <select value={transferForm.to_warehouse_id} onChange={(event) => setTransferForm((curr) => ({ ...curr, to_warehouse_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    <option value="">Select destination</option>
                    {warehouses.filter((row) => row.warehouse_id !== form.warehouse_id).map((row) => <option key={row.warehouse_id} value={row.warehouse_id}>{row.warehouse_code} - {row.warehouse_name}</option>)}
                  </select>
                  {fieldError(transferErrors, 'to_warehouse_id')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Quantity</span>
                  <input type="number" min="0" step="0.0001" value={transferForm.quantity} onChange={(event) => setTransferForm((curr) => ({ ...curr, quantity: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(transferErrors, 'quantity')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Reason</span>
                  <textarea rows={3} maxLength={500} value={transferForm.reason} onChange={(event) => setTransferForm((curr) => ({ ...curr, reason: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(transferErrors, 'reason')}
                </label>
              </div>
              <button type="button" disabled={refreshing} onClick={submitTransfer} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">Transfer Stock</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
