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
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load categories'));
  }

  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await categoriesApi.create(form);
      setForm(emptyForm);
      setShow(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to create category');
    }
  }

  async function toggle(c) {
    try {
      await categoriesApi.update(c.id, { is_active: !c.is_active });
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update category');
    }
  }

  return (
    <Layout>
      <div className="page-shell max-w-5xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">Categories</h1>
            <p className="page-subtitle">Organize tickets by category so routing, reporting, and support workflows stay clear.</p>
          </div>
          <button className="btn-primary" onClick={() => setShow((s) => !s)}>
            {show ? 'Cancel' : 'New category'}
          </button>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}

        {show && (
          <form onSubmit={onCreate} className="card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Create category</h2>
              <p className="mt-1 text-sm text-slate-500">Add a category customers can choose when submitting a request.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category-name">Name</label>
                <input
                  id="category-name"
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="category-description">Description</label>
                <input
                  id="category-description"
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button className="btn-primary">Create category</button>
            </div>
          </form>
        )}

        {!cats && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading categories…</div>}

        {cats && (
          cats.length === 0 ? (
            <div className="card"><EmptyState title="No categories yet" message="Create a category to help customers route their requests." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium text-slate-800">{c.name}</td>
                        <td className="text-slate-600">{c.description || '—'}</td>
                        <td>
                          {c.is_active
                            ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">Active</span>
                            : <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">Inactive</span>}
                        </td>
                        <td className="text-right">
                          <button className="btn-ghost px-3 py-2 text-xs" onClick={() => toggle(c)}>
                            {c.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}