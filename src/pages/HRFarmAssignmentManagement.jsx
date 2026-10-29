import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  assignment_id: '',
  employee_id: '',
  farm_id: '',
  assignment_date: '',
  end_date: '',
  is_primary: false,
  assigned_by: '',
  remarks: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    assignment_id: row.assignment_id || '',
    employee_id: row.employee_id || '',
    farm_id: row.farm_id || '',
    assignment_date: toDateInput(row.assignment_date),
    end_date: toDateInput(row.end_date),
    is_primary: Boolean(row.is_primary),
    assigned_by: row.assigned_by || '',
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
  if (!form.employee_id) return 'Employee is required.';
  if (!form.farm_id) return 'Farm is required.';
  if (!form.assignment_date) return 'Assignment date is required.';
  if (form.end_date && form.end_date < form.assignment_date) return 'End date cannot be before assignment date.';
  return '';
}

export default function HRFarmAssignmentManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [farms, setFarms] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [assignedBySearch, setAssignedBySearch] = useState('');
  const [isAssignedByDropdownOpen, setIsAssignedByDropdownOpen] = useState(false);
  const assignedByDropdownRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeUserOptions = useMemo(
    () => userOptions.filter((row) => !row.is_deleted && row.is_active !== false),
    [userOptions],
  );
  const filteredUserOptions = useMemo(() => {
    const search = assignedBySearch.trim().toLowerCase();
    if (!search) return activeUserOptions;
    return activeUserOptions.filter((row) => {
      const username = String(row.username || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim().toLowerCase();
      return username.includes(search) || email.includes(search) || fullName.includes(search);
    });
  }, [activeUserOptions, assignedBySearch]);
  const assignedByUser = userOptions.find((row) => row.user_id === form.assigned_by);

  useEffect(() => {
    if (!isAssignedByDropdownOpen) return undefined;
    function handleOutsideClick(event) {
      if (!assignedByDropdownRef.current?.contains(event.target)) {
        setIsAssignedByDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAssignedByDropdownOpen]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [assignmentPayload, employeePayload, farmPayload, userPayload] = await Promise.all([
        apiRequest(`/hr/farm-assignment?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/hr/employee?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/user?page_number=1&page_size=500&is_deleted=0', currentUser.accessToken),
      ]);
      setUserOptions(Array.isArray(userPayload.data) ? userPayload.data : []);
      setRows(Array.isArray(assignmentPayload.data) ? assignmentPayload.data : []);
      setEmployees(Array.isArray(employeePayload.data) ? employeePayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const validationError = validateForm(form);
      if (validationError) throw new Error(validationError);

      const isEditing = Boolean(form.assignment_id);
      await apiRequest(isEditing ? `/hr/farm-assignment/${form.assignment_id}` : '/hr/farm-assignment', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          end_date: form.end_date || null,
          assigned_by: form.assigned_by || null,
          remarks: form.remarks || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null, assigned_by: form.assigned_by || currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Farm assignment updated successfully.' : 'Farm assignment created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm('Delete this farm assignment?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/farm-assignment/${row.assignment_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.assignment_id === row.assignment_id) setForm(emptyForm);
      setMessage('Farm assignment deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">HR Employee Farm Assignment</h2>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Employee</span><select required value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select employee</option>{employees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_code} - {row.full_name || `${row.first_name} ${row.last_name}`}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required value={form.farm_id} onChange={(event) => setForm((current) => ({ ...current, farm_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select farm</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Assignment date</span><input required type="date" value={form.assignment_date} onChange={(event) => setForm((current) => ({ ...current, assignment_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">End date</span><input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <div className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Assigned by</span>
            <div ref={assignedByDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAssignedByDropdownOpen((current) => !current);
                  setAssignedBySearch('');
                }}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[#dfe8e1] bg-white px-3 text-left text-sm outline-none transition hover:border-[#bed8c7] focus:border-[#0f8b3d]"
              >
                <span className={assignedByUser ? 'text-[#1f2d2a]' : 'text-[#8aa19a]'}>
                  {assignedByUser ? `${assignedByUser.username} - ${assignedByUser.email || assignedByUser.user_id}` : 'Current user (default)'}
                </span>
                <span className="text-[#5d6d68]">{isAssignedByDropdownOpen ? '⌃' : '⌄'}</span>
              </button>

              {isAssignedByDropdownOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-[#dfe8e1] bg-white p-2 shadow-xl">
                  <input
                    autoFocus
                    value={assignedBySearch}
                    onChange={(event) => setAssignedBySearch(event.target.value)}
                    placeholder="Search username, email, or name"
                    className="mb-2 h-10 w-full rounded-lg border border-[#dfe8e1] bg-[#f9fbfa] px-3 text-sm outline-none focus:border-[#0f8b3d]"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-[#edf3ef]">
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, assigned_by: '' }));
                        setIsAssignedByDropdownOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${form.assigned_by ? 'text-[#1f2d2a]' : 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]'}`}
                    >
                      Current user (default)
                    </button>
                    {!assignedByUser && form.assigned_by && (
                      <div className="px-3 py-2 text-xs text-[#6f7d78]">Current assigned by: {form.assigned_by}</div>
                    )}
                    {filteredUserOptions.map((row) => {
                      const isSelected = form.assigned_by === row.user_id;
                      return (
                        <button
                          key={row.user_id}
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, assigned_by: row.user_id }));
                            setIsAssignedByDropdownOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f2f8f4] ${isSelected ? 'bg-[#ecf8f0] font-semibold text-[#0f8b3d]' : 'text-[#1f2d2a]'}`}
                        >
                          {row.username} - {row.email || row.user_id}
                        </button>
                      );
                    })}
                    {filteredUserOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-[#6f7d78]">No users found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <label className="mt-8 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_primary} onChange={(event) => setForm((current) => ({ ...current, is_primary: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Primary assignment</label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <div className="mt-4 flex justify-end gap-2">
          {form.assignment_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.assignment_id ? 'Save changes' : 'Save assignment'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Farm Assignments</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Employee</th><th className="px-2 py-2">Farm</th><th className="px-2 py-2">Assignment date</th><th className="px-2 py-2">End date</th><th className="px-2 py-2">Primary</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading assignments...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No assignments found.</td></tr> : rows.map((row) => (
                <tr key={row.assignment_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{row.employee_code} - {row.first_name} {row.last_name}</td>
                  <td className="px-2 py-2">{row.farm_code} - {row.farm_name}</td>
                  <td className="px-2 py-2">{toDateInput(row.assignment_date)}</td>
                  <td className="px-2 py-2">{toDateInput(row.end_date) || '-'}</td>
                  <td className="px-2 py-2">{row.is_primary ? 'Yes' : 'No'}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>}
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
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
