import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function apiRequest(path, accessToken) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AuditLogManagement({ currentUser }) {
  const [auditRows, setAuditRows] = useState([]);
  const [errorRows, setErrorRows] = useState([]);
  const [loginRows, setLoginRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [auditPayload, errorPayload, loginPayload] = await Promise.all([
        apiRequest('/audit/log?page_number=1&page_size=10', currentUser.accessToken),
        apiRequest('/audit/error?page_number=1&page_size=10', currentUser.accessToken),
        apiRequest('/audit/login-history?page_number=1&page_size=10', currentUser.accessToken),
      ]);
      setAuditRows(Array.isArray(auditPayload.data) ? auditPayload.data : []);
      setErrorRows(Array.isArray(errorPayload.data) ? errorPayload.data : []);
      setLoginRows(Array.isArray(loginPayload.data) ? loginPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setAuditRows([]);
      setErrorRows([]);
      setLoginRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Audit Logs</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">View audit, error, and login history records.</p>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f4f7f5] disabled:opacity-50">{loading ? 'Loading...' : 'Refresh'}</button>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="space-y-5">
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Audit Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Action</th><th className="px-3 py-3 font-semibold">Entity</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Details</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">Loading audit logs...</td></tr> : auditRows.length === 0 ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">No audit logs found.</td></tr> : auditRows.map((row) => (
                  <tr key={row.audit_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                    <td className="px-3 py-3">{formatDate(row.created_date)}</td>
                    <td className="px-3 py-3">{row.action_type}</td>
                    <td className="px-3 py-3">{row.entity_type}</td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-3 py-3">{row.action_details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Error Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Time</th><th className="px-3 py-3 font-semibold">Level</th><th className="px-3 py-3 font-semibold">Source</th><th className="px-3 py-3 font-semibold">Message</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="px-3 py-8 text-center text-[#5d6d68]">Loading error logs...</td></tr> : errorRows.length === 0 ? <tr><td colSpan="4" className="px-3 py-8 text-center text-[#5d6d68]">No error logs found.</td></tr> : errorRows.map((row) => (
                  <tr key={row.error_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                    <td className="px-3 py-3">{formatDate(row.error_time || row.created_date)}</td>
                    <td className="px-3 py-3">{row.level}</td>
                    <td className="px-3 py-3">{row.source || '—'}</td>
                    <td className="px-3 py-3">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Login History</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Time</th><th className="px-3 py-3 font-semibold">Username</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">IP</th><th className="px-3 py-3 font-semibold">Failure Reason</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">Loading login history...</td></tr> : loginRows.length === 0 ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">No login history found.</td></tr> : loginRows.map((row) => (
                  <tr key={row.login_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                    <td className="px-3 py-3">{formatDate(row.login_time || row.created_date)}</td>
                    <td className="px-3 py-3">{row.username}</td>
                    <td className="px-3 py-3">{row.login_status}</td>
                    <td className="px-3 py-3">{row.ip_address || '—'}</td>
                    <td className="px-3 py-3">{row.failure_reason || '—'}</td>
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
