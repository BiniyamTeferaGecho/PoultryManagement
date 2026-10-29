import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const emptyForm = {
  vaccination_id: '',
  flock_id: '',
  farm_id: '',
  house_id: '',
  vaccination_date: '',
  vaccine_name: '',
  vaccine_batch_number: '',
  vaccine_manufacturer: '',
  disease_prevention: '',
  administration_method: '',
  route_of_administration: '',
  dosage: '',
  dosage_unit: '',
  birds_vaccinated_females: '0',
  birds_vaccinated_males: '0',
  age_at_vaccination_days: '',
  vaccinator_name: '',
  vaccination_program_id: '',
  is_booster: false,
  booster_sequence: '',
  next_booster_due: '',
  withdrawal_period_days: '',
  remarks: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateAgeDays(hatchDateValue, vaccinationDateValue) {
  if (!hatchDateValue || !vaccinationDateValue) return '';
  const hatchDate = new Date(hatchDateValue);
  const vaccinationDate = new Date(vaccinationDateValue);
  if (Number.isNaN(hatchDate.getTime()) || Number.isNaN(vaccinationDate.getTime())) return '';
  const diffDays = Math.floor((vaccinationDate.getTime() - hatchDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? String(diffDays) : '';
}

function updateDerivedFields(currentForm, nextFields, flocks) {
  const nextForm = { ...currentForm, ...nextFields };
  const selectedFlock = flocks.find((row) => row.flock_id === nextForm.flock_id);
  return {
    ...nextForm,
    farm_id: selectedFlock?.farm_id || '',
    house_id: selectedFlock?.house_id || '',
    age_at_vaccination_days: calculateAgeDays(selectedFlock?.hatch_date, nextForm.vaccination_date),
  };
}

function toForm(row, flocks) {
  return updateDerivedFields(emptyForm, {
    vaccination_id: row.vaccination_id || '',
    flock_id: row.flock_id || '',
    farm_id: row.farm_id || '',
    house_id: row.house_id || '',
    vaccination_date: toDateInput(row.vaccination_date),
    vaccine_name: row.vaccine_name || '',
    vaccine_batch_number: row.vaccine_batch_number || '',
    vaccine_manufacturer: row.vaccine_manufacturer || '',
    disease_prevention: row.disease_prevention || '',
    administration_method: row.administration_method || '',
    route_of_administration: row.route_of_administration || '',
    dosage: row.dosage ?? '',
    dosage_unit: row.dosage_unit || '',
    birds_vaccinated_females: row.birds_vaccinated_females ?? 0,
    birds_vaccinated_males: row.birds_vaccinated_males ?? 0,
    age_at_vaccination_days: row.age_at_vaccination_days ?? '',
    vaccinator_name: row.vaccinator_name || '',
    vaccination_program_id: row.vaccination_program_id ?? '',
    is_booster: row.is_booster === true || row.is_booster === 1,
    booster_sequence: row.booster_sequence ?? '',
    next_booster_due: toDateInput(row.next_booster_due),
    withdrawal_period_days: row.withdrawal_period_days ?? '',
    remarks: row.remarks || '',
  }, flocks);
}

function validateForm(form, flocks) {
  const selectedFlock = flocks.find((row) => row.flock_id === form.flock_id);
  if (!selectedFlock?.hatch_date) {
    return { field: 'flock_id', message: 'Selected flock is missing hatch date; age cannot be calculated.' };
  }
  if (!form.age_at_vaccination_days) {
    return { field: 'age_at_vaccination_days', message: 'Age at vaccination must be calculated from hatch date and vaccination date.' };
  }
  const females = readNumber(form.birds_vaccinated_females);
  const males = readNumber(form.birds_vaccinated_males);
  if (!Number.isInteger(females) || females < 0) {
    return { field: 'birds_vaccinated_females', message: 'Female birds vaccinated must be a non-negative integer.' };
  }
  if (!Number.isInteger(males) || males < 0) {
    return { field: 'birds_vaccinated_males', message: 'Male birds vaccinated must be a non-negative integer.' };
  }
  if ((females + males) <= 0) {
    return { field: 'birds_vaccinated_total', message: 'Total birds vaccinated must be greater than zero.' };
  }
  if (form.is_booster && !form.booster_sequence) {
    return { field: 'booster_sequence', message: 'Booster sequence is required when Booster is enabled.' };
  }
  return null;
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

export default function VaccinationRecordManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    searchText: '',
    vaccineName: '',
    isBooster: 'all',
    fromDate: '',
    toDate: '',
  });

  const houseOptions = useMemo(() => houses.filter((house) => !form.farm_id || house.farm_id === form.farm_id), [houses, form.farm_id]);
  const birdsVaccinatedTotal = (Number(form.birds_vaccinated_females) || 0) + (Number(form.birds_vaccinated_males) || 0);

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page_number: String(page), page_size: '10' });
      if (filters.searchText) params.set('search_text', filters.searchText.trim());
      if (filters.vaccineName) params.set('vaccine_name', filters.vaccineName.trim());
      if (filters.isBooster !== 'all') params.set('is_booster', filters.isBooster === 'yes' ? '1' : '0');
      if (filters.fromDate) params.set('from_date', filters.fromDate);
      if (filters.toDate) params.set('to_date', filters.toDate);
      if (includeDeleted) params.set('include_deleted', '1');

      const [listPayload, flockPayload, farmPayload, housePayload] = await Promise.all([
        apiRequest(`/vaccination?${params.toString()}`, currentUser.accessToken),
        apiRequest('/flock?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/farm?page_number=1&page_size=100', currentUser.accessToken),
        apiRequest('/house?page_number=1&page_size=100', currentUser.accessToken),
      ]);

      setRows(Array.isArray(listPayload.data) ? listPayload.data : []);
      setTotalCount(Number(listPayload.totalCount) || 0);
      setFlocks(Array.isArray(flockPayload.data) ? flockPayload.data : []);
      setFarms(Array.isArray(farmPayload.data) ? farmPayload.data : []);
      setHouses(Array.isArray(housePayload.data) ? housePayload.data : []);
    } catch (requestError) {
      setRows([]);
      setTotalCount(0);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, filters, includeDeleted, page]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function clearEditor() {
    setForm(emptyForm);
    setFieldError(null);
  }

  function editRow(row) {
    setForm(toForm(row, flocks));
    setFieldError(null);
    setError('');
    setMessage('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setFieldError(null);

    try {
      const validationError = validateForm(form, flocks);
      if (validationError) {
        setFieldError(validationError);
        return;
      }

      const isEditing = Boolean(form.vaccination_id);
      const payload = {
        flock_id: form.flock_id,
        farm_id: form.farm_id,
        house_id: form.house_id,
        vaccination_date: form.vaccination_date,
        vaccine_name: form.vaccine_name.trim(),
        vaccine_batch_number: form.vaccine_batch_number.trim(),
        vaccine_manufacturer: form.vaccine_manufacturer.trim() || null,
        disease_prevention: form.disease_prevention.trim() || null,
        administration_method: form.administration_method.trim(),
        route_of_administration: form.route_of_administration.trim() || null,
        dosage: numberOrNull(form.dosage),
        dosage_unit: form.dosage_unit.trim() || null,
        birds_vaccinated_females: Number(form.birds_vaccinated_females),
        birds_vaccinated_males: Number(form.birds_vaccinated_males),
        age_at_vaccination_days: Number(form.age_at_vaccination_days),
        vaccinator_name: form.vaccinator_name.trim() || null,
        vaccination_program_id: Number(form.vaccination_program_id || 0) || null,
        is_booster: Boolean(form.is_booster),
        booster_sequence: form.is_booster ? Number(form.booster_sequence || 0) || null : null,
        next_booster_due: form.next_booster_due || null,
        clear_next_booster: isEditing ? !form.next_booster_due : false,
        withdrawal_period_days: Number(form.withdrawal_period_days || 0) || null,
        remarks: form.remarks.trim() || null,
        user_id: currentUser.user_id || null,
      };

      await apiRequest(isEditing ? `/vaccination/${form.vaccination_id}` : '/vaccination', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(isEditing ? 'Vaccination record updated successfully.' : 'Vaccination record created successfully.');
      clearEditor();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm(`Delete vaccination record for ${row.vaccine_name} on ${toDateInput(row.vaccination_date)}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/vaccination/${row.vaccination_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, reason: 'Deleted from vaccination record form' }),
      });
      if (form.vaccination_id === row.vaccination_id) clearEditor();
      setMessage('Vaccination record deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreRow(row) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/vaccination/${row.vaccination_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.user_id || null }),
      });
      setMessage('Vaccination record restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function hardDeleteRow(row) {
    if (!window.confirm(`Permanently delete ${row.vaccine_name} (${row.vaccine_batch_number})? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/vaccination/${row.vaccination_id}/hard`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: currentUser.user_id || null, confirm: true }),
      });
      if (form.vaccination_id === row.vaccination_id) clearEditor();
      setMessage('Vaccination record permanently deleted.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h2 className="text-xl font-bold text-[#1f2d2a]">Vaccination Record Management</h2>
      <p className="mt-1 text-sm text-[#5d6d68]">Capture and maintain flock vaccination records with booster tracking.</p>
      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Flock</span><select required value={form.flock_id} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedFields(current, { flock_id: event.target.value }, flocks)); }} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select flock</option>{flocks.map((row) => <option key={row.flock_id} value={row.flock_id}>{row.flock_number}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Farm</span><select required disabled value={form.farm_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{farms.map((row) => <option key={row.farm_id} value={row.farm_id}>{row.farm_code} - {row.farm_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">House</span><select required disabled value={form.house_id} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm text-[#5d6d68] outline-none"><option value="">Select flock first</option>{houseOptions.map((row) => <option key={row.house_id} value={row.house_id}>{row.house_code} - {row.house_name}</option>)}</select></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Vaccination date</span><input required type="date" value={form.vaccination_date} onChange={(event) => { setFieldError(null); setForm((current) => updateDerivedFields(current, { vaccination_date: event.target.value }, flocks)); }} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Vaccine name</span><input required value={form.vaccine_name} onChange={(event) => setForm((current) => ({ ...current, vaccine_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Batch number</span><input required value={form.vaccine_batch_number} onChange={(event) => setForm((current) => ({ ...current, vaccine_batch_number: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Manufacturer</span><input value={form.vaccine_manufacturer} onChange={(event) => setForm((current) => ({ ...current, vaccine_manufacturer: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Disease prevention</span><input value={form.disease_prevention} onChange={(event) => setForm((current) => ({ ...current, disease_prevention: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Administration method</span><input required value={form.administration_method} onChange={(event) => setForm((current) => ({ ...current, administration_method: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Route</span><input value={form.route_of_administration} onChange={(event) => setForm((current) => ({ ...current, route_of_administration: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Dosage</span><input min="0" step="0.01" type="number" value={form.dosage} onChange={(event) => setForm((current) => ({ ...current, dosage: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Dosage unit</span><input value={form.dosage_unit} onChange={(event) => setForm((current) => ({ ...current, dosage_unit: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Female birds vaccinated</span><input required min="0" type="number" value={form.birds_vaccinated_females} onChange={(event) => setForm((current) => ({ ...current, birds_vaccinated_females: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Male birds vaccinated</span><input required min="0" type="number" value={form.birds_vaccinated_males} onChange={(event) => setForm((current) => ({ ...current, birds_vaccinated_males: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Total vaccinated</span><input readOnly value={birdsVaccinatedTotal} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Age at vaccination (days)</span><input required readOnly type="number" value={form.age_at_vaccination_days} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-[#f6faf7] px-3 text-sm outline-none" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Vaccinator</span><input value={form.vaccinator_name} onChange={(event) => setForm((current) => ({ ...current, vaccinator_name: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Program ID</span><input type="number" min="0" value={form.vaccination_program_id} onChange={(event) => setForm((current) => ({ ...current, vaccination_program_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744] md:mt-7"><input type="checkbox" checked={form.is_booster} onChange={(event) => setForm((current) => ({ ...current, is_booster: event.target.checked, booster_sequence: event.target.checked ? current.booster_sequence : '' }))} className="h-4 w-4 accent-[#0f8b3d]" /><span>Booster vaccination</span></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Booster sequence</span><input disabled={!form.is_booster} type="number" min="1" value={form.booster_sequence} onChange={(event) => setForm((current) => ({ ...current, booster_sequence: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] disabled:bg-[#f6faf7]" /></label>

          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Next booster due</span><input type="date" value={form.next_booster_due} onChange={(event) => setForm((current) => ({ ...current, next_booster_due: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          <label className="text-sm font-medium text-[#374744]"><span className="mb-1 block">Withdrawal period (days)</span><input type="number" min="0" value={form.withdrawal_period_days} onChange={(event) => setForm((current) => ({ ...current, withdrawal_period_days: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
        </div>

        <label className="mt-3 block text-sm font-medium text-[#374744]"><span className="mb-1 block">Remarks</span><textarea rows="2" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-[#dfe8e1] p-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>

        <div className="mt-4 flex justify-end gap-2">
          {form.vaccination_id && <button type="button" onClick={clearEditor} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : form.vaccination_id ? 'Save vaccination' : 'Save vaccination record'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={filters.searchText} onChange={(event) => updateFilter('searchText', event.target.value)} placeholder="Search vaccine, batch, vaccinator..." className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d] md:col-span-2" />
          <input value={filters.vaccineName} onChange={(event) => updateFilter('vaccineName', event.target.value)} placeholder="Filter by vaccine name" className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <select value={filters.isBooster} onChange={(event) => updateFilter('isBooster', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="all">All booster types</option><option value="yes">Booster only</option><option value="no">Primary only</option></select>
          <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
          <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className="h-11 rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Vaccination Records</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9efe9] text-[#51615d]">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Vaccine</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Birds</th>
                <th className="px-2 py-2">Booster</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">Loading vaccination records...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="px-2 py-6 text-center text-[#5d6d68]">No vaccination records found.</td></tr> : rows.map((row) => (
                <tr key={row.vaccination_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{toDateInput(row.vaccination_date)}</td>
                  <td className="px-2 py-2">{row.flock_number || row.flock_id}</td>
                  <td className="px-2 py-2">{row.vaccine_name}</td>
                  <td className="px-2 py-2">{row.vaccine_batch_number || '—'}</td>
                  <td className="px-2 py-2">{row.birds_vaccinated_total ?? ((row.birds_vaccinated_females || 0) + (row.birds_vaccinated_males || 0))}</td>
                  <td className="px-2 py-2">{row.is_booster ? `Yes${row.booster_sequence ? ` (#${row.booster_sequence})` : ''}` : 'No'}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : 'bg-[#eafaf0] text-[#198754]'}`}>{row.is_deleted ? 'Deleted' : 'Active'}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!row.is_deleted && <button type="button" onClick={() => editRow(row)} className="rounded-lg border border-[#d7e4dd] px-2 py-1 text-xs font-semibold text-[#24443c] hover:bg-[#f3faf6]">Edit</button>}
                      {!row.is_deleted && <button type="button" onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>}
                      {row.is_deleted && <button type="button" onClick={() => restoreRow(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>}
                      {row.is_deleted && <button type="button" onClick={() => hardDeleteRow(row)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Hard Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#44514d]">
          <span>Total: {totalCount.toLocaleString()}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-[#d7e4dd] px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
