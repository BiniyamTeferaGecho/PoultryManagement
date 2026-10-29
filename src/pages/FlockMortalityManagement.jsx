import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  flock_id: '',
  mortality_date: '',
  females: '',
  males: '',
  reason: '',
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

export default function FlockMortalityManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFlocks = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/flock?page_number=1&page_size=100&status=Active', currentUser.accessToken);
      setFlocks(Array.isArray(payload.data) ? payload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setFlocks([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken]);

  useEffect(() => { loadFlocks(); }, [loadFlocks]);

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/flock/${form.flock_id}/mortality`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          females: Number(form.females),
          males: Number(form.males),
          reason: form.reason || null,
          created_by: currentUser.user_id || null,
        }),
      });
      setForm(emptyForm);
      setMessage('Mortality recorded successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }

    function editFlock(row) {
      setForm((current) => ({
        ...current,
        flock_id: row.flock_id,
      }));
      setError('');
      setMessage(`Selected flock ${row.flock_number} for mortality entry.`);
    }

    async function deleteFlock(row) {
      if (!window.confirm(`Delete ${row.flock_number}?`)) return;
      setSaving(true);
      setError('');
      setMessage('');
      try {
        await apiRequest(`/flock/${row.flock_id}`, currentUser.accessToken, {
          method: 'DELETE',
          body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
        });
        if (form.flock_id === row.flock_id) {
          setForm((current) => ({ ...current, flock_id: '' }));
        }
        setMessage('Flock deleted successfully.');
        await loadFlocks();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Mortality Record</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Record daily flock mortality.</p>
      {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border border-green-200 bg-green-50 text-green-700`}>{message}</div>}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Flock</span>
            <select required value={form.flock_id} onChange={(event) => setForm((current) => ({ ...current, flock_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]">
              <option value="">Select active flock</option>
              {flocks.map((flock) => <option key={flock.flock_id} value={flock.flock_id}>{flock.flock_number} - {flock.farm_name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Mortality date</span>
            <input required type="date" value={form.mortality_date} onChange={(event) => setForm((current) => ({ ...current, mortality_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Female mortality</span>
            <input required min="0" type="number" value={form.females} onChange={(event) => setForm((current) => ({ ...current, females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
          <label className="text-sm font-medium text-[#374744]">
            <span className="mb-1 block">Male mortality</span>
            <input required min="0" type="number" value={form.males} onChange={(event) => setForm((current) => ({ ...current, males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium text-[#374744]">
          <span className="mb-1 block">Reason</span>
          <textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} rows="3" className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </label>
        <div className="mt-4 flex justify-end"><button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : 'Record mortality'}</button></div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-[#1f2d2a]">Active Flocks</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2 font-semibold">Flock</th><th className="px-2 py-2 font-semibold">Farm</th><th className="px-2 py-2 font-semibold">Breed</th><th className="px-2 py-2 font-semibold">Current Total</th><th className="px-2 py-2 text-right font-semibold">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">Loading flocks...</td></tr> : flocks.length === 0 ? <tr><td colSpan="5" className="px-2 py-6 text-center text-[#5d6d68]">No active flocks found.</td></tr> : flocks.map((row) => <tr key={row.flock_id} className="border-b border-[#f0f3f1]"><td className="px-2 py-2 font-mono text-xs">{row.flock_number}</td><td className="px-2 py-2">{row.farm_name}</td><td className="px-2 py-2">{row.breed_name}</td><td className="px-2 py-2">{row.current_total ?? 0}</td><td className="px-2 py-2"><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => editFlock(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button><button type="button" disabled={saving} onClick={() => deleteFlock(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
