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

export default function AlertLogManagement({ currentUser }) {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', alert_severity: '', is_resolved: 'all' });

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.alert_severity) params.set('alert_severity', filters.alert_severity);
      if (filters.is_resolved !== 'all') params.set('is_resolved', filters.is_resolved);
      const payload = await apiRequest(`/alert/log?${params.toString()}`, currentUser.accessToken);
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setTotalCount(payload.totalCount ?? 0);
    } catch (requestError) {
      setError(requestError.message);
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, page]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Alert Logs</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">View and filter alert log history.</p>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f4f7f5] disabled:opacity-50">{loading ? 'Loading...' : 'Refresh'}</button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input value={filters.search} onChange={(e) => { setFilters((c) => ({ ...c, search: e.target.value })); setPage(1); }} placeholder="Search message or ID" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.alert_severity} onChange={(e) => { setFilters((c) => ({ ...c, alert_severity: e.target.value })); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="">All severities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
          <select value={filters.is_resolved} onChange={(e) => { setFilters((c) => ({ ...c, is_resolved: e.target.value })); setPage(1); }} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
            <option value="all">All states</option><option value="true">Resolved</option><option value="false">Pending</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-3 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Severity</th><th className="px-3 py-3 font-semibold">Message</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Flock</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">Loading alert logs...</td></tr> : items.length === 0 ? <tr><td colSpan="5" className="px-3 py-8 text-center text-[#5d6d68]">No alert logs found.</td></tr> : items.map((item) => (
                <tr key={item.alert_log_id} className="border-b border-[#f0f3f1] text-[#30433f]">
                  <td className="px-3 py-3">{formatDate(item.alert_date || item.created_date)}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-[#f4f7f5] px-2 py-1 text-xs font-semibold">{item.alert_severity}</span></td>
                  <td className="px-3 py-3">{item.alert_message}</td>
                  <td className="px-3 py-3">{item.resolution_status || (item.is_resolved ? 'Resolved' : 'Pending')}</td>
                  <td className="px-3 py-3 font-mono text-xs">{item.flock_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#5d6d68]">
          <span>{totalCount} alert log{totalCount === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
