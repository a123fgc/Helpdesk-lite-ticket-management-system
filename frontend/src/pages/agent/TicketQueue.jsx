import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import TicketList from '../../components/tickets/TicketList';
import TicketFilters from '../../components/tickets/TicketFilters';
import { useTickets } from '../../hooks/useTickets';

export default function TicketQueue() {
  const [filters, setFilters] = useState({
    status: '', priority: '', category_id: '', assigned_to: '', mine: '', search: '', page: 1, limit: 10,
  });
  const { data, page, limit, total, loading, error, reload } = useTickets(filters);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Team operations</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ticket queue</h1>
          <p className="mt-2 text-sm text-slate-500">Prioritize, filter, and take ownership of customer requests.</p>
        </div>

        <TicketFilters
          filters={filters}
          onChange={setFilters}
          showAssignee
          showMine
        />

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" className="font-semibold underline" onClick={reload}>Try again</button>
          </div>
        )}
        {loading && <div className="flex items-center gap-3 text-sm text-slate-500"><Spinner />Loading ticket queue…</div>}

        {!loading && !error && data && (
          <>
            <div className="text-xs font-medium text-slate-500">{total} {total === 1 ? 'ticket' : 'tickets'} in this view</div>
            <TicketList
              tickets={data}
              basePath="/agent/tickets"
              showCustomer
              showAssignee
              emptyTitle="No tickets in this view"
              emptyMessage="Try changing the filters or check back later."
            />
            <div className="flex justify-end">
              <Pagination
                page={page} limit={limit} total={total}
                onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}