import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  employee_role_id: '',
  employee_id: '',
  role_id: '',
  assigned_date: '',
  end_date: '',
  is_active: true,
  assigned_by: '',
  allow_overlap: false,
  row_version: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    employee_role_id: row.employee_role_id || '',
    employee_id: row.employee_id || '',
    role_id: row.role_id || '',
    assigned_date: toDateInput(row.assigned_date),
    end_date: toDateInput(row.end_date),
    is_active: Boolean(row.is_active),
    assigned_by: row.assigned_by || '',
    row_version: row.row_version || '',
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

export default function HREmployeeRoleManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [assignedBySearch, setAssignedBySearch] = useState('');
  const [isAssignedByDropdownOpen, setIsAssignedByDropdownOpen] = useState(false);
  const assignedByDropdownRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
      const [roleAssignPayload, employeePayload, rolePayload, userPayload] = await Promise.all([
        apiRequest('/hr/employee-role?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/hr/employee?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/security/role?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/user?page_number=1&page_size=500&is_deleted=0', currentUser.accessToken),
      ]);
      setUserOptions(Array.isArray(userPayload.data) ? userPayload.data : []);
      setRows(Array.isArray(roleAssignPayload.data) ? roleAssignPayload.data : []);
      setEmployees(Array.isArray(employeePayload.data) ? employeePayload.data : []);
      setRoles(Array.isArray(rolePayload.data) ? rolePayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!form.employee_id || !form.role_id || !form.assigned_date) {
      setError('Employee, role and assigned date are required.');
      return;
    }
    if (form.end_date && form.end_date < form.assigned_date) {
      setError('End date cannot be before assigned date.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const isEditing = Boolean(form.employee_role_id);
      await apiRequest(isEditing ? `/hr/employee-role/${form.employee_role_id}` : '/hr/employee-role', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          end_date: form.end_date || null,
          assigned_by: form.assigned_by || (isEditing ? null : currentUser.user_id) || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Employee role updated successfully.' : 'Employee role assigned successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm('Delete this employee role assignment?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/employee-role/${row.employee_role_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.employee_role_id === row.employee_role_id) setForm(emptyForm);
      setMessage('Employee role deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">HR Employee Role Assignment</h2>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Employee</span><select required value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select employee</option>{employees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_code} - {row.full_name || `${row.first_name} ${row.last_name}`}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Role</span><select required value={form.role_id} onChange={(event) => setForm((current) => ({ ...current, role_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select role</option>{roles.map((row) => <option key={row.role_id} value={row.role_id}>{row.role_name} - {row.display_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Assigned date</span><input required type="date" value={form.assigned_date} onChange={(event) => setForm((current) => ({ ...current, assigned_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
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
          <label className="mt-8 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Active role</label>
          {form.employee_role_id && <label className="mt-8 flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.allow_overlap} onChange={(event) => setForm((current) => ({ ...current, allow_overlap: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Allow overlapping dates</label>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {form.employee_role_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.employee_role_id ? 'Save changes' : 'Assign role'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Assigned Roles</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Employee</th><th className="px-2 py-2">Role</th><th className="px-2 py-2">Assigned date</th><th className="px-2 py-2">End date</th><th className="px-2 py-2">Active</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading role assignments...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No role assignments found.</td></tr> : rows.map((row) => (
                <tr key={row.employee_role_id} className="border-b border-[#f0f3f1]">
                  <td className="px-2 py-2">{row.employee_code} - {row.first_name} {row.last_name}</td>
                  <td className="px-2 py-2">{row.role_name} ({row.display_name})</td>
                  <td className="px-2 py-2">{toDateInput(row.assigned_date)}</td>
                  <td className="px-2 py-2">{toDateInput(row.end_date) || '-'}</td>
                  <td className="px-2 py-2">{row.is_active ? 'Yes' : 'No'}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button type="button" disabled={saving} onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>
                      <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>
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
