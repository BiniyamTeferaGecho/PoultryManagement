import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOOKUP_PAGE_SIZE = 100;

const emptyHatchery = {
  company_id: '',
  hatchery_name: '',
  location: '',
  capacity_eggs: '',
  capacity_chicks: '',
  incubator_count: '',
  hatcher_count: '',
  incubation_temp_default: '37.5',
  incubation_humidity_default: '55.0',
  hatchery_manager: '',
  status: 'Active',
};

const emptyBatch = {
  hatchery_id: '',
  flock_id: '',
  breeding_group_id: '',
  child_flock_id: '',
  batch_date: '',
  eggs_set_date: '',
  eggs_set_count: '',
  eggs_set_weight_kg: '',
  incubation_start_date: '',
  incubation_end_date: '',
  hatch_date: '',
  hatch_start_date: '',
  hatch_end_date: '',
  incubation_duration_days: '',
  incubation_temperature_avg: '',
  incubation_humidity_avg: '',
  eggs_fertile_count: '',
  eggs_clear_count: '',
  eggs_dead_count: '',
  eggs_cracked_count: '',
  total_chicks_hatched: '',
  female_chicks_hatched: '',
  male_chicks_hatched: '',
  chicks_rejected: '0',
  chicks_sold: '0',
  chicks_transferred: '0',
  chick_quality_rating: '',
  chick_weight_avg: '',
  chick_size_avg: '',
  remarks: '',
};

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

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

export default function HatcheryManagement({ currentUser }) {
  const [hatcheryForm, setHatcheryForm] = useState(emptyHatchery);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [hatcheries, setHatcheries] = useState([]);
  const [batches, setBatches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeHatcheries = useMemo(() => hatcheries.filter((row) => !row.is_deleted && row.status === 'Active'), [hatcheries]);
  const activeFlocks = useMemo(() => flocks.filter((row) => row.status === 'Active'), [flocks]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) {
      setError('Your session does not include an access token. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [hatcheryPayload, batchPayload, companyPayload, flockPayload] = await Promise.all([
        apiRequest('/hatchery?page_number=1&page_size=50&include_deleted=0', currentUser.accessToken),
        apiRequest('/hatchery/batch?page_number=1&page_size=50', currentUser.accessToken),
        apiRequest(`/company?${new URLSearchParams({ page_number: '1', page_size: String(LOOKUP_PAGE_SIZE), include_deleted: '0' })}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
      ]);
      setHatcheries(Array.isArray(hatcheryPayload.data) ? hatcheryPayload.data : []);
      setBatches(Array.isArray(batchPayload.data) ? batchPayload.data : []);
      setCompanies(Array.isArray(companyPayload.data) ? companyPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setHatcheries([]);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitHatchery(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...hatcheryForm,
        capacity_eggs: numberOrNull(hatcheryForm.capacity_eggs),
        capacity_chicks: numberOrNull(hatcheryForm.capacity_chicks),
        incubator_count: numberOrNull(hatcheryForm.incubator_count),
        hatcher_count: numberOrNull(hatcheryForm.hatcher_count),
        incubation_temp_default: numberOrNull(hatcheryForm.incubation_temp_default) ?? 37.5,
        incubation_humidity_default: numberOrNull(hatcheryForm.incubation_humidity_default) ?? 55.0,
        created_by: currentUser.user_id || null,
      };
      const result = await apiRequest('/hatchery', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setHatcheryForm(emptyHatchery);
      setMessage(`Hatchery created successfully. Generated code: ${result.data?.hatchery_code || 'N/A'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitBatch(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const eggsSetCount = Number(batchForm.eggs_set_count);
      const totalChicksHatched = numberOrNull(batchForm.total_chicks_hatched);
      const femaleChicksHatched = numberOrNull(batchForm.female_chicks_hatched);
      const maleChicksHatched = numberOrNull(batchForm.male_chicks_hatched);
      const chicksRejected = numberOrNull(batchForm.chicks_rejected) ?? 0;
      const chicksSold = numberOrNull(batchForm.chicks_sold) ?? 0;
      const chicksTransferred = numberOrNull(batchForm.chicks_transferred) ?? 0;
      const eggsFertileCount = numberOrNull(batchForm.eggs_fertile_count);
      const eggsClearCount = numberOrNull(batchForm.eggs_clear_count);
      const eggsDeadCount = numberOrNull(batchForm.eggs_dead_count);
      const eggsCrackedCount = numberOrNull(batchForm.eggs_cracked_count);

      if (totalChicksHatched !== null && totalChicksHatched > eggsSetCount) throw new Error('Total chicks hatched must be less than or equal to eggs set count.');
      if (femaleChicksHatched !== null && totalChicksHatched !== null && femaleChicksHatched > totalChicksHatched) throw new Error('Female chicks hatched must be less than or equal to total chicks hatched.');
      if (maleChicksHatched !== null && totalChicksHatched !== null && maleChicksHatched > totalChicksHatched) throw new Error('Male chicks hatched must be less than or equal to total chicks hatched.');
      if (totalChicksHatched !== null && (chicksRejected + chicksSold + chicksTransferred) > totalChicksHatched) throw new Error('Rejected + sold + transferred chicks cannot exceed total chicks hatched.');
      if (eggsFertileCount !== null && eggsClearCount !== null && eggsDeadCount !== null && eggsCrackedCount !== null && (eggsFertileCount + eggsClearCount + eggsDeadCount + eggsCrackedCount) > eggsSetCount) {
        throw new Error('Fertile + clear + dead + cracked eggs cannot exceed eggs set count.');
      }

      const payload = {
        ...batchForm,
        breeding_group_id: batchForm.breeding_group_id || null,
        child_flock_id: batchForm.child_flock_id || null,
        incubation_end_date: batchForm.incubation_end_date || null,
        hatch_date: batchForm.hatch_date || null,
        hatch_start_date: batchForm.hatch_start_date || null,
        hatch_end_date: batchForm.hatch_end_date || null,
        chick_quality_rating: batchForm.chick_quality_rating || null,
        remarks: batchForm.remarks || null,
        eggs_set_count: eggsSetCount,
        eggs_set_weight_kg: numberOrNull(batchForm.eggs_set_weight_kg),
        incubation_duration_days: numberOrNull(batchForm.incubation_duration_days),
        incubation_temperature_avg: numberOrNull(batchForm.incubation_temperature_avg),
        incubation_humidity_avg: numberOrNull(batchForm.incubation_humidity_avg),
        eggs_fertile_count: eggsFertileCount,
        eggs_clear_count: eggsClearCount,
        eggs_dead_count: eggsDeadCount,
        eggs_cracked_count: eggsCrackedCount,
        total_chicks_hatched: totalChicksHatched,
        female_chicks_hatched: femaleChicksHatched,
        male_chicks_hatched: maleChicksHatched,
        chicks_rejected: chicksRejected,
        chicks_sold: chicksSold,
        chicks_transferred: chicksTransferred,
        chick_weight_avg: numberOrNull(batchForm.chick_weight_avg),
        chick_size_avg: numberOrNull(batchForm.chick_size_avg),
        created_by: currentUser.user_id || null,
      };
      const result = await apiRequest('/hatchery/batch', currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setBatchForm(emptyBatch);
      setMessage(`Hatchery batch created successfully. Generated batch number: ${result.data?.batch_number || 'N/A'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1f2d2a]">Hatchery Management</h2>
          <p className="mt-1 text-sm text-[#5d6d68]">Manage hatcheries and hatchery production batches.</p>
        </div>
        <button type="button" onClick={loadData} className="rounded-xl border border-[#dfe8e1] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#f4f7f5]">Refresh</button>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form onSubmit={submitHatchery} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Create Hatchery</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select required value={hatcheryForm.company_id} onChange={(event) => setHatcheryForm((current) => ({ ...current, company_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select company</option>
              {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_code} - {company.company_name}</option>)}
            </select>
            <input required value={hatcheryForm.hatchery_name} onChange={(event) => setHatcheryForm((current) => ({ ...current, hatchery_name: event.target.value }))} placeholder="Hatchery name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input value={hatcheryForm.location} onChange={(event) => setHatcheryForm((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input value={hatcheryForm.hatchery_manager} onChange={(event) => setHatcheryForm((current) => ({ ...current, hatchery_manager: event.target.value }))} placeholder="Hatchery manager" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={hatcheryForm.capacity_eggs} onChange={(event) => setHatcheryForm((current) => ({ ...current, capacity_eggs: event.target.value }))} placeholder="Egg capacity" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={hatcheryForm.capacity_chicks} onChange={(event) => setHatcheryForm((current) => ({ ...current, capacity_chicks: event.target.value }))} placeholder="Chick capacity" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={hatcheryForm.incubator_count} onChange={(event) => setHatcheryForm((current) => ({ ...current, incubator_count: event.target.value }))} placeholder="Incubator count" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={hatcheryForm.hatcher_count} onChange={(event) => setHatcheryForm((current) => ({ ...current, hatcher_count: event.target.value }))} placeholder="Hatcher count" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" step="0.01" value={hatcheryForm.incubation_temp_default} onChange={(event) => setHatcheryForm((current) => ({ ...current, incubation_temp_default: event.target.value }))} placeholder="Default temp" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" step="0.01" value={hatcheryForm.incubation_humidity_default} onChange={(event) => setHatcheryForm((current) => ({ ...current, incubation_humidity_default: event.target.value }))} placeholder="Default humidity" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <select value={hatcheryForm.status} onChange={(event) => setHatcheryForm((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option>Active</option><option>Inactive</option><option>Maintenance</option></select>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save hatchery'}</button>
          </div>
        </form>

        <form onSubmit={submitBatch} className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Create Hatchery Batch</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select required value={batchForm.hatchery_id} onChange={(event) => setBatchForm((current) => ({ ...current, hatchery_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select hatchery</option>
              {activeHatcheries.map((hatchery) => <option key={hatchery.hatchery_id} value={hatchery.hatchery_id}>{hatchery.hatchery_code} - {hatchery.hatchery_name}</option>)}
            </select>
            <select required value={batchForm.flock_id} onChange={(event) => setBatchForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select flock</option>
              {activeFlocks.map((flock) => <option key={flock.flock_id} value={flock.flock_id}>{flock.flock_number} - {flock.farm_name}</option>)}
            </select>
            <input type="date" required value={batchForm.batch_date} onChange={(event) => setBatchForm((current) => ({ ...current, batch_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" required value={batchForm.eggs_set_date} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_set_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" required min="0" value={batchForm.eggs_set_count} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_set_count: event.target.value }))} placeholder="Eggs set count" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" required value={batchForm.incubation_start_date} onChange={(event) => setBatchForm((current) => ({ ...current, incubation_start_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" step="0.01" value={batchForm.eggs_set_weight_kg} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_set_weight_kg: event.target.value }))} placeholder="Egg set weight (kg)" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={batchForm.incubation_end_date} onChange={(event) => setBatchForm((current) => ({ ...current, incubation_end_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={batchForm.hatch_date} onChange={(event) => setBatchForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={batchForm.hatch_start_date} onChange={(event) => setBatchForm((current) => ({ ...current, hatch_start_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="date" value={batchForm.hatch_end_date} onChange={(event) => setBatchForm((current) => ({ ...current, hatch_end_date: event.target.value }))} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.incubation_duration_days} onChange={(event) => setBatchForm((current) => ({ ...current, incubation_duration_days: event.target.value }))} placeholder="Incubation duration (days)" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" step="0.01" value={batchForm.incubation_temperature_avg} onChange={(event) => setBatchForm((current) => ({ ...current, incubation_temperature_avg: event.target.value }))} placeholder="Incubation temp avg" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" step="0.01" value={batchForm.incubation_humidity_avg} onChange={(event) => setBatchForm((current) => ({ ...current, incubation_humidity_avg: event.target.value }))} placeholder="Incubation humidity avg" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.eggs_fertile_count} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_fertile_count: event.target.value }))} placeholder="Fertile eggs" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.eggs_clear_count} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_clear_count: event.target.value }))} placeholder="Clear eggs" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.eggs_dead_count} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_dead_count: event.target.value }))} placeholder="Dead eggs" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.eggs_cracked_count} onChange={(event) => setBatchForm((current) => ({ ...current, eggs_cracked_count: event.target.value }))} placeholder="Cracked eggs" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.total_chicks_hatched} onChange={(event) => setBatchForm((current) => ({ ...current, total_chicks_hatched: event.target.value }))} placeholder="Total chicks hatched" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.female_chicks_hatched} onChange={(event) => setBatchForm((current) => ({ ...current, female_chicks_hatched: event.target.value }))} placeholder="Female chicks hatched" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.male_chicks_hatched} onChange={(event) => setBatchForm((current) => ({ ...current, male_chicks_hatched: event.target.value }))} placeholder="Male chicks hatched" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.chicks_rejected} onChange={(event) => setBatchForm((current) => ({ ...current, chicks_rejected: event.target.value }))} placeholder="Chicks rejected" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.chicks_sold} onChange={(event) => setBatchForm((current) => ({ ...current, chicks_sold: event.target.value }))} placeholder="Chicks sold" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" value={batchForm.chicks_transferred} onChange={(event) => setBatchForm((current) => ({ ...current, chicks_transferred: event.target.value }))} placeholder="Chicks transferred" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input value={batchForm.chick_quality_rating} onChange={(event) => setBatchForm((current) => ({ ...current, chick_quality_rating: event.target.value }))} placeholder="Chick quality rating" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" step="0.01" value={batchForm.chick_weight_avg} onChange={(event) => setBatchForm((current) => ({ ...current, chick_weight_avg: event.target.value }))} placeholder="Chick weight avg" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
            <input type="number" min="0" step="0.01" value={batchForm.chick_size_avg} onChange={(event) => setBatchForm((current) => ({ ...current, chick_size_avg: event.target.value }))} placeholder="Chick size avg" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </div>
          <textarea value={batchForm.remarks} onChange={(event) => setBatchForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Remarks" rows="2" className="mt-3 w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Save batch'}</button>
          </div>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Hatcheries</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Code</th><th className="px-2 py-2 font-semibold">Name</th><th className="px-2 py-2 font-semibold">Location</th><th className="px-2 py-2 font-semibold">Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">Loading hatcheries...</td></tr> : hatcheries.length === 0 ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">No hatcheries found.</td></tr> : hatcheries.slice(0, 10).map((row) => (
                  <tr key={row.hatchery_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.hatchery_code}</td>
                    <td className="px-2 py-2">{row.hatchery_name}</td>
                    <td className="px-2 py-2">{row.location || '—'}</td>
                    <td className="px-2 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Recent Hatchery Batches</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
              <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Batch</th><th className="px-2 py-2 font-semibold">Hatchery</th><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Eggs set</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">Loading batches...</td></tr> : batches.length === 0 ? <tr><td colSpan="4" className="px-2 py-6 text-center text-[#5d6d68]">No batches found.</td></tr> : batches.slice(0, 10).map((row) => (
                  <tr key={row.batch_id} className="border-b border-[#f0f3f1]">
                    <td className="px-2 py-2 font-mono text-xs">{row.batch_number}</td>
                    <td className="px-2 py-2">{row.hatchery_name}</td>
                    <td className="px-2 py-2">{row.flock_number}</td>
                    <td className="px-2 py-2">{row.eggs_set_count ?? 0}</td>
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
