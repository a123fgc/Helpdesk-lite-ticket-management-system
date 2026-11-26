import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { adminApi } from '../../api/endpoints';
import { fmtDate } from '../../utils/format';

export default function ManageApiKeys() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState(null);
  const [err, setErr] = useState('');

  function load() {
    adminApi.listApiKeys()
      .then((r) => setKeys(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }
  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    setErr(''); setCreated(null);
    try {
      const r = await adminApi.createApiKey(name.trim() || 'Untitled');
      setCreated(r.data.key);
      setName('');
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  async function revoke(k) {
    if (!confirm(`Revoke "${k.name}"? This cannot be undone.`)) return;
    try { await adminApi.revokeApiKey(k.id); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-4">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-slate-500">
          Used by Make.com to call your app. Send as <code>X-API-Key</code> header.
        </p>

        {err && <div className="text-red-600">{err}</div>}

        <form onSubmit={onCreate} className="card p-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Make.com"
                   value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn-primary">Create key</button>
        </form>

        {created && (
          <div className="card p-4 border-amber-300 bg-amber-50 space-y-2">
            <div className="text-sm font-medium text-amber-900">
              Copy this key now — it will never be shown again.
            </div>
            <code className="block break-all rounded bg-white p-2 text-xs border border-amber-200">{created}</code>
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(created)}>Copy</button>
          </div>
        )}

        {!keys && <Spinner />}

        {keys && (
          keys.length === 0 ? <EmptyState title="No API keys yet" /> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Prefix</th>
                  <th className="px-4 py-2">Last used</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-2">{k.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="px-4 py-2 text-slate-500">{k.last_used_at ? fmtDate(k.last_used_at) : 'Never'}</td>
                    <td className="px-4 py-2">
                      {k.is_active
                        ? <span className="text-emerald-700 text-xs font-medium">Active</span>
                        : <span className="text-slate-400 text-xs font-medium">Revoked</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {k.is_active && <button className="btn-danger" onClick={() => revoke(k)}>Revoke</button>}
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