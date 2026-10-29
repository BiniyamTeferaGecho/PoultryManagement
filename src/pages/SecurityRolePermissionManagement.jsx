import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

export default function SecurityRolePermissionManagement({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    role_id: '',
    permission_id: '',
    include_inactive: false,
  });
  const [assignData, setAssignData] = useState({
    role_id: '',
    permission_id: '',
    is_active: true,
  });

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page_number: String(page),
        page_size: '20',
        include_inactive: filters.include_inactive ? '1' : '0',
      });
      if (filters.role_id) params.set('role_id', filters.role_id);
      if (filters.permission_id) params.set('permission_id', filters.permission_id);

      const [rolePayload, permissionPayload, assignmentPayload] = await Promise.all([
        apiRequest('/security/role?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/security/permission?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest(`/security/role-permission?${params.toString()}`, currentUser.accessToken),
      ]);

      const roleList = Array.isArray(rolePayload.data) ? rolePayload.data : [];
      const permissionList = Array.isArray(permissionPayload.data) ? permissionPayload.data : [];
      setRoles(roleList);
      setPermissions(permissionList);
      setRows(Array.isArray(assignmentPayload.data) ? assignmentPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters.include_inactive, filters.permission_id, filters.role_id, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function assignPermission(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/security/role-permission/assign', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          role_id: assignData.role_id,
          permission_id: assignData.permission_id,
          is_active: assignData.is_active,
          assigned_by: currentUser.user_id || null,
          created_by: currentUser.user_id || null,
        }),
      });
      setMessage('Permission assigned to role successfully.');
      setAssignData({ role_id: '', permission_id: '', is_active: true });
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function revokePermission(row) {
    if (!window.confirm(`Revoke permission ${row.permission_code} from role ${row.role_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/security/role-permission/revoke', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          role_permission_id: row.role_permission_id,
          modified_by: currentUser.user_id || null,
        }),
      });
      setMessage('Role permission revoked successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1f2d2a]">Role Permission Assignment</h2>
        <p className="mt-1 text-sm text-[#5d6d68]">Assign and revoke permissions for roles.</p>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <form onSubmit={assignPermission} className="mb-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Assign permission</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select required value={assignData.role_id} onChange={(event) => setAssignData((current) => ({ ...current, role_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">Select role</option>
            {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.display_name || role.role_name}</option>)}
          </select>
          <select required value={assignData.permission_id} onChange={(event) => setAssignData((current) => ({ ...current, permission_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">Select permission</option>
            {permissions.map((permission) => <option key={permission.permission_id} value={permission.permission_id}>{permission.permission_code} - {permission.permission_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={assignData.is_active} onChange={(event) => setAssignData((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
            Active assignment
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Assign permission'}</button>
        </div>
      </form>

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={filters.role_id} onChange={(event) => { setFilters((current) => ({ ...current, role_id: event.target.value })); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">All roles</option>
            {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.display_name || role.role_name}</option>)}
          </select>
          <select value={filters.permission_id} onChange={(event) => { setFilters((current) => ({ ...current, permission_id: event.target.value })); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">All permissions</option>
            {permissions.map((permission) => <option key={permission.permission_id} value={permission.permission_id}>{permission.permission_code} - {permission.permission_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={filters.include_inactive} onChange={(event) => { setFilters((current) => ({ ...current, include_inactive: event.target.checked })); setPage(1); }} className="h-4 w-4 accent-[#0f8b3d]" />
            Include inactive
          </label>
          <button type="button" onClick={loadData} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Refresh</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Permission</th><th className="px-3 py-3 font-semibold">Assigned By</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">Loading assignments...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">No assignments found.</td></tr> : rows.map((row) => (
                <tr key={row.role_permission_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3">{row.role_display_name || row.role_name}</td>
                  <td className="px-3 py-3">{row.permission_code} - {row.permission_name}</td>
                  <td className="px-3 py-3">{row.assigned_by_username || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" disabled={saving || !row.is_active} onClick={() => revokePermission(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2 text-sm text-[#5d6d68]">
          <button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
          <span className="px-2 py-1.5">Page {page}</span>
          <button type="button" disabled={loading || rows.length < 20} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
