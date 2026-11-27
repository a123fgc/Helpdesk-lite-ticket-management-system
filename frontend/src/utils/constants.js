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
  open: 'bg-blue-50 text-blue-700 ring-blue-200/70',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  waiting_on_customer: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  closed: 'bg-slate-100 text-slate-700 ring-slate-200/80',
};

export const PRIORITY_COLOR = {
  low: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  medium: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  high: 'bg-orange-50 text-orange-700 ring-orange-200/70',
  urgent: 'bg-rose-50 text-rose-700 ring-rose-200/70',
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