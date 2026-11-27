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
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load audit log'));
  }, [JSON.stringify(filters)]); // eslint-disable-line

  function change(k, v) {
    setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));
  }

  return (
    <Layout>
      <div className="page-shell max-w-7xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">Audit log</h1>
            <p className="page-subtitle">Review important ticket and system activity for accountability and troubleshooting.</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label" htmlFor="audit-action">Action</label>
              <select id="audit-action" className="input" value={filters.action} onChange={(e) => change('action', e.target.value)}>
                <option value="">All actions</option>
                {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="audit-ticket-id">Ticket ID</label>
              <input
                id="audit-ticket-id"
                className="input"
                placeholder="Ticket UUID"
                value={filters.ticket_id}
                onChange={(e) => change('ticket_id', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="audit-from">From</label>
              <input
                id="audit-from"
                className="input"
                type="datetime-local"
                value={filters.from}
                onChange={(e) => change('from', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="audit-to">To</label>
              <input
                id="audit-to"
                className="input"
                type="datetime-local"
                value={filters.to}
                onChange={(e) => change('to', e.target.value)}
              />
            </div>
          </div>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}
        {!list && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading audit log…</div>}

        {list && (
          list.data.length === 0 ? (
            <div className="card"><EmptyState title="No audit entries" message="Try adjusting filters or check back after ticket activity occurs." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Ticket</th>
                      <th>Actor</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap text-slate-500">{fmtDate(a.created_at)}</td>
                        <td>
                          <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-medium text-slate-700">
                            {a.action}
                          </span>
                        </td>
                        <td className="font-medium text-slate-700">{a.ticket_number ? `#${a.ticket_number}` : '—'}</td>
                        <td className="text-slate-600">
                          {a.actor_name || <span className="text-slate-400">system</span>}
                          {a.actor_role && <span className="ml-1 text-xs text-slate-400">({a.actor_role})</span>}
                        </td>
                        <td className="max-w-md break-words text-xs text-slate-600">
                          {a.old_value ? `from ${JSON.stringify(a.old_value)} ` : ''}
                          {a.new_value ? `to ${JSON.stringify(a.new_value)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 p-4 sm:p-5">
                <Pagination page={list.page} limit={list.limit} total={list.total} onChange={(p) => change('page', p)} />
              </div>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}