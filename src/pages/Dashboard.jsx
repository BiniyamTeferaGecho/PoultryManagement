import { useCallback, useEffect, useState } from 'react';
import AccountSecurityPage from './AccountSecurityPage';
import CompanyRegistration from './Company';
import FarmRegistration from './farm';
import Houses from './Houses';
import FlockBreedManagement from './FlockBreedManagement';
import FlockStrainManagement from './FlockStrainManagement';
import FlockPlacementManagement from './FlockPlacementManagement';
import FlockMortalityManagement from './FlockMortalityManagement';
import ImportShipmentForm from './ImportShipmentForm';
import QuarantineRecordForm from './QuarantineRecordForm';
import CreateFlockManagement from './CreateFlockManagement';
import HatcherySetupManagement from './HatcherySetupManagement';
import HatcheryBatchManagement from './HatcheryBatchManagement';
import ChickBatchForm from './ChickBatchForm';
import RearingDailyManagement from './RearingDailyManagement';
import BroilerDailyRecordForm from './BroilerDailyRecordForm';
import ProductionDailyManagement from './ProductionDailyManagement';
import FeedTypeManagement from './FeedTypeManagement';
import FeedConsumptionManagement from './FeedConsumptionManagement';
import WaterConsumptionManagement from './WaterConsumptionManagement';
import VaccinationRecordManagement from './VaccinationRecordManagement';
import HealthIncidentManagement from './HealthIncidentManagement';
import TreatmentManagement from './TreatmentManagement';
import MortalityReportManagement from './MortalityReportManagement';
import RearingMortalityByReasonReport from './RearingMortalityByReasonReport';
import ProductionMortalityByReasonReport from './ProductionMortalityByReasonReport';
import VaccinationReportManagement from './VaccinationReportManagement';
import HREmployeeManagement from './HREmployeeManagement';
import HRFarmAssignmentManagement from './HRFarmAssignmentManagement';
import HRHouseAssignmentManagement from './HRHouseAssignmentManagement';
import HREmployeeRoleManagement from './HREmployeeRoleManagement';
import HREmployeeSignatureManagement from './HREmployeeSignatureManagement';
import LookupManagement from './LookupManagement';
import MortalityReasonManagement from './MortalityReasonManagement';
import ProductManagement from './ProductManagement';
import ProductBatchForm from './ProductBatchForm';
import ProductCategoryManagement from './ProductCategoryManagement';
import SupplierForm from './SupplierForm';
import StockBalanceForm from './StockBalanceForm';
import WarehouseForm from './WarehouseForm';
import StockMovementForm from './StockMovementForm';
import AlertLogManagement from './AlertLogManagement';
import AuditLogManagement from './AuditLogManagement';
import ProfilePage from './ProfilePage';
import UserManagement from './UserManagement';
import SecurityFormManagement from './SecurityFormManagement';
import SecurityPermissionManagement from './SecurityPermissionManagement';
import SecurityRoleManagement from './SecurityRoleManagement';
import SecurityRolePermissionManagement from './SecurityRolePermissionManagement';
import UserProfileMenu from '../components/UserProfileMenu';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelativeTime(isoDateTime) {
  if (!isoDateTime) return 'Unknown time';
  const value = new Date(isoDateTime).getTime();
  if (Number.isNaN(value)) return 'Unknown time';
  const diffMs = Date.now() - value;
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function toTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildRecentDailySeries(rows, measureFn, maxPoints = 14) {
  const byDate = new Map();
  rows.forEach((row) => {
    const dateKey = toDateInput(row.record_date);
    if (!dateKey) return;
    const value = Number(measureFn(row));
    byDate.set(dateKey, (byDate.get(dateKey) || 0) + (Number.isFinite(value) ? value : 0));
  });
  const labels = Array.from(byDate.keys()).sort().slice(-maxPoints);
  const values = labels.map((label) => byDate.get(label) || 0);
  return { labels, values };
}

function buildChartPoints(values, width = 320, chartTop = 20, chartBottom = 116) {
  if (!values.length) return [];
  const maxValue = Math.max(...values, 1);
  const startX = 6;
  const endX = width - 6;
  const step = values.length > 1 ? (endX - startX) / (values.length - 1) : 0;
  return values.map((value, index) => {
    const normalized = value / maxValue;
    const y = chartBottom - (chartBottom - chartTop) * normalized;
    return { x: startX + (step * index), y, value };
  });
}

function toLinePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
}

function toAreaPath(points, chartBottom = 140) {
  if (!points.length) return '';
  const line = toLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x},${chartBottom} L${first.x},${chartBottom} Z`;
}

function sumRows(rows, fieldName, fallback = () => 0) {
  return rows.reduce((total, row) => {
    const value = Number(row[fieldName]);
    if (Number.isFinite(value)) return total + value;
    const fallbackValue = Number(fallback(row));
    return Number.isFinite(fallbackValue) ? total + fallbackValue : total;
  }, 0);
}

function todayLocalIsoDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const DASHBOARD_SERIES_COLORS = ['#6f9a3d', '#a6d15a', '#c18ce0', '#f3c44d', '#4ba3f2', '#ff8f66'];

const quickActions = [
  { label: 'Add Flock', icon: '🐣', page: 'flocks-create', menu: 'flocks' },
  { label: 'Record Feed', icon: '🌾', page: 'feed-consumption-management', menu: 'feed' },
  { label: 'Add Egg Production', icon: '🥚', page: 'production-daily', menu: 'production' },
  { label: 'Record Mortality', icon: '🩺', page: 'flocks-mortality', menu: 'flocks' },
  { label: 'Add Expense', icon: '💰', page: 'dashboard', menu: null },
  { label: 'Generate Report', icon: '📄', page: 'production-weekly', menu: 'production' },
];

function DashboardPage({ user, onLogout, onUserUpdate, onPasswordChanged }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [farmCount, setFarmCount] = useState(null);
  const [farmCountError, setFarmCountError] = useState('');
  const [houseCount, setHouseCount] = useState(null);
  const [houseCountError, setHouseCountError] = useState('');
  const [formCount, setFormCount] = useState(null);
  const [formCountError, setFormCountError] = useState('');
  const [permissionCount, setPermissionCount] = useState(null);
  const [permissionCountError, setPermissionCountError] = useState('');
  const [roleCount, setRoleCount] = useState(null);
  const [roleCountError, setRoleCountError] = useState('');
  const [productionMetrics, setProductionMetrics] = useState(null);
  const [vaccinationMetrics, setVaccinationMetrics] = useState(null);
  const [vaccinationSummaryRows, setVaccinationSummaryRows] = useState([]);
  const [vaccinationSummaryFlockId, setVaccinationSummaryFlockId] = useState('');
  const [vaccinationSummaryFlockNumber, setVaccinationSummaryFlockNumber] = useState('');
  const [productionDailyRows, setProductionDailyRows] = useState([]);
  const [rearingDailyRows, setRearingDailyRows] = useState([]);
  const [flockRows, setFlockRows] = useState([]);
  const [hrEmployeeRows, setHrEmployeeRows] = useState([]);
  const [hrFarmAssignmentRows, setHrFarmAssignmentRows] = useState([]);
  const [hrHouseAssignmentRows, setHrHouseAssignmentRows] = useState([]);
  const [hrEmployeeRoleRows, setHrEmployeeRoleRows] = useState([]);
  const [hrSignatureRows, setHrSignatureRows] = useState([]);
  const [productionMetricsError, setProductionMetricsError] = useState('');
  const [vaccinationMetricsError, setVaccinationMetricsError] = useState('');
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  function runQuickAction(action) {
    if (action.menu) setExpandedMenu(action.menu);
    setActivePage(action.page);
  }

  const authenticatedGet = useCallback(async (path, failureMessage) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || failureMessage);
    return payload;
  }, [user.accessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadFarmCount() {
      if (!user?.accessToken) {
        if (isCurrent) {
          setFarmCount(null);
          setFarmCountError('Sign in to view the farm count.');
        }
        return;
      }

      setIsRefreshingDashboard(true);
      setFarmCount(null);
      setFarmCountError('');
      try {
        const response = await fetch(`${API_BASE_URL}/farm/count`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load the farm count.');

        const totalCount = payload.data?.totalCount;
        if (!Number.isInteger(totalCount) || totalCount < 0) {
          throw new Error('The farm count returned by the server is invalid.');
        }
        if (isCurrent) setFarmCount(totalCount);
      } catch (requestError) {
        console.error('loadFarmCount error:', requestError);
        if (isCurrent) setFarmCountError(requestError.message);
      } finally {
        if (isCurrent) setIsRefreshingDashboard(false);
      }
    }

    loadFarmCount();
    return () => {
      isCurrent = false;
    };
  }, [dashboardRefreshKey, user?.accessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSecurityCounts() {
      if (!user?.accessToken) {
        if (isCurrent) {
          setFormCount(null);
          setFormCountError('Sign in to view the form count.');
          setPermissionCount(null);
          setPermissionCountError('Sign in to view the permission count.');
          setRoleCount(null);
          setRoleCountError('Sign in to view the role count.');
        }
        return;
      }

      if (isCurrent) {
        setFormCount(null);
        setPermissionCount(null);
        setRoleCount(null);
        setFormCountError('');
        setPermissionCountError('');
        setRoleCountError('');
      }

      async function fetchTotalCount(path, label) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || `Unable to load ${label}.`);
        const totalCount = payload.data?.totalCount;
        if (!Number.isInteger(totalCount) || totalCount < 0) {
          throw new Error(`The ${label} returned by the server is invalid.`);
        }
        return totalCount;
      }

      const [formsResult, permissionsResult, rolesResult] = await Promise.allSettled([
        fetchTotalCount('/security/form/count', 'form count'),
        fetchTotalCount('/security/permission/count', 'permission count'),
        fetchTotalCount('/security/role/count', 'role count'),
      ]);

      if (!isCurrent) return;

      if (formsResult.status === 'fulfilled') {
        setFormCount(formsResult.value);
      } else {
        console.error('loadFormCount error:', formsResult.reason);
        setFormCountError(formsResult.reason?.message || 'Unable to load the form count.');
      }

      if (permissionsResult.status === 'fulfilled') {
        setPermissionCount(permissionsResult.value);
      } else {
        console.error('loadPermissionCount error:', permissionsResult.reason);
        setPermissionCountError(permissionsResult.reason?.message || 'Unable to load the permission count.');
      }

      if (rolesResult.status === 'fulfilled') {
        setRoleCount(rolesResult.value);
      } else {
        console.error('loadRoleCount error:', rolesResult.reason);
        setRoleCountError(rolesResult.reason?.message || 'Unable to load the role count.');
      }
    }

    loadSecurityCounts();
    return () => {
      isCurrent = false;
    };
  }, [dashboardRefreshKey, user?.accessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadHouseCount() {
      if (!user?.accessToken) {
        if (isCurrent) {
          setHouseCount(null);
          setHouseCountError('Sign in to view the house count.');
        }
        return;
      }

      setHouseCount(null);
      setHouseCountError('');
      try {
        const response = await fetch(`${API_BASE_URL}/house/count`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load the house count.');
        const totalCount = payload.data?.totalCount;
        if (!Number.isInteger(totalCount) || totalCount < 0) {
          throw new Error('The house count returned by the server is invalid.');
        }
        if (isCurrent) setHouseCount(totalCount);
      } catch (requestError) {
        console.error('loadHouseCount error:', requestError);
        if (isCurrent) setHouseCountError(requestError.message);
      }
    }

    loadHouseCount();
    return () => {
      isCurrent = false;
    };
  }, [dashboardRefreshKey, user?.accessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadProductionMetrics() {
      if (!user?.accessToken) {
        if (isCurrent) {
          setProductionMetrics(null);
          setVaccinationMetrics(null);
          setVaccinationSummaryRows([]);
          setVaccinationSummaryFlockId('');
          setVaccinationSummaryFlockNumber('');
          setProductionDailyRows([]);
          setRearingDailyRows([]);
          setFlockRows([]);
          setHrEmployeeRows([]);
          setHrFarmAssignmentRows([]);
          setHrHouseAssignmentRows([]);
          setHrEmployeeRoleRows([]);
          setHrSignatureRows([]);
          setProductionMetricsError('Sign in to view production metrics.');
          setVaccinationMetricsError('Sign in to view vaccination metrics.');
        }
        return;
      }

      if (isCurrent) {
        setProductionMetrics(null);
        setVaccinationMetrics(null);
        setVaccinationSummaryRows([]);
        setVaccinationSummaryFlockNumber('');
        setProductionDailyRows([]);
        setRearingDailyRows([]);
        setFlockRows([]);
        setHrEmployeeRows([]);
        setHrFarmAssignmentRows([]);
        setHrHouseAssignmentRows([]);
        setHrEmployeeRoleRows([]);
        setHrSignatureRows([]);
        setProductionMetricsError('');
        setVaccinationMetricsError('');
      }

      try {
        const [productionPayload, rearingPayload, flockPayload, hrEmployeesPayload, hrFarmAssignmentsPayload, hrHouseAssignmentsPayload, hrEmployeeRolesPayload, hrSignaturesPayload, vaccinationDashboardPayload, feedTodayPayload] = await Promise.all([
          authenticatedGet(
            '/production/daily?page_number=1&page_size=100&include_deleted=0',
            'Unable to load production daily metrics.',
          ),
          authenticatedGet(
            '/rearing/daily?page_number=1&page_size=100&include_deleted=0',
            'Unable to load rearing daily metrics.',
          ),
          authenticatedGet('/flock?page_number=1&page_size=100', 'Unable to load flock data.'),
          authenticatedGet('/hr/employee?page_number=1&page_size=100&include_deleted=0', 'Unable to load HR employees.'),
          authenticatedGet('/hr/farm-assignment?page_number=1&page_size=100&include_deleted=0', 'Unable to load HR farm assignments.'),
          authenticatedGet('/hr/house-assignment?page_number=1&page_size=100', 'Unable to load HR house assignments.'),
          authenticatedGet('/hr/employee-role?page_number=1&page_size=100', 'Unable to load HR employee roles.'),
          authenticatedGet('/hr/signature?page_number=1&page_size=100', 'Unable to load HR signatures.'),
          authenticatedGet('/vaccination/reports/dashboard', 'Unable to load vaccination dashboard metrics.'),
          authenticatedGet(`/feed/consumptions/by-date?consumption_date=${todayLocalIsoDate()}`, 'Unable to load feed consumption for today.'),
        ]);
        const rows = Array.isArray(productionPayload.data) ? productionPayload.data : [];
        const rearingRows = Array.isArray(rearingPayload.data) ? rearingPayload.data : [];
        const flocks = Array.isArray(flockPayload.data) ? flockPayload.data : [];
        const hrEmployees = Array.isArray(hrEmployeesPayload.data) ? hrEmployeesPayload.data : [];
        const hrFarmAssignments = Array.isArray(hrFarmAssignmentsPayload.data) ? hrFarmAssignmentsPayload.data : [];
        const hrHouseAssignments = Array.isArray(hrHouseAssignmentsPayload.data) ? hrHouseAssignmentsPayload.data : [];
        const hrEmployeeRoles = Array.isArray(hrEmployeeRolesPayload.data) ? hrEmployeeRolesPayload.data : [];
        const hrSignatures = Array.isArray(hrSignaturesPayload.data) ? hrSignaturesPayload.data : [];
        const vaccinationTotals = vaccinationDashboardPayload?.data?.totals || null;
        const today = todayLocalIsoDate();
        const todayRows = rows.filter((row) => toDateInput(row.record_date) === today);
        const latestRecordDate = rows.reduce((latest, row) => {
          const currentDate = toDateInput(row.record_date);
          return currentDate > latest ? currentDate : latest;
        }, '');
        const latestRows = latestRecordDate ? rows.filter((row) => toDateInput(row.record_date) === latestRecordDate) : [];

        const totalBirds = sumRows(
          latestRows,
          'closing_total',
          (row) => Number(row.opening_total) || ((Number(row.opening_females) || 0) + (Number(row.opening_males) || 0)),
        );
        const eggsToday = sumRows(todayRows, 'total_eggs');
        const feedTodayKg = sumRows(Array.isArray(feedTodayPayload.data) ? feedTodayPayload.data : [], 'quantity_consumed_kg');
        const mortalityToday = sumRows(
          todayRows,
          'mortality_total',
          (row) => (Number(row.mortality_females) || 0) + (Number(row.mortality_males) || 0),
        );

        const sortedFlocks = [...flocks].sort((a, b) => String(a.flock_number || '').localeCompare(String(b.flock_number || '')));
        const defaultFlockId = sortedFlocks[0]?.flock_id || '';
        const selectedStillExists = sortedFlocks.some((row) => row.flock_id === vaccinationSummaryFlockId);
        const nextSelectedFlockId = selectedStillExists ? vaccinationSummaryFlockId : defaultFlockId;

        if (isCurrent) {
          setProductionDailyRows(rows);
          setRearingDailyRows(rearingRows);
          setFlockRows(flocks);
          setHrEmployeeRows(hrEmployees);
          setHrFarmAssignmentRows(hrFarmAssignments);
          setHrHouseAssignmentRows(hrHouseAssignments);
          setHrEmployeeRoleRows(hrEmployeeRoles);
          setHrSignatureRows(hrSignatures);
          setVaccinationMetrics(vaccinationTotals);
          setVaccinationSummaryFlockId(nextSelectedFlockId);
          setProductionMetrics({
            totalBirds,
            eggsToday,
            feedTodayKg,
            mortalityToday,
            latestRecordDate,
          });
        }
      } catch (requestError) {
        console.error('loadProductionMetrics error:', requestError);
        if (isCurrent) {
          setProductionMetricsError(requestError.message);
          setVaccinationMetricsError(requestError.message);
        }
      }
    }

    loadProductionMetrics();
    return () => {
      isCurrent = false;
    };
  }, [authenticatedGet, dashboardRefreshKey, user?.accessToken]);

  useEffect(() => {
    let isCurrent = true;

    async function loadVaccinationFlockSummary() {
      if (!user?.accessToken || !vaccinationSummaryFlockId) {
        if (isCurrent) {
          setVaccinationSummaryRows([]);
          setVaccinationSummaryFlockNumber('');
        }
        return;
      }

      const selectedFlock = flockRows.find((row) => row.flock_id === vaccinationSummaryFlockId);
      if (isCurrent) setVaccinationSummaryFlockNumber(selectedFlock?.flock_number || '');

      try {
        const summaryPayload = await authenticatedGet(
          `/vaccination/reports/flock/${vaccinationSummaryFlockId}/summary`,
          'Unable to load vaccination flock summary.',
        );
        if (isCurrent) {
          setVaccinationSummaryRows(Array.isArray(summaryPayload.data) ? summaryPayload.data : []);
        }
      } catch (requestError) {
        if (isCurrent) {
          setVaccinationSummaryRows([]);
          setVaccinationMetricsError(requestError.message);
        }
      }
    }

    loadVaccinationFlockSummary();
    return () => {
      isCurrent = false;
    };
  }, [authenticatedGet, flockRows, user?.accessToken, vaccinationSummaryFlockId]);

  const flockById = flockRows.reduce((accumulator, row) => {
    if (row?.flock_id) accumulator[row.flock_id] = row;
    return accumulator;
  }, {});

  const birdCategoryMap = {};
  flockRows.forEach((row) => {
    const label = row.poultry_type || 'Others';
    const birds = Number(row.current_total);
    const value = Number.isFinite(birds) ? birds : ((Number(row.initial_females) || 0) + (Number(row.initial_males) || 0));
    birdCategoryMap[label] = (birdCategoryMap[label] || 0) + value;
  });
  const dynamicCategoryData = Object.entries(birdCategoryMap)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({
      label,
      value,
      color: DASHBOARD_SERIES_COLORS[index % DASHBOARD_SERIES_COLORS.length],
    }));
  const categoryData = dynamicCategoryData.length ? dynamicCategoryData : [{ label: 'No Data', value: 0, color: '#d1d5db' }];
  const categoryTotal = categoryData.reduce((total, item) => total + item.value, 0);
  const donutStyle = categoryTotal > 0
    ? {
      background: `conic-gradient(${categoryData.reduce((segments, item, index) => {
        const previousPercent = categoryData.slice(0, index).reduce((sum, entry) => sum + ((entry.value / categoryTotal) * 100), 0);
        const nextPercent = previousPercent + ((item.value / categoryTotal) * 100);
        return `${segments}${segments ? ', ' : ''}${item.color} ${previousPercent}% ${nextPercent}%`;
      }, '')})`,
    }
    : { background: '#edf3ef' };

  const eggSeriesData = buildRecentDailySeries(productionDailyRows, (row) => row.total_eggs);
  const eggSeries = eggSeriesData.values;
  const eggLabels = eggSeriesData.labels;
  const eggPoints = buildChartPoints(eggSeries);
  const eggLinePath = toLinePath(eggPoints);
  const eggAreaPath = toAreaPath(eggPoints);
  const maxEggValue = Math.max(...eggSeries, 0);

  const feedSeriesData = buildRecentDailySeries(productionDailyRows, (row) => row.feed_consumption_kg);
  const feedSeries = feedSeriesData.values;
  const feedLabels = feedSeriesData.labels;
  const maxFeedValue = Math.max(...feedSeries, 0);

  const mortalitySeriesData = buildRecentDailySeries(
    productionDailyRows,
    (row) => Number(row.mortality_total) || ((Number(row.mortality_females) || 0) + (Number(row.mortality_males) || 0)),
  );
  const mortalityPoints = buildChartPoints(mortalitySeriesData.values);
  const mortalityLinePath = toLinePath(mortalityPoints);
  const mortalityAreaPath = toAreaPath(mortalityPoints, 150);

  const flockSummary = flockRows
    .map((row) => {
      const hatchDate = new Date(row.hatch_date);
      const age = Number.isNaN(hatchDate.getTime()) ? '—' : Math.max(0, Math.floor((Date.now() - hatchDate.getTime()) / (24 * 60 * 60 * 1000)));
      const birds = Number(row.current_total);
      return {
        name: row.flock_number || 'Unknown',
        type: row.poultry_type || 'Others',
        birds: Number.isFinite(birds) ? birds : ((Number(row.initial_females) || 0) + (Number(row.initial_males) || 0)),
        age,
        status: row.is_deleted ? 'Deleted' : 'Active',
      };
    })
    .sort((a, b) => b.birds - a.birds)
    .slice(0, 5);

  const feedByType = {};
  productionDailyRows.forEach((row) => {
    const flock = flockById[row.flock_id];
    const label = flock?.poultry_type ? `${flock.poultry_type} Feed` : 'Other Feed';
    const amount = Number(row.feed_consumption_kg);
    feedByType[label] = (feedByType[label] || 0) + (Number.isFinite(amount) ? amount : 0);
  });
  const totalFeedForUsage = Object.values(feedByType).reduce((sum, value) => sum + value, 0);
  const feedUse = Object.entries(feedByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value], index) => ({
      label,
      value: Number(value.toFixed(2)),
      percent: totalFeedForUsage > 0 ? Math.max(1, Math.round((value / totalFeedForUsage) * 100)) : 0,
      color: DASHBOARD_SERIES_COLORS[index % DASHBOARD_SERIES_COLORS.length],
    }));
  const feedDonutStyle = totalFeedForUsage > 0
    ? {
      background: `conic-gradient(${feedUse.reduce((segments, item, index) => {
        const previousPercent = feedUse.slice(0, index).reduce((sum, entry) => sum + ((entry.value / totalFeedForUsage) * 100), 0);
        const nextPercent = previousPercent + ((item.value / totalFeedForUsage) * 100);
        return `${segments}${segments ? ', ' : ''}${item.color} ${previousPercent}% ${nextPercent}%`;
      }, '')})`,
    }
    : { background: '#edf3ef' };

  const todayIso = todayLocalIsoDate();
  const activeEmployeeCount = hrEmployeeRows.filter((row) => {
    const status = String(row.status || '').toLowerCase();
    return !status || status === 'active';
  }).length;
  const activeFarmAssignmentCount = hrFarmAssignmentRows.filter((row) => {
    const endDate = toDateInput(row.end_date);
    return !endDate || endDate >= todayIso;
  }).length;
  const activeRoleAssignmentCount = hrEmployeeRoleRows.filter((row) => {
    const endDate = toDateInput(row.end_date);
    return Boolean(row.is_active) && (!endDate || endDate >= todayIso);
  }).length;

  const employeeCodeById = new Map(hrEmployeeRows.map((row) => [row.employee_id, row.employee_code]));
  const recentActivities = [
    ...productionDailyRows.map((row) => {
      const eggs = Number(row.total_eggs) || 0;
      const feed = Number(row.feed_consumption_kg) || 0;
      const mortality = Number(row.mortality_total) || ((Number(row.mortality_females) || 0) + (Number(row.mortality_males) || 0));
      let title = 'Production record captured';
      let icon = '📘';
      let description = `Daily production recorded for ${row.flock_number || 'a flock'}.`;

      if (eggs > 0) {
        title = 'Egg production recorded';
        icon = '🥚';
        description = `${eggs.toLocaleString()} eggs recorded for ${row.flock_number || 'a flock'}.`;
      } else if (feed > 0) {
        title = 'Feed consumption added';
        icon = '🌾';
        description = `${feed.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg feed recorded for ${row.flock_number || 'a flock'}.`;
      } else if (mortality > 0) {
        title = 'Mortality updated';
        icon = '🩺';
        description = `${mortality.toLocaleString()} mortality recorded for ${row.flock_number || 'a flock'}.`;
      }

      return {
        title,
        icon,
        description,
        time: formatRelativeTime(row.modified_date || row.created_date || row.record_date),
        timestamp: toTimestamp(row.modified_date || row.created_date || row.record_date),
      };
    }),
    ...rearingDailyRows.map((row) => {
      const mortality = Number(row.mortality_total) || ((Number(row.mortality_females) || 0) + (Number(row.mortality_males) || 0));
      const feed = Number(row.feed_consumption_kg) || 0;
      const uniformity = Number(row.uniformity_percent) || 0;
      let title = 'Rearing record captured';
      let icon = '📗';
      let description = `Daily rearing record captured for ${row.flock_number || 'a flock'}.`;

      if (mortality > 0) {
        title = 'Rearing mortality updated';
        icon = '🩺';
        description = `${mortality.toLocaleString()} mortality logged in rearing for ${row.flock_number || 'a flock'}.`;
      } else if (feed > 0) {
        title = 'Rearing feed recorded';
        icon = '🌾';
        description = `${feed.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg feed recorded in rearing for ${row.flock_number || 'a flock'}.`;
      } else if (uniformity > 0) {
        title = 'Uniformity tracked';
        icon = '📏';
        description = `Uniformity ${uniformity.toLocaleString(undefined, { maximumFractionDigits: 2 })}% recorded for ${row.flock_number || 'a flock'}.`;
      }

      return {
        title,
        icon,
        description,
        time: formatRelativeTime(row.modified_date || row.created_date || row.record_date),
        timestamp: toTimestamp(row.modified_date || row.created_date || row.record_date),
      };
    }),
    ...hrEmployeeRows.map((row) => ({
      title: 'HR employee registered',
      icon: '👤',
      description: `${row.employee_code || 'Employee'} (${row.first_name || ''} ${row.last_name || ''}) was registered.`,
      time: formatRelativeTime(row.modified_date || row.created_date || row.hire_date),
      timestamp: toTimestamp(row.modified_date || row.created_date || row.hire_date),
    })),
    ...hrFarmAssignmentRows.map((row) => ({
      title: 'Employee assigned to farm',
      icon: '🚜',
      description: `${row.employee_code || 'Employee'} assigned to ${row.farm_name || row.farm_code || 'a farm'}.`,
      time: formatRelativeTime(row.modified_date || row.created_date || row.assignment_date),
      timestamp: toTimestamp(row.modified_date || row.created_date || row.assignment_date),
    })),
    ...hrHouseAssignmentRows.map((row) => ({
      title: 'Employee assigned to house',
      icon: '🏠',
      description: `${row.employee_code || employeeCodeById.get(row.employee_id) || 'Employee'} assigned to ${row.house_name || row.house_code || 'a house'}.`,
      time: formatRelativeTime(row.modified_date || row.created_date || row.assignment_date),
      timestamp: toTimestamp(row.modified_date || row.created_date || row.assignment_date),
    })),
    ...hrEmployeeRoleRows.map((row) => ({
      title: 'Employee role assigned',
      icon: '🧩',
      description: `${row.employee_code || 'Employee'} assigned role ${row.display_name || row.role_name || 'role'}.`,
      time: formatRelativeTime(row.modified_date || row.created_date || row.assigned_date),
      timestamp: toTimestamp(row.modified_date || row.created_date || row.assigned_date),
    })),
    ...hrSignatureRows.map((row) => ({
      title: 'Employee signature recorded',
      icon: '✍️',
      description: `Signature for ${row.employee_code || employeeCodeById.get(row.employee_id) || 'employee'} captured${row.signature_file_url ? ' with file URL' : ''}.`,
      time: formatRelativeTime(row.modified_date || row.created_date || row.effective_date),
      timestamp: toTimestamp(row.modified_date || row.created_date || row.effective_date),
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  const dashboardStats = [
    {
      title: 'Total Birds',
      value: productionMetrics === null ? (productionMetricsError ? '—' : '...') : productionMetrics.totalBirds.toLocaleString(),
      delta: '',
      footer: productionMetricsError || (productionMetrics?.latestRecordDate ? `Latest record date: ${productionMetrics.latestRecordDate}` : 'No production records yet'),
      accent: 'bg-[#dff5e8]',
      icon: '🐔',
      iconBg: 'bg-[#eaf9f0]',
      valueColor: 'text-[#0f8b3d]',
    },
    {
      title: 'Eggs Today',
      value: productionMetrics === null ? (productionMetricsError ? '—' : '...') : productionMetrics.eggsToday.toLocaleString(),
      delta: '',
      footer: productionMetricsError || 'Sum of production daily records for today',
      accent: 'bg-[#e8f2ff]',
      icon: '🥚',
      iconBg: 'bg-[#edf5ff]',
      valueColor: 'text-[#1d6fe6]',
    },
    {
      title: 'Feed Consumed',
      value: productionMetrics === null ? (productionMetricsError ? '—' : '...') : `${productionMetrics.feedTodayKg.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`,
      delta: '',
      footer: productionMetricsError || 'Feed consumption records for today',
      accent: 'bg-[#fff7dc]',
      icon: '🌾',
      iconBg: 'bg-[#fff6d7]',
      valueColor: 'text-[#d9a227]',
    },
    {
      title: 'Mortality Today',
      value: productionMetrics === null ? (productionMetricsError ? '—' : '...') : productionMetrics.mortalityToday.toLocaleString(),
      delta: '',
      footer: productionMetricsError || 'Production mortality entries for today',
      accent: 'bg-[#f2e8ff]',
      icon: '⚕️',
      iconBg: 'bg-[#f1eaff]',
      valueColor: 'text-[#8b5cf6]',
    },
    {
      title: 'Total Houses',
      value: houseCount === null ? (houseCountError ? '—' : '...') : houseCount.toLocaleString(),
      delta: '',
      footer: houseCountError || 'Current house records',
      accent: 'bg-[#e8f2ff]',
      icon: '🏠',
      iconBg: 'bg-[#edf5ff]',
      valueColor: 'text-[#1d6fe6]',
    },
    {
      title: 'Total Farms',
      value: farmCount === null ? (farmCountError ? '—' : '...') : farmCount.toLocaleString(),
      delta: '',
      footer: farmCountError || 'Current farm records',
      accent: 'bg-[#e5f4ed]',
      icon: '🚜',
      iconBg: 'bg-[#edf9f2]',
      valueColor: 'text-[#0c6d4d]',
    },
    {
      title: 'Active Employees',
      value: activeEmployeeCount.toLocaleString(),
      delta: '',
      footer: 'Employees with active status',
      accent: 'bg-[#e7f0ff]',
      icon: '👥',
      iconBg: 'bg-[#edf4ff]',
      valueColor: 'text-[#2f63d8]',
    },
    {
      title: 'Active Farm Assignments',
      value: activeFarmAssignmentCount.toLocaleString(),
      delta: '',
      footer: 'Current employee-to-farm assignments',
      accent: 'bg-[#e8fbf1]',
      icon: '🚜',
      iconBg: 'bg-[#eefcf5]',
      valueColor: 'text-[#158e54]',
    },
    {
      title: 'Active Role Assignments',
      value: activeRoleAssignmentCount.toLocaleString(),
      delta: '',
      footer: 'Current employee role mappings',
      accent: 'bg-[#f3ebff]',
      icon: '🧩',
      iconBg: 'bg-[#f6f0ff]',
      valueColor: 'text-[#7b4ac9]',
    },
    {
      title: 'Security Forms',
      value: formCount === null ? (formCountError ? '—' : '...') : formCount.toLocaleString(),
      delta: '',
      footer: formCountError || 'Configured forms',
      accent: 'bg-[#fff6e8]',
      icon: '🧩',
      iconBg: 'bg-[#fff2dc]',
      valueColor: 'text-[#d17a0f]',
    },
    {
      title: 'Permissions',
      value: permissionCount === null ? (permissionCountError ? '—' : '...') : permissionCount.toLocaleString(),
      delta: '',
      footer: permissionCountError || 'Configured permissions',
      accent: 'bg-[#eaf2ff]',
      icon: '🔐',
      iconBg: 'bg-[#e8f0ff]',
      valueColor: 'text-[#3559d6]',
    },
    {
      title: 'Roles',
      value: roleCount === null ? (roleCountError ? '—' : '...') : roleCount.toLocaleString(),
      delta: '',
      footer: roleCountError || 'Configured roles',
      accent: 'bg-[#f3ebff]',
      icon: '🛡️',
      iconBg: 'bg-[#f1e8ff]',
      valueColor: 'text-[#7b4ac9]',
    },
    {
      title: 'Vaccinations (30d)',
      value: vaccinationMetrics === null ? (vaccinationMetricsError ? '—' : '...') : (Number(vaccinationMetrics.total_vaccinations) || 0).toLocaleString(),
      delta: '',
      footer: vaccinationMetricsError || 'From vaccination dashboard report',
      accent: 'bg-[#eef8ff]',
      icon: '💉',
      iconBg: 'bg-[#e5f4ff]',
      valueColor: 'text-[#1e6ed8]',
    },
    {
      title: 'Overdue Boosters',
      value: vaccinationMetrics === null ? (vaccinationMetricsError ? '—' : '...') : (Number(vaccinationMetrics.overdue_boosters) || 0).toLocaleString(),
      delta: '',
      footer: vaccinationMetricsError || 'Boosters due or overdue',
      accent: 'bg-[#fff1f0]',
      icon: '⏰',
      iconBg: 'bg-[#ffe8e5]',
      valueColor: 'text-[#d45745]',
    },
  ];

  const isUserManagement = activePage.startsWith('users-');
  const isSecurityFormManagement = activePage === 'security-forms';
  const isSecurityPermissionManagement = activePage === 'security-permissions';
  const isSecurityRoleManagement = activePage === 'security-roles';
  const isSecurityRolePermissionManagement = activePage === 'security-role-permissions';
  const isSecurityManagement = isSecurityFormManagement || isSecurityPermissionManagement || isSecurityRoleManagement || isSecurityRolePermissionManagement;
  const isLookupManagement = activePage === 'lookup-registration';
  const isMortalityReasonManagement = activePage === 'mortality-reason-management';
  const isCompanyRegistration = activePage === 'company-registration';
  const isFarmRegistration = activePage === 'farm-registration';
  const isHouseRegistration = activePage === 'house-registration';
  const isMasterDataProductionManagement = activePage === 'master-production';
  const isMasterDataProductionBatchManagement = activePage === 'master-production-batch';
  const isMasterDataProductionCategoryManagement = activePage === 'master-production-category';
  const isSupplierManagement = activePage === 'master-supplier';
  const isWarehouseManagement = activePage === 'inventory-warehouse';
  const isInventoryWarehouseManagement = isWarehouseManagement;
  const isInventoryStockBalanceManagement = activePage === 'inventory-stock-balance' || activePage === 'inventory-stock';
  const isInventoryStockMovementManagement = activePage === 'inventory-stock-movement';
  const isFlockBreedManagement = activePage === 'flocks-breed';
  const isFlockStrainManagement = activePage === 'flocks-strain';
  const isCreateFlockManagement = activePage === 'flocks-create';
  const isFlockPlacementManagement = activePage === 'flocks-placement';
  const isFlockMortalityManagement = activePage === 'flocks-mortality';
  const isImportShipmentManagement = activePage === 'flocks-import-shipment';
  const isQuarantineRecordManagement = activePage === 'flocks-quarantine-record';
  const isHatcherySetupManagement = activePage === 'flocks-hatchery';
  const isHatcheryBatchManagement = activePage === 'flocks-hatchery-batch';
  const isHatcheryChickBatchManagement = activePage === 'hatchery-chick-batch';
  const isRearingDailyManagement = activePage === 'production-rearing-daily';
  const isRearingWeeklyManagement = activePage === 'production-rearing-weekly';
  const isProductionDailyManagement = activePage === 'production-daily';
  const isBroilerDailyRecordManagement = activePage === 'production-broiler-daily';
  const isProductionWeeklyManagement = activePage === 'production-weekly';
  const isFeedTypeManagement = activePage === 'feed-type-management';
  const isFeedConsumptionManagement = activePage === 'feed-consumption-management';
  const isWaterConsumptionManagement = activePage === 'water-consumption-management';
  const isFeedManagement = isFeedTypeManagement || isFeedConsumptionManagement || isWaterConsumptionManagement;
  const isVaccinationRecordManagement = activePage === 'vaccination-record-management';
  const isHealthIncidentManagement = activePage === 'health-incident-management';
  const isTreatmentManagement = activePage === 'treatment-management';
  const isVaccinationManagement = isVaccinationRecordManagement || isHealthIncidentManagement || isTreatmentManagement;
  const isMortalityReportManagement = activePage === 'reports-mortality';
  const isProductionMortalityByReasonReportManagement = activePage === 'reports-production-mortality-by-reason';
  const isRearingMortalityByReasonReportManagement = activePage === 'reports-rearing-mortality-by-reason';
  const isVaccinationReportManagement = activePage === 'reports-vaccination';
  const isHREmployeeManagement = activePage === 'production-hr-employee';
  const isHRFarmAssignmentManagement = activePage === 'production-hr-farm-assignment';
  const isHRHouseAssignmentManagement = activePage === 'production-hr-house-assignment';
  const isHREmployeeRoleManagement = activePage === 'production-hr-employee-role';
  const isHREmployeeSignatureManagement = activePage === 'production-hr-employee-signature';
  const isHRManagement = isHREmployeeManagement
    || isHRFarmAssignmentManagement
    || isHRHouseAssignmentManagement
    || isHREmployeeRoleManagement
    || isHREmployeeSignatureManagement;
  const isProductionManagement = isRearingDailyManagement
    || isRearingWeeklyManagement
    || isProductionDailyManagement
    || isProductionWeeklyManagement
    || isBroilerDailyRecordManagement;
  const isReportsManagement = isMortalityReportManagement
    || isProductionMortalityByReasonReportManagement
    || isRearingMortalityByReasonReportManagement
    || isVaccinationReportManagement;
  const isHatcheryManagementMenu = isHatcherySetupManagement || isHatcheryBatchManagement || isHatcheryChickBatchManagement;
  const isFlockHatcheryManagement = isFlockBreedManagement
    || isFlockStrainManagement
    || isCreateFlockManagement
    || isFlockPlacementManagement
    || isFlockMortalityManagement
    || isImportShipmentManagement
    || isQuarantineRecordManagement;
  const isProfilePage = activePage === 'profile' || activePage === 'profile-picture';
  const isAlertLogManagement = activePage === 'alert-log';
  const isAuditLogManagement = activePage === 'audit-log';
  const pageTitle = isUserManagement || isSecurityManagement
    ? 'Users & Roles'
    : isLookupManagement || isMortalityReasonManagement || isCompanyRegistration || isFarmRegistration || isHouseRegistration || isSupplierManagement || isWarehouseManagement || isMasterDataProductionManagement || isMasterDataProductionBatchManagement || isMasterDataProductionCategoryManagement
      ? 'Master Data'
      : isVaccinationManagement
        ? 'Vaccination'
      : isFeedManagement
        ? 'Feed Management'
      : isInventoryStockBalanceManagement || isInventoryStockMovementManagement
        ? 'Inventory'
      : isHRManagement
        ? 'HR'
      : isProductionManagement
        ? 'Production'
      : isReportsManagement
        ? 'Reports'
      : isHatcheryManagementMenu
        ? 'Hatchery'
      : isFlockHatcheryManagement
        ? 'Flock & Hatchery'
      : isAlertLogManagement || isAuditLogManagement
        ? 'Monitoring & Audit'
        : activePage === 'account-security'
          ? 'Login & Account Security'
          : isProfilePage
            ? 'My Profile'
            : 'Dashboard';
  const pageSubtitle = isUserManagement || isSecurityManagement
    ? 'Manage user accounts and access'
    : isLookupManagement || isMortalityReasonManagement || isCompanyRegistration || isFarmRegistration || isHouseRegistration || isSupplierManagement || isWarehouseManagement || isMasterDataProductionManagement || isMasterDataProductionBatchManagement || isMasterDataProductionCategoryManagement
      ? 'Manage shared master data'
      : isVaccinationManagement
        ? 'Manage vaccination, health incident, and treatment records'
      : isFeedManagement
        ? 'Manage feed types, feed consumption and water consumption records'
      : isInventoryStockBalanceManagement
        ? 'Manage warehouse stock balances'
      : isInventoryStockMovementManagement
        ? 'Track warehouse stock movements and transfer workflow'
      : isHRManagement
        ? 'Manage employee records, assignments, and roles'
      : isProductionManagement
        ? 'Capture production and rearing records'
      : isReportsManagement
        ? 'Manager-focused analytics and trend monitoring'
      : isHatcheryManagementMenu
        ? 'Manage hatchery setup, hatching batches, and chick batches'
      : isFlockHatcheryManagement
        ? 'Manage flock lifecycle and hatchery batches'
      : isAlertLogManagement || isAuditLogManagement
        ? 'Track alerts and audit operations'
        : activePage === 'account-security'
          ? 'Review your login information and security settings'
          : isProfilePage
            ? 'Manage your personal information and profile picture'
            : 'Overview of your poultry farm';

  const isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const sidebarOpen = !isSmallScreen || isSidebarOpen;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[#edf4ee] p-0 text-[#1c2b28] antialiased">
      <div className="relative flex min-h-screen w-full bg-[#edf4ee]">
        {isSmallScreen && isSidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-[#122319]/45"
          />
        )}

        <aside
          className={[
           'flex flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(18,91,69,0.82)_0%,rgba(10,63,47,0.88)_100%)] px-4 py-5 text-white shadow-[0_24px_55px_rgba(10,52,35,0.3)] backdrop-blur-2xl ring-1 ring-white/10 transition-transform duration-200 ease-in-out',
           isSmallScreen ? 'fixed left-0 top-0 z-40 h-screen w-[82vw] max-w-75' : 'sticky top-0 h-screen w-72 shrink-0 self-start',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl shadow-sm">🐓</div>
            <div>
              <div className="text-2xl font-black leading-none tracking-tight">Poultry Farm</div>
              <div className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-white/80 uppercase">Management System</div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto pb-6 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => { setActivePage('dashboard'); if (isSmallScreen) setIsSidebarOpen(false); }}
              aria-current={activePage === 'dashboard' ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-base font-medium transition ${
                activePage === 'dashboard' ? 'bg-white/15 text-white shadow-inner ring-1 ring-white/10' : 'text-white/85 hover:bg-white/10'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">🏠</span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => setExpandedMenu((current) => current === 'hr' ? null : 'hr')}
              aria-expanded={expandedMenu === 'hr'}
              aria-current={isHRManagement ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                isHRManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">👥</span>
              <span className="flex-1">HR</span>
              <span aria-hidden="true">{expandedMenu === 'hr' || isHRManagement ? '⌃' : '⌄'}</span>
            </button>
            {(expandedMenu === 'hr' || isHRManagement) && (
              <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                <button
                  type="button"
                  onClick={() => { setActivePage('production-hr-employee'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isHREmployeeManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">👤</span>
                  <span>HR Employees</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('production-hr-farm-assignment'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isHRFarmAssignmentManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🚜</span>
                  <span>HR Farm Assignments</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('production-hr-house-assignment'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isHRHouseAssignmentManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏠</span>
                  <span>HR House Assignments</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('production-hr-employee-role'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isHREmployeeRoleManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🧩</span>
                  <span>HR Employee Roles</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('production-hr-employee-signature'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isHREmployeeSignatureManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">✍️</span>
                  <span>HR Employee Signatures</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setExpandedMenu((current) => current === 'feed' ? null : 'feed')}
              aria-expanded={expandedMenu === 'feed'}
              aria-current={isFeedManagement ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                isFeedManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">🌾</span>
              <span className="flex-1">Consumptions</span>
              <span aria-hidden="true">{expandedMenu === 'feed' || isFeedManagement ? '⌃' : '⌄'}</span>
            </button>
            {(expandedMenu === 'feed' || isFeedManagement) && (
              <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                <button
                  type="button"
                  onClick={() => { setActivePage('feed-type-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isFeedTypeManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏷️</span>
                  <span>Feed Types</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('feed-consumption-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isFeedConsumptionManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">📘</span>
                  <span>Feed Consumption</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePage('water-consumption-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isWaterConsumptionManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">💧</span>
                  <span>Water Consumption</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setExpandedMenu((current) => current === 'production' ? null : 'production')}
              aria-expanded={expandedMenu === 'production'}
              aria-current={isProductionManagement ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                isProductionManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">📦</span>
              <span className="flex-1">Production</span>
              <span aria-hidden="true">{expandedMenu === 'production' || isProductionManagement ? '⌃' : '⌄'}</span>
            </button>
            {(expandedMenu === 'production' || isProductionManagement) && (
              <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                <button
                  type="button"
                  onClick={() => { setActivePage('production-daily'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isProductionDailyManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🥚</span>
                  <span>Production Daily Record</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActivePage('production-rearing-daily'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isRearingDailyManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">📘</span>
                  <span>Rearing Daily Record</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActivePage('production-broiler-daily'); if (isSmallScreen) setIsSidebarOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isBroilerDailyRecordManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🍗</span>
                  <span>Broiler Daily Record</span>
                </button>

              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'vaccination' ? null : 'vaccination')}
                aria-expanded={expandedMenu === 'vaccination'}
                aria-current={isVaccinationManagement ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isVaccinationManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">💉</span>
                <span className="flex-1">Vaccination</span>
                <span aria-hidden="true">{expandedMenu === 'vaccination' || isVaccinationManagement ? '⌃' : '⌄'}</span>
              </button>
              {(expandedMenu === 'vaccination' || isVaccinationManagement) && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  <button
                    type="button"
                    onClick={() => { setActivePage('vaccination-record-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isVaccinationRecordManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">📋</span>
                    <span>Vaccination Record</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('health-incident-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isHealthIncidentManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🩺</span>
                    <span>Health Incident</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('treatment-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isTreatmentManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">💊</span>
                    <span>Treatment</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'inventory' ? null : 'inventory')}
                aria-expanded={expandedMenu === 'inventory'}
                aria-current={isInventoryStockBalanceManagement || isInventoryStockMovementManagement ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isInventoryStockBalanceManagement || isInventoryStockMovementManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">📦</span>
                <span className="flex-1">Inventory</span>
                <span aria-hidden="true">{expandedMenu === 'inventory' || isInventoryStockBalanceManagement || isInventoryStockMovementManagement ? '⌃' : '⌄'}</span>
              </button>
              {(expandedMenu === 'inventory' || isInventoryStockBalanceManagement || isInventoryStockMovementManagement) && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  <button
                    type="button"
                    onClick={() => { setActivePage('inventory-stock-balance'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isInventoryStockBalanceManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">⚖️</span>
                    <span>Stock Balance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('inventory-stock-movement'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isInventoryStockMovementManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🔄</span>
                    <span>Stock Movement</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium text-white/85 transition hover:bg-white/10"
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">💰</span>
              <span>Finance</span>
            </button>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'reports' ? null : 'reports')}
                aria-expanded={expandedMenu === 'reports'}
                aria-current={isReportsManagement ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isReportsManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">📊</span>
                <span className="flex-1">Reports</span>
                <span aria-hidden="true">{expandedMenu === 'reports' || isReportsManagement ? '⌃' : '⌄'}</span>
              </button>
              {(expandedMenu === 'reports' || isReportsManagement) && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  <button
                    type="button"
                    onClick={() => { setActivePage('reports-mortality'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isMortalityReportManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">☠️</span>
                    <span>Mortality Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('reports-production-mortality-by-reason'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isProductionMortalityByReasonReportManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🧬</span>
                    <span>Production Mortality By Reason</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('reports-rearing-mortality-by-reason'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isRearingMortalityByReasonReportManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🧪</span>
                    <span>Rearing Mortality By Reason</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('reports-vaccination'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isVaccinationReportManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">💉</span>
                    <span>Vaccination Report</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'flocks' ? null : 'flocks')}
                aria-expanded={expandedMenu === 'flocks'}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isFlockHatcheryManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">🐣</span>
                <span className="flex-1">Flocks</span>
                <span aria-hidden="true">{expandedMenu === 'flocks' ? '⌃' : '⌄'}</span>
              </button>
              {expandedMenu === 'flocks' && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  {[
                    ['flocks-breed', 'Breed setup', '🐥', isFlockBreedManagement],
                    ['flocks-strain', 'Strain setup', '🧬', isFlockStrainManagement],
                    ['flocks-create', 'Create Flock', '🐣', isCreateFlockManagement],
                    ['flocks-placement', 'Flock placement', '📍', isFlockPlacementManagement],
                    ['flocks-mortality', 'Mortality log', '☠️', isFlockMortalityManagement],
                    ['flocks-import-shipment', 'Import Shipment', '🚚', isImportShipmentManagement],
                    ['flocks-quarantine-record', 'Quarantine Record', '🧪', isQuarantineRecordManagement],
                  ].map(([page, label, icon, isActive]) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => { setActivePage(page); if (isSmallScreen) setIsSidebarOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'hatchery' ? null : 'hatchery')}
                aria-expanded={expandedMenu === 'hatchery'}
                aria-current={isHatcheryManagementMenu ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isHatcheryManagementMenu ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">🥚</span>
                <span className="flex-1">Hatchery</span>
                <span aria-hidden="true">{expandedMenu === 'hatchery' || isHatcheryManagementMenu ? '⌃' : '⌄'}</span>
              </button>
              {(expandedMenu === 'hatchery' || isHatcheryManagementMenu) && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  {[
                    ['flocks-hatchery', 'Hatchery setup', '🥚', isHatcherySetupManagement],
                    ['flocks-hatchery-batch', 'Hatchery batch setup', '🧺', isHatcheryBatchManagement],
                    ['hatchery-chick-batch', 'Chicken Batch', '🐤', isHatcheryChickBatchManagement],
                  ].map(([page, label, icon, isActive]) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => { setActivePage(page); if (isSmallScreen) setIsSidebarOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'master-data' ? null : 'master-data')}
                aria-expanded={expandedMenu === 'master-data'}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isLookupManagement || isMortalityReasonManagement || isCompanyRegistration || isFarmRegistration || isHouseRegistration || isSupplierManagement || isWarehouseManagement || isMasterDataProductionManagement || isMasterDataProductionBatchManagement || isMasterDataProductionCategoryManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">🗂️</span>
                <span className="flex-1">Master Data</span>
                <span aria-hidden="true">{expandedMenu === 'master-data' ? '⌃' : '⌄'}</span>
              </button>
              {expandedMenu === 'master-data' && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  <button
                    type="button"
                    onClick={() => { setActivePage('lookup-registration'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isLookupManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏷️</span>
                    <span>Lookup Registration</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('mortality-reason-management'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isMortalityReasonManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🩺</span>
                    <span>Mortality Reason</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('company-registration'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isCompanyRegistration ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏢</span>
                    <span>Companies</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('farm-registration'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isFarmRegistration ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🚜</span>
                    <span>Farms</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('house-registration'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isHouseRegistration ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏠</span>
                    <span>Houses</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('master-supplier'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isSupplierManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🚛</span>
                    <span>Supplier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('inventory-warehouse'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isWarehouseManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🏬</span>
                    <span>Warehouse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('master-production'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isMasterDataProductionManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">📦</span>
                    <span>Production</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('master-production-batch'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isMasterDataProductionBatchManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🧪</span>
                    <span>Production Batch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('master-production-category'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isMasterDataProductionCategoryManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🗃️</span>
                    <span>Production Category</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'monitoring' ? null : 'monitoring')}
                aria-expanded={expandedMenu === 'monitoring'}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isAlertLogManagement || isAuditLogManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">📡</span>
                <span className="flex-1">Monitoring &amp; Audit</span>
                <span aria-hidden="true">{expandedMenu === 'monitoring' ? '⌃' : '⌄'}</span>
              </button>
              {expandedMenu === 'monitoring' && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  <button
                    type="button"
                    onClick={() => { setActivePage('alert-log'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isAlertLogManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🚨</span>
                    <span>Alert Log</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePage('audit-log'); if (isSmallScreen) setIsSidebarOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isAuditLogManagement ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base" aria-hidden="true">🧾</span>
                    <span>Audit Log</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setExpandedMenu((current) => current === 'users' ? null : 'users')}
                aria-expanded={expandedMenu === 'users'}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition ${
                  isUserManagement || isSecurityManagement ? 'bg-white/15 text-white shadow-inner' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">👥</span>
                <span className="flex-1">Users &amp; Roles</span>
                <span aria-hidden="true">{expandedMenu === 'users' ? '⌃' : '⌄'}</span>
              </button>
              {expandedMenu === 'users' && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/20 pl-3">
                  {[
                    ['users-list', 'User list'],
                    ['users-create', 'Add user'],
                    ['users-deleted', 'Deleted users'],
                    ['security-forms', 'Form setup'],
                    ['security-permissions', 'Permission setup'],
                    ['security-roles', 'Role setup'],
                    ['security-role-permissions', 'Role-Permission setup'],
                  ].map(([page, label]) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => { setActivePage(page); if (isSmallScreen) setIsSidebarOpen(false); }}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        activePage === page ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium text-white/85 transition hover:bg-white/10"
            >
              <span className="flex h-6 w-6 items-center justify-center text-lg">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>

          <div className="mt-10 rounded-2xl bg-[#0a5c41] p-4 text-center shadow-inner">
            <div className="mb-2 flex justify-center text-3xl">🐓</div>
            <div className="text-2xl font-bold leading-tight">Healthy Birds</div>
            <div className="text-3xl font-black tracking-tight">Higher Profits</div>
          </div>
        </aside>

        <main className="flex-1 bg-[#f4f7f5]">
          <header className="flex flex-col gap-3 border-b border-[#dfe8e1] bg-[#f6faf7] px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              {isSmallScreen && (
                <button
                  type="button"
                  aria-label={isSidebarOpen ? 'Close sidebar menu' : 'Open sidebar menu'}
                  onClick={() => setIsSidebarOpen((open) => !open)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#edf3ee] text-xl text-[#1d2b2a] shadow-sm"
                >
                  ☰
                </button>
              )}
              <div className="min-w-0">
                <div className="text-xl font-bold tracking-tight text-[#1f2d2a] sm:text-2xl">{pageTitle}</div>
                <div className="text-xs text-[#5d6d68] sm:text-sm">{pageSubtitle}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
              {activePage === 'dashboard' && <button
                type="button"
                onClick={() => setDashboardRefreshKey((current) => current + 1)}
                disabled={isRefreshingDashboard}
                className="rounded-xl border border-[#b8d8c4] bg-white px-3 py-2 text-sm font-semibold text-[#0c6d4d] shadow-sm hover:bg-[#edf9f2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshingDashboard ? 'Refreshing...' : '↻ Refresh'}
              </button>}
              <div className="hidden items-center gap-3 rounded-xl border border-[#dfe8e1] bg-white px-3 py-2 shadow-sm sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e6f7ed] text-sm">🐓</div>
                <span className="text-sm font-semibold text-[#1e312c]">Main Farm</span>
                <span className="text-lg text-[#5d6d68]">▾</span>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-[#dfe8e1] bg-white px-3 py-2 shadow-sm lg:flex">
                <span className="text-base">📅</span>
                <span className="text-sm font-medium text-[#1e312c]">May 18 - May 24, 2025</span>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e6f7ed] text-xl">🔔</div>

              <UserProfileMenu user={user} onNavigate={setActivePage} onLogout={onLogout} />
            </div>
          </header>

          {isUserManagement ? <UserManagement key={activePage} currentUser={user} view={activePage} /> : isSecurityFormManagement ? (
            <SecurityFormManagement currentUser={user} />
          ) : isSecurityPermissionManagement ? (
            <SecurityPermissionManagement currentUser={user} />
          ) : isSecurityRoleManagement ? (
            <SecurityRoleManagement currentUser={user} />
          ) : isSecurityRolePermissionManagement ? (
            <SecurityRolePermissionManagement currentUser={user} />
          ) : isLookupManagement ? (
            <LookupManagement currentUser={user} />
          ) : isMortalityReasonManagement ? (
            <MortalityReasonManagement currentUser={user} />
          ) : isCompanyRegistration ? (
            <CompanyRegistration currentUser={user} />
          ) : isFarmRegistration ? (
            <FarmRegistration currentUser={user} />
          ) : isHouseRegistration ? (
            <Houses currentUser={user} />
          ) : isMasterDataProductionManagement ? (
            <ProductManagement currentUser={user} />
          ) : isMasterDataProductionBatchManagement ? (
            <ProductBatchForm currentUser={user} onCancel={() => setActivePage('dashboard')} onSaved={() => {}} />
          ) : isMasterDataProductionCategoryManagement ? (
            <ProductCategoryManagement currentUser={user} />
          ) : isSupplierManagement ? (
            <SupplierForm currentUser={user} onCancel={() => setActivePage('dashboard')} onSaved={() => {}} />
          ) : isInventoryWarehouseManagement ? (
            <WarehouseForm currentUser={user} onCancel={() => setActivePage('dashboard')} onSaved={() => {}} />
          ) : isInventoryStockBalanceManagement ? (
            <StockBalanceForm currentUser={user} onCancel={() => setActivePage('dashboard')} onSaved={() => {}} />
          ) : isInventoryStockMovementManagement ? (
            <StockMovementForm currentUser={user} onCancel={() => setActivePage('dashboard')} onSaved={() => {}} />
          ) : isFlockBreedManagement ? (
            <FlockBreedManagement currentUser={user} />
          ) : isFlockStrainManagement ? (
            <FlockStrainManagement currentUser={user} />
          ) : isCreateFlockManagement ? (
            <CreateFlockManagement currentUser={user} />
          ) : isFlockPlacementManagement ? (
            <FlockPlacementManagement currentUser={user} />
          ) : isFlockMortalityManagement ? (
            <FlockMortalityManagement currentUser={user} />
          ) : isImportShipmentManagement ? (
            <ImportShipmentForm currentUser={user} onSaved={() => {}} onCancel={() => setActivePage('dashboard')} />
          ) : isQuarantineRecordManagement ? (
            <QuarantineRecordForm currentUser={user} onSaved={() => {}} onCancel={() => setActivePage('dashboard')} />
          ) : isHatcherySetupManagement ? (
            <HatcherySetupManagement currentUser={user} />
          ) : isHatcheryBatchManagement ? (
            <HatcheryBatchManagement currentUser={user} />
          ) : isHatcheryChickBatchManagement ? (
            <ChickBatchForm currentUser={user} onSaved={() => {}} onCancel={() => setActivePage('dashboard')} />
          ) : isRearingDailyManagement ? (
            <RearingDailyManagement currentUser={user} />
          ) : isBroilerDailyRecordManagement ? (
            <BroilerDailyRecordForm currentUser={user} />
          )  : isProductionDailyManagement ? (
            <ProductionDailyManagement currentUser={user} />
          )  : isFeedTypeManagement ? (
            <FeedTypeManagement currentUser={user} />
          ) : isFeedConsumptionManagement ? (
            <FeedConsumptionManagement currentUser={user} />
          ) : isWaterConsumptionManagement ? (
            <WaterConsumptionManagement currentUser={user} />
          ) : isVaccinationRecordManagement ? (
            <VaccinationRecordManagement currentUser={user} />
          ) : isHealthIncidentManagement ? (
            <HealthIncidentManagement currentUser={user} />
          ) : isTreatmentManagement ? (
            <TreatmentManagement currentUser={user} />
          ) : isMortalityReportManagement ? (
            <MortalityReportManagement currentUser={user} />
          ) : isProductionMortalityByReasonReportManagement ? (
            <ProductionMortalityByReasonReport currentUser={user} />
          ) : isRearingMortalityByReasonReportManagement ? (
            <RearingMortalityByReasonReport currentUser={user} />
          ) : isVaccinationReportManagement ? (
            <VaccinationReportManagement currentUser={user} />
          ) : isHREmployeeManagement ? (
            <HREmployeeManagement currentUser={user} />
          ) : isHRFarmAssignmentManagement ? (
            <HRFarmAssignmentManagement currentUser={user} />
          ) : isHRHouseAssignmentManagement ? (
            <HRHouseAssignmentManagement currentUser={user} />
          ) : isHREmployeeRoleManagement ? (
            <HREmployeeRoleManagement currentUser={user} />
          ) : isHREmployeeSignatureManagement ? (
            <HREmployeeSignatureManagement currentUser={user} />
          ) : isAlertLogManagement ? (
            <AlertLogManagement currentUser={user} />
          ) : isAuditLogManagement ? (
            <AuditLogManagement currentUser={user} />
          ) : isProfilePage ? (
            <ProfilePage currentUser={user} onUserUpdate={onUserUpdate} focusPicture={activePage === 'profile-picture'} />
          ) : activePage === 'account-security' ? (
            <AccountSecurityPage currentUser={user} onPasswordChanged={onPasswordChanged} />
          ) : (
            <div className="p-3 sm:p-5 lg:p-6">
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
                {dashboardStats.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[26px] border border-[#e7efe9] bg-[linear-gradient(135deg,#ffffff_0%,#f8faf8_100%)] p-4 shadow-[0_14px_35px_rgba(13,42,33,0.06)] ring-1 ring-[#edf3ee] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(13,42,33,0.09)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                     <div className="min-w-0 flex-1">
                       <div className="text-sm font-semibold text-[#4d615b]">{item.title}</div>
                       <div className={`mt-3 text-2xl font-black tracking-tight sm:text-3xl ${item.valueColor}`}>{item.value}</div>
                     </div>
                     <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.iconBg} text-2xl shadow-sm`}>
                       {item.icon}
                     </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-medium leading-relaxed text-[#6b7b77]">
                     {item.delta && <span className={item.valueColor}>{item.delta}</span>}
                     <span className="block min-w-0 wrap-break-word">{item.footer}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfa_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.05)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Birds by Category</div>
                    <span className="rounded-full bg-[#edf9f3] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#0c6d4d]">Live</span>
                  </div>

                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <div className="relative flex h-44 w-44 items-center justify-center rounded-full" style={donutStyle}>
                     <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-center shadow-inner ring-1 ring-[#edf2ee]">
                       <div>
                         <div className="text-2xl font-black text-[#1f2d2a]">{categoryTotal.toLocaleString()}</div>
                       </div>
                     </div>
                    </div>

                    <div className="w-full flex-1 space-y-3 text-sm">
                     {categoryData.map((item) => (
                       <div key={item.label} className="flex items-center justify-between gap-2 rounded-xl bg-[#f6faf7] px-2.5 py-2">
                         <div className="flex items-center gap-2">
                           <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                           <span className="text-[#374744]">{item.label}</span>
                         </div>
                         <span className="font-bold text-[#1f2d2a]">{item.value.toLocaleString()}</span>
                       </div>
                     ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfa_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.05)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Egg Production (Daily)</div>
                    <div className="rounded-full border border-[#dfeae3] bg-[#f5faf7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#465a56]">This Week</div>
                  </div>

                  <div className="h-48 overflow-hidden rounded-2xl bg-[#f7faf8] p-2">
                    <svg viewBox="0 0 320 140" className="h-full w-full">
                     <defs>
                       <linearGradient id="eggFill" x1="0" x2="0" y1="0" y2="1">
                         <stop offset="0%" stopColor="#2ecb7d" stopOpacity="0.22" />
                         <stop offset="100%" stopColor="#2ecb7d" stopOpacity="0.02" />
                       </linearGradient>
                     </defs>
                     {[0, 1, 2, 3, 4].map((line) => (
                       <line key={line} x1="0" x2="320" y1={20 + line * 25} y2={20 + line * 25} stroke="#e7eee9" strokeDasharray="4 6" />
                     ))}
                     {eggAreaPath && <path d={eggAreaPath} fill="url(#eggFill)" />}
                     {eggLinePath && <path d={eggLinePath} fill="none" stroke="#2ecb7d" strokeWidth="3" strokeLinecap="round" />}
                     {eggPoints.map((point, index) => (
                       <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#2ecb7d" />
                     ))}
                     <text x="14" y="16" fill="#7c8b86" fontSize="10">{maxEggValue.toLocaleString()}</text>
                     <text x="14" y="116" fill="#7c8b86" fontSize="10">0</text>
                    </svg>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#4a5855]">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#2ecb7d]" /> Eggs (nos)</div>
                    {eggLabels.length > 1 && <div>{formatShortDate(eggLabels[0])} - {formatShortDate(eggLabels[eggLabels.length - 1])}</div>}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfa_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.05)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Feed Consumption (kg)</div>
                    <div className="rounded-full border border-[#dfeae3] bg-[#f5faf7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#465a56]">This Week</div>
                  </div>

                  <div className="mt-4 flex h-48 items-end gap-2 rounded-2xl bg-[#f7faf8] p-2">
                    {(feedSeries.length ? feedSeries : [0]).map((value, index) => (
                     <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
                       <div className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#25b76f_0%,#1d9d62_100%)] shadow-inner" style={{ height: `${maxFeedValue > 0 ? (value / maxFeedValue) * 132 : 6}px` }} />
                     </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] text-[#6f7d78]">
                    {(feedLabels.length ? feedLabels : ['No data']).map((day) => (
                     <span key={day}>{formatShortDate(day)}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Flock Summary</div>
                  </div>

                  <div className="responsive-table-shell overflow-x-auto">
                    <table className="w-full min-w-105 text-left text-sm">
                     <thead>
                       <tr className="border-b border-[#e9efe9] text-[#51615d]">
                         <th className="pb-2 font-semibold">Flock Name</th>
                         <th className="pb-2 font-semibold">Type</th>
                         <th className="pb-2 font-semibold">Birds</th>
                         <th className="pb-2 font-semibold">Age</th>
                         <th className="pb-2 font-semibold">Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {flockSummary.map((item) => (
                         <tr key={item.name} className="border-b border-[#f0f3f1] text-[#30433f]">
                           <td className="py-2.5 font-semibold">{item.name}</td>
                           <td className="py-2.5">{item.type}</td>
                           <td className="py-2.5">{item.birds.toLocaleString()}</td>
                           <td className="py-2.5">{item.age}</td>
                           <td className="py-2.5">
                             <span className="rounded-full bg-[#eafaf0] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#198754]">{item.status}</span>
                           </td>
                         </tr>
                       ))}
                       {flockSummary.length === 0 && (
                         <tr>
                           <td colSpan="5" className="py-4 text-center text-[#6f7d78]">No flock data found.</td>
                         </tr>
                       )}
                     </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Mortality Trend</div>
                    <div className="rounded-full border border-[#dfeae3] bg-[#f5faf7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#465a56]">This Week</div>
                  </div>

                  <svg viewBox="0 0 320 150" className="h-40 w-full">
                    <defs>
                     <linearGradient id="mortalityFill" x1="0" x2="0" y1="0" y2="1">
                       <stop offset="0%" stopColor="#f27070" stopOpacity="0.22" />
                       <stop offset="100%" stopColor="#f27070" stopOpacity="0.04" />
                     </linearGradient>
                    </defs>
                    <g>
                     {[0, 1, 2, 3, 4].map((line) => (
                       <line key={line} x1="0" x2="320" y1={20 + line * 25} y2={20 + line * 25} stroke="#edf1ee" strokeDasharray="4 6" />
                     ))}
                     {mortalityAreaPath && <path d={mortalityAreaPath} fill="url(#mortalityFill)" />}
                     {mortalityLinePath && <path d={mortalityLinePath} fill="none" stroke="#ef5a5a" strokeWidth="3" strokeLinecap="round" />}
                     {mortalityPoints.map((point, index) => (
                       <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#ef5a5a" />
                     ))}
                    </g>
                  </svg>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Top Feed Usage</div>
                  </div>

                  <div className="flex items-center justify-center py-4">
                    <div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={feedDonutStyle}>
                     <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-center shadow-inner ring-1 ring-[#edf2ee]">
                       <div>
                         <div className="text-4xl font-black tracking-tight text-[#1f2d2a]">{totalFeedForUsage.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                         <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d6d68]">kg</div>
                       </div>
                     </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    {feedUse.map((item) => (
                     <div key={item.label} className="flex items-center justify-between rounded-xl bg-[#f6faf7] px-2.5 py-2">
                       <div className="flex items-center gap-2">
                         <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                         <span className="text-[#374744]">{item.label}</span>
                       </div>
                       <span className="font-bold text-[#1f2d2a]">{item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span>
                     </div>
                    ))}
                    {feedUse.length === 0 && <div className="text-[#6f7d78]">No feed usage records found.</div>}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Recent Activities</div>
                  </div>

                  <div className="space-y-3">
                    {recentActivities.map((activity, index) => (
                     <div key={`${activity.title}-${index}`} className="flex gap-3 rounded-2xl bg-[#f5faf6] p-3">
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e7f8ed] text-lg shadow-sm">{activity.icon}</div>
                       <div className="min-w-0 flex-1">
                         <div className="font-bold text-[#1d2d2b]">{activity.title}</div>
                         <div className="mt-1 text-xs leading-5 text-[#60716d]">{activity.description}</div>
                       </div>
                       <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5f6f6a]">{activity.time}</div>
                     </div>
                    ))}
                    {recentActivities.length === 0 && (
                     <div className="rounded-2xl bg-[#f5faf6] p-3 text-sm text-[#60716d]">
                       No recent production, rearing, or HR activities found.
                     </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-lg font-extrabold text-[#1f2d2a]">Vaccination Summary</div>
                    <select
                     value={vaccinationSummaryFlockId}
                     onChange={(event) => setVaccinationSummaryFlockId(event.target.value)}
                     className="h-10 w-full rounded-xl border border-[#dfe8e1] bg-white px-2.5 text-xs font-medium text-[#344642] outline-none transition focus:border-[#0f8b3d] focus:ring-2 focus:ring-[#a9e2bf] sm:w-auto"
                    >
                     <option value="">Select flock</option>
                     {[...flockRows]
                       .sort((a, b) => String(a.flock_number || '').localeCompare(String(b.flock_number || '')))
                       .map((row) => (
                         <option key={row.flock_id} value={row.flock_id}>
                           {row.flock_number || row.flock_id}
                         </option>
                       ))}
                    </select>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="rounded-xl bg-[#f4faf6] px-3 py-2 text-xs font-semibold text-[#5f6f6a]">
                     {vaccinationSummaryFlockNumber ? `Flock: ${vaccinationSummaryFlockNumber}` : 'Flock: N/A'}
                    </div>
                    {vaccinationSummaryRows.length === 0 && (
                     <div className="rounded-2xl bg-[#f5faf6] p-3 text-sm text-[#60716d]">
                       No vaccination summary records found.
                     </div>
                    )}
                    {vaccinationSummaryRows.slice(0, 4).map((item) => (
                     <div key={`${item.vaccine_name}-${item.first_given || ''}`} className="rounded-2xl bg-[#f8faf9] p-3">
                       <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                         <span className="font-semibold text-[#1d2d2b]">{item.vaccine_name || 'Unknown vaccine'}</span>
                         <span className="font-bold text-[#1d2d2b]">{Number(item.total_birds_vaccinated || 0).toLocaleString()} birds</span>
                       </div>
                       <div className="text-xs text-[#60716d]">
                         {Number(item.times_given || 0).toLocaleString()} doses, boosters: {Number(item.booster_count || 0).toLocaleString()}
                       </div>
                     </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#e7efe9] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] p-4 shadow-[0_12px_30px_rgba(13,42,33,0.04)]">
                  <div className="mb-4 text-lg font-extrabold text-[#1f2d2a]">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    {quickActions.map((action) => (
                     <button
                       key={action.label}
                       type="button"
                       onClick={() => runQuickAction(action)}
                       className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-[#dfeae3] bg-[linear-gradient(180deg,#f9fbfa_0%,#edf9f1_100%)] p-3 text-center transition hover:-translate-y-0.5 hover:border-[#9ecdb3] hover:bg-[#eefaf1]"
                     >
                       <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf8ef] text-lg text-[#0f8b3d] shadow-sm">
                         {action.icon}
                       </div>
                       <span className="text-sm font-bold text-[#1d2d2b]">{action.label}</span>
                     </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;
