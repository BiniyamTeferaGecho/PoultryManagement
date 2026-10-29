import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalPopup } from '../context/GlobalPopupContext';
import alemaLogo from '../assets/images/alemalogo.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function apiRequest(path, accessToken) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

function metricValue(source, keys) {
  const key = keys.find((candidate) => source?.[candidate] !== undefined && source?.[candidate] !== null);
  return toNumber(key ? source[key] : 0);
}

export default function VaccinationReportManagement({ currentUser }) {
  const { showError } = useGlobalPopup();
  const defaultToDate = todayIso();
  const defaultFromDate = addDaysIso(defaultToDate, -30);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingFlockReport, setPrintingFlockReport] = useState(false);
  const [flocks, setFlocks] = useState([]);
  const [dashboardTotals, setDashboardTotals] = useState(null);
  const [byVaccine, setByVaccine] = useState([]);
  const [flockSummaryRows, setFlockSummaryRows] = useState([]);
  const [filters, setFilters] = useState({
    flock_id: '',
    from_date: defaultFromDate,
    to_date: defaultToDate,
  });

  const loadReport = useCallback(async (nextFilters, initialLoad = false) => {
    if (!currentUser.accessToken) return;
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (nextFilters.from_date) params.set('from_date', nextFilters.from_date);
      if (nextFilters.to_date) params.set('to_date', nextFilters.to_date);
      const query = params.toString();

      const requests = [
        apiRequest(`/vaccination/reports/dashboard${query ? `?${query}` : ''}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
      ];

      if (nextFilters.flock_id) {
        requests.push(apiRequest(`/vaccination/reports/flock/${nextFilters.flock_id}/summary`, currentUser.accessToken));
      }

      const [dashboardPayload, flockPayload, flockSummaryPayload] = await Promise.all(requests);

      const dashboard = dashboardPayload.data || {};
      setDashboardTotals(dashboard.totals || null);
      setByVaccine(Array.isArray(dashboard.byVaccine) ? dashboard.byVaccine : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFlockSummaryRows(nextFilters.flock_id && Array.isArray(flockSummaryPayload?.data) ? flockSummaryPayload.data : []);
    } catch (error) {
      setDashboardTotals(null);
      setByVaccine([]);
      setFlockSummaryRows([]);
      showError(error.message || 'Unable to load vaccination report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.accessToken, showError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport({
      flock_id: '',
      from_date: defaultFromDate,
      to_date: defaultToDate,
    }, true);
  }, [defaultFromDate, defaultToDate, loadReport]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    loadReport(filters, false);
  }

  function resetFilters() {
    const next = {
      flock_id: '',
      from_date: defaultFromDate,
      to_date: defaultToDate,
    };
    setFilters(next);
    loadReport(next, false);
  }

  const totals = useMemo(() => {
    const records = metricValue(dashboardTotals, ['total_records', 'total_vaccinations', 'vaccination_count']);
    const birds = metricValue(dashboardTotals, ['total_birds_vaccinated', 'total_birds', 'birds_vaccinated']);
    const boosters = metricValue(dashboardTotals, ['booster_records', 'total_boosters', 'booster_count']);
    const uniqueVaccines = metricValue(dashboardTotals, ['distinct_vaccines', 'unique_vaccines']);
    const fallbackBirds = byVaccine.reduce((sum, row) => sum + metricValue(row, ['total_birds_vaccinated', 'birds_vaccinated', 'total_birds']), 0);

    return {
      records,
      birds: birds || fallbackBirds,
      boosters,
      uniqueVaccines,
    };
  }, [dashboardTotals, byVaccine]);

  const normalizedByVaccine = useMemo(() => {
    return byVaccine.map((row) => ({
      vaccine: row.vaccine_name || row.vaccine || row.name || 'Unknown vaccine',
      records: metricValue(row, ['record_count', 'total_records', 'vaccination_count']),
      birds: metricValue(row, ['total_birds_vaccinated', 'birds_vaccinated', 'total_birds']),
      boosters: metricValue(row, ['booster_count', 'booster_records']),
      lastDate: toDateInput(row.last_vaccination_date || row.last_date || row.latest_vaccination_date),
    })).sort((left, right) => right.records - left.records);
  }, [byVaccine]);

  const flockLabel = useMemo(() => {
    if (!filters.flock_id) return 'All flocks';
    return flocks.find((row) => row.flock_id === filters.flock_id)?.flock_number || filters.flock_id;
  }, [filters.flock_id, flocks]);

  const summaryColumns = useMemo(() => {
    if (!flockSummaryRows.length) return [];
    return Object.keys(flockSummaryRows[0]);
  }, [flockSummaryRows]);

  function exportCsv() {
    const lines = [];
    lines.push(['Metric', 'Value'].join(','));
    lines.push(['Total Vaccination Records', totals.records].map(escapeCsvCell).join(','));
    lines.push(['Total Birds Vaccinated', totals.birds].map(escapeCsvCell).join(','));
    lines.push(['Booster Records', totals.boosters].map(escapeCsvCell).join(','));
    lines.push(['Unique Vaccines', totals.uniqueVaccines].map(escapeCsvCell).join(','));
    lines.push('');

    lines.push(['Vaccine', 'Records', 'Birds Vaccinated', 'Booster Records', 'Latest Vaccination'].join(','));
    normalizedByVaccine.forEach((row) => {
      lines.push([
        row.vaccine,
        row.records,
        row.birds,
        row.boosters,
        row.lastDate || '',
      ].map(escapeCsvCell).join(','));
    });

    if (filters.flock_id && summaryColumns.length > 0) {
      lines.push('');
      lines.push([`Flock Summary: ${flockLabel}`].map(escapeCsvCell).join(','));
      lines.push(summaryColumns.map((column) => escapeCsvCell(column.replaceAll('_', ' '))).join(','));
      flockSummaryRows.forEach((row) => {
        lines.push(summaryColumns.map((column) => escapeCsvCell(row[column])).join(','));
      });
    }

    const stamp = `${todayIso()}-${Date.now()}`;
    downloadTextFile(`vaccination-report-${stamp}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  }

  function exportPrintView() {
    const vaccineRows = normalizedByVaccine.map((row) => `
      <tr>
        <td>${escapeHtml(row.vaccine)}</td>
        <td>${row.records.toLocaleString()}</td>
        <td>${row.birds.toLocaleString()}</td>
        <td>${row.boosters.toLocaleString()}</td>
        <td>${escapeHtml(row.lastDate || '-')}</td>
      </tr>
    `).join('');

    const summaryHeader = summaryColumns.map((column) => `<th>${escapeHtml(column.replaceAll('_', ' '))}</th>`).join('');
    const summaryRows = flockSummaryRows.map((row) => `
      <tr>${summaryColumns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>
    `).join('');

    const reportWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!reportWindow) {
      showError('Popup was blocked. Please allow popups to export PDF.');
      return;
    }

    reportWindow.document.write(`
      <html>
      <head>
        <title>Vaccination Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #1f2d2a; }
          .report-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
          .report-logo { height: 52px; width: auto; object-fit: contain; }
          h1 { margin: 0 0 8px; }
          .meta { margin-bottom: 12px; font-size: 12px; color: #465a56; }
          .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
          .card { border: 1px solid #dfe8e1; border-radius: 8px; padding: 8px; }
          .card .label { font-size: 11px; color: #5d6d68; }
          .card .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #dfe8e1; padding: 6px 8px; font-size: 12px; text-align: left; }
          th { background: #f6faf7; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img class="report-logo" src="${escapeHtml(alemaLogo)}" alt="Alema Logo" />
          <h1>Vaccination Report</h1>
        </div>
        <div class="meta">
          Date range: ${escapeHtml(filters.from_date || '-')} to ${escapeHtml(filters.to_date || '-')}<br/>
          Flock: ${escapeHtml(flockLabel)}<br/>
          Generated at: ${escapeHtml(new Date().toLocaleString())}
        </div>
        <div class="cards">
          <div class="card"><div class="label">Total Records</div><div class="value">${totals.records.toLocaleString()}</div></div>
          <div class="card"><div class="label">Birds Vaccinated</div><div class="value">${totals.birds.toLocaleString()}</div></div>
          <div class="card"><div class="label">Booster Records</div><div class="value">${totals.boosters.toLocaleString()}</div></div>
          <div class="card"><div class="label">Unique Vaccines</div><div class="value">${totals.uniqueVaccines.toLocaleString()}</div></div>
        </div>
        <h2>Vaccination by Vaccine</h2>
        <table>
          <thead>
            <tr>
              <th>Vaccine</th>
              <th>Records</th>
              <th>Birds Vaccinated</th>
              <th>Booster Records</th>
              <th>Latest Vaccination</th>
            </tr>
          </thead>
          <tbody>${vaccineRows || '<tr><td colspan="5">No data</td></tr>'}</tbody>
        </table>
        ${filters.flock_id ? `
          <h2>Flock Summary (${escapeHtml(flockLabel)})</h2>
          <table>
            <thead><tr>${summaryHeader || '<th>No columns</th>'}</tr></thead>
            <tbody>${summaryRows || `<tr><td${summaryColumns.length > 1 ? ` colspan="${summaryColumns.length}"` : ''}>No data</td></tr>`}</tbody>
          </table>
        ` : ''}
        <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
      </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
  }

  async function printFlockCustomerReport() {
    if (!filters.flock_id) {
      showError('Please select a flock before printing the customer report.');
      return;
    }

    setPrintingFlockReport(true);
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.set('from_date', filters.from_date);
      if (filters.to_date) params.set('to_date', filters.to_date);

      const payload = await apiRequest(`/vaccination/flock/${filters.flock_id}?${params.toString()}`, currentUser.accessToken);
      const rows = Array.isArray(payload.data) ? payload.data : [];

      const totalsByFlock = rows.reduce((summary, row) => {
        const females = toNumber(row.birds_vaccinated_females);
        const males = toNumber(row.birds_vaccinated_males);
        return {
          records: summary.records + 1,
          females: summary.females + females,
          males: summary.males + males,
          totalBirds: summary.totalBirds + (toNumber(row.birds_vaccinated_total) || females + males),
          boosterRecords: summary.boosterRecords + (row.is_booster ? 1 : 0),
        };
      }, {
        records: 0,
        females: 0,
        males: 0,
        totalBirds: 0,
        boosterRecords: 0,
      });

      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(toDateInput(row.vaccination_date) || '-')}</td>
          <td>${escapeHtml(row.vaccine_name || '-')}</td>
          <td>${escapeHtml(row.vaccine_batch_number || '-')}</td>
          <td>${escapeHtml(row.administration_method || '-')}</td>
          <td>${escapeHtml(row.disease_prevention || '-')}</td>
          <td>${toNumber(row.birds_vaccinated_females).toLocaleString()}</td>
          <td>${toNumber(row.birds_vaccinated_males).toLocaleString()}</td>
          <td>${(toNumber(row.birds_vaccinated_total) || (toNumber(row.birds_vaccinated_females) + toNumber(row.birds_vaccinated_males))).toLocaleString()}</td>
          <td>${row.is_booster ? 'Yes' : 'No'}</td>
          <td>${escapeHtml(row.vaccinator_name || '-')}</td>
        </tr>
      `).join('');

      const reportWindow = window.open('', '_blank', 'width=1280,height=850');
      if (!reportWindow) {
        showError('Popup was blocked. Please allow popups to print customer report.');
        return;
      }

      reportWindow.document.write(`
        <html>
        <head>
          <title>Vaccination Report - ${escapeHtml(flockLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #1f2d2a; }
            .report-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
            .report-logo { height: 52px; width: auto; object-fit: contain; }
            h1 { margin: 0 0 8px; }
            h2 { margin: 20px 0 8px; }
            .meta { margin-bottom: 12px; font-size: 12px; color: #465a56; line-height: 1.6; }
            .customer-badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; border: 1px solid #a8cdb7; background: #eef9f2; font-size: 11px; font-weight: 700; color: #0f6a43; margin-bottom: 10px; }
            .cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
            .card { border: 1px solid #dfe8e1; border-radius: 8px; padding: 8px; }
            .card .label { font-size: 11px; color: #5d6d68; }
            .card .value { font-size: 18px; font-weight: 700; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #dfe8e1; padding: 6px 8px; font-size: 11px; text-align: left; }
            th { background: #f6faf7; font-weight: 700; }
            .no-print { margin-top: 12px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="customer-badge">Customer Copy</div>
          <div class="report-header">
            <img class="report-logo" src="${escapeHtml(alemaLogo)}" alt="Alema Logo" />
            <h1>Vaccination Report (Per Flock)</h1>
          </div>
          <div class="meta">
            Flock: <strong>${escapeHtml(flockLabel)}</strong><br/>
            Date range: ${escapeHtml(filters.from_date || '-')} to ${escapeHtml(filters.to_date || '-')}<br/>
            Generated at: ${escapeHtml(new Date().toLocaleString())}
          </div>
          <div class="cards">
            <div class="card"><div class="label">Vaccination Records</div><div class="value">${totalsByFlock.records.toLocaleString()}</div></div>
            <div class="card"><div class="label">Female Birds</div><div class="value">${totalsByFlock.females.toLocaleString()}</div></div>
            <div class="card"><div class="label">Male Birds</div><div class="value">${totalsByFlock.males.toLocaleString()}</div></div>
            <div class="card"><div class="label">Total Birds Vaccinated</div><div class="value">${totalsByFlock.totalBirds.toLocaleString()}</div></div>
            <div class="card"><div class="label">Booster Records</div><div class="value">${totalsByFlock.boosterRecords.toLocaleString()}</div></div>
          </div>
          <h2>Vaccination Details</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vaccine</th>
                <th>Batch No.</th>
                <th>Method</th>
                <th>Disease Prevention</th>
                <th>Female Birds</th>
                <th>Male Birds</th>
                <th>Total Birds</th>
                <th>Booster</th>
                <th>Vaccinator</th>
              </tr>
            </thead>
            <tbody>${tableRows || '<tr><td colspan="10">No vaccination records found for this flock and date range.</td></tr>'}</tbody>
          </table>
          <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
        </body>
        </html>
      `);
      reportWindow.document.close();
      reportWindow.focus();
    } catch (error) {
      showError(error.message || 'Unable to print flock vaccination report.');
    } finally {
      setPrintingFlockReport(false);
    }
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Vaccination Report</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Track vaccination activity, bird coverage, and booster patterns by period and flock.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || (normalizedByVaccine.length === 0 && flockSummaryRows.length === 0)}
            className="h-10 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportPrintView}
            disabled={loading || (normalizedByVaccine.length === 0 && flockSummaryRows.length === 0)}
            className="h-10 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={printFlockCustomerReport}
            disabled={loading || refreshing || printingFlockReport || !filters.flock_id}
            className="h-10 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {printingFlockReport ? 'Preparing...' : 'Print Flock Report'}
          </button>
        </div>
      </div>

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
              disabled={loading || refreshing}
              className="h-11 rounded-xl bg-[#0f8b3d] px-4 text-sm font-bold text-white hover:bg-[#0c7133] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={loading || refreshing}
              className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-4 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#dce8e0] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#5d6d68]">Total Vaccination Records</p>
          <p className="mt-2 text-2xl font-black text-[#1f2d2a]">{totals.records.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-[#dce8e0] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#5d6d68]">Birds Vaccinated</p>
          <p className="mt-2 text-2xl font-black text-[#1f2d2a]">{totals.birds.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-[#dce8e0] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#5d6d68]">Booster Records</p>
          <p className="mt-2 text-2xl font-black text-[#1f2d2a]">{totals.boosters.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-[#dce8e0] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#5d6d68]">Unique Vaccines</p>
          <p className="mt-2 text-2xl font-black text-[#1f2d2a]">{totals.uniqueVaccines.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-[#1f2d2a]">Vaccination by Vaccine</h3>
        <p className="mb-3 text-sm text-[#5d6d68]">Aggregated results from the vaccination dashboard endpoint.</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Vaccine</th>
                <th className="px-2 py-2">Records</th>
                <th className="px-2 py-2">Birds Vaccinated</th>
                <th className="px-2 py-2">Booster Records</th>
                <th className="px-2 py-2">Latest Vaccination</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading vaccination report...</td></tr>
              ) : normalizedByVaccine.length === 0 ? (
                <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No vaccination data found.</td></tr>
              ) : normalizedByVaccine.map((row) => (
                <tr key={`${row.vaccine}-${row.lastDate}`} className="border-b border-[#f0f3f1]">
                  <td className="px-2 py-2 font-medium text-[#24332f]">{row.vaccine}</td>
                  <td className="px-2 py-2">{row.records.toLocaleString()}</td>
                  <td className="px-2 py-2">{row.birds.toLocaleString()}</td>
                  <td className="px-2 py-2">{row.boosters.toLocaleString()}</td>
                  <td className="px-2 py-2">{row.lastDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filters.flock_id && (
        <div className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Flock Summary</h3>
          <p className="mb-3 text-sm text-[#5d6d68]">Detailed summary for flock: <span className="font-semibold">{flockLabel}</span>.</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-190 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e9efe9] text-[#51615d]">
                  {summaryColumns.map((column) => (
                    <th key={column} className="px-2 py-2 capitalize">{column.replaceAll('_', ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading || refreshing ? (
                  <tr><td colSpan={Math.max(1, summaryColumns.length)} className="px-2 py-6 text-center text-[#5d6d68]">Loading flock summary...</td></tr>
                ) : flockSummaryRows.length === 0 ? (
                  <tr><td colSpan={Math.max(1, summaryColumns.length)} className="px-2 py-6 text-center text-[#5d6d68]">No flock summary found for this filter.</td></tr>
                ) : flockSummaryRows.map((row, index) => (
                  <tr key={`${filters.flock_id}-${index}`} className="border-b border-[#f0f3f1]">
                    {summaryColumns.map((column) => (
                      <td key={`${index}-${column}`} className="px-2 py-2">{String(row[column] ?? '—')}</td>
                    ))}
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
