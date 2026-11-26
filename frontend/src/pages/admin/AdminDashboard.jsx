import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { adminApi } from '../../api/endpoints';
import { STATUSES, STATUS_LABEL } from '../../utils/constants';

const STATUS_BAR = {
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  waiting_on_customer: 'bg-purple-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-slate-400',
};

export default function AdminDashboard() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminApi.metrics()
      .then((r) => setM(r.data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load metrics'));
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Administration</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Workspace overview</h1>
            <p className="mt-2 text-sm text-slate-500">A live view of support activity and team capacity.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Operations snapshot
          </span>
        </div>
        {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
        {!m && !err && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading workspace metrics…</div>}

        {m && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Avg. first response" value={`${m.avg_first_response_hours}h`} hint="Across responded tickets" accent="blue" />
              <Kpi label="SLA compliance" value={`${m.sla_compliance_pct}%`} hint="Tickets meeting current SLA" accent="violet" />
              <Kpi label="Customer satisfaction" value={m.satisfaction_count ? m.avg_satisfaction : '—'} hint={`${m.satisfaction_count} survey responses`} accent="amber" />
              <Kpi label="Total tickets" value={m.tickets_by_status.reduce((s, r) => s + r.n, 0)} hint="All ticket statuses" accent="emerald" />
            </div>

            <div className="card p-5 sm:p-6">
              <div className="mb-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ticket health</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Requests by status</h2>
              </div>
              <StatusBars rows={m.tickets_by_status} />
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Team capacity</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Agent workload</h2>
              </div>
              {m.workload_per_agent.length === 0
                ? <EmptyState title="No agents yet" />
                : (
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Agent</th>
                        <th className="px-6 py-3">Active</th>
                        <th className="px-6 py-3">Resolved / closed</th>
                        <th className="px-6 py-3">Total assigned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {m.workload_per_agent.map((a) => (
                        <tr key={a.id} className="transition hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-800">{a.full_name}</td>
                          <td className="px-6 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{a.active}</span></td>
                          <td className="px-6 py-4 text-slate-600">{a.done}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{a.assigned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function Kpi({ label, value, hint, accent = 'blue' }) {
  const accentClasses = {
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <span className={`h-3 w-3 rounded-full ring-4 ring-offset-2 ${accentClasses[accent]}`} />
      </div>
      {hint && <div className="mt-3 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function StatusBars({ rows }) {
  const map = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  return (
    <div className="space-y-2">
      {STATUSES.map((s) => {
        const n = map[s] || 0;
        const pct = Math.round((n / total) * 100);
        return (
          <div key={s} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-sm font-medium text-slate-600">{STATUS_LABEL[s]}</div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${STATUS_BAR[s]}`} style={{ width: `${pct}%` }} />
            </div>
              <div className="w-24 shrink-0 text-right text-xs font-medium text-slate-500">{n} <span className="text-slate-400">({pct}%)</span></div>
          </div>
        );
      })}
    </div>
  );
}