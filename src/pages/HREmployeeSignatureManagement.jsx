import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from '../components/forms/SignaturePad';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const emptyForm = {
  signature_id: '',
  employee_id: '',
  signature_file_url: '',
  signature_hash: '',
  effective_date: '',
  expiry_date: '',
  is_active: true,
  allow_overlap: false,
  row_version: '',
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toForm(row) {
  return {
    ...emptyForm,
    signature_id: row.signature_id || '',
    employee_id: row.employee_id || '',
    signature_file_url: row.signature_file_url || '',
    signature_hash: row.signature_hash || '',
    effective_date: toDateInput(row.effective_date),
    expiry_date: toDateInput(row.expiry_date),
    is_active: Boolean(row.is_active),
    row_version: row.row_version || '',
  };
}

function signatureImageUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

async function apiRequest(path, accessToken, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

export default function HREmployeeSignatureManagement({ currentUser }) {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('draw');
  const [drawnBlob, setDrawnBlob] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');

  const isEditing = Boolean(form.signature_id);
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.employee_id, employee])),
    [employees],
  );

  const loadData = useCallback(async () => {
    if (!currentUser.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [signaturePayload, employeePayload] = await Promise.all([
        apiRequest(`/hr/signature?page_number=1&page_size=100&include_deleted=${includeDeleted ? 1 : 0}`, currentUser.accessToken),
        apiRequest('/hr/employee?page_number=1&page_size=100&include_deleted=0', currentUser.accessToken),
      ]);
      setRows(Array.isArray(signaturePayload.data) ? signaturePayload.data : []);
      setEmployees(Array.isArray(employeePayload.data) ? employeePayload.data : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.accessToken, includeDeleted]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function employeeLabel(employeeId) {
    const employee = employeeById.get(employeeId);
    if (!employee) return employeeId;
    return `${employee.employee_code} - ${employee.full_name || `${employee.first_name} ${employee.last_name}`}`;
  }

  function clearUpload() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setUploadFile(null);
    setUploadPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function acceptFile(file) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Signature image must be a PNG, JPEG or WebP file.');
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setError('Signature image must not exceed 2 MB.');
      return;
    }
    setError('');
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setUploadFile(file);
    setUploadPreview(previewUrlRef.current);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function resetSignature() {
    clearUpload();
    setDrawnBlob(null);
    setPadKey((current) => current + 1);
  }

  function resetForm() {
    setForm(emptyForm);
    setMode('draw');
    resetSignature();
  }

  function startEdit(row) {
    setForm(toForm(row));
    setMode('draw');
    resetSignature();
    setError('');
    setMessage('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    const signatureBlob = mode === 'draw' ? drawnBlob : uploadFile;
    if (!form.employee_id || !form.effective_date) {
      setError('Employee and effective date are required.');
      return;
    }
    if (!signatureBlob && !form.signature_file_url) {
      setError(mode === 'draw' ? 'Please sign in the signature board.' : 'Please choose a signature image to upload.');
      return;
    }
    if (form.expiry_date && form.expiry_date < form.effective_date) {
      setError('Expiry date cannot be before effective date.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let signatureFileUrl = form.signature_file_url;
      let signatureHash = form.signature_hash;
      if (signatureBlob) {
        const formData = new FormData();
        formData.append('signature', signatureBlob, mode === 'draw' ? 'signature.png' : uploadFile.name);
        const uploaded = await apiRequest('/hr/signature/upload', currentUser.accessToken, { method: 'POST', body: formData });
        signatureFileUrl = uploaded.data.signature_file_url;
        signatureHash = uploaded.data.signature_hash;
      }

      await apiRequest(isEditing ? `/hr/signature/${form.signature_id}` : '/hr/signature', currentUser.accessToken, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          employee_id: form.employee_id,
          signature_file_url: signatureFileUrl,
          signature_hash: signatureHash,
          effective_date: form.effective_date,
          expiry_date: form.expiry_date || null,
          is_active: form.is_active,
          allow_overlap: form.allow_overlap,
          ...(isEditing
            ? { modified_by: currentUser.user_id || null, row_version: form.row_version || null }
            : { created_by: currentUser.user_id || null }),
        }),
      });
      resetForm();
      setMessage(isEditing ? 'Employee signature updated successfully.' : 'Employee signature saved successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row) {
    if (!window.confirm('Delete this employee signature?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/signature/${row.signature_id}`, currentUser.accessToken, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: currentUser.user_id || null }),
      });
      if (form.signature_id === row.signature_id) resetForm();
      setMessage('Employee signature deleted successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function restoreRow(row) {
    if (!window.confirm('Restore this employee signature?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/hr/signature/${row.signature_id}/restore`, currentUser.accessToken, {
        method: 'POST',
        body: JSON.stringify({ modified_by: currentUser.user_id || null }),
      });
      setMessage('Employee signature restored successfully.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const hasNewSignature = mode === 'draw' ? Boolean(drawnBlob) : Boolean(uploadFile);

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#1f2d2a]">HR Employee Signature</h2>
        <p className="mt-1 text-sm text-[#5d6d68]">Capture a signature on the board or upload an image. It is stored as an image file with a SHA-256 hash.</p>
      </div>
      {message && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 rounded-2xl border border-[#e3ebea] bg-white p-5 shadow-sm lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <label className="block text-sm font-medium text-[#374744]"><span className="mb-1 block">Employee</span><select required value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] bg-white px-3 text-sm outline-none focus:border-[#0f8b3d]"><option value="">Select employee</option>{employees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_code} - {row.full_name || `${row.first_name} ${row.last_name}`}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#374744]"><span className="mb-1 block">Effective date</span><input required type="date" value={form.effective_date} onChange={(event) => setForm((current) => ({ ...current, effective_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
            <label className="block text-sm font-medium text-[#374744]"><span className="mb-1 block">Expiry date</span><input type="date" value={form.expiry_date} onChange={(event) => setForm((current) => ({ ...current, expiry_date: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dfe8e1] px-3 text-sm outline-none focus:border-[#0f8b3d]" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Active signature</label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={form.allow_overlap} onChange={(event) => setForm((current) => ({ ...current, allow_overlap: event.target.checked }))} className="h-4 w-4 accent-[#0f8b3d]" />Allow overlapping dates</label>
          <p className="text-xs text-[#6f7d78]">A signature whose expiry date has passed is saved as inactive automatically.</p>
        </div>

        <div className="lg:col-span-3">
          {isEditing && form.signature_file_url && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#dfe8e1] bg-[#f9fbfa] p-3">
              <img src={signatureImageUrl(form.signature_file_url)} alt="Current signature" className="h-14 w-32 rounded-lg border border-[#e3ebea] bg-white object-contain p-1" />
              <p className="text-xs text-[#5d6d68]">Current signature. Draw or upload a new one below to replace it, or leave blank to keep it.</p>
            </div>
          )}
          <div className="mb-3 inline-flex rounded-xl bg-[#f1f5f2] p-1" role="tablist">
            {[{ id: 'draw', label: 'Draw signature' }, { id: 'upload', label: 'Upload image' }].map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id} onClick={() => setMode(tab.id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${mode === tab.id ? 'bg-white text-[#0f8b3d] shadow-sm' : 'text-[#5d6d68] hover:text-[#1f2d2a]'}`}>{tab.label}</button>
            ))}
          </div>

          <div className={mode === 'draw' ? '' : 'hidden'}>
            <SignaturePad key={padKey} onChange={setDrawnBlob} disabled={saving} />
          </div>

          {mode === 'upload' && (
            <div
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${isDragging ? 'border-[#0f8b3d] bg-[#ecf8f0]' : 'border-[#c9dccf] bg-[#f9fbfa]'}`}
            >
              {uploadPreview ? (
                <>
                  <img src={uploadPreview} alt="Signature preview" className="max-h-40 max-w-full rounded-lg bg-white object-contain p-2 shadow-sm" />
                  <p className="mt-2 max-w-full truncate text-xs text-[#5d6d68]">{uploadFile?.name}</p>
                  <button type="button" onClick={clearUpload} className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Remove</button>
                </>
              ) : (
                <>
                  <div className="text-3xl text-[#9bb0a7]" aria-hidden="true">⇪</div>
                  <p className="mt-2 text-sm font-medium text-[#374744]">Drag and drop a signature image here</p>
                  <p className="mt-1 text-xs text-[#6f7d78]">PNG, JPEG or WebP, up to 2 MB</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 rounded-xl border border-[#dfe8e1] bg-white px-4 py-2 text-sm font-semibold text-[#374744] hover:bg-[#f4f7f5]">Browse files</button>
                </>
              )}
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={(event) => acceptFile(event.target.files?.[0])} className="hidden" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 lg:col-span-5">
          {isEditing && <button type="button" onClick={resetForm} disabled={saving} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Cancel edit</button>}
          <button type="button" onClick={resetSignature} disabled={saving || !hasNewSignature} className="rounded-xl border border-[#dfe8e1] px-4 py-2.5 text-sm font-bold text-[#374744] hover:bg-[#f4f7f5] disabled:opacity-50">Reset signature</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0f8b3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7133] disabled:opacity-50">{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save signature'}</button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-[#e3ebea] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2d2a]">Employee Signatures</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#374744]"><input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} className="h-4 w-4 accent-[#0f8b3d]" />Include deleted</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead><tr className="border-b border-[#e9efe9] text-[#51615d]"><th className="px-2 py-2">Employee</th><th className="px-2 py-2">Signature</th><th className="px-2 py-2">Hash</th><th className="px-2 py-2">Effective</th><th className="px-2 py-2">Expiry</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="px-2 py-6 text-center text-[#5d6d68]">Loading signatures...</td></tr> : rows.length === 0 ? <tr><td colSpan="7" className="px-2 py-6 text-center text-[#5d6d68]">No signatures found.</td></tr> : rows.map((row) => (
                <tr key={row.signature_id} className={`border-b border-[#f0f3f1] ${row.is_deleted ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-2">{employeeLabel(row.employee_id)}</td>
                  <td className="px-2 py-2">
                    {row.signature_file_url
                      ? <a href={signatureImageUrl(row.signature_file_url)} target="_blank" rel="noreferrer"><img src={signatureImageUrl(row.signature_file_url)} alt="Employee signature" className="h-12 w-28 rounded-lg border border-[#e3ebea] bg-white object-contain p-1" /></a>
                      : '-'}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs" title={row.signature_hash || ''}>{row.signature_hash ? `${row.signature_hash.slice(0, 12)}…` : '-'}</td>
                  <td className="px-2 py-2">{toDateInput(row.effective_date)}</td>
                  <td className="px-2 py-2">{toDateInput(row.expiry_date) || '-'}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_deleted ? 'bg-red-50 text-red-700' : row.is_active ? 'bg-[#eafaf0] text-[#198754]' : 'bg-amber-50 text-amber-700'}`}>{row.is_deleted ? 'Deleted' : row.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => startEdit(row)} className="rounded-lg border border-[#dfe8e1] px-3 py-1.5 font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Edit</button>}
                      {!row.is_deleted && <button type="button" disabled={saving} onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete</button>}
                      {row.is_deleted && <button type="button" disabled={saving} onClick={() => restoreRow(row)} className="rounded-lg border border-[#bfe5ca] px-3 py-1.5 font-semibold text-[#0f8b3d] hover:bg-[#ecf8f0] disabled:opacity-50">Restore</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
