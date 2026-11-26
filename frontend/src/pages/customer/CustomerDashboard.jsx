import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import TicketCard from '../../components/tickets/TicketCard';
import { ticketsApi } from '../../api/endpoints';
import { useTickets } from '../../hooks/useTickets';
import { useAuth } from '../../hooks/useAuth';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const recent = useTickets({ limit: 5 });
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    ticketsApi.summary()
      .then((response) => setSummary(response.data))
      .catch((error) => setSummaryError(error.response?.data?.error || 'Could not load ticket summary'));
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-700 px-6 py-8 text-white shadow-lg sm:px-9 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute right-24 top-20 h-40 w-40 rounded-full border border-white/10" />
          <div className="relative max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Customer workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Good to see you, {user.full_name.split(' ')[0]}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Keep track of your requests and pick up the conversation whenever you need.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/customer/tickets/new" className="btn rounded-xl bg-white text-slate-900 shadow-sm hover:bg-blue-50">
                Create a support request
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/customer/tickets" className="btn border border-white/25 bg-white/10 text-white hover:bg-white/15">
                View all tickets
              </Link>
            </div>
          </div>
        </section>

        {summaryError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{summaryError}</div>}

        <section aria-label="Ticket summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="All requests" value={summary?.total ?? '—'} detail="Across your account" accent="blue" />
          <StatCard label="Open" value={summary ? (summary.by_status?.open || 0) : '—'} detail="Waiting for resolution" accent="amber" />
          <StatCard label="Resolved" value={summary ? (summary.by_status?.resolved || 0) : '—'} detail="Recently completed" accent="emerald" />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Your activity</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Recent requests</h2>
            </div>
            <Link to="/customer/tickets" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
              Browse all tickets <span aria-hidden="true">→</span>
            </Link>
          </div>

          {recent.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{recent.error}</div>}
          {recent.loading && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading your tickets…</div>}
          {!recent.loading && recent.data && (
            recent.data.length === 0
              ? <div className="card"><EmptyState title="Your support inbox is clear" message="When you create a request, you’ll find updates and replies here." action={<Link to="/customer/tickets/new" className="btn-primary">Create your first request</Link>} /></div>
              : <div className="space-y-3">
                  {recent.data.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} to={`/customer/tickets/${ticket.id}`} />
                  ))}
                </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function StatCard({ label, value, detail, accent }) {
  const accentClasses = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs text-slate-400">{detail}</div>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${accentClasses[accent]}`}>
          {accent === 'blue' ? 'All' : accent === 'amber' ? '↗' : '✓'}
        </span>
      </div>
    </div>
  );
}
