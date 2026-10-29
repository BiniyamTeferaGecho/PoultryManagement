import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  placement_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  placement_date: '',
  removal_date: '',
  females_placed: '',
  males_placed: '',
  age_at_placement: '',
  source_location: '',
  transfer_reason: '',
  movement_id: '',
  is_current: true,
  placed_by: '',
  remarks: '',
};

function placementToForm(placement) {
  return {
    ...emptyForm,
    placement_id: placement.placement_id || '',
    flock_id: placement.flock_id || '',
    farm_id: placement.farm_id || '',
    house_id: placement.house_id || '',
    placement_date: placement.placement_date ? String(placement.placement_date).slice(0, 10) : '',
    removal_date: placement.removal_date ? String(placement.removal_date).slice(0, 10) : '',
    females_placed: placement.females_placed ?? '',
    males_placed: placement.males_placed ?? '',
    age_at_placement: placement.age_at_placement ?? '',
    source_location: placement.source_location || '',
    transfer_reason: placement.transfer_reason || '',
    movement_id: placement.movement_id || '',
    is_current: Boolean(placement.is_current),
    placed_by: placement.placed_by || '',
    remarks: placement.remarks || '',
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

export default function FlockPlacementManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [placements, setPlacements] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const selectedFlock = useMemo(() => flocks.find((row) => row.flock_id === form.flock_id) || null, [flocks, form.flock_id]);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [placementPayload, flockPayload, farmPayload, housePayload] = await Promise.all([
        apiRequest('/flock/placement?page_number=1&page_size=50&include_deleted=0', currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
      ]);
      setPlacements(Array.isArray(placementPayload.data) ? placementPayload.data : []);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setPlacements([]);
      setFlocks([]);
      setFarms([]);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!selectedFlock || form.placement_id) return;
    setForm((current) => ({
      ...current,
      farm_id: current.farm_id || selectedFlock.farm_id || '',
      house_id: current.house_id || selectedFlock.house_id || '',
      age_at_placement: current.age_at_placement || (() => {
        if (!selectedFlock.hatch_date || !current.placement_date) return '';
        const hatchMs = new Date(selectedFlock.hatch_date).getTime();
        const placementMs = new Date(current.placement_date).getTime();
        if (Number.isNaN(hatchMs) || Number.isNaN(placementMs)) return '';
        return Math.max(0, Math.floor((placementMs - hatchMs) / (24 * 60 * 60 * 1000)));
      })(),
    }));
  }, [selectedFlock, form.placement_id, form.placement_date]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const isEditing = Boolean(form.placement_id);
      await apiRequest(isEditing ? `/flock/placement/${form.placement_id}` : '/flock/placement', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          flock_id: form.flock_id,
          farm_id: form.farm_id,
          house_id: form.house_id,
          placement_date: form.placement_date,
          removal_date: form.removal_date || null,
          females_placed: Number(form.females_placed),
          males_placed: Number(form.males_placed),
          age_at_placement: Number(form.age_at_placement),
          source_location: form.source_location || null,
          transfer_reason: form.transfer_reason || null,
          movement_id: form.movement_id || null,
          is_current: form.is_current,
          placed_by: form.placed_by || null,
          remarks: form.remarks || null,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      setForm(emptyForm);
      setMessage(isEditing ? 'Flock placement updated successfully.' : 'Flock placement created successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditForm(row) {
    setForm(placementToForm(row));
    setError('');
    setMessage('');
  }

  async function deletePlacement(row) {
    if (!window.confirm(`Delete placement for flock ${row.flock_number || row.flock_id}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/placement/${row.placement_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.placement_id === row.placement_id) setForm(emptyForm);
      setMessage('Flock placement deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Flock Placement</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Create and manage flock placement records.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => setForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number || row.flock_id}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required value={form.farm_id} onChange={(event) => setForm((current) => ({ ...current, farm_id: event.target.value, house_id: '' }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select farm</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required value={form.house_id} onChange={(event) => setForm((current) => ({ ...current, house_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select house</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Placement date</span><input required type="date" value={form.placement_date} onChange={(event) => setForm((current) => ({ ...current, placement_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Removal date</span><input type="date" value={form.removal_date} onChange={(event) => setForm((current) => ({ ...current, removal_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Females placed</span><input required min="0" type="number" value={form.females_placed} onChange={(event) => setForm((current) => ({ ...current, females_placed: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Males placed</span><input required min="0" type="number" value={form.males_placed} onChange={(event) => setForm((current) => ({ ...current, males_placed: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age at placement (days)</span><input required min="0" type="number" value={form.age_at_placement} onChange={(event) => setForm((current) => ({ ...current, age_at_placement: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Source location</span><input value={form.source_location} onChange={(event) => setForm((current) => ({ ...current, source_location: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Transfer reason</span><input value={form.transfer_reason} onChange={(event) => setForm((current) => ({ ...current, transfer_reason: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Movement ID (optional)</span><input value={form.movement_id} onChange={(event) => setForm((current) => ({ ...current, movement_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Placed by (optional user ID)</span><input value={form.placed_by} onChange={(event) => setForm((current) => ({ ...current, placed_by: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#374744]">
          <input type="checkbox" checked={form.is_current} onChange={(event) => setForm((current) => ({ ...current, is_current: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />
          Mark as current placement
        </label>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Remarks</span>
          <textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} rows="2" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          {form.placement_id && <button type="button" onClick={() => setForm(emptyForm)} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.placement_id ? 'Save placement changes' : 'Save placement'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Recent Placements</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">House</th><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Total placed</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">Loading placements...</td></tr> : placements.length === 0 ? <tr><td colSpan="6" className="px-2 py-6 text-center text-[#5d6d68]">No placements found.</td></tr> : placements.map((row) => <tr key={row.placement_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.flock_number || row.flock_id}</td><td className="px-2 py-2">{row.farm_name || row.farm_id}</td><td className="px-2 py-2">{row.house_name || row.house_id}</td><td className="px-2 py-2">{row.placement_date ? String(row.placement_date).slice(0, 10) : ''}</td><td className="px-2 py-2">{row.total_placed ?? ((Number(row.females_placed) || 0) + (Number(row.males_placed) || 0))}</td><td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => openEditForm(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deletePlacement(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
