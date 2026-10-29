import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  company_id: '',
  warehouse_code: '',
  warehouse_name: '',
  location: '',
  warehouse_type: '',
  warehouse_status: 'Active',
  is_active: true,
  phone: '',
  email: '',
  capacity_cubic_meters: '',
  manager_user_id: '',
  notes: '',
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

function fieldError(errors, key) {
  return errors[key] ? <p className="mt-1 text-xs text-red-600">{errors[key]}</p> : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, scale = 2) {
  return toNumber(value).toLocaleString(undefined, { maximumFractionDigits: scale, minimumFractionDigits: scale });
}

export default function WarehouseForm({
  currentUser,
  warehouseId = null,
  onSaved = () => {},
  onCancel = () => {},
}) {
  const { showError } = useGlobalPopup();
  const [currentWarehouseId, setCurrentWarehouseId] = useState(warehouseId || null);
  const isEditMode = Boolean(currentWarehouseId);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeChoices, setTypeChoices] = useState([]);
  const [statusChoices, setStatusChoices] = useState([]);
  const [statusForm, setStatusForm] = useState({ new_status: '', reason: '' });
  const [statusErrors, setStatusErrors] = useState({});
  const [deleteReason, setDeleteReason] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [warehouseMetrics, setWarehouseMetrics] = useState(null);
  const [warehouseMeta, setWarehouseMeta] = useState(null);
  const [warehouseRows, setWarehouseRows] = useState([]);
  const [warehouseTotalCount, setWarehouseTotalCount] = useState(0);
  const [warehousePage, setWarehousePage] = useState(1);
  const [warehouseListLoading, setWarehouseListLoading] = useState(true);
  const [listActionId, setListActionId] = useState(null);

  const currentCompany = useMemo(
    () => companies.find((row) => row.company_id === form.company_id) || null,
    [companies, form.company_id],
  );

  const currentManager = useMemo(
    () => users.find((row) => row.user_id === form.manager_user_id) || null,
    [users, form.manager_user_id],
  );

  const loadReferenceData = useCallback(async () => {
    const [companyPayload, usersPayload, choicePayload] = await Promise.all([
      apiRequest('/company?page_size=100', currentUser.accessToken),
      apiRequest('/security/users?page_size=100', currentUser.accessToken),
      apiRequest('/inventory/warehouse/choice-values', currentUser.accessToken),
    ]);
    setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
    setUsers(Array.isArray(usersPayload.data) ? usersPayload.data : []);
    const choiceData = choicePayload.data || {};
    setTypeChoices(Array.isArray(choiceData.warehouseTypes) ? choiceData.warehouseTypes : []);
    setStatusChoices(Array.isArray(choiceData.warehouseStatuses) ? choiceData.warehouseStatuses : []);
  }, [currentUser.accessToken]);

  const loadWarehouseList = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setWarehouseListLoading(true);
    try {
      const payload = await apiRequest(`/inventory/warehouse?page_number=${warehousePage}&page_size=10`, currentUser.accessToken);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setWarehouseRows(rows);
      setWarehouseTotalCount(Number(payload.totalCount) || 0);
    } catch (error) {
      setWarehouseRows([]);
      setWarehouseTotalCount(0);
      showError(error.message || 'Unable to load warehouse list.');
    } finally {
      setWarehouseListLoading(false);
    }
  }, [currentUser.accessToken, showError, warehousePage]);

  const loadWarehouse = useCallback(async () => {
    if (!currentWarehouseId) return null;
    const [detailsPayload, utilizationPayload] = await Promise.all([
      apiRequest(`/inventory/warehouse/${currentWarehouseId}`, currentUser.accessToken),
      apiRequest(`/inventory/warehouse/reports/utilization?warehouse_id=${currentWarehouseId}`, currentUser.accessToken),
    ]);
    const row = detailsPayload.data || {};
    setForm({
      company_id: row.company_id || '',
      warehouse_code: row.warehouse_code || '',
      warehouse_name: row.warehouse_name || '',
      location: row.location || '',
      warehouse_type: row.warehouse_type || '',
      warehouse_status: row.warehouse_status || 'Active',
      is_active: Boolean(row.is_active),
      phone: row.phone || '',
      email: row.email || '',
      capacity_cubic_meters: row.capacity_cubic_meters ?? '',
      manager_user_id: row.manager_user_id || '',
      notes: row.notes || '',
    });
    setWarehouseMeta(row);
    const utilizationRows = Array.isArray(utilizationPayload.data) ? utilizationPayload.data : [];
    setWarehouseMetrics(utilizationRows[0] || null);
    setStatusForm({ new_status: row.warehouse_status || '', reason: '' });
    return row;
  }, [currentWarehouseId, currentUser.accessToken]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentUser.accessToken) return;
      setLoading(true);
      try {
        await loadReferenceData();
        if (isEditMode) {
          await loadWarehouse();
        } else {
          setForm(emptyForm);
          setWarehouseMeta(null);
          setWarehouseMetrics(null);
          setStatusForm({ new_status: 'Active', reason: '' });
        }
      } catch (error) {
        if (!active) return;
        showError(error.message || 'Unable to load warehouse form.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.accessToken, isEditMode, loadReferenceData, loadWarehouse, showError]);

  useEffect(() => {
    if (!currentUser.accessToken) return;
    loadWarehouseList();
  }, [currentUser.accessToken, loadWarehouseList]);

  function validateMain(nextForm) {
    const nextErrors = {};
    if (!nextForm.company_id) nextErrors.company_id = 'Company is required.';
    if (!nextForm.warehouse_code.trim()) nextErrors.warehouse_code = 'Warehouse code is required.';
    if (nextForm.warehouse_code.trim().length > 20) nextErrors.warehouse_code = 'Warehouse code must not exceed 20 characters.';
    if (!nextForm.warehouse_name.trim()) nextErrors.warehouse_name = 'Warehouse name is required.';
    if (nextForm.warehouse_name.trim().length > 100) nextErrors.warehouse_name = 'Warehouse name must not exceed 100 characters.';
    if (nextForm.location.trim().length > 200) nextErrors.location = 'Location must not exceed 200 characters.';
    if (nextForm.phone.trim().length > 30) nextErrors.phone = 'Phone must not exceed 30 characters.';
    if (nextForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextForm.email.trim())) nextErrors.email = 'Email must be valid.';
    if (nextForm.email.trim().length > 100) nextErrors.email = 'Email must not exceed 100 characters.';
    if (nextForm.capacity_cubic_meters !== '') {
      const capacity = Number(nextForm.capacity_cubic_meters);
      if (!Number.isFinite(capacity) || capacity < 0) nextErrors.capacity_cubic_meters = 'Capacity must be 0 or greater.';
    }
    if (nextForm.notes.length > 500) nextErrors.notes = 'Notes must not exceed 500 characters.';
    if (nextForm.warehouse_type && !warehouseTypeSet.has(nextForm.warehouse_type)) nextErrors.warehouse_type = 'Invalid warehouse type.';
    if (!nextForm.warehouse_status || !warehouseStatusSet.has(nextForm.warehouse_status)) nextErrors.warehouse_status = 'Warehouse status is required.';
    return nextErrors;
  }

  async function refreshWarehouseAndNotify(message) {
    if (!currentWarehouseId) return;
    setRefreshing(true);
    try {
      const row = await loadWarehouse();
      await loadWarehouseList();
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
        company_id: form.company_id,
        warehouse_code: form.warehouse_code.trim(),
        warehouse_name: form.warehouse_name.trim(),
        location: form.location.trim() || null,
        warehouse_type: form.warehouse_type || null,
        warehouse_status: form.warehouse_status,
        is_active: Boolean(form.is_active),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        capacity_cubic_meters: form.capacity_cubic_meters === '' ? null : Number(form.capacity_cubic_meters),
        manager_user_id: form.manager_user_id || null,
        clear_manager: !form.manager_user_id,
        notes: form.notes.trim() || null,
        user_id: currentUser.user_id || null,
      };

      if (!isEditMode) {
        const response = await apiRequest('/inventory/warehouse', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMessage('Warehouse created successfully.');
        await loadWarehouseList();
        onSaved(response.data);
        setForm(emptyForm);
        return;
      }

      const response = await apiRequest(`/inventory/warehouse/${currentWarehouseId}`, currentUser.accessToken, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccessMessage('Warehouse updated successfully.');
      await loadWarehouseList();
      onSaved(response.data);
      await loadWarehouse();
    } catch (error) {
      showError(error.message || 'Unable to save warehouse.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStatusChange() {
    const nextErrors = {};
    if (!statusForm.new_status) nextErrors.new_status = 'Status is required.';
    if (!warehouseStatusSet.has(statusForm.new_status)) nextErrors.new_status = 'Invalid status selected.';
    if (statusForm.reason.length > 500) nextErrors.reason = 'Reason must not exceed 500 characters.';
    setStatusErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setRefreshing(true);
    setSuccessMessage('');
    try {
      await apiRequest(`/inventory/warehouse/${warehouseId}/status`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: statusForm.new_status,
          reason: statusForm.reason.trim() || null,
          user_id: currentUser.user_id || null,
        }),
      });
      await refreshWarehouseAndNotify('Warehouse status changed successfully.');
      setStatusErrors({});
      setStatusForm((curr) => ({ ...curr, reason: '' }));
    } catch (error) {
      showError(error.message || 'Unable to change warehouse status.');
      setRefreshing(false);
    }
  }

  async function runDangerAction(path, message, options = {}) {
    if (!warehouseId) return;
    if (options.confirmText && !window.confirm(options.confirmText)) return;
    setDangerBusy(true);
    setSuccessMessage('');
    try {
      await apiRequest(`/inventory/warehouse/${warehouseId}${path}`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          reason: deleteReason.trim() || null,
          confirm: true,
          user_id: currentUser.user_id || null,
        }),
      });
      setDeleteReason('');
      if (path === '/hard-delete') {
        setSuccessMessage(message);
        onSaved({ warehouse_id: warehouseId, deleted: true });
      } else {
        await refreshWarehouseAndNotify(message);
      }
    } catch (error) {
      showError(error.message || 'Unable to complete the action.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleWarehouseListAction(row, action) {
    const targetId = row?.warehouse_id;
    if (!targetId) return;

    if (action === 'edit') {
      setCurrentWarehouseId(targetId);
      setSuccessMessage('');
      setActiveTab('details');
      return;
    }

    const actionMessages = {
      softDelete: 'Warehouse deleted successfully.',
      restore: 'Warehouse restored successfully.',
      hardDelete: 'Warehouse permanently deleted.',
    };

    const confirmMessages = {
      softDelete: 'Soft-delete this warehouse?',
      restore: 'Restore this warehouse?',
      hardDelete: 'This will permanently delete the warehouse. Continue?',
    };

    if (confirmMessages[action] && !window.confirm(confirmMessages[action])) return;

    try {
      setDangerBusy(true);
      const endpoint = action === 'softDelete'
        ? `/inventory/warehouse/${targetId}/delete`
        : action === 'restore'
          ? `/inventory/warehouse/${targetId}/restore`
          : `/inventory/warehouse/${targetId}/hard-delete`;
      const method = action === 'hardDelete' ? 'DELETE' : 'POST';
      await apiRequest(endpoint, currentUser.accessToken, {
        method,
        body: JSON.stringify({
          reason: action === 'softDelete' ? 'Deleted from warehouse list.' : undefined,
          confirm: action === 'hardDelete',
          user_id: currentUser.user_id || null,
        }),
      });
      setSuccessMessage(actionMessages[action]);
      await loadWarehouseList();
      if (currentWarehouseId === targetId) {
        await loadWarehouse();
      }
    } catch (error) {
      showError(error.message || 'Unable to complete the warehouse action.');
    } finally {
      setDangerBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e3ebea] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5d6d68]">Loading warehouse form...</p>
      </div>
    );
  }

  const utilizationPercent = warehouseMetrics?.capacity_utilization_pct ?? warehouseMetrics?.utilization_pct ?? null;
  const isDeleted = Boolean(warehouseMeta?.is_deleted);
  const warehouseTypeSet = new Set((typeChoices.length ? typeChoices : [
    { value: 'Main' }, { value: 'Feed Store' }, { value: 'Cold Storage' }, { value: 'General' }, { value: 'Quarantine' }, { value: 'Bonded' }, { value: 'Transit' },
  ]).map((row) => row.value));
  const warehouseStatusSet = new Set((statusChoices.length ? statusChoices : [
    { value: 'Active' }, { value: 'Under Maintenance' }, { value: 'Full' }, { value: 'Closed' },
  ]).map((row) => row.value));
  const warehouseTotalPages = Math.max(1, Math.ceil(warehouseTotalCount / 10));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#374744]">Warehouse List</h3>
            <p className="text-sm text-[#5d6d68]">Manage records directly from the list with row actions.</p>
          </div>
          <div className="text-sm text-[#5d6d68]">Total: {warehouseTotalCount.toLocaleString()}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Location</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {warehouseListLoading ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading warehouses...</td></tr>
              ) : warehouseRows.length === 0 ? (
                <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No warehouses found.</td></tr>
              ) : warehouseRows.map((row) => {
                const rowDeleted = Boolean(row.is_deleted);
                const rowStatus = row.warehouse_status || 'Active';
                return (
                  <tr key={row.warehouse_id} className={`border-b border-[#f0f3f1] ${rowDeleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2 font-medium text-[#374744]">{row.warehouse_code || '-'}</td>
                    <td className="px-2 py-2">{row.warehouse_name || '-'}</td>
                    <td className="px-2 py-2">{row.warehouse_type || '-'}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${rowDeleted ? 'bg-red-50 text-red-700' : rowStatus === 'Closed' ? 'bg-slate-100 text-slate-700' : rowStatus === 'Under Maintenance' ? 'bg-amber-50 text-amber-700' : 'bg-[#eafaf0] text-[#198754]'}`}>
                        {rowDeleted ? 'Deleted' : rowStatus}
                      </span>
                    </td>
                    <td className="px-2 py-2">{row.location || '-'}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleWarehouseListAction(row, 'edit')} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>
                        {!rowDeleted && <button type="button" onClick={() => handleWarehouseListAction(row, 'softDelete')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                        {rowDeleted && <button type="button" onClick={() => handleWarehouseListAction(row, 'restore')} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                        {rowDeleted && <button type="button" onClick={() => handleWarehouseListAction(row, 'hardDelete')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Hard Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#44514d]">
          <span>Page {warehousePage} of {warehouseTotalPages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setWarehousePage((current) => Math.max(1, current - 1))} disabled={warehousePage <= 1 || warehouseListLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <button type="button" onClick={() => setWarehousePage((current) => Math.min(warehouseTotalPages, current + 1))} disabled={warehousePage >= warehouseTotalPages || warehouseListLoading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <form onSubmit={handleMainSubmit} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#374744]">{isEditMode ? 'Edit Warehouse' : 'Create Warehouse'}</h2>
            <p className="mt-1 text-sm text-[#5d6d68]">Maintain warehouse details, ownership, and capacity setup.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-[#dfe8e1] px-4 text-sm font-semibold text-[#374744] hover:bg-[#f5f8f6]">Cancel</button>
            <button type="submit" disabled={submitting || refreshing || dangerBusy} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
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
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Identity</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Company *</span>
                  <select value={form.company_id} disabled={isEditMode} onChange={(event) => setForm((curr) => ({ ...curr, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6f8f7]">
                    <option value="">Select company</option>
                    {companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}
                  </select>
                  {fieldError(errors, 'company_id')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Warehouse code *</span>
                  <input value={form.warehouse_code} onChange={(event) => setForm((curr) => ({ ...curr, warehouse_code: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'warehouse_code')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Warehouse name *</span>
                  <input value={form.warehouse_name} onChange={(event) => setForm((curr) => ({ ...curr, warehouse_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'warehouse_name')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Location</span>
                  <input value={form.location} onChange={(event) => setForm((curr) => ({ ...curr, location: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'location')}
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#dfe8e1] p-4">
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Classification & Contact</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Warehouse type</span>
                  <select value={form.warehouse_type} onChange={(event) => setForm((curr) => ({ ...curr, warehouse_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    <option value="">Select type</option>
                    {(typeChoices.length ? typeChoices : [{ value: 'Main', label: 'Main' }, { value: 'Feed Store', label: 'Feed Store' }, { value: 'Cold Storage', label: 'Cold Storage' }, { value: 'General', label: 'General' }, { value: 'Quarantine', label: 'Quarantine' }, { value: 'Bonded', label: 'Bonded' }, { value: 'Transit', label: 'Transit' }]).map((row) => (
                      <option key={row.value} value={row.value}>{row.label || row.value}</option>
                    ))}
                  </select>
                  {fieldError(errors, 'warehouse_type')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Warehouse status *</span>
                  <select value={form.warehouse_status} onChange={(event) => setForm((curr) => ({ ...curr, warehouse_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    {(statusChoices.length ? statusChoices : [{ value: 'Active', label: 'Active' }, { value: 'Under Maintenance', label: 'Under Maintenance' }, { value: 'Full', label: 'Full' }, { value: 'Closed', label: 'Closed' }]).map((row) => (
                      <option key={row.value} value={row.value}>{row.label || row.value}</option>
                    ))}
                  </select>
                  {fieldError(errors, 'warehouse_status')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Phone</span>
                  <input value={form.phone} onChange={(event) => setForm((curr) => ({ ...curr, phone: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'phone')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Email</span>
                  <input type="email" value={form.email} onChange={(event) => setForm((curr) => ({ ...curr, email: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'email')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Capacity (m³)</span>
                  <input type="number" min="0" step="0.01" value={form.capacity_cubic_meters} onChange={(event) => setForm((curr) => ({ ...curr, capacity_cubic_meters: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(errors, 'capacity_cubic_meters')}
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Manager</span>
                  <select value={form.manager_user_id} onChange={(event) => setForm((curr) => ({ ...curr, manager_user_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    <option value="">No manager</option>
                    {users.map((row) => <option key={row.user_id} value={row.user_id}>{row.username}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:col-span-2">
                  <input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm((curr) => ({ ...curr, is_active: event.target.checked }))} className="h-4 w-4 rounded border-[#c6d6cd] text-[#0f8b3d] focus:ring-[#0f8b3d]" />
                  Active warehouse
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
              <h3 className="mb-3 text-sm font-bold text-[#374744]">Warehouse Snapshot</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Company</div>
                  <div className="mt-1 text-sm font-semibold text-[#374744]">{currentCompany ? `${currentCompany.company_code} - ${currentCompany.company_name}` : (warehouseMeta?.company_name || '-')}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Manager</div>
                  <div className="mt-1 text-sm font-semibold text-[#374744]">{currentManager?.username || warehouseMeta?.manager_username || '-'}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Stock Value</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{formatNumber(warehouseMeta?.total_stock_value ?? warehouseMetrics?.total_stock_value ?? 0, 2)}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Active Batches</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{toNumber(warehouseMeta?.active_batch_count).toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Quantity On Hand</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{formatNumber(warehouseMeta?.total_on_hand ?? 0, 4)}</div>
                </div>
                <div className="rounded-xl border border-[#dfe8e1] bg-white p-3">
                  <div className="text-xs text-[#5d6d68]">Capacity Utilization</div>
                  <div className="mt-1 text-lg font-bold text-[#374744]">{utilizationPercent === null || utilizationPercent === undefined ? '-' : `${formatNumber(utilizationPercent, 2)}%`}</div>
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
              { key: 'status', label: 'Change Status' },
              { key: 'danger', label: 'Danger Zone' },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-[#0f8b3d] text-white' : 'text-[#374744] hover:bg-white'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <p className="text-sm text-[#5d6d68]">Use the main form above to maintain warehouse details and notes.</p>
          )}

          {activeTab === 'status' && (
            <div className="space-y-3">
              <p className="text-sm text-[#5d6d68]">Change status without editing other fields.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">Current status</span>
                  <input value={form.warehouse_status || ''} readOnly className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6f8f7] px-3 text-sm text-[#5d6d68]" />
                </label>
                <label className="text-sm font-medium text-[#374744]">
                  <span className="mb-1 block">New status</span>
                  <select value={statusForm.new_status} onChange={(event) => setStatusForm((curr) => ({ ...curr, new_status: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
                    <option value="">Select status</option>
                    {(statusChoices.length ? statusChoices : [{ value: 'Active', label: 'Active' }, { value: 'Under Maintenance', label: 'Under Maintenance' }, { value: 'Full', label: 'Full' }, { value: 'Closed', label: 'Closed' }]).map((row) => (
                      <option key={row.value} value={row.value}>{row.label || row.value}</option>
                    ))}
                  </select>
                  {fieldError(statusErrors, 'new_status')}
                </label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2">
                  <span className="mb-1 block">Reason</span>
                  <textarea rows={3} maxLength={500} value={statusForm.reason} onChange={(event) => setStatusForm((curr) => ({ ...curr, reason: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
                  {fieldError(statusErrors, 'reason')}
                </label>
              </div>
              <button type="button" disabled={refreshing || dangerBusy} onClick={submitStatusChange} className="h-11 rounded-xl bg-[#0f8b3d] px-5 text-sm font-semibold text-white hover:bg-[#0d7b36] disabled:opacity-50">Change Status</button>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-3">
              <p className="text-sm text-[#8a3c3c]">Delete/restore operations affect warehouse visibility and referential integrity.</p>
              <label className="text-sm font-medium text-[#374744]">
                <span className="mb-1 block">Reason</span>
                <textarea rows={3} maxLength={500} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="w-full rounded-xl border border-[#dfe8e1] px-3 py-2 text-sm outline-none focus:border-[#0f8b3d]" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={dangerBusy || refreshing || isDeleted} onClick={() => runDangerAction('/delete', 'Warehouse deleted successfully.', { confirmText: 'Soft-delete this warehouse?' })} className="h-11 rounded-xl bg-[#d9534f] px-5 text-sm font-semibold text-white hover:bg-[#c74742] disabled:opacity-50">Soft Delete</button>
                <button type="button" disabled={dangerBusy || refreshing || !isDeleted} onClick={() => runDangerAction('/restore', 'Warehouse restored successfully.')} className="h-11 rounded-xl border border-[#dfe8e1] px-5 text-sm font-semibold text-[#374744] hover:bg-[#f5f8f6] disabled:opacity-50">Restore</button>
                <button type="button" disabled={dangerBusy || refreshing} onClick={() => runDangerAction('/hard-delete', 'Warehouse permanently deleted.', { confirmText: 'This will permanently delete the warehouse. Continue?' })} className="h-11 rounded-xl bg-[#7f1d1d] px-5 text-sm font-semibold text-white hover:bg-[#6a1818] disabled:opacity-50">Hard Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
