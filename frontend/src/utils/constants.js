export const STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];
export const STATUS_TRANSITIONS = {
  open: ['in_progress'],
  in_progress: ['waiting_on_customer', 'resolved'],
  waiting_on_customer: ['in_progress', 'resolved'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const STATUS_COLOR = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting_on_customer: 'bg-purple-100 text-purple-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
};

export const PRIORITY_COLOR = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export const AUDIT_ACTIONS = [
  'ticket_created',
  'status_changed',
  'assigned',
  'message_added',
  'note_added',
  'sla_breached',
  'survey_submitted',
  'auto_closed',
];

export const WEBHOOK_EVENT_TYPES = [
  'ticket.created',
  'ticket.status_changed',
  'ticket.resolved',
  'ticket.sla_breach',
];