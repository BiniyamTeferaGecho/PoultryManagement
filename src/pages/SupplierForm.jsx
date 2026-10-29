import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;

const APPROVAL_COLORS = {
  Draft: 'bg-slate-100 text-slate-800',
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Suspended: 'bg-purple-100 text-purple-800',
};

const emptyForm = {
  supplier_id: '',
  company_id: '',
  supplier_code: '',
  supplier_name: '',
  supplier_type: '',
  country: '',
  is_active: true,
  contact_person: '',
  contact_title: '',
  phone: '',
  email: '',
  website: '',
  secondary_contact_person: '',
  secondary_phone: '',
  address_line: '',
  registration_number: '',
  tax_id: '',
  certification: '',
  certification_expiry_date: '',
  payment_terms: '',
  credit_limit: '',
  bank_account_info: '',
  lead_time_days: '',
  notes: '',
  approval_status: 'Pending',
  approved_by_username: '',
  approved_date: '',
  created_by_username: '',
  created_date: '',
  modified_by_username: '',
  modified_date: '',
  deleted_by_username: '',
  deleted_date: '',
  row_version: '',
  is_deleted: false,
  company_code: '',
  company_name: '',
  total_po_count: 0,
  total_import_shipments: 0,
  last_po_date: '',
  total_po_value_lifetime: 0,
};

const emptyFilters = {
  search_text: '',
  company_id: '',
  supplier_type: '',
  country: '',
  is_active: '',
  approval_status: '',
  expiring_cert_within_days: '',
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
    supplier_id: row.supplier_id || '',
    company_id: row.company_id || '',
    supplier_code: row.supplier_code || '',
    supplier_name: row.supplier_name || '',
    supplier_type: row.supplier_type || '',
    country: row.country || '',
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    contact_person: row.contact_person || '',
    contact_title: row.contact_title || '',
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
    secondary_contact_person: row.secondary_contact_person || '',
    secondary_phone: row.secondary_phone || '',
    address_line: row.address_line || '',
    registration_number: row.registration_number || '',
    tax_id: row.tax_id || '',
    certification: row.certification || '',
    certification_expiry_date: toDateInput(row.certification_expiry_date),
    payment_terms: row.payment_terms || '',
    credit_limit: row.credit_limit ?? '',
    bank_account_info: row.bank_account_info || '',
    lead_time_days: row.lead_time_days ?? '',
    notes: row.notes || '',
    approval_status: row.approval_status || 'Pending',
    approved_date: row.approved_date || '',
    created_date: row.created_date || '',
    modified_date: row.modified_date || '',
    deleted_date: row.deleted_date || '',
    row_version: normalizeRowVersion(row.row_version),
    is_deleted: Boolean(row.is_deleted),
    total_po_count: Number(row.total_po_count) || 0,
    total_import_shipments: Number(row.total_import_shipments) || 0,
    total_po_value_lifetime: Number(row.total_po_value_lifetime) || 0,
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

function formatMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0.00';
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SupplierForm({ currentUser, supplierId = null, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [listRows, setListRows] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [certificationAlerts, setCertificationAlerts] = useState([]);
  const [dashboard, setDashboard] = useState({ kpis: {}, byType: [], byCountry: [] });
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

  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [choiceValues, setChoiceValues] = useState({
    supplierTypes: ['Breeder', 'Feed', 'Medication', 'Vaccine', 'Equipment', 'Consumables', 'Genetics', 'Transport', 'Service', 'General'],
    approvalStatuses: ['Draft', 'Pending', 'Approved', 'Rejected', 'Suspended'],
    paymentTermsSuggestions: ['Net 30', 'Net 60', 'Net 90', 'COD', 'Prepaid'],
  });

  const [activeTab, setActiveTab] = useState('details');
  const [changeApproval, setChangeApproval] = useState({ new_status: '', comments: '' });
  const [decision, setDecision] = useState({ decision: 'Approved', comments: '' });
  const [deleteReason, setDeleteReason] = useState('');
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');
  const [metrics, setMetrics] = useState({ po_count: 0, lifetime_value: 0 });

  const effectiveSupplierId = form.supplier_id || supplierId || null;
  const isEditMode = Boolean(effectiveSupplierId);
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / 10));

  const legalTransitions = useMemo(() => {
    if (form.approval_status === 'Draft') return ['Pending', 'Rejected'];
    if (form.approval_status === 'Pending') return ['Approved', 'Rejected'];
    if (form.approval_status === 'Approved') return ['Suspended'];
    if (form.approval_status === 'Rejected') return ['Pending', 'Draft'];
    if (form.approval_status === 'Suspended') return ['Approved'];
    return [];
  }, [form.approval_status]);

  const certificationFlags = useMemo(() => {
    if (!form.certification_expiry_date) return { expired: false, expiringSoon: false, daysToExpiry: null };
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiry = new Date(form.certification_expiry_date);
    if (Number.isNaN(expiry.getTime())) return { expired: false, expiringSoon: false, daysToExpiry: null };
    const expiryDate = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const diffDays = Math.floor((expiryDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
    return { expired: diffDays < 0, expiringSoon: diffDays >= 0 && diffDays <= 30, daysToExpiry: diffDays };
  }, [form.certification_expiry_date]);

  const canDelete = form.total_po_count <= 0 && form.total_import_shipments <= 0;
  const canHardDelete = form.is_deleted && canDelete && hardDeleteConfirmText.trim() === (form.supplier_code || '').trim();

  function fieldError(name) {
    return fieldErrors[name] ? <div className="mt-1 text-xs text-red-600">{fieldErrors[name]}</div> : null;
  }

  const loadSupplierDetail = useCallback(async (id) => {
    if (!currentUser?.accessToken || !id) return;
    const [detailPayload, poPayload, valuePayload] = await Promise.all([
      apiRequest(`/livestock/supplier/${id}`, currentUser.accessToken),
      apiRequest(`/livestock/supplier/functions/${id}/po-count`, currentUser.accessToken),
      apiRequest(`/livestock/supplier/functions/${id}/lifetime-value`, currentUser.accessToken),
    ]);
    setForm(toForm(detailPayload.data));
    setMetrics({
      po_count: Number(poPayload.data?.po_count) || 0,
      lifetime_value: Number(valuePayload.data?.lifetime_value) || 0,
    });
  }, [currentUser?.accessToken]);

  const loadListAndDashboard = useCallback(async () => {
    if (!currentUser?.accessToken) return;
    const params = new URLSearchParams({
      page_number: String(pageNumber),
      page_size: '10',
      include_deleted: filters.include_deleted ? '1' : '0',
    });
    if (filters.search_text) params.set('search_text', filters.search_text);
    if (filters.company_id) params.set('company_id', filters.company_id);
    if (filters.supplier_type) params.set('supplier_type', filters.supplier_type);
    if (filters.country) params.set('country', filters.country);
    if (filters.approval_status) params.set('approval_status', filters.approval_status);
    if (filters.expiring_cert_within_days) params.set('expiring_cert_within_days', filters.expiring_cert_within_days);
    if (filters.is_active === '1' || filters.is_active === '0') params.set('is_active', filters.is_active);

    const [listPayload, dashboardPayload, pendingPayload, certPayload] = await Promise.all([
      apiRequest(`/livestock/supplier?${params.toString()}`, currentUser.accessToken),
      apiRequest(`/livestock/supplier/reports/dashboard${filters.company_id ? `?company_id=${encodeURIComponent(filters.company_id)}` : ''}`, currentUser.accessToken),
      apiRequest(`/livestock/supplier/functions/pending-approvals${filters.company_id ? `?company_id=${encodeURIComponent(filters.company_id)}` : ''}`, currentUser.accessToken),
      apiRequest('/livestock/supplier/functions/expiring-certifications?within_days=60', currentUser.accessToken),
    ]);

    setListRows(Array.isArray(listPayload.data) ? listPayload.data : []);
    setTotalCount(Number(listPayload.totalCount) || 0);
    setDashboard(dashboardPayload.data || { kpis: {} });
    setPendingApprovals(Array.isArray(pendingPayload.data) ? pendingPayload.data : []);
    setCertificationAlerts(Array.isArray(certPayload.data) ? certPayload.data.slice(0, 10) : []);
  }, [currentUser?.accessToken, filters, pageNumber]);

  const loadData = useCallback(async () => {
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [companyPayload, userPayload, choicePayload] = await Promise.all([
        apiRequest(`/company?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest(`/security/users?page_number=1&page_size=${LOOKUP_PAGE_SIZE}`, currentUser.accessToken),
        apiRequest('/livestock/supplier/choice-values', currentUser.accessToken),
      ]);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
      if (choicePayload?.data) setChoiceValues(choicePayload.data);

      await loadListAndDashboard();
      if (supplierId) {
        await loadSupplierDetail(supplierId);
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load supplier data.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.accessToken, loadListAndDashboard, loadSupplierDetail, supplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!currentUser?.accessToken) return;
    loadListAndDashboard().catch((requestError) => {
      setError(requestError.message || 'Failed to refresh supplier list.');
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
    if (!form.company_id) nextErrors.company_id = 'Company is required.';
    if (!form.supplier_name.trim()) nextErrors.supplier_name = 'Supplier name is required.';
    if (!form.country.trim()) nextErrors.country = 'Country is required.';
    if (form.supplier_name.length > 100) nextErrors.supplier_name = 'Supplier name must not exceed 100 characters.';
    if (form.country.length > 50) nextErrors.country = 'Country must not exceed 50 characters.';
    if (form.supplier_type && !choiceValues.supplierTypes.includes(form.supplier_type)) nextErrors.supplier_type = 'Invalid supplier type.';
    if (form.credit_limit !== '' && (Number(form.credit_limit) < 0 || !Number.isFinite(Number(form.credit_limit)))) nextErrors.credit_limit = 'credit_limit must be a non-negative number.';
    if (form.lead_time_days !== '' && (intOrNull(form.lead_time_days) === null || Number(form.lead_time_days) < 0)) nextErrors.lead_time_days = 'lead_time_days must be a non-negative integer.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Email must be a valid email address.';
    if (form.website && !/^https?:\/\//i.test(form.website)) nextErrors.website = 'Website must start with http:// or https://.';

    const maxRules = [
      ['supplier_code', 20], ['contact_person', 100], ['contact_title', 100], ['phone', 20], ['email', 100], ['website', 200],
      ['secondary_contact_person', 100], ['secondary_phone', 20], ['address_line', 500], ['registration_number', 50],
      ['tax_id', 50], ['certification', 100], ['payment_terms', 50], ['bank_account_info', 200],
    ];
    maxRules.forEach(([field, max]) => {
      if (form[field] && String(form[field]).length > max) nextErrors[field] = `${field} must not exceed ${max} characters.`;
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser?.accessToken) {
      setError('Sign out and sign in again.');
      return;
    }
    if (form.is_deleted) {
      setTabError('Restore first to edit.');
      return;
    }
    if (!validateForm()) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        company_id: form.company_id,
        supplier_code: form.supplier_code || null,
        supplier_name: form.supplier_name.trim(),
        supplier_type: form.supplier_type || null,
        country: form.country.trim(),
        contact_person: form.contact_person || null,
        contact_title: form.contact_title || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        registration_number: form.registration_number || null,
        certification: form.certification || null,
        certification_expiry_date: form.certification_expiry_date || null,
        tax_id: form.tax_id || null,
        payment_terms: form.payment_terms || null,
        credit_limit: numberOrNull(form.credit_limit),
        bank_account_info: form.bank_account_info || null,
        lead_time_days: intOrNull(form.lead_time_days),
        secondary_contact_person: form.secondary_contact_person || null,
        secondary_phone: form.secondary_phone || null,
        address_line: form.address_line || null,
        notes: form.notes || null,
        is_active: Boolean(form.is_active),
        user_id: currentUser.user_id,
      };

      if (!isEditMode) {
        const created = await apiRequest('/livestock/supplier', currentUser.accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const createdId = created.data?.supplier_id;
        setMessage('Supplier created successfully.');
        if (createdId) {
          await loadSupplierDetail(createdId);
        } else {
          setForm({ ...emptyForm });
        }
      } else {
        await apiRequest(`/livestock/supplier/${effectiveSupplierId}`, currentUser.accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Supplier updated successfully.');
        await loadSupplierDetail(effectiveSupplierId);
      }
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  }

  async function runTabAction(action, successMessage) {
    if (!currentUser?.accessToken || !effectiveSupplierId) {
      setTabError('Sign out and sign in again.');
      return;
    }
    setSaving(true);
    setTabError('');
    try {
      await action();
      setMessage(successMessage);
      await loadSupplierDetail(effectiveSupplierId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeApproval() {
    if (!changeApproval.new_status) {
      setTabError('No legal transition is available from current status.');
      return;
    }
    if (!window.confirm('Change supplier approval status?')) return;
    await runTabAction(async () => {
      await apiRequest(`/livestock/supplier/${effectiveSupplierId}/change-approval`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          new_status: changeApproval.new_status,
          comments: changeApproval.comments || null,
          user_id: currentUser.user_id,
        }),
      });
    }, 'Approval status changed successfully.');
  }

  async function handleApproveReject() {
    const allowed = ['Draft', 'Pending'].includes(form.approval_status);
    if (!allowed) {
      setTabError(`Already ${form.approval_status} by ${form.approved_by_username || 'N/A'} on ${formatDateTime(form.approved_date)}.`);
      return;
    }
    if (!window.confirm('Submit this approval decision?')) return;
    await runTabAction(async () => {
      await apiRequest(`/livestock/supplier/${effectiveSupplierId}/approve`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          decision: decision.decision,
          comments: decision.comments || null,
          user_id: currentUser.user_id,
        }),
      });
    }, 'Decision submitted successfully.');
  }

  async function handleSoftDelete() {
    if (!canDelete) {
      setTabError(form.total_po_count > 0
        ? 'Cannot delete: supplier has active purchase orders. Deactivate instead.'
        : 'Cannot delete: supplier has import shipments. Deactivate instead.');
      return;
    }
    if (!window.confirm('Soft delete this supplier?')) return;
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/supplier/${effectiveSupplierId}/delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ reason: deleteReason || null, user_id: currentUser.user_id }),
      });
      setMessage('Supplier soft-deleted successfully.');
      await loadSupplierDetail(effectiveSupplierId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to delete supplier.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleRestore() {
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/supplier/${effectiveSupplierId}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id }),
      });
      setMessage('Supplier restored successfully.');
      await loadSupplierDetail(effectiveSupplierId);
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to restore supplier.');
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleHardDelete() {
    if (!canHardDelete) {
      setTabError('Type supplier_code exactly to enable hard delete, and ensure no POs/imports exist.');
      return;
    }
    if (!window.confirm('Permanently delete this supplier? This cannot be undone.')) return;
    setDangerBusy(true);
    setTabError('');
    try {
      await apiRequest(`/livestock/supplier/${effectiveSupplierId}/hard-delete`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id, confirm: 1 }),
      });
      setMessage('Supplier permanently deleted.');
      setForm({ ...emptyForm });
      setMetrics({ po_count: 0, lifetime_value: 0 });
      await loadListAndDashboard();
      if (onSaved) onSaved();
    } catch (requestError) {
      setTabError(requestError.message || 'Failed to hard delete supplier.');
    } finally {
      setDangerBusy(false);
    }
  }

  function openEdit(row) {
    setTabError('');
    setMessage('');
    setError('');
    loadSupplierDetail(row.supplier_id).catch((requestError) => {
      setError(requestError.message || 'Failed to load supplier detail.');
    });
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-[#1f2d2a]">Supplier</h2>
            <p className="text-sm text-[#5d6d68]">Manage supplier identity, compliance, approvals, and lifecycle actions.</p>
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
              <h3 className="mb-3 text-base font-bold text-[#374744]">Identity</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Company</span><select required disabled={isEditMode} value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>{fieldError('company_id')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Supplier code</span><input value={form.supplier_code} disabled={isEditMode} onChange={(event) => setForm((current) => ({ ...current, supplier_code: event.target.value }))} placeholder="Auto-generated via GenerateBusinessCode — leave blank" className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f4f7f5]" />{fieldError('supplier_code')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Supplier name</span><input required maxLength="100" value={form.supplier_name} onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('supplier_name')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Supplier type</span><select value={form.supplier_type} onChange={(event) => setForm((current) => ({ ...current, supplier_type: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select type</option>{choiceValues.supplierTypes.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldError('supplier_type')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Country</span><input required maxLength="50" value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('country')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Is active</span><select value={form.is_active ? '1' : '0'} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === '1' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="1">Active</option><option value="0">Inactive</option></select></label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Contact</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Contact person</span><input maxLength="100" value={form.contact_person} onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Contact title</span><input maxLength="100" value={form.contact_title} onChange={(event) => setForm((current) => ({ ...current, contact_title: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Phone</span><input maxLength="20" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Email</span><input maxLength="100" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('email')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Website</span><input maxLength="200" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('website')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Secondary contact person</span><input maxLength="100" value={form.secondary_contact_person} onChange={(event) => setForm((current) => ({ ...current, secondary_contact_person: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Secondary phone</span><input maxLength="20" value={form.secondary_phone} onChange={(event) => setForm((current) => ({ ...current, secondary_phone: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744] md:col-span-2"><span className="mb-1 block">Address line</span><input maxLength="500" value={form.address_line} onChange={(event) => setForm((current) => ({ ...current, address_line: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Legal &amp; Certification</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Registration number</span><input maxLength="50" value={form.registration_number} onChange={(event) => setForm((current) => ({ ...current, registration_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Tax ID</span><input maxLength="50" value={form.tax_id} onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Certification</span><input maxLength="100" value={form.certification} onChange={(event) => setForm((current) => ({ ...current, certification: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Certification expiry date</span><input type="date" value={form.certification_expiry_date} onChange={(event) => setForm((current) => ({ ...current, certification_expiry_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {certificationFlags.expired ? <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">Certification Expired</span> : null}
                {!certificationFlags.expired && certificationFlags.expiringSoon ? <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">Certification Expiring Soon</span> : null}
                {certificationFlags.daysToExpiry !== null ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Days to expiry: {certificationFlags.daysToExpiry}</span> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Financial</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Payment terms</span><input list="payment-terms-suggestions" maxLength="50" value={form.payment_terms} onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /><datalist id="payment-terms-suggestions">{choiceValues.paymentTermsSuggestions?.map((row) => <option key={row} value={row} />)}</datalist></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Credit limit</span><input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('credit_limit')}</label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Bank account info</span><input maxLength="200" value={form.bank_account_info} onChange={(event) => setForm((current) => ({ ...current, bank_account_info: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Lead time (days)</span><input type="number" min="0" value={form.lead_time_days} onChange={(event) => setForm((current) => ({ ...current, lead_time_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />{fieldError('lead_time_days')}</label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Notes</h3>
              <textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
            </div>

            {form.is_deleted && <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Restore first to edit.</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm({ ...emptyForm })} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Clear</button>
              <button type="submit" disabled={saving || loading || form.is_deleted} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditMode ? 'Save supplier' : 'Create supplier'}</button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e3ebea] bg-[#f9fcfa] p-4 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-[#374744]">Computed &amp; Detail Snapshot</h3>
              {isEditMode ? (
                <div className="grid grid-cols-1 gap-2 text-sm text-[#374744]">
                  <div><span className="text-[#5d6d68]">Company:</span> <span className="font-semibold">{form.company_code || '—'} {form.company_name ? `- ${form.company_name}` : ''}</span></div>
                  <div><span className="text-[#5d6d68]">Approval:</span> <span className={`rounded-full px-2 py-1 text-xs font-semibold ${APPROVAL_COLORS[form.approval_status] || 'bg-slate-100 text-slate-700'}`}>{form.approval_status || '—'}</span></div>
                  <div><span className="text-[#5d6d68]">Approved by/date:</span> <span className="font-semibold">{form.approved_by_username || '—'} / {formatDateTime(form.approved_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Created by/date:</span> <span className="font-semibold">{form.created_by_username || '—'} / {formatDateTime(form.created_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Modified by/date:</span> <span className="font-semibold">{form.modified_by_username || '—'} / {formatDateTime(form.modified_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Deleted by/date:</span> <span className="font-semibold">{form.deleted_by_username || '—'} / {formatDateTime(form.deleted_date)}</span></div>
                  <div><span className="text-[#5d6d68]">Row version:</span> <span className="font-semibold">{form.row_version || '—'}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${form.is_deleted ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{form.is_deleted ? 'Deleted' : 'Active row'}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${form.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{form.is_active ? 'Active supplier' : 'Inactive supplier'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Total POs (function)</div><div className="text-base font-bold text-[#374744]">{metrics.po_count}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Lifetime Value (function)</div><div className="text-base font-bold text-[#374744]">{formatMoney(metrics.lifetime_value)}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Total POs (detail)</div><div className="text-base font-bold text-[#374744]">{form.total_po_count || 0}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Total imports</div><div className="text-base font-bold text-[#374744]">{form.total_import_shipments || 0}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Last PO date</div><div className="text-base font-bold text-[#374744]">{formatDate(form.last_po_date)}</div></div>
                    <div className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2"><div className="text-xs text-[#5d6d68]">Total PO value</div><div className="text-base font-bold text-[#374744]">{formatMoney(form.total_po_value_lifetime)}</div></div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5d6d68]">Save supplier first to view detailed metrics.</p>
              )}
            </div>

            {isEditMode && (
              <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  {['details', 'change-approval', 'approve', 'danger'].map((tab) => (
                    <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab ? 'bg-[#0f8b3d] text-white' : 'border border-[#dfe8e1] text-[#374744] hover:bg-[#f4f7f5]'}`}>
                      {tab === 'details' ? 'Details' : tab === 'change-approval' ? 'Change Approval' : tab === 'approve' ? 'Approve / Reject' : 'Danger Zone'}
                    </button>
                  ))}
                </div>

                {activeTab === 'details' && <div className="text-sm text-[#5d6d68]">Manage approval and deletion actions from tabs.</div>}

                {activeTab === 'change-approval' && (
                  <div className="space-y-3">
                    <div className="text-xs text-[#5d6d68]">Current: <span className={`rounded-full px-2 py-1 font-semibold ${APPROVAL_COLORS[form.approval_status] || 'bg-slate-100 text-slate-700'}`}>{form.approval_status}</span></div>
                    <label className="block text-sm font-medium text-[#374744]">New status<select value={changeApproval.new_status} onChange={(event) => setChangeApproval((current) => ({ ...current, new_status: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">{legalTransitions.length ? 'Select status' : 'No legal transitions'}</option>{legalTransitions.map((row) => <option key={row} value={row}>{row}</option>)}</select></label>
                    <label className="block text-sm font-medium text-[#374744]">Comments<textarea rows="2" maxLength="500" value={changeApproval.comments} onChange={(event) => setChangeApproval((current) => ({ ...current, comments: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">Approved sets approved_by + approved_date automatically.</div>
                    <button type="button" disabled={saving || !changeApproval.new_status} onClick={handleChangeApproval} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Change Approval'}</button>
                  </div>
                )}

                {activeTab === 'approve' && (
                  <div className="space-y-3">
                    {!['Draft', 'Pending'].includes(form.approval_status) && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Already {form.approval_status} by {form.approved_by_username || 'N/A'} on {formatDateTime(form.approved_date)}.</div>}
                    <label className="block text-sm font-medium text-[#374744]">Decision<select value={decision.decision} onChange={(event) => setDecision((current) => ({ ...current, decision: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></label>
                    <label className="block text-sm font-medium text-[#374744]">Comments<textarea rows="2" maxLength="500" value={decision.comments} onChange={(event) => setDecision((current) => ({ ...current, comments: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
                    <button type="button" disabled={saving || !['Draft', 'Pending'].includes(form.approval_status)} onClick={handleApproveReject} className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Running...' : 'Submit Decision'}</button>
                  </div>
                )}

                {activeTab === 'danger' && (
                  <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    {!canDelete && (
                      <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
                        {form.total_po_count > 0
                          ? 'Cannot delete: supplier has active purchase orders. Deactivate instead.'
                          : 'Cannot delete: supplier has import shipments. Deactivate instead.'}
                      </div>
                    )}
                    <label className="block text-sm font-medium text-[#7f1d1d]">Delete reason<textarea rows="2" maxLength="500" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="mt-1 w-full rounded-xl border border-red-200 p-3 text-sm outline-none" /></label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={dangerBusy || !canDelete} onClick={handleSoftDelete} className="h-10 rounded-lg bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50">Soft Delete</button>
                      <button type="button" disabled={dangerBusy || !form.is_deleted} onClick={handleRestore} className="h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-700 disabled:opacity-50">Restore</button>
                    </div>
                    <label className="block text-sm font-medium text-[#7f1d1d]">Type supplier_code ({form.supplier_code || 'N/A'}) to confirm hard delete<input value={hardDeleteConfirmText} onChange={(event) => setHardDeleteConfirmText(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm outline-none" /></label>
                    <button type="button" disabled={dangerBusy || !canHardDelete} onClick={handleHardDelete} className="h-10 rounded-lg bg-[#6a1818] px-3 text-sm font-bold text-white disabled:opacity-50">Hard Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Total Suppliers', dashboard.kpis?.total_suppliers ?? 0, ''],
            ['Active Suppliers', dashboard.kpis?.active_suppliers ?? 0, ''],
            ['Approved Suppliers', dashboard.kpis?.approved_suppliers ?? 0, ''],
            ['Pending Approval', dashboard.kpis?.pending_approval ?? 0, ''],
            ['Expired Certification', dashboard.kpis?.expired_certification ?? 0, 'text-red-700'],
            ['Expiring Soon', dashboard.kpis?.expiring_soon ?? 0, 'text-amber-700'],
          ].map(([label, value, valueClass]) => (
            <div key={label} className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
              <div className="text-xs font-semibold text-[#5d6d68]">{label}</div>
              <div className={`mt-1 text-xl font-bold text-[#374744] ${valueClass}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={filters.search_text} onChange={(event) => setFilters((current) => ({ ...current, search_text: event.target.value }))} placeholder="Search code, name, contact, registration" className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={filters.company_id} onChange={(event) => setFilters((current) => ({ ...current, company_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All companies</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>
            <select value={filters.supplier_type} onChange={(event) => setFilters((current) => ({ ...current, supplier_type: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All types</option>{choiceValues.supplierTypes.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <input value={filters.country} onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))} placeholder="Country" className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={filters.is_active} onChange={(event) => setFilters((current) => ({ ...current, is_active: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All statuses</option><option value="1">Active</option><option value="0">Inactive</option></select>
            <select value={filters.approval_status} onChange={(event) => setFilters((current) => ({ ...current, approval_status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">All approvals</option>{choiceValues.approvalStatuses.map((row) => <option key={row} value={row}>{row}</option>)}</select>
            <input type="number" min="1" value={filters.expiring_cert_within_days} onChange={(event) => setFilters((current) => ({ ...current, expiring_cert_within_days: event.target.value }))} placeholder="Expiring cert within days" className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#dfe8e1] px-3 text-sm font-medium text-[#374744]"><input type="checkbox" checked={filters.include_deleted} onChange={(event) => setFilters((current) => ({ ...current, include_deleted: event.target.checked }))} />Include deleted</label>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setPageNumber(1); loadListAndDashboard().catch((requestError) => setError(requestError.message)); }} className="h-10 rounded-lg bg-[#0f8b3d] px-4 text-sm font-semibold text-white hover:bg-[#0c7133]">Apply</button>
            <button type="button" onClick={resetFilters} className="h-10 rounded-lg border border-[#dfe8e1] px-4 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Reset</button>
          </div>

          <div className="responsive-table-shell overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2 font-semibold">Code</th>
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Country</th>
                  <th className="px-2 py-2 font-semibold">Contact</th>
                  <th className="px-2 py-2 font-semibold">Certification</th>
                  <th className="px-2 py-2 font-semibold">Active</th>
                  <th className="px-2 py-2 font-semibold">Approval</th>
                  <th className="px-2 py-2 font-semibold">POs</th>
                  <th className="px-2 py-2 font-semibold">Imports</th>
                  <th className="px-2 py-2 font-semibold">PO Value (12m)</th>
                  <th className="px-2 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 ? (
                  <tr><td colSpan="12" className="px-2 py-6 text-center text-[#5d6d68]">No suppliers found for selected filters.</td></tr>
                ) : listRows.map((row) => (
                  <tr key={row.supplier_id} className={`border-b border-[#f0f3f1] text-[#30433f] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2 font-mono text-xs">{row.supplier_code}</td>
                    <td className="px-2 py-2">{row.supplier_name}</td>
                    <td className="px-2 py-2">{row.supplier_type || '—'}</td>
                    <td className="px-2 py-2">{row.country || '—'}</td>
                    <td className="px-2 py-2">{row.contact_person || '—'}</td>
                    <td className="px-2 py-2"><div className="flex flex-wrap gap-1"><span>{row.certification_expiry_date ? toDateInput(row.certification_expiry_date) : '—'}</span>{row.is_certification_expired ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Expired</span> : null}{!row.is_certification_expired && row.is_certification_expiring_soon ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Expiring</span> : null}</div></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${APPROVAL_COLORS[row.approval_status] || 'bg-slate-100 text-slate-700'}`}>{row.approval_status || '—'}</span></td>
                    <td className="px-2 py-2">{row.total_po_count ?? 0}</td>
                    <td className="px-2 py-2">{row.total_import_shipments ?? 0}</td>
                    <td className="px-2 py-2">{formatMoney(row.po_value_12m ?? 0)}</td>
                    <td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5]">Edit</button><button type="button" onClick={() => { openEdit(row); setActiveTab('danger'); }} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">Danger</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-[#5d6d68]">
            <span>{totalCount} supplier{totalCount === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span>Page {pageNumber} of {totalPages}</span>
              <button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-[#374744]">Pending Approvals</h3>
          <div className="responsive-table-shell overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2 font-semibold">Code</th>
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Country</th>
                  <th className="px-2 py-2 font-semibold">Contact</th>
                  <th className="px-2 py-2 font-semibold">Email</th>
                  <th className="px-2 py-2 font-semibold">Approval</th>
                  <th className="px-2 py-2 font-semibold">Created By</th>
                  <th className="px-2 py-2 font-semibold">Days Pending</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.length === 0 ? (
                  <tr><td colSpan="9" className="px-2 py-6 text-center text-[#5d6d68]">No pending approvals.</td></tr>
                ) : pendingApprovals.map((row) => (
                  <tr key={row.supplier_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.supplier_code || '—'}</td>
                    <td className="px-2 py-2">{row.supplier_name || '—'}</td>
                    <td className="px-2 py-2">{row.supplier_type || '—'}</td>
                    <td className="px-2 py-2">{row.country || '—'}</td>
                    <td className="px-2 py-2">{row.contact_person || '—'}</td>
                    <td className="px-2 py-2">{row.email || '—'}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${APPROVAL_COLORS[row.approval_status] || 'bg-slate-100 text-slate-700'}`}>{row.approval_status}</span></td>
                    <td className="px-2 py-2">{row.created_by_username || '—'}</td>
                    <td className="px-2 py-2">{row.days_pending ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-[#374744]">Certification Alerts (60 days)</h3>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2 font-semibold">Code</th>
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Country</th>
                  <th className="px-2 py-2 font-semibold">Certification</th>
                  <th className="px-2 py-2 font-semibold">Expiry Date</th>
                  <th className="px-2 py-2 font-semibold">Days to Expiry</th>
                  <th className="px-2 py-2 font-semibold">Expired</th>
                </tr>
              </thead>
              <tbody>
                {certificationAlerts.length === 0 ? (
                  <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No certification alerts.</td></tr>
                ) : certificationAlerts.map((row) => (
                  <tr key={row.supplier_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.supplier_code || '—'}</td>
                    <td className="px-2 py-2">{row.supplier_name || '—'}</td>
                    <td className="px-2 py-2">{row.supplier_type || '—'}</td>
                    <td className="px-2 py-2">{row.country || '—'}</td>
                    <td className="px-2 py-2">{row.certification || '—'}</td>
                    <td className="px-2 py-2">{formatDate(row.certification_expiry_date)}</td>
                    <td className="px-2 py-2">{Number(row.days_to_expiry) <= 0 ? <span className="font-semibold text-red-700">{row.days_to_expiry}</span> : Number(row.days_to_expiry) <= 30 ? <span className="font-semibold text-amber-700">{row.days_to_expiry}</span> : row.days_to_expiry}</td>
                    <td className="px-2 py-2">{row.is_certification_expired ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Expired</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">No</span>}</td>
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
