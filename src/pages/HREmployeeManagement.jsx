import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const DEPARTMENT_LOOKUP_GROUP = 'Department';
const GENDER_LOOKUP_GROUP = 'Gender';
const EMPLOYMENT_TYPE_LOOKUP_GROUP = 'Employment';

const emptyForm = {
  employee_id: '',
  user_id: '',
  employee_code: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  phone_number: '',
  email: '',
  national_id: '',
  hire_date: '',
  termination_date: '',
  company_id: '',
  department: '',
  job_title: '',
  employment_type: '',
  manager_employee_id: '',
  status: 'Active',
  remarks: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    employee_id: row.employee_id || '',
    user_id: row.user_id || '',
    employee_code: row.employee_code || '',
    first_name: row.first_name || '',
    middle_name: row.middle_name || '',
    last_name: row.last_name || '',
    gender: row.gender || '',
    date_of_birth: toDateInput(row.date_of_birth),
    phone_number: row.phone_number || '',
    email: row.email || '',
    national_id: row.national_id || '',
    hire_date: toDateInput(row.hire_date),
    termination_date: toDateInput(row.termination_date),
    company_id: row.company_id || '',
    department: row.department || '',
    job_title: row.job_title || '',
    employment_type: row.employment_type || '',
    manager_employee_id: row.manager_employee_id || '',
    status: row.status || 'Active',
    remarks: row.remarks || '',
  };
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

function validateForm(form) {
  if (!form.first_name.trim()) return 'First name is required.';
  if (!form.last_name.trim()) return 'Last name is required.';
  if (!form.gender) return 'Gender is required.';
  if (!form.hire_date) return 'Hire date is required.';
  if (!form.company_id) return 'Company is required.';
  if (form.termination_date && form.hire_date && form.termination_date < form.hire_date) {
    return 'Termination date cannot be before hire date.';
  }
  return '';
}

export default function HREmployeeManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [genders, setGenders] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [linkedUserSearch, setLinkedUserSearch] = useState('');
  const [isLinkedUserDropdownOpen, setIsLinkedUserDropdownOpen] = useState(false);
  const linkedUserDropdownRef = useRef(null);

  const managerOptions = useMemo(
    () => rows.filter((row) => !row.is_deleted && row.employee_id !== form.employee_id),
    [rows, form.employee_id],
  );
  const activeUserOptions = useMemo(
    () => userOptions.filter((row) => !row.is_deleted && row.is_active !== false),
    [userOptions],
  );
  const filteredUserOptions = useMemo(() => {
    const search = linkedUserSearch.trim().toLowerCase();
    if (!search) return activeUserOptions;
    return activeUserOptions.filter((row) => {
      const username = String(row.username || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim().toLowerCase();
      return username.includes(search) || email.includes(search) || fullName.includes(search);
    });
  }, [activeUserOptions, linkedUserSearch]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [employeePayload, companyPayload, userPayload, departmentPayload, genderPayload, employmentTypePayload] = await Promise.all([
        apiRequest(`/hr/employee?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/company?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/user?page_number=1&page_size=500&is_deleted=0', currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(DEPARTMENT_LOOKUP_GROUP)}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(GENDER_LOOKUP_GROUP)}`, currentUser.accessToken),
        apiRequest(`/lookup/group/${encodeURIComponent(EMPLOYMENT_TYPE_LOOKUP_GROUP)}`, currentUser.accessToken),
      ]);
      setEmploymentTypes(Array.isArray(employmentTypePayload.data) ? employmentTypePayload.data : []);
      setGenders(Array.isArray(genderPayload.data) ? genderPayload.data : []);
      setDepartments(Array.isArray(departmentPayload.data) ? departmentPayload.data : []);
      setRows(Array.isArray(employeePayload.data) ? employeePayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setUserOptions(Array.isArray(userPayload.data) ? userPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
      setUserOptions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  const linkedUser = userOptions.find((row) => row.user_id === form.user_id);

  useEffect(() => {
    if (!isLinkedUserDropdownOpen) return undefined;
    function handleOutsideClick(event) {
      if (!linkedUserDropdownRef.current?.contains(event.target)) {
        setIsLinkedUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isLinkedUserDropdownOpen]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const validationError = validateForm(form);
      if (validationError) throw new Error(validationError);

      const isEditing = Boolean(form.employee_id);
      await apiRequest(isEditing ? `/hr/employee/${form.employee_id}` : '/hr/employee', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          user_id: form.user_id || null,
          employee_code: form.employee_code.trim() || (isEditing ? undefined : null),
          middle_name: form.middle_name || null,
          date_of_birth: form.date_of_birth || null,
          phone_number: form.phone_number || null,
          email: form.email || null,
          national_id: form.national_id || null,
          termination_date: form.termination_date || null,
          department: form.department || null,
          job_title: form.job_title || null,
          employment_type: form.employment_type || null,
          manager_employee_id: form.manager_employee_id || null,
          remarks: form.remarks || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Employee updated successfully.' : 'Employee created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete employee ${row.employee_code}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/employee/${row.employee_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.employee_id === row.employee_id) setForm(emptyForm);
      setMessage('Employee deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreRow(row) {
    if (!window.confirm(`Restore employee ${row.employee_code}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/employee/${row.employee_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Employee restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#dfeae3] bg-[#edf9f1] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f8b3d]">
            <span className="text-base">👥</span>
            HR directory
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#172a22]">Employee Management</h2>
        </div>
        <div className="rounded-2xl border border-[#dfeae3] bg-white px-3 py-2 text-sm font-medium text-[#435b53] shadow-sm">
          {rows.length} employees
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-2xl border border-[#bfe4c9] bg-[#ecfdf3] px-4 py-3 text-sm font-semibold text-[#0d6b3d] shadow-sm">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="overflow-hidden rounded-[28px] border border-[#e4ece6] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf9_100%)] shadow-[0_24px_60px_rgba(10,40,28,0.08)] ring-1 ring-[#edf4ee]">
        <div className="border-b border-[#ebf1ee] bg-[linear-gradient(135deg,#eafaf0_0%,#f5fbf7_100%)] px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#4d675f]">Profile</div>
              <div className="mt-1 text-lg font-black text-[#1f2d2a]">{form.employee_id ? 'Update employee' : 'Add employee'}</div>
            </div>
            {form.employee_id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                disabled={saving}
                className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-2 text-sm font-semibold text-[#374744] transition hover:bg-[#f4f7f5] disabled:opacity-50"
              >
                Clear form
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Employee code {form.employee_id ? '' : '(optional)'}</span>
              <input value={form.employee_code} onChange={(event) => setForm((current) => ({ ...current, employee_code: event.target.value }))} placeholder={form.employee_id ? '' : 'Leave blank for auto-code'} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">First name</span>
              <input required value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Middle name</span>
              <input value={form.middle_name} onChange={(event) => setForm((current) => ({ ...current, middle_name: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Last name</span>
              <input required value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Gender</span>
              <select required value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="">Select gender</option>{form.gender && !genders.some((row) => row.lookup_value === form.gender) && <option value={form.gender}>{form.gender}</option>}{genders.map((row) => <option key={row.lookup_id || row.lookup_code} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}</select>
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Date of birth</span>
              <input type="date" value={form.date_of_birth} onChange={(event) => setForm((current) => ({ ...current, date_of_birth: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Phone number</span>
              <input value={form.phone_number} onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Email</span>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">National ID</span>
              <input value={form.national_id} onChange={(event) => setForm((current) => ({ ...current, national_id: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Hire date</span>
              <input required type="date" value={form.hire_date} onChange={(event) => setForm((current) => ({ ...current, hire_date: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Termination date</span>
              <input type="date" value={form.termination_date} onChange={(event) => setForm((current) => ({ ...current, termination_date: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Company</span>
              <select required value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="">Select company</option>{companies.map((row) => <option key={row.company_id} value={row.company_id}>{row.company_code} - {row.company_name}</option>)}</select>
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Department</span>
              <select value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="">Select department</option>{form.department && !departments.some((row) => row.lookup_value === form.department) && <option value={form.department}>{form.department}</option>}{departments.map((row) => <option key={row.lookup_id || row.lookup_code} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}</select>
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Job title</span>
              <input value={form.job_title} onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Employment type</span>
              <select value={form.employment_type} onChange={(event) => setForm((current) => ({ ...current, employment_type: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="">Select employment type</option>{form.employment_type && !employmentTypes.some((row) => row.lookup_value === form.employment_type) && <option value={form.employment_type}>{form.employment_type}</option>}{employmentTypes.map((row) => <option key={row.lookup_id || row.lookup_code} value={row.lookup_value}>{row.lookup_code} - {row.lookup_value}</option>)}</select>
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Terminated">Terminated</option></select>
            </label>
            <label className="group text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Manager</span>
              <select value={form.manager_employee_id} onChange={(event) => setForm((current) => ({ ...current, manager_employee_id: event.target.value }))} className="h-11 w-full rounded-2xl border border-[#dfe8e1] bg-white px-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"><option value="">No manager</option>{managerOptions.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_code} - {row.full_name || `${row.first_name} ${row.last_name}`}</option>)}</select>
            </label>
            <div className="text-sm font-semibold text-[#374744]">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Linked user</span>
              <div ref={linkedUserDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkedUserDropdownOpen((current) => !current);
                    setLinkedUserSearch('');
                  }}
                  className="flex h-11 w-full items-center justify-between rounded-2xl border border-[#dfe8e1] bg-white px-3 text-left text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition hover:border-[#bed8c7] focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"
                >
                  <span className={linkedUser ? 'text-[#1f2d2a]' : 'text-[#8aa19a]'}>
                    {linkedUser ? `${linkedUser.username} - ${linkedUser.email || linkedUser.user_id}` : 'No linked user'}
                  </span>
                  <span className="text-[#5d6d68]">{isLinkedUserDropdownOpen ? '⌃' : '⌄'}</span>
                </button>

                {isLinkedUserDropdownOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-2xl border border-[#dfe8e1] bg-white p-2 shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                    <input
                      autoFocus
                      value={linkedUserSearch}
                      onChange={(event) => setLinkedUserSearch(event.target.value)}
                      placeholder="Search username, email, or name"
                      className="mb-2 h-10 w-full rounded-xl border border-[#dfe8e1] bg-[#f8fbf9] px-3 text-sm outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]"
                    />
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-[#edf3ef] bg-[#fafcfb]">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, user_id: '' }));
                          setIsLinkedUserDropdownOpen(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${form.user_id ? 'text-[#1f2d2a]' : 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]'}`}
                      >
                        No linked user
                      </button>
                      {!linkedUser && form.user_id && (
                        <div className="px-3 py-2 text-xs text-[#6f7d78]">Current linked user: {form.user_id}</div>
                      )}
                      {filteredUserOptions.map((row) => {
                        const isSelected = form.user_id === row.user_id;
                        return (
                          <button
                            key={row.user_id}
                            type="button"
                            onClick={() => {
                              setForm((current) => ({ ...current, user_id: row.user_id }));
                              setIsLinkedUserDropdownOpen(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${isSelected ? 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]' : 'text-[#1f2d2a]'}`}
                          >
                            {row.username} - {row.email || row.user_id}
                          </button>
                        );
                      })}
                      {filteredUserOptions.length === 0 && (
                        <div className="px-3 py-3 text-sm text-[#6f7d78]">No user found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <label className="mt-4 block text-sm font-semibold text-[#374744]">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a6e68]">Remarks</span>
            <textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="3" className="w-full rounded-2xl border border-[#dfe8e1] bg-white p-3 text-sm text-[#1d2d2b] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0f8b3d] focus:ring-4 focus:ring-[#dff7e8]" />
          </label>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {form.employee_id && (
              <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-2xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold text-[#374744] transition hover:bg-[#f4f7f5] disabled:opacity-50">
                Cancel edit
              </button>
            )}
            <button type="submit" disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#0f8b3d_0%,#0c6f36_100%)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,139,61,0.22)] transition hover:-translate-y-px hover:shadow-[0_18px_28px_rgba(15,139,61,0.28)] disabled:opacity-50">
              {saving ? 'Saving...' : form.employee_id ? 'Save changes' : 'Save employee'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-[28px] border border-[#e4ece6] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf9_100%)] shadow-[0_24px_60px_rgba(10,40,28,0.06)] ring-1 ring-[#edf4ee]">
        <div className="flex flex-col gap-3 border-b border-[#ebf1ee] bg-[#f6faf7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#4d675f]">Roster</div>
            <h3 className="mt-1 text-lg font-black text-[#1f2d2a]">Employees</h3>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#374744]">
            <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include deleted
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-[#ebf1ee] bg-[#f8fbf9] text-[#51615d]">
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Code</th>
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Name</th>
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Company</th>
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Department</th>
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Status</th>
                <th className="px-3 py-3 font-bold uppercase tracking-[0.08em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">Loading employees...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-8 text-center text-[#5d6d68]">No employees found.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.employee_id} className={`border-b border-[#f0f3f1] transition hover:bg-[#f9fcfa] ${row.is_deleted ? 'bg-red-50/35' : ''}`}>
                  <td className="px-3 py-3 font-mono text-[11px] font-bold text-[#2b3d39]">{row.employee_code}</td>
                  <td className="px-3 py-3 font-semibold text-[#1d2d2b]">{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim()}</td>
                  <td className="px-3 py-3 text-[#425954]">{row.company_name || '-'}</td>
                  <td className="px-3 py-3 text-[#425954]">{row.department || '-'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${row.is_deleted ? 'bg-red-100 text-red-700' : row.status === 'Inactive' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {row.is_deleted ? 'Deleted' : row.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={saving} onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-xl border border-[#dfe8e1] bg-white px-3 py-1.5 text-xs font-bold text-[#2e4741] transition hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                      {!row.is_deleted && (
                        <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50">Delete</button>
                      )}
                      {row.is_deleted && (
                        <button type="button" disabled={saving} onClick={() => restoreRow(row)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">Restore</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
