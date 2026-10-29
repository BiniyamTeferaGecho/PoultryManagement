import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  batch_id: '',
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

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function batchToForm(batch) {
  return {
    ...emptyForm,
    ...batch,
    batch_id: batch.batch_id || '',
    hatchery_id: batch.hatchery_id || '',
    flock_id: batch.flock_id || '',
    breeding_group_id: batch.breeding_group_id || '',
    child_flock_id: batch.child_flock_id || '',
    batch_date: toDateInput(batch.batch_date),
    eggs_set_date: toDateInput(batch.eggs_set_date),
    eggs_set_count: batch.eggs_set_count ?? '',
    eggs_set_weight_kg: batch.eggs_set_weight_kg ?? '',
    incubation_start_date: toDateInput(batch.incubation_start_date),
    incubation_end_date: toDateInput(batch.incubation_end_date),
    hatch_date: toDateInput(batch.hatch_date),
    hatch_start_date: toDateInput(batch.hatch_start_date),
    hatch_end_date: toDateInput(batch.hatch_end_date),
    incubation_duration_days: batch.incubation_duration_days ?? '',
    incubation_temperature_avg: batch.incubation_temperature_avg ?? '',
    incubation_humidity_avg: batch.incubation_humidity_avg ?? '',
    eggs_fertile_count: batch.eggs_fertile_count ?? '',
    eggs_clear_count: batch.eggs_clear_count ?? '',
    eggs_dead_count: batch.eggs_dead_count ?? '',
    eggs_cracked_count: batch.eggs_cracked_count ?? '',
    total_chicks_hatched: batch.total_chicks_hatched ?? '',
    female_chicks_hatched: batch.female_chicks_hatched ?? '',
    male_chicks_hatched: batch.male_chicks_hatched ?? '',
    chicks_rejected: batch.chicks_rejected ?? '0',
    chicks_sold: batch.chicks_sold ?? '0',
    chicks_transferred: batch.chicks_transferred ?? '0',
    chick_quality_rating: batch.chick_quality_rating || '',
    chick_weight_avg: batch.chick_weight_avg ?? '',
    chick_size_avg: batch.chick_size_avg ?? '',
    remarks: batch.remarks || '',
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

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

export default function HatcheryBatchManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [hatcheries, setHatcheries] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [batchPayload, hatcheryPayload, flockPayload] = await Promise.all([
        apiRequest('/hatchery/batch?page_number=1&page_size=50', currentUser.accessToken),
        apiRequest('/hatchery?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100&status=Active', currentUser.accessToken),
      ]);
      setRows(Array.isArray(batchPayload.data) ? batchPayload.data : []);
      setHatcheries(Array.isArray(hatcheryPayload.data) ? hatcheryPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
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
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const eggsSetCount = Number(form.eggs_set_count);
      const totalChicksHatched = numberOrNull(form.total_chicks_hatched);
      const femaleChicksHatched = numberOrNull(form.female_chicks_hatched);
      const maleChicksHatched = numberOrNull(form.male_chicks_hatched);
      const chicksRejected = numberOrNull(form.chicks_rejected) ?? 0;
      const chicksSold = numberOrNull(form.chicks_sold) ?? 0;
      const chicksTransferred = numberOrNull(form.chicks_transferred) ?? 0;
      const eggsFertileCount = numberOrNull(form.eggs_fertile_count);
      const eggsClearCount = numberOrNull(form.eggs_clear_count);
      const eggsDeadCount = numberOrNull(form.eggs_dead_count);
      const eggsCrackedCount = numberOrNull(form.eggs_cracked_count);

      if (totalChicksHatched !== null && totalChicksHatched > eggsSetCount) throw new Error('Total chicks hatched must be less than or equal to eggs set count.');
      if (femaleChicksHatched !== null && totalChicksHatched !== null && femaleChicksHatched > totalChicksHatched) throw new Error('Female chicks hatched must be less than or equal to total chicks hatched.');
      if (maleChicksHatched !== null && totalChicksHatched !== null && maleChicksHatched > totalChicksHatched) throw new Error('Male chicks hatched must be less than or equal to total chicks hatched.');
      if (totalChicksHatched !== null && (chicksRejected + chicksSold + chicksTransferred) > totalChicksHatched) throw new Error('Rejected + sold + transferred chicks cannot exceed total chicks hatched.');
      if (eggsFertileCount !== null && eggsClearCount !== null && eggsDeadCount !== null && eggsCrackedCount !== null && (eggsFertileCount + eggsClearCount + eggsDeadCount + eggsCrackedCount) > eggsSetCount) {
        throw new Error('Fertile + clear + dead + cracked eggs cannot exceed eggs set count.');
      }

      const isEditing = Boolean(form.batch_id);
      const result = await apiRequest(isEditing ? `/hatchery/batch/${form.batch_id}` : '/hatchery/batch', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          breeding_group_id: form.breeding_group_id || null,
          child_flock_id: form.child_flock_id || null,
          incubation_end_date: form.incubation_end_date || null,
          hatch_date: form.hatch_date || null,
          hatch_start_date: form.hatch_start_date || null,
          hatch_end_date: form.hatch_end_date || null,
          incubation_duration_days: numberOrNull(form.incubation_duration_days),
          incubation_temperature_avg: numberOrNull(form.incubation_temperature_avg),
          incubation_humidity_avg: numberOrNull(form.incubation_humidity_avg),
          eggs_set_count: eggsSetCount,
          eggs_set_weight_kg: numberOrNull(form.eggs_set_weight_kg),
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
          chick_quality_rating: form.chick_quality_rating || null,
          chick_weight_avg: numberOrNull(form.chick_weight_avg),
          chick_size_avg: numberOrNull(form.chick_size_avg),
          remarks: form.remarks || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing
        ? 'Hatchery batch updated successfully.'
        : `Hatchery batch created successfully (${result.data?.batch_number || 'generated code'}).`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(batchToForm(row));
    setError('');
    setMessage('');
  }

  async function deleteBatch(row) {
    if (!window.confirm(`Delete batch ${row.batch_number}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hatchery/batch/${row.batch_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.batch_id === row.batch_id) setForm(emptyForm);
      setMessage('Hatchery batch deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Hatchery Batch Setup</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and view hatchery batches.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatchery</span><select required value={form.hatchery_id} onChange={(event) => setForm((current) => ({ ...current, hatchery_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select hatchery</option>{hatcheries.map((row) => <option key={row.hatchery_id} value={row.hatchery_id}>{row.hatchery_code} - {row.hatchery_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => setForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Batch date</span><input required type="date" value={form.batch_date} onChange={(event) => setForm((current) => ({ ...current, batch_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Eggs set date</span><input required type="date" value={form.eggs_set_date} onChange={(event) => setForm((current) => ({ ...current, eggs_set_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Eggs set count</span><input required min="0" type="number" value={form.eggs_set_count} onChange={(event) => setForm((current) => ({ ...current, eggs_set_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubation start date</span><input required type="date" value={form.incubation_start_date} onChange={(event) => setForm((current) => ({ ...current, incubation_start_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubation end date</span><input type="date" value={form.incubation_end_date} onChange={(event) => setForm((current) => ({ ...current, incubation_end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatch date</span><input type="date" value={form.hatch_date} onChange={(event) => setForm((current) => ({ ...current, hatch_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatch start date</span><input type="date" value={form.hatch_start_date} onChange={(event) => setForm((current) => ({ ...current, hatch_start_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Hatch end date</span><input type="date" value={form.hatch_end_date} onChange={(event) => setForm((current) => ({ ...current, hatch_end_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Eggs weight (kg)</span><input type="number" min="0" step="0.01" value={form.eggs_set_weight_kg} onChange={(event) => setForm((current) => ({ ...current, eggs_set_weight_kg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubation duration (days)</span><input type="number" min="0" value={form.incubation_duration_days} onChange={(event) => setForm((current) => ({ ...current, incubation_duration_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubation temp avg</span><input type="number" step="0.01" value={form.incubation_temperature_avg} onChange={(event) => setForm((current) => ({ ...current, incubation_temperature_avg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Incubation humidity avg</span><input type="number" step="0.01" value={form.incubation_humidity_avg} onChange={(event) => setForm((current) => ({ ...current, incubation_humidity_avg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Fertile eggs</span><input type="number" min="0" value={form.eggs_fertile_count} onChange={(event) => setForm((current) => ({ ...current, eggs_fertile_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Clear eggs</span><input type="number" min="0" value={form.eggs_clear_count} onChange={(event) => setForm((current) => ({ ...current, eggs_clear_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Dead eggs</span><input type="number" min="0" value={form.eggs_dead_count} onChange={(event) => setForm((current) => ({ ...current, eggs_dead_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Cracked eggs</span><input type="number" min="0" value={form.eggs_cracked_count} onChange={(event) => setForm((current) => ({ ...current, eggs_cracked_count: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Total chicks hatched</span><input min="0" type="number" value={form.total_chicks_hatched} onChange={(event) => setForm((current) => ({ ...current, total_chicks_hatched: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Female chicks hatched</span><input min="0" type="number" value={form.female_chicks_hatched} onChange={(event) => setForm((current) => ({ ...current, female_chicks_hatched: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Male chicks hatched</span><input min="0" type="number" value={form.male_chicks_hatched} onChange={(event) => setForm((current) => ({ ...current, male_chicks_hatched: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chicks rejected</span><input min="0" type="number" value={form.chicks_rejected} onChange={(event) => setForm((current) => ({ ...current, chicks_rejected: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chicks sold</span><input min="0" type="number" value={form.chicks_sold} onChange={(event) => setForm((current) => ({ ...current, chicks_sold: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chicks transferred</span><input min="0" type="number" value={form.chicks_transferred} onChange={(event) => setForm((current) => ({ ...current, chicks_transferred: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chick quality rating</span><input value={form.chick_quality_rating} onChange={(event) => setForm((current) => ({ ...current, chick_quality_rating: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chick weight avg</span><input type="number" min="0" step="0.01" value={form.chick_weight_avg} onChange={(event) => setForm((current) => ({ ...current, chick_weight_avg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Chick size avg</span><input type="number" min="0" step="0.01" value={form.chick_size_avg} onChange={(event) => setForm((current) => ({ ...current, chick_size_avg: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Remarks</span>
          <textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          {form.batch_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.batch_id ? 'Save batch changes' : 'Save batch'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Batches</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Batch</th><th className="px-2 py-2 font-semibold">Hatchery</th><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Eggs set</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading batches...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No batches found.</td></tr> : rows.map((row) => (
                <tr key={row.batch_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.batch_number}</td><td className="px-2 py-2">{row.hatchery_name}</td><td className="px-2 py-2">{row.flock_number}</td><td className="px-2 py-2">{row.eggs_set_count ?? 0}</td><td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteBatch(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
