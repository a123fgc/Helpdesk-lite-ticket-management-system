import { useEffect, useState } from 'react';
import { categoriesApi } from '../../api/endpoints';
import { Select, Textarea } from '../common/Input';
import { PRIORITIES, PRIORITY_LABEL } from '../../utils/constants';

export default function TicketForm({ initialValue, onSubmit, busy = false, error }) {
  const [cats, setCats] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category_id: '',
    priority: 'medium',
    ...(initialValue || {}),
  });
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    let active = true;
    setCategoryLoading(true);
    setCategoryError('');
    categoriesApi.list()
      .then((r) => {
        if (!active) return;
        setCats(r.data);
        if (r.data[0]) setForm((f) => (f.category_id ? f : { ...f, category_id: r.data[0].id }));
      })
      .catch(() => {
        if (active) setCategoryError('Could not load support categories. Refresh the page to try again.');
      })
      .finally(() => {
        if (active) setCategoryLoading(false);
      });
    return () => { active = false; };
  }, [categoryRetry]);

  function onFile(e) {
    const selected = Array.from(e.target.files || []);
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
    const invalid = selected.some((file) => {
      const extension = file.name.split('.').pop().toLowerCase();
      return !allowedExtensions.includes(extension) || file.size > 5 * 1024 * 1024;
    });

    if (selected.length > 2) {
      setFileError('Choose no more than two attachments.');
      setFiles([]);
    } else if (invalid) {
      setFileError('Use PDF, JPEG, PNG, GIF, or WebP files up to 5 MB each.');
      setFiles([]);
    } else {
      setFileError('');
      setFiles(selected);
    }

    e.target.value = '';
  }

  function removeFile(fileToRemove) {
    setFiles((current) => current.filter((file) => file !== fileToRemove));
    setFileError('');
  }

  function submit(e) {
    e.preventDefault();
    if (categoryLoading || !cats.length) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append('attachments', f));
    onSubmit(fd, files);
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-7">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="label">Subject</label>
        <input
          className="input"
          required
          maxLength={255}
          placeholder="Briefly describe what you need help with"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          required
          disabled={categoryLoading || !cats.length}
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          {categoryLoading && <option value="">Loading categories…</option>}
          {!categoryLoading && !cats.length && <option value="">No categories available</option>}
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select
          label="Priority"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </Select>
      </div>
      {categoryError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{categoryError}</span>
          <button type="button" className="font-semibold underline" onClick={() => setCategoryRetry((attempt) => attempt + 1)}>Retry</button>
        </div>
      )}
      {!categoryLoading && !categoryError && !cats.length && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No support categories are available right now. Please contact the support team.
        </p>
      )}

      <Textarea
        label="Description"
        required
        rows={6}
        placeholder="Include what happened, what you expected, and any steps you have already tried."
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div>
        <label className="label">Attachments <span className="font-normal text-slate-400">(PDF or image · up to 2 files · 5 MB each)</span></label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={onFile}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700 hover:border-brand-300 hover:bg-brand-50/40"
        />
        {fileError && <p role="alert" className="mt-2 text-sm text-red-600">{fileError}</p>}
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li key={`${f.name}-${f.lastModified}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                <span className="min-w-0 truncate text-slate-600">{f.name} <span className="text-slate-400">({Math.max(1, Math.round(f.size / 1024))} KB)</span></span>
                <button type="button" className="shrink-0 font-semibold text-slate-500 hover:text-red-600" onClick={() => removeFile(f)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
        <span className="text-xs text-slate-400">We’ll keep your request history in your account.</span>
        <button className="btn-primary min-w-40" disabled={busy || categoryLoading || !cats.length}>
          {busy ? 'Creating…' : 'Create Ticket'}
        </button>
      </div>
    </form>
  );
}