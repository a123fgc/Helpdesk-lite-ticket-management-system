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
  const [copied, setCopied] = useState(false);

  function load() {
    adminApi.listApiKeys()
      .then((r) => setKeys(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load API keys'));
  }

  useEffect(load, []);

  async function onCreate(e) {
    e.preventDefault();
    setErr('');
    setCreated(null);
    setCopied(false);
    try {
      const r = await adminApi.createApiKey(name.trim() || 'Untitled');
      setCreated(r.data.key);
      setName('');
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to create API key');
    }
  }

  async function revoke(k) {
    if (!confirm(`Revoke "${k.name}"? This cannot be undone.`)) return;
    try {
      await adminApi.revokeApiKey(k.id);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to revoke API key');
    }
  }

  async function copyKey() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Layout>
      <div className="page-shell max-w-6xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">API keys</h1>
            <p className="page-subtitle">Create and revoke keys for integrations such as Make.com. Send keys in the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">X-API-Key</code> header.</p>
          </div>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}

        <form onSubmit={onCreate} className="card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="api-key-name">Key name</label>
              <input
                id="api-key-name"
                className="input"
                placeholder="e.g. Make.com production"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn-primary sm:shrink-0">Create key</button>
          </div>
        </form>

        {created && (
          <div className="card border-amber-200 bg-amber-50/70 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-amber-900">Copy this key now</div>
                <p className="mt-1 text-sm text-amber-800">For security, the full key will not be shown again.</p>
              </div>
              <button type="button" className="btn-ghost shrink-0" onClick={copyKey}>
                {copied ? 'Copied' : 'Copy key'}
              </button>
            </div>
            <code className="mt-4 block overflow-x-auto rounded-xl border border-amber-200 bg-white p-3 text-xs text-slate-800">{created}</code>
          </div>
        )}

        {!keys && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading API keys…</div>}

        {keys && (
          keys.length === 0 ? (
            <div className="card"><EmptyState title="No API keys yet" message="Create a key when you’re ready to connect an external integration." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Prefix</th>
                      <th>Last used</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id}>
                        <td className="font-medium text-slate-800">{k.name}</td>
                        <td className="font-mono text-xs text-slate-600">{k.key_prefix}…</td>
                        <td className="text-slate-500">{k.last_used_at ? fmtDate(k.last_used_at) : 'Never'}</td>
                        <td>
                          {k.is_active
                            ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">Active</span>
                            : <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">Revoked</span>}
                        </td>
                        <td className="text-right">
                          {k.is_active && <button className="btn-danger px-3 py-2 text-xs" onClick={() => revoke(k)}>Revoke</button>}
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