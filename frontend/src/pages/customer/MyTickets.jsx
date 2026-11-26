import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import TicketList from '../../components/tickets/TicketList';
import TicketFilters from '../../components/tickets/TicketFilters';
import { useTickets } from '../../hooks/useTickets';

export default function MyTickets() {
  const [filters, setFilters] = useState({
    status: '', priority: '', category_id: '', search: '', page: 1, limit: 10,
  });
  const { data, page, limit, total, loading, error, reload } = useTickets(filters);
  const hasFilters = Boolean(filters.status || filters.priority || filters.category_id || filters.search);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Support history</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">My tickets</h1>
            <p className="mt-2 text-sm text-slate-500">Search and follow up on your support requests.</p>
          </div>
          <Link to="/customer/tickets/new" className="btn-primary">Create a request <span aria-hidden="true">→</span></Link>
        </div>

        <TicketFilters filters={filters} onChange={setFilters} />

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" className="font-semibold underline" onClick={reload}>Try again</button>
          </div>
        )}
        {loading && <div className="flex items-center gap-3 text-sm text-slate-500"><Spinner />Loading your requests…</div>}

        {!loading && !error && data && (
          <>
            <div className="text-xs font-medium text-slate-500">{total} {total === 1 ? 'request' : 'requests'} found</div>
            <TicketList
              tickets={data}
              basePath="/customer/tickets"
              emptyTitle={hasFilters ? 'No matching requests' : 'No requests yet'}
              emptyMessage={hasFilters
                ? 'Try a different search or remove one of the filters.'
                : 'When you contact support, your requests and replies will appear here.'}
              emptyAction={!hasFilters && <Link to="/customer/tickets/new" className="btn-primary">Create your first request</Link>}
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