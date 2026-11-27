import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { adminApi } from '../../api/endpoints';
import { fmtDate } from '../../utils/format';

const emptyForm = { full_name: '', email: '', password: '' };

export default function ManageAgents() {
  const [agents, setAgents] = useState(null);
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  function load() {
    adminApi.listAgents()
      .then((r) => setAgents(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load agents'));
  }

  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await adminApi.createAgent(form);
      setForm(emptyForm);
      setShow(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to create agent');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a) {
    try {
      await adminApi.setAgentActive(a.id, !a.is_active);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update agent');
    }
  }

  return (
    <Layout>
      <div className="page-shell max-w-6xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">Agents</h1>
            <p className="page-subtitle">Manage support agents, create accounts, and control access to the workspace.</p>
          </div>
          <button className="btn-primary" onClick={() => setShow((s) => !s)}>
            {show ? 'Cancel' : 'New agent'}
          </button>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}

        {show && (
          <form onSubmit={onCreate} className="card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Create agent account</h2>
              <p className="mt-1 text-sm text-slate-500">New agents can sign in immediately with the password you set.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label" htmlFor="agent-full-name">Full name</label>
                <input
                  id="agent-full-name"
                  className="input"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="agent-email">Email</label>
                <input
                  id="agent-email"
                  className="input"
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="agent-password">Password</label>
                <input
                  id="agent-password"
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create agent'}</button>
            </div>
          </form>
        )}

        {!agents && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading agents…</div>}

        {agents && (
          agents.length === 0 ? (
            <div className="card"><EmptyState title="No agents yet" message="Create an agent account to start assigning tickets." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.id}>
                        <td className="font-medium text-slate-800">{a.full_name}</td>
                        <td className="text-slate-600">{a.email}</td>
                        <td>
                          {a.is_active
                            ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">Active</span>
                            : <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">Disabled</span>}
                        </td>
                        <td className="text-slate-500">{fmtDate(a.created_at)}</td>
                        <td className="text-right">
                          <button className="btn-ghost px-3 py-2 text-xs" onClick={() => toggle(a)}>
                            {a.is_active ? 'Deactivate' : 'Activate'}
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