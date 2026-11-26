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
      .catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }
  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await adminApi.createAgent(form);
      setForm(emptyForm);
      setShow(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed');
    } finally { setBusy(false); }
  }

  async function toggle(a) {
    try { await adminApi.setAgentActive(a.id, !a.is_active); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <button className="btn-primary" onClick={() => setShow((s) => !s)}>
            {show ? 'Cancel' : 'New agent'}
          </button>
        </div>

        {err && <div className="text-red-600">{err}</div>}

        {show && (
          <form onSubmit={onCreate} className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" required
                     value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required
                     value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6}
                     value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create agent'}</button>
            </div>
          </form>
        )}

        {!agents && <Spinner />}

        {agents && (
          agents.length === 0 ? <EmptyState title="No agents yet" /> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2">{a.full_name}</td>
                    <td className="px-4 py-2 text-slate-600">{a.email}</td>
                    <td className="px-4 py-2">
                      {a.is_active
                        ? <span className="text-emerald-700 text-xs font-medium">Active</span>
                        : <span className="text-slate-400 text-xs font-medium">Disabled</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{fmtDate(a.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <button className="btn-ghost" onClick={() => toggle(a)}>
                        {a.is_active ? 'Deactivate' : 'Activate'}
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