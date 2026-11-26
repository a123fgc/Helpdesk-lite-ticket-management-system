import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import TicketCard from '../../components/tickets/TicketCard';
import { useTickets } from '../../hooks/useTickets';
import { useAuth } from '../../hooks/useAuth';

export default function AgentDashboard() {
  const { user } = useAuth();
  const mine = useTickets({ mine: 'true', limit: 5 });
  const unassigned = useTickets({ status: 'open', unassigned: 'true', limit: 5 });

  return (
    <Layout>
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Agent workspace</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Welcome back, {user.full_name.split(' ')[0]}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Your queue, your customers, and the next best action—all in one place.
            </p>
          </div>
          <Link to="/agent/queue" className="btn-primary shrink-0">
            Open ticket queue <span aria-hidden="true">→</span>
          </Link>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Section
            title="Assigned to me"
            eyebrow="Your workload"
            state={mine}
            empty="No tickets are assigned to you right now."
          />
          <Section
            title="Available to pick up"
            eyebrow="Open queue"
            state={unassigned}
            empty="There are no unassigned open tickets."
          />
        </div>
      </div>
    </Layout>
  );
}

function Section({ title, eyebrow, state, empty }) {
  const { data, loading, error } = state;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</div>
          <h2 className="mt-1 font-semibold text-slate-900">{title}</h2>
        </div>
        <Link to="/agent/queue" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
          View queue <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <div className="flex items-center gap-3 p-3 text-sm text-slate-500"><Spinner />Loading tickets…</div>}
        {!loading && data && (
          data.length === 0
            ? <EmptyState title={empty} />
            : <div className="space-y-3">
                {data.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} to={`/agent/tickets/${ticket.id}`} showCustomer />
                ))}
              </div>
        )}
      </div>
    </section>
  );
}
