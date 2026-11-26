import { Link } from 'react-router-dom';
import TicketStatusBadge from './TicketStatusBadge';
import TicketCard from './TicketCard';
import EmptyState from '../common/EmptyState';
import { fmtDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function TicketList({
  tickets,
  basePath = '/customer/tickets',
  showCustomer = false,
  showAssignee = false,
  emptyTitle = 'No tickets match',
  emptyMessage = 'Try adjusting filters or search.',
  emptyAction,
}) {
  const { user } = useAuth();

  if (!tickets || tickets.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            to={`${basePath}/${ticket.id}`}
            showCustomer={showCustomer}
            showAssignee={showAssignee}
          />
        ))}
      </div>
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Category</th>
                {showCustomer && <th className="px-4 py-2">Customer</th>}
                {showAssignee && <th className="px-4 py-2">Assignee</th>}
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{t.ticket_number}</td>
                  <td className="max-w-sm px-4 py-3.5">
                    <Link to={`${basePath}/${t.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {t.subject}
                    </Link>
                    {t.sla_breached && <span className="ml-2 text-xs font-medium text-red-600">SLA</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{t.category_name}</td>
                  {showCustomer && <td className="px-4 py-3.5 text-slate-600">{t.created_by_name}</td>}
                  {showAssignee && (
                    <td className="px-4 py-3.5">
                      {t.assigned_to_name || <span className="text-slate-400">Unassigned</span>}
                      {t.assigned_to === user?.id && <span className="text-xs text-brand-600"> (you)</span>}
                    </td>
                  )}
                  <td className="px-4 py-3.5"><TicketStatusBadge priority={t.priority} /></td>
                  <td className="px-4 py-3.5"><TicketStatusBadge status={t.status} /></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{fmtDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}