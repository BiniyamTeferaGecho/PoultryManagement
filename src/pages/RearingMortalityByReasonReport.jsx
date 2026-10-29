import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

async function apiRequest(path, accessToken) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

export default function RearingMortalityByReasonReport({ currentUser }) {
  const { showError } = useGlobalPopup();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flocks, setFlocks] = useState([]);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    flock_id: '',
    from_date: '',
    to_date: '',
  });

  const loadReport = useCallback(async (nextFilters, initialLoad = false) => {
    if (!currentUser.accessToken) return;
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (nextFilters.flock_id) params.set('flock_id', nextFilters.flock_id);
      if (nextFilters.from_date) params.set('from_date', nextFilters.from_date);
      if (nextFilters.to_date) params.set('to_date', nextFilters.to_date);

      const [reportPayload, flockPayload] = await Promise.all([
        apiRequest(`/rearing/reports/mortality-by-reason?${params.toString()}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
      ]);

      setRows(Array.isArray(reportPayload.data) ? reportPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
    } catch (error) {
      setRows([]);
      showError(error.message || 'Unable to load rearing mortality-by-reason report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.accessToken, showError]);

  useEffect(() => {
    loadReport(filters, true);
  }, [loadReport]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    loadReport(filters, false);
  }

  function resetFilters() {
    const next = {
      flock_id: '',
      from_date: '',
      to_date: '',
    };
    setFilters(next);
    loadReport(next, false);
  }

  const totals = useMemo(() => {
    return rows.reduce((summary, row) => ({
      occurrences: summary.occurrences + toNumber(row.occurrences),
      females: summary.females + toNumber(row.total_females),
      males: summary.males + toNumber(row.total_males),
      deaths: summary.deaths + toNumber(row.total_deaths),
    }), {
      occurrences: 0,
      females: 0,
      males: 0,
      deaths: 0,
    });
  }, [rows]);

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Rearing Mortality By Reason Report</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Approved rearing mortality grouped by reason and flock.</p>

      <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Flock</span>
            <select
              value={filters.flock_id}
              onChange={(event) => updateFilter('flock_id', event.target.value)}
              className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"
            >
              <option value="">All flocks</option>
              {flocks.map((row) => (
                <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">From date</span>
            <input
              type="date"
              value={filters.from_date}
              onChange={(event) => updateFilter('from_date', event.target.value)}
              className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
            />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">To date</span>
            <input
              type="date"
              value={filters.to_date}
              onChange={(event) => updateFilter('to_date', event.target.value)}
              className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              disabled={refreshing}
              className="h-11 flex-1 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={refreshing}
              className="h-11 rounded-xl border border-[#dfe8e1] px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
          <div className="text-xs font-medium text-[#6b7a76]">Total Occurrences</div>
          <div className="mt-1 text-xl font-bold text-[#1f2d2a]">{totals.occurrences.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
          <div className="text-xs font-medium text-[#6b7a76]">Female Deaths</div>
          <div className="mt-1 text-xl font-bold text-[#1f2d2a]">{totals.females.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
          <div className="text-xs font-medium text-[#6b7a76]">Male Deaths</div>
          <div className="mt-1 text-xl font-bold text-[#1f2d2a]">{totals.males.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-[#e3ebea] bg-white p-3 shadow-sm">
          <div className="text-xs font-medium text-[#6b7a76]">Total Deaths</div>
          <div className="mt-1 text-xl font-bold text-[#1f2d2a]">{totals.deaths.toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-[#1f2d2a]">By Reason</h3>
        {loading ? <p className="mt-3 text-sm text-[#5d6d68]">Loading report...</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-280 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2">Flock</th>
                  <th className="px-2 py-2">Reason Code</th>
                  <th className="px-2 py-2">Reason Name</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Occurrences</th>
                  <th className="px-2 py-2">Female Deaths</th>
                  <th className="px-2 py-2">Male Deaths</th>
                  <th className="px-2 py-2">Total Deaths</th>
                  <th className="px-2 py-2">First</th>
                  <th className="px-2 py-2">Last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.flock_id}-${row.mortality_reason_id || 'none'}-${index}`} className="border-b border-[#eef3f0]">
                    <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                    <td className="px-2 py-2">{row.reason_code || 'N/A'}</td>
                    <td className="px-2 py-2">{row.reason_name || 'Unknown reason'}</td>
                    <td className="px-2 py-2">{row.reason_category || 'General'}</td>
                    <td className="px-2 py-2">{toNumber(row.occurrences).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.total_females).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.total_males).toLocaleString()}</td>
                    <td className="px-2 py-2 font-semibold text-[#7a2f2f]">{toNumber(row.total_deaths).toLocaleString()}</td>
                    <td className="px-2 py-2">{toDateInput(row.first_occurrence)}</td>
                    <td className="px-2 py-2">{toDateInput(row.last_occurrence)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-2 py-6 text-center text-[#5d6d68]">No records found for selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
