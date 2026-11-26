import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { auditApi } from '../../api/endpoints';
import { fmtDate } from '../../utils/format';
import { AUDIT_ACTIONS } from '../../utils/constants';

export default function AuditLog() {
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState({ action: '', ticket_id: '', from: '', to: '', page: 1, limit: 25 });
  const [err, setErr] = useState('');

  useEffect(() => {
    setList(null);
    auditApi.list(filters)
      .then((r) => setList(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }, [JSON.stringify(filters)]); // eslint-disable-line

  function change(k, v) { setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 })); }

  return (
    <Layout>
      <div className="max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold">Audit Log</h1>

        <div className="card p-3 flex flex-wrap gap-2 items-center">
          <select className="input max-w-[200px]" value={filters.action} onChange={(e) => change('action', e.target.value)}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input className="input max-w-[280px]" placeholder="ticket id (uuid)"
                 value={filters.ticket_id} onChange={(e) => change('ticket_id', e.target.value)} />
          <input className="input max-w-[200px]" type="datetime-local"
                 value={filters.from} onChange={(e) => change('from', e.target.value)} />
          <input className="input max-w-[200px]" type="datetime-local"
                 value={filters.to} onChange={(e) => change('to', e.target.value)} />
        </div>

        {err && <div className="text-red-600">{err}</div>}
        {!list && <Spinner />}

        {list && (
          list.data.length === 0 ? <EmptyState title="No entries" /> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Ticket</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td className="px-4 py-2 font-medium">{a.action}</td>
                    <td className="px-4 py-2">{a.ticket_number ? `#${a.ticket_number}` : '—'}</td>
                    <td className="px-4 py-2">
                      {a.actor_name || <span className="text-slate-400">system</span>}
                      {a.actor_role && <span className="text-xs text-slate-400"> ({a.actor_role})</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 break-all">
                      {a.old_value ? `from ${JSON.stringify(a.old_value)} ` : ''}
                      {a.new_value ? `to ${JSON.stringify(a.new_value)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-slate-100 flex justify-end">
              <Pagination page={list.page} limit={list.limit} total={list.total} onChange={(p) => change('page', p)} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}