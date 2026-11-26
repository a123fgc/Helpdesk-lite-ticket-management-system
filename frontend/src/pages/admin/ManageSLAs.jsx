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
    slaApi.list().then((r) => setRules(r.data)).catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }
  useEffect(load, []);

  function updateRow(idx, k, v) {
    setRules((rs) => rs.map((r, i) => i === idx ? { ...r, [k]: Number(v) } : r));
  }

  async function save(rule) {
    setSaving(rule.priority);
    try {
      await slaApi.upsert({
        priority: rule.priority,
        response_minutes: rule.response_minutes,
        resolution_minutes: rule.resolution_minutes,
      });
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setSaving(null); }
  }

  return (
    <Layout>
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">SLA Rules</h1>
        <p className="text-sm text-slate-500">Minutes from ticket creation.</p>
        {err && <div className="text-red-600">{err}</div>}
        {!rules && <Spinner />}

        {rules && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Response (min)</th>
                  <th className="px-4 py-2">Resolution (min)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules
                  .slice()
                  .sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority))
                  .map((r, i) => (
                    <tr key={r.priority}>
                      <td className="px-4 py-2 capitalize font-medium">{r.priority}</td>
                      <td className="px-4 py-2">
                        <input className="input max-w-[140px]" type="number" min={1}
                               value={r.response_minutes}
                               onChange={(e) => updateRow(i, 'response_minutes', e.target.value)} />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input max-w-[140px]" type="number" min={1}
                               value={r.resolution_minutes}
                               onChange={(e) => updateRow(i, 'resolution_minutes', e.target.value)} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="btn-primary" disabled={saving === r.priority} onClick={() => save(r)}>
                          {saving === r.priority ? 'Saving…' : 'Save'}
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