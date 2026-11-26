import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { categoriesApi } from '../../api/endpoints';

const emptyForm = { name: '', description: '' };

export default function ManageCategories() {
  const [cats, setCats] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState(false);

  function load() {
    categoriesApi.list({ include_inactive: true })
      .then((r) => setCats(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }
  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await categoriesApi.create(form);
      setForm(emptyForm);
      setShow(false);
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  async function toggle(c) {
    try { await categoriesApi.update(c.id, { is_active: !c.is_active }); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  return (
    <Layout>
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <button className="btn-primary" onClick={() => setShow((s) => !s)}>
            {show ? 'Cancel' : 'New category'}
          </button>
        </div>

        {err && <div className="text-red-600">{err}</div>}

        {show && (
          <form onSubmit={onCreate} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" required
                     value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input"
                     value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button className="btn-primary">Create</button>
            </div>
          </form>
        )}

        {!cats && <Spinner />}

        {cats && (
          cats.length === 0 ? <EmptyState title="No categories yet" /> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600">{c.description || '—'}</td>
                    <td className="px-4 py-2">
                      {c.is_active
                        ? <span className="text-emerald-700 text-xs font-medium">Active</span>
                        : <span className="text-slate-400 text-xs font-medium">Inactive</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button className="btn-ghost" onClick={() => toggle(c)}>
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}