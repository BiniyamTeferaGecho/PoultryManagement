import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysIso(baseIso, days) {
  const date = new Date(baseIso);
  if (Number.isNaN(date.getTime())) return baseIso;
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function MortalityReportManagement({ currentUser }) {
  const { showError } = useGlobalPopup();
  const defaultToDate = todayIso();
  const defaultFromDate = addDaysIso(defaultToDate, -30);

  const [flocks, setFlocks] = useState([]);
  const [rows, setRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    flock_id: '',
    from_date: defaultFromDate,
    to_date: defaultToDate,
    include_negative_alert: true,
  });
  const [sortBy, setSortBy] = useState('flock_number');
  const [sortDirection, setSortDirection] = useState('asc');

  const loadReport = useCallback(async (nextFilters, initialLoad = false) => {
    if (!currentUser.accessToken) return;
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const baseParams = new URLSearchParams();
      if (nextFilters.flock_id) baseParams.set('flock_id', nextFilters.flock_id);
      if (nextFilters.from_date) baseParams.set('from_date', nextFilters.from_date);
      if (nextFilters.to_date) baseParams.set('to_date', nextFilters.to_date);

      // Always load the full dataset for cards/table; do not let alert mode filter out normal rows.
      const dataParams = new URLSearchParams(baseParams.toString());
      dataParams.set('include_negative_alert', '0');

      const alertParams = new URLSearchParams(baseParams.toString());
      alertParams.set('include_negative_alert', '1');

      const requests = [
        apiRequest(`/production/reports/flock-mortality-live?${dataParams.toString()}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
      ];

      if (nextFilters.include_negative_alert) {
        requests.push(apiRequest(`/production/reports/flock-mortality-live?${alertParams.toString()}`, currentUser.accessToken));
      }

      const [reportPayload, flockPayload, alertPayload] = await Promise.all(requests);

      setRows(Array.isArray(reportPayload.data) ? reportPayload.data : []);
      setAlerts(nextFilters.include_negative_alert && Array.isArray(alertPayload?.alerts) ? alertPayload.alerts : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
    } catch (error) {
      setRows([]);
      setAlerts([]);
      showError(error.message || 'Unable to load mortality report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.accessToken, showError]);

  useEffect(() => {
    loadReport(filters, true);
  }, [loadReport]);

  const sortedRows = useMemo(() => {
    const copied = [...rows];
    copied.sort((left, right) => {
      const leftValue = left?.[sortBy];
      const rightValue = right?.[sortBy];
      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        const leftText = String(leftValue || '');
        const rightText = String(rightValue || '');
        const result = leftText.localeCompare(rightText);
        return sortDirection === 'asc' ? result : -result;
      }
      const result = toNumber(leftValue) - toNumber(rightValue);
      return sortDirection === 'asc' ? result : -result;
    });
    return copied;
  }, [rows, sortBy, sortDirection]);

  const totals = useMemo(() => {
    return sortedRows.reduce((summary, row) => ({
      openingMale: summary.openingMale + toNumber(row.opening_male),
      openingFemale: summary.openingFemale + toNumber(row.opening_female),
      mortalityMale: summary.mortalityMale + toNumber(row.total_approved_male_mortality),
      mortalityFemale: summary.mortalityFemale + toNumber(row.total_approved_female_mortality),
      currentMale: summary.currentMale + toNumber(row.current_male),
      currentFemale: summary.currentFemale + toNumber(row.current_female),
      currentLive: summary.currentLive + toNumber(row.current_live_flock),
      negativeFlags: summary.negativeFlags + (row.has_negative_population_flag ? 1 : 0),
    }), {
      openingMale: 0,
      openingFemale: 0,
      mortalityMale: 0,
      mortalityFemale: 0,
      currentMale: 0,
      currentFemale: 0,
      currentLive: 0,
      negativeFlags: 0,
    });
  }, [sortedRows]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    loadReport(filters, false);
  }

  function resetToLast30Days() {
    const next = {
      flock_id: '',
      from_date: defaultFromDate,
      to_date: defaultToDate,
      include_negative_alert: true,
    };
    setFilters(next);
    loadReport(next, false);
  }

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(column);
    setSortDirection('asc');
  }

  function downloadTextFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const header = [
      'Flock',
      'Opening Female',
      'Opening Male',
      'Mortality Female',
      'Mortality Male',
      'Current Female',
      'Current Male',
      'Current Total',
      'Status',
    ];
    const lines = [header.map(escapeCsvCell).join(',')];

    sortedRows.forEach((row) => {
      lines.push([
        row.flock_number || row.flock_id,
        toNumber(row.opening_female),
        toNumber(row.opening_male),
        toNumber(row.total_approved_female_mortality),
        toNumber(row.total_approved_male_mortality),
        toNumber(row.current_female),
        toNumber(row.current_male),
        toNumber(row.current_live_flock),
        row.has_negative_population_flag ? 'Warning' : 'OK',
      ].map(escapeCsvCell).join(','));
    });

    if (filters.include_negative_alert && alerts.length > 0) {
      lines.push('');
      lines.push('Data Integrity Alerts');
      lines.push([
        'Severity',
        'Flock',
        'Opening Male',
        'Mortality Male',
        'Opening Female',
        'Mortality Female',
        'Message',
      ].join(','));
      alerts.forEach((alert) => {
        lines.push([
          alert.severity || 'WARNING',
          alert.flock_number || alert.flock_id,
          toNumber(alert.opening_male),
          toNumber(alert.total_approved_male_mortality),
          toNumber(alert.opening_female),
          toNumber(alert.total_approved_female_mortality),
          alert.message || 'Approved mortality exceeds opening population',
        ].map(escapeCsvCell).join(','));
      });
    }

    const stamp = `${todayIso()}-${Date.now()}`;
    downloadTextFile(`mortality-report-${stamp}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  }

  function exportPrintView() {
    const reportRows = sortedRows.map((row) => `
      <tr>
        <td>${row.flock_number || row.flock_id || ''}</td>
        <td>${toNumber(row.opening_female).toLocaleString()}</td>
        <td>${toNumber(row.opening_male).toLocaleString()}</td>
        <td>${toNumber(row.total_approved_female_mortality).toLocaleString()}</td>
        <td>${toNumber(row.total_approved_male_mortality).toLocaleString()}</td>
        <td>${toNumber(row.current_female).toLocaleString()}</td>
        <td>${toNumber(row.current_male).toLocaleString()}</td>
        <td>${toNumber(row.current_live_flock).toLocaleString()}</td>
        <td>${row.has_negative_population_flag ? 'Warning' : 'OK'}</td>
      </tr>
    `).join('');

    const alertRows = alerts.map((alert) => `
      <tr>
        <td>${alert.severity || 'WARNING'}</td>
        <td>${alert.flock_number || alert.flock_id || ''}</td>
        <td>${toNumber(alert.opening_male).toLocaleString()}</td>
        <td>${toNumber(alert.total_approved_male_mortality).toLocaleString()}</td>
        <td>${toNumber(alert.opening_female).toLocaleString()}</td>
        <td>${toNumber(alert.total_approved_female_mortality).toLocaleString()}</td>
        <td>${alert.message || 'Approved mortality exceeds opening population'}</td>
      </tr>
    `).join('');

    const reportWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!reportWindow) {
      showError('Popup was blocked. Please allow popups to export PDF.');
      return;
    }

    reportWindow.document.write(`
      <html>
      <head>
        <title>Mortality Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #1f2d2a; }
          h1 { margin: 0 0 8px; }
          .meta { margin-bottom: 12px; font-size: 12px; color: #465a56; }
          .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
          .card { border: 1px solid #dfe8e1; border-radius: 8px; padding: 8px; }
          .card .label { font-size: 11px; color: #5d6d68; }
          .card .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #dfe8e1; padding: 6px 8px; font-size: 12px; text-align: left; }
          th { background: #f6faf7; }
          .warning { color: #d45745; font-weight: 700; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>Mortality Report</h1>
        <div class="meta">
          Date range: ${filters.from_date || '-'} to ${filters.to_date || '-'}<br/>
          Flock: ${filters.flock_id || 'All flocks'}<br/>
          Generated at: ${new Date().toLocaleString()}
        </div>

        <div class="cards">
          <div class="card"><div class="label">Current Live Total</div><div class="value">${totals.currentLive.toLocaleString()}</div></div>
          <div class="card"><div class="label">Current Female</div><div class="value">${totals.currentFemale.toLocaleString()}</div></div>
          <div class="card"><div class="label">Current Male</div><div class="value">${totals.currentMale.toLocaleString()}</div></div>
          <div class="card"><div class="label">Negative Flags</div><div class="value">${totals.negativeFlags.toLocaleString()}</div></div>
        </div>

        <h2>Mortality and Live Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Flock</th>
              <th>Opening F</th>
              <th>Opening M</th>
              <th>Mortality F</th>
              <th>Mortality M</th>
              <th>Current F</th>
              <th>Current M</th>
              <th>Current Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${reportRows || '<tr><td colspan="9">No data</td></tr>'}</tbody>
        </table>

        ${filters.include_negative_alert && alerts.length > 0 ? `
          <h2>Data Integrity Alerts</h2>
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Flock</th>
                <th>Opening M</th>
                <th>Mortality M</th>
                <th>Opening F</th>
                <th>Mortality F</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>${alertRows}</tbody>
          </table>
        ` : ''}

        <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
      </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Mortality Report</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Interactive mortality and live flock report for management reviews.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} disabled={loading || refreshing} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-xs font-semibold text-[#35524a] hover:bg-[#f3faf6] disabled:opacity-50">Export CSV</button>
          <button type="button" onClick={exportPrintView} disabled={loading || refreshing} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-xs font-semibold text-[#35524a] hover:bg-[#f3faf6] disabled:opacity-50">Export PDF</button>
          <button type="button" onClick={() => {
            const next = { ...filters, from_date: addDaysIso(defaultToDate, -7), to_date: defaultToDate };
            setFilters(next);
            loadReport(next, false);
          }} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-xs font-semibold text-[#35524a] hover:bg-[#f3faf6]">Last 7 days</button>
          <button type="button" onClick={resetToLast30Days} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-xs font-semibold text-[#35524a] hover:bg-[#f3faf6]">Last 30 days</button>
          <button type="button" onClick={() => {
            const next = { ...filters, from_date: addDaysIso(defaultToDate, -90), to_date: defaultToDate };
            setFilters(next);
            loadReport(next, false);
          }} className="rounded-lg border border-[#dfe8e1] px-3 py-2 text-xs font-semibold text-[#35524a] hover:bg-[#f3faf6]">Last 90 days</button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="text-sm font-medium text-[#374744] md:col-span-2">
            <span className="mb-1 block">Flock</span>
            <select value={filters.flock_id} onChange={(event) => updateFilter('flock_id', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">All flocks</option>
              {flocks.map((flock) => <option key={flock.flock_id} value={flock.flock_id}>{flock.flock_number}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">From</span>
            <input type="date" value={filters.from_date} onChange={(event) => updateFilter('from_date', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">To</span>
            <input type="date" value={filters.to_date} onChange={(event) => updateFilter('to_date', event.target.value)} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-[#374744]">
            <input type="checkbox" checked={filters.include_negative_alert} onChange={(event) => updateFilter('include_negative_alert', event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />
            Include negative alerts
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={resetToLast30Days} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5]">Reset</button>
          <button type="button" onClick={applyFilters} disabled={refreshing} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{refreshing ? 'Loading...' : 'Apply filters'}</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm"><div className="text-xs text-[#5d6d68]">Current Live Total</div><div className="mt-2 text-2xl font-bold text-[#1f2d2a]">{totals.currentLive.toLocaleString()}</div></div>
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm"><div className="text-xs text-[#5d6d68]">Current Female</div><div className="mt-2 text-2xl font-bold text-[#1f2d2a]">{totals.currentFemale.toLocaleString()}</div></div>
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm"><div className="text-xs text-[#5d6d68]">Current Male</div><div className="mt-2 text-2xl font-bold text-[#1f2d2a]">{totals.currentMale.toLocaleString()}</div></div>
        <div className="rounded-2xl border border-[#f2d4cf] bg-[#fff7f6] p-4 shadow-sm"><div className="text-xs text-[#b35c4e]">Negative Population Flags</div><div className="mt-2 text-2xl font-bold text-[#d45745]">{totals.negativeFlags.toLocaleString()}</div></div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Mortality and Live Summary</h3>
          <div className="text-xs text-[#5d6d68]">{sortedRows.length.toLocaleString()} flock records</div>
        </div>
        {loading ? <p className="text-sm text-[#5d6d68]">Loading report...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-250 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('flock_number')} className="font-semibold hover:text-[#1f2d2a]">Flock</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('opening_female')} className="font-semibold hover:text-[#1f2d2a]">Opening F</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('opening_male')} className="font-semibold hover:text-[#1f2d2a]">Opening M</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('total_approved_female_mortality')} className="font-semibold hover:text-[#1f2d2a]">Mortality F</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('total_approved_male_mortality')} className="font-semibold hover:text-[#1f2d2a]">Mortality M</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('current_female')} className="font-semibold hover:text-[#1f2d2a]">Current F</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('current_male')} className="font-semibold hover:text-[#1f2d2a]">Current M</button></th>
                  <th className="px-2 py-2"><button type="button" onClick={() => toggleSort('current_live_flock')} className="font-semibold hover:text-[#1f2d2a]">Current Total</button></th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.flock_id} className={`border-b border-[#f0f3f1] ${row.has_negative_population_flag ? 'bg-red-50/40' : ''}`}>
                    <td className="px-2 py-2 font-mono text-xs">{row.flock_number || row.flock_id}</td>
                    <td className="px-2 py-2">{toNumber(row.opening_female).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.opening_male).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.total_approved_female_mortality).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.total_approved_male_mortality).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.current_female).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(row.current_male).toLocaleString()}</td>
                    <td className="px-2 py-2 font-semibold">{toNumber(row.current_live_flock).toLocaleString()}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.has_negative_population_flag ? 'bg-red-100 text-red-700' : 'bg-[#eafaf0] text-[#198754]'}`}>
                        {row.has_negative_population_flag ? 'Warning' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && <tr><td colSpan="9" className="px-2 py-5 text-center text-sm text-[#6d7a76]">No mortality data found for selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filters.include_negative_alert && alerts.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#f2d4cf] bg-[#fff7f6] p-4 shadow-sm">
          <h3 className="text-lg font-bold text-[#7d3529]">Data Integrity Alerts</h3>
          <p className="mt-1 text-sm text-[#9a4f41]">Flocks where approved mortality exceeds opening population.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-200 text-left text-sm">
              <thead>
                <tr className="border-b border-[#f5d8d2] text-[#8c4a3d]">
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Flock</th>
                  <th className="px-2 py-2">Opening M</th>
                  <th className="px-2 py-2">Mortality M</th>
                  <th className="px-2 py-2">Opening F</th>
                  <th className="px-2 py-2">Mortality F</th>
                  <th className="px-2 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={`${alert.flock_id}-${alert.message}`} className="border-b border-[#fae2dd]">
                    <td className="px-2 py-2 font-semibold text-red-700">{alert.severity || 'WARNING'}</td>
                    <td className="px-2 py-2 font-mono text-xs">{alert.flock_number || alert.flock_id}</td>
                    <td className="px-2 py-2">{toNumber(alert.opening_male).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(alert.total_approved_male_mortality).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(alert.opening_female).toLocaleString()}</td>
                    <td className="px-2 py-2">{toNumber(alert.total_approved_female_mortality).toLocaleString()}</td>
                    <td className="px-2 py-2">{alert.message || 'Approved mortality exceeds opening population'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
