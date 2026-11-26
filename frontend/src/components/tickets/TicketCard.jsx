import { Link } from 'react-router-dom';
import TicketStatusBadge from './TicketStatusBadge';
import { fmtRelative } from '../../utils/format';

export default function TicketCard({ ticket, to, showCustomer = false, showAssignee = false }) {
  return (
    <Link
      to={to}
      className="group block card p-4 transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-5"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700 sm:text-base">
            <span className="mr-2 font-mono text-xs font-medium text-slate-400">#{ticket.ticket_number}</span>
            {ticket.subject}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {ticket.category_name}
            {showCustomer && ticket.created_by_name && <> · {ticket.created_by_name}</>}
            {showAssignee && <> · {ticket.assigned_to_name || 'Unassigned'}</>}
            <span aria-hidden="true">·</span>{fmtRelative(ticket.created_at)}
          </div>
        </div>
        <TicketStatusBadge status={ticket.status} priority={ticket.priority} sla={ticket.sla_breached} />
      </div>
    </Link>
  );
}