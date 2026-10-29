import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  assignment_id: '',
  employee_id: '',
  house_id: '',
  assignment_date: '',
  end_date: '',
  assigned_by: '',
  remarks: '',
  allow_overlap: false,
  prevent_employee_overlap: false,
  prevent_house_overlap: false,
  row_version: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    assignment_id: row.assignment_id || '',
    employee_id: row.employee_id || '',
    house_id: row.house_id || '',
    assignment_date: toDateInput(row.assignment_date),
    end_date: toDateInput(row.end_date),
    assigned_by: row.assigned_by || '',
    remarks: row.remarks || '',
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

function assignmentStatus(row) {
  if (row.is_deleted) return { label: 'Deleted', className: 'bg-red-50 text-red-700' };
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date && toDateInput(row.end_date) < today) return { label: 'Ended', className: 'bg-amber-50 text-amber-700' };
  return { label: 'Current', className: 'bg-[#eafaf0] text-[#198754]' };
}

export default function HRHouseAssignmentManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [houses, setHouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [currentOnly, setCurrentOnly] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isEditing = Boolean(form.assignment_id);
  const employeeById = useMemo(() => new Map(employees.map((row) => [row.employee_id, row])), [employees]);
  const houseById = useMemo(() => new Map(houses.map((row) => [row.house_id, row])), [houses]);
  const userById = useMemo(() => new Map(users.map((row) => [row.user_id, row])), [users]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [assignmentPayload, employeePayload, housePayload, userPayload] = await Promise.all([
        apiRequest(`/hr/house-assignment?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}&current_only=${currentOnly ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/hr/employee?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/user?page_number=1&page_size=500&is_deleted=0', currentUser.accessToken),
      ]);
      setRows(Array.isArray(assignmentPayload.data) ? assignmentPayload.data : []);
      setEmployees(Array.isArray(employeePayload.data) ? employeePayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
      setUsers(Array.isArray(userPayload.data) ? userPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted, currentOnly]);

  useEffect(() => { loadData(); }, [loadData]);

  function employeeLabel(employeeId) {
    const employee = employeeById.get(employeeId);
    if (!employee) return employeeId;
    return `${employee.employee_code} - ${employee.full_name || `${employee.first_name} ${employee.last_name}`}`;
  }

  function houseLabel(houseId) {
    const house = houseById.get(houseId);
    return house ? `${house.house_code} - ${house.house_name}` : houseId;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function runAction(action, successMessage) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!form.employee_id || !form.house_id || !form.assignment_date) {
      setError('Employee, house and assignment date are required.');
      return;
    }
    if (form.end_date && form.end_date < form.assignment_date) {
      setError('End date cannot be before assignment date.');
      return;
    }
    const wasEditing = isEditing;
    await runAction(async () => {
      await apiRequest(wasEditing ? `/hr/house-assignment/${form.assignment_id}` : '/hr/house-assignment', currentUser.accessToken, {
        method: wasEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          employee_id: form.employee_id,
          house_id: form.house_id,
          assignment_date: form.assignment_date,
          end_date: form.end_date || null,
          assigned_by: form.assigned_by || (wasEditing ? null : currentUser.user_id) || null,
          remarks: form.remarks || null,
          allow_overlap: form.allow_overlap,
          prevent_employee_overlap: form.prevent_employee_overlap,
          prevent_house_overlap: form.prevent_house_overlap,
          ...(wasEditing
            ? { modified_by: currentUser.user_id || null, row_version: form.row_version || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
    }, wasEditing ? 'House assignment updated successfully.' : 'House assignment created successfully.');
  }

  async function deleteRow(row) {
    if (!window.confirm('Delete this house assignment?')) return;
    await runAction(async () => {
      await apiRequest(`/hr/house-assignment/${row.assignment_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.assignment_id === row.assignment_id) setForm(emptyForm);
    }, 'House assignment deleted successfully.');
  }

  async function restoreRow(row) {
    if (!window.confirm('Restore this house assignment?')) return;
    await runAction(async () => {
      await apiRequest(`/hr/house-assignment/${row.assignment_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
    }, 'House assignment restored successfully.');
  }

  async function endRow(row) {
    if (!window.confirm('End this house assignment today?')) return;
    await runAction(async () => {
      await apiRequest(`/hr/house-assignment/${row.assignment_id}/end`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
    }, 'House assignment ended successfully.');
  }

  const checkboxClass = 'h-4 w-4 accent-[#0f8b3d]';

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">HR Employee House Assignment</h2>
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Employee</span><select required value={form.employee_id} onChange={(event) => updateField('employee_id', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select employee</option>{employees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_code} - {row.full_name || `${row.first_name} ${row.last_name}`}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required value={form.house_id} onChange={(event) => updateField('house_id', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select house</option>{houses.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Assignment date</span><input required type="date" value={form.assignment_date} onChange={(event) => updateField('assignment_date', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">End date</span><input type="date" value={form.end_date} onChange={(event) => updateField('end_date', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[#374744]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_overlap} onChange={(event) => updateField('allow_overlap', event.target.checked)} className={checkboxClass} />Allow overlap for same employee and house</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.prevent_employee_overlap} onChange={(event) => updateField('prevent_employee_overlap', event.target.checked)} className={checkboxClass} />Employee cannot be in another house in this range</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.prevent_house_overlap} onChange={(event) => updateField('prevent_house_overlap', event.target.checked)} className={checkboxClass} />House cannot have another employee in this range</label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {isEditing && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save assignment'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">House Assignments</h3>
          <div className="flex gap-4 text-sm font-medium text-[#374744]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={currentOnly} onChange={(event) => setCurrentOnly(event.target.checked)} className={checkboxClass} />Current only</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className={checkboxClass} />Include deleted</label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Employee</th><th className="px-2 py-2">House</th><th className="px-2 py-2">Assignment date</th><th className="px-2 py-2">End date</th><th className="px-2 py-2">Assigned by</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-2 py-6 text-center text-[#5d6d68]">Loading assignments...</td></tr> : rows.length === 0 ? <tr><td colSpan="7" className="px-2 py-6 text-center text-[#5d6d68]">No house assignments found.</td></tr> : rows.map((row) => {
                const status = assignmentStatus(row);
                return (
                  <tr key={row.assignment_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2">{employeeLabel(row.employee_id)}</td>
                    <td className="px-2 py-2">{houseLabel(row.house_id)}</td>
                    <td className="px-2 py-2">{toDateInput(row.assignment_date)}</td>
                    <td className="px-2 py-2">{toDateInput(row.end_date) || '-'}</td>
                    <td className="px-2 py-2">{userById.get(row.assigned_by)?.username || '-'}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        {!row.is_deleted && <button type="button" disabled={saving} onClick={() => { setForm(toForm(row)); setError(''); setMessage(''); }} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>}
                        {!row.is_deleted && !row.end_date && <button type="button" disabled={saving} onClick={() => endRow(row)} className="rounded-lg border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">End</button>}
                        {!row.is_deleted && <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
                        {row.is_deleted && <button type="button" disabled={saving} onClick={() => restoreRow(row)} className="rounded-lg border border-[#bfe5ca] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#ecf8f0] disabled:opacity-50">Restore</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
