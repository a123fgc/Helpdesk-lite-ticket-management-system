import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { webhooksApi } from '../../api/endpoints';
import { fmtDate } from '../../utils/format';
import { WEBHOOK_EVENT_TYPES } from '../../utils/constants';

const STATUSES = ['', 'pending', 'delivered', 'failed'];

export default function WebhookEvents() {
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState({ status: '', event_type: '', page: 1, limit: 20 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(null);

  function load() {
    setList(null);
    webhooksApi.list(filters)
      .then((r) => setList(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed'));
  }
  useEffect(load, [JSON.stringify(filters)]); // eslint-disable-line

  function change(k, v) { setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 })); }

  async function resend(ev) {
    setBusy(ev.id); setErr('');
    try { await webhooksApi.resend(ev.id); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setBusy(null); }
  }

  return (
    <Layout>
      <div className="max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold">Webhook Events</h1>

        <div className="card p-3 flex flex-wrap gap-2 items-center">
          <select className="input max-w-[180px]" value={filters.status} onChange={(e) => change('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <select className="input max-w-[220px]" value={filters.event_type} onChange={(e) => change('event_type', e.target.value)}>
            <option value="">All event types</option>
            {WEBHOOK_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="ml-auto text-sm text-slate-500">Retries happen automatically with backoff.</div>
        </div>

        {err && <div className="text-red-600">{err}</div>}
        {!list && <Spinner />}

        {list && (
          list.data.length === 0 ? <EmptyState title="No events" /> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Ticket</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Attempts</th>
                  <th className="px-4 py-2">Next retry</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((ev) => (
                  <FragmentRow
                    key={ev.id}
                    ev={ev}
                    expanded={expanded === ev.id}
                    onToggle={() => setExpanded(expanded === ev.id ? null : ev.id)}
                    busy={busy === ev.id}
                    onResend={() => resend(ev)}
                  />
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

function FragmentRow({ ev, expanded, onToggle, busy, onResend }) {
  return (
    <>
      <tr>
        <td className="px-4 py-2">
          <button className="text-brand-600 hover:underline" onClick={onToggle}>{ev.event_type}</button>
        </td>
        <td className="px-4 py-2 font-mono text-xs">{ev.ticket_id ? ev.ticket_id.slice(0, 8) : '—'}</td>
        <td className="px-4 py-2">
          {ev.status === 'delivered' && <span className="text-emerald-700 text-xs font-medium">Delivered</span>}
          {ev.status === 'pending' && <span className="text-amber-700 text-xs font-medium">Pending</span>}
          {ev.status === 'failed' && <span className="text-red-700 text-xs font-medium">Failed</span>}
        </td>
        <td className="px-4 py-2">{ev.attempts}</td>
        <td className="px-4 py-2 text-slate-500">{ev.next_retry_at ? fmtDate(ev.next_retry_at) : '—'}</td>
        <td className="px-4 py-2 text-slate-500">{fmtDate(ev.created_at)}</td>
        <td className="px-4 py-2 text-right">
          <button className="btn-ghost" onClick={onResend} disabled={busy}>
            {busy ? '…' : 'Resend'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-slate-50">
            <div className="text-xs text-slate-500 mb-1">Payload</div>
            <pre className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto">
{JSON.stringify(ev.payload, null, 2)}
            </pre>
            {ev.last_error && (
              <div className="text-xs text-red-600 mt-2">Last error: {ev.last_error}</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}