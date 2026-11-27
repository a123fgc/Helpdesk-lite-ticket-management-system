import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import { slaApi } from '../../api/endpoints';

const ORDER = ['urgent', 'high', 'medium', 'low'];

export default function ManageSLAs() {
  const [rules, setRules] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(null);

  function load() {
    slaApi.list()
      .then((r) => setRules(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load SLA rules'));
  }

  useEffect(load, []);

  function updateRule(priority, key, value) {
    setRules((rs) => rs.map((r) => (r.priority === priority ? { ...r, [key]: Number(value) } : r)));
  }

  async function save(rule) {
    setSaving(rule.priority);
    setErr('');
    try {
      await slaApi.upsert({
        priority: rule.priority,
        response_minutes: rule.response_minutes,
        resolution_minutes: rule.resolution_minutes,
      });
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save SLA rule');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Layout>
      <div className="page-shell max-w-5xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">SLA rules</h1>
            <p className="page-subtitle">Define response and resolution targets by priority. Times are measured in minutes from ticket creation.</p>
          </div>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}
        {!rules && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading SLA rules…</div>}

        {rules && (
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Response (min)</th>
                    <th>Resolution (min)</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules
                    .slice()
                    .sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority))
                    .map((r) => (
                      <tr key={r.priority}>
                        <td>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 ring-1 ring-inset ring-slate-200/80">
                            {r.priority}
                          </span>
                        </td>
                        <td>
                          <input
                            className="input max-w-[160px]"
                            type="number"
                            min={1}
                            aria-label={`${r.priority} response minutes`}
                            value={r.response_minutes}
                            onChange={(e) => updateRule(r.priority, 'response_minutes', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="input max-w-[160px]"
                            type="number"
                            min={1}
                            aria-label={`${r.priority} resolution minutes`}
                            value={r.resolution_minutes}
                            onChange={(e) => updateRule(r.priority, 'resolution_minutes', e.target.value)}
                          />
                        </td>
                        <td className="text-right">
                          <button className="btn-primary px-4 py-2 text-xs" disabled={saving === r.priority} onClick={() => save(r)}>
                            {saving === r.priority ? 'Saving…' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}