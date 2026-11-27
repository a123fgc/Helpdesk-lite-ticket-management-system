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
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load webhook events'));
  }

  useEffect(load, [JSON.stringify(filters)]); // eslint-disable-line

  function change(k, v) {
    setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));
  }

  async function resend(ev) {
    setBusy(ev.id);
    setErr('');
    try {
      await webhooksApi.resend(ev.id);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to resend webhook');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Layout>
      <div className="page-shell max-w-7xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">Webhook events</h1>
            <p className="page-subtitle">Monitor outbound webhook delivery, inspect payloads, and resend events when needed.</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[220px_280px_1fr] xl:items-end">
            <div>
              <label className="label" htmlFor="webhook-status">Status</label>
              <select id="webhook-status" className="input" value={filters.status} onChange={(e) => change('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="webhook-event-type">Event type</label>
              <select id="webhook-event-type" className="input" value={filters.event_type} onChange={(e) => change('event_type', e.target.value)}>
                <option value="">All event types</option>
                {WEBHOOK_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 xl:mb-0.5">
              Retries happen automatically with exponential backoff.
            </div>
          </div>
        </div>

        {err && <div role="alert" className="alert-error">{err}</div>}
        {!list && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading webhook events…</div>}

        {list && (
          list.data.length === 0 ? (
            <div className="card"><EmptyState title="No webhook events" message="Events will appear here when ticket actions trigger outbound webhooks." /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Ticket</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Next retry</th>
                      <th>Created</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
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

function FragmentRow({ ev, expanded, onToggle, busy, onResend }) {
  return (
    <>
      <tr>
        <td>
          <button className="font-medium text-brand-700 hover:text-brand-600 hover:underline" onClick={onToggle}>
            {ev.event_type}
          </button>
        </td>
        <td className="font-mono text-xs text-slate-500">{ev.ticket_id ? ev.ticket_id.slice(0, 8) : '—'}</td>
        <td>
          {ev.status === 'delivered' && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">Delivered</span>}
          {ev.status === 'pending' && <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/70">Pending</span>}
          {ev.status === 'failed' && <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/70">Failed</span>}
        </td>
        <td className="text-slate-600">{ev.attempts}</td>
        <td className="text-slate-500">{ev.next_retry_at ? fmtDate(ev.next_retry_at) : '—'}</td>
        <td className="text-slate-500">{fmtDate(ev.created_at)}</td>
        <td className="text-right">
          <button className="btn-ghost px-3 py-2 text-xs" onClick={onResend} disabled={busy}>
            {busy ? 'Sending…' : 'Resend'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50/70 px-4 py-4 sm:px-5">
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Payload</div>
                <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-700">
{JSON.stringify(ev.payload, null, 2)}
                </pre>
              </div>
              {ev.last_error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  <span className="font-semibold">Last error:</span> {ev.last_error}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}