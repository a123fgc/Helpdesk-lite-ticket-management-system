import Badge from '../common/Badge';
import { STATUS_LABEL, PRIORITY_LABEL } from '../../utils/constants';

export default function TicketStatusBadge({ status, priority, sla }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {priority && <Badge tone={priority}>{PRIORITY_LABEL[priority] || priority}</Badge>}
      {status && <Badge tone={status}>{STATUS_LABEL[status] || status.replace(/_/g, ' ')}</Badge>}
      {sla && <Badge tone="urgent">SLA breach</Badge>}
    </div>
  );
}