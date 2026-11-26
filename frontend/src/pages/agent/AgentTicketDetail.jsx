import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import TicketStatusBadge from '../../components/tickets/TicketStatusBadge';
import TicketThread from '../../components/tickets/TicketThread';
import { ticketsApi, messagesApi, notesApi, auditApi } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../utils/format';
import { STATUS_LABEL, STATUS_TRANSITIONS } from '../../utils/constants';
import { downloadAttachment } from '../../utils/downloadAttachment';

export default function AgentTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const requestVersion = useRef(0);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [relatedError, setRelatedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const request = ++requestVersion.current;
    setLoading(true);
    setErr('');
    setRelatedError('');
    const results = await Promise.allSettled([
      ticketsApi.get(id),
      messagesApi.list(id),
      notesApi.list(id),
      auditApi.byTicket(id),
    ]);
    if (request !== requestVersion.current) return;

    if (results[0].status === 'fulfilled') {
      setTicket(results[0].value.data);
    } else {
      setTicket(null);
      setErr(results[0].reason?.response?.data?.error || 'Could not load this ticket.');
    }

    const failures = [];
    if (results[1].status === 'fulfilled') setMessages(results[1].value.data);
    else failures.push('conversation');
    if (results[2].status === 'fulfilled') setNotes(results[2].value.data);
    else failures.push('internal notes');
    if (results[3].status === 'fulfilled') setAudit(results[3].value.data);
    else failures.push('audit trail');
    if (failures.length) {
      setRelatedError(`Could not load ${failures.join(', ')}. Refresh to try again.`);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    setTicket(null);
    load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  async function assignSelf() {
    setBusy(true);
    setErr('');
    try {
      await ticketsApi.assignSelf(id);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not assign this ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    if (status === ticket.status) return;
    setBusy(true);
    setErr('');
    try {
      await ticketsApi.changeStatus(id, status);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not update the ticket status.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(body) {
    await messagesApi.create(id, body);
    await load();
  }

  async function downloadFile(attachment) {
    setErr('');
    try {
      await downloadAttachment(id, attachment);
    } catch {
      setErr('Could not download attachment.');
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await notesApi.create(id, note);
      setNote('');
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not add the internal note.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ticket) {
    return <Layout><div className="flex items-center gap-3 text-sm text-slate-500"><Spinner />Loading ticket…</div></Layout>;
  }
  if (err && !ticket) {
    return (
      <Layout>
        <div role="alert" className="card space-y-3 p-6">
          <p className="text-sm text-red-700">{err}</p>
          <button type="button" className="btn-ghost" onClick={load}>Try again</button>
        </div>
      </Layout>
    );
  }
  if (!ticket) return null;

  const isMine = ticket.assigned_to === user?.id;
  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-5">
        <Link to="/agent/queue" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-700">
          <span aria-hidden="true">←</span> Ticket queue
        </Link>

        {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

        <section className="card space-y-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ticket #{ticket.ticket_number} <span className="mx-1">·</span> {ticket.category_name}
              </div>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950">{ticket.subject}</h1>
            </div>
            <TicketStatusBadge status={ticket.status} priority={ticket.priority} sla={ticket.sla_breached} />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-slate-100 py-3 text-xs text-slate-500">
            <span>Customer: <strong className="font-semibold text-slate-700">{ticket.created_by_name}</strong></span>
            <span>Created {fmtDate(ticket.created_at)}</span>
            <span>{ticket.assigned_to_name ? `Assigned to ${ticket.assigned_to_name}` : 'Unassigned'}</span>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Customer description</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{ticket.description}</div>
          </div>

          {ticket.attachments?.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Attachments</div>
              <ul className="flex flex-wrap gap-2">
                {ticket.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
                      onClick={() => downloadFile(attachment)}
                    >
                      <span aria-hidden="true">↓</span>{attachment.original_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {relatedError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{relatedError}</div>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="order-2 space-y-5 lg:order-1 lg:col-span-2">
            <section className="card space-y-4 p-5 sm:p-7">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-brand-600">Customer communication</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Conversation</h2>
                <p className="mt-1 text-sm text-slate-500">Replies here are visible to the customer.</p>
              </div>
              <TicketThread
                messages={messages}
                onSend={sendReply}
                disabled={ticket.status === 'closed'}
                placeholder="Write a reply to the customer…"
                replyHint="This message will be visible to the customer."
              />
            </section>

            <section className="card space-y-4 p-5 sm:p-7">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Private to your team</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Internal notes</h2>
                <p className="mt-1 text-sm text-slate-500">Customers cannot see these notes.</p>
              </div>
              {notes.length === 0
                ? <EmptyState title="No internal notes" message="Add context for the next agent who handles this request." />
                : (
                  <ul className="space-y-3">
                    {notes.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{item.author_name}</span>
                          <span aria-hidden="true">·</span><time dateTime={item.created_at}>{fmtDate(item.created_at)}</time>
                        </div>
                        <div className="whitespace-pre-wrap leading-6 text-slate-800">{item.body}</div>
                      </li>
                    ))}
                  </ul>
                )}

              <form onSubmit={addNote} className="space-y-3 border-t border-slate-100 pt-4">
                <label htmlFor="internal-note" className="label">Add a private note</label>
                <textarea
                  id="internal-note"
                  className="input min-h-[90px]"
                  placeholder="Share troubleshooting steps or useful context with your team…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex justify-end">
                  <button className="btn-ghost" disabled={busy || !note.trim()}>{busy ? 'Saving…' : 'Add note'}</button>
                </div>
              </form>
            </section>
          </div>

          <aside className="order-1 space-y-4 lg:order-2">
            <section className="card space-y-4 p-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-brand-600">Ticket controls</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Actions</h2>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-slate-500">Current assignee</div>
                <div className="mt-1 font-semibold text-slate-800">{ticket.assigned_to_name || 'Not assigned'}</div>
              </div>
              {!isMine && (
                <button className="btn-primary w-full" disabled={busy} onClick={assignSelf}>
                  {busy ? 'Updating…' : ticket.assigned_to ? 'Reassign to me' : 'Assign to me'}
                </button>
              )}
              {isMine && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">This ticket is assigned to you.</div>}

              <div>
                <label htmlFor="ticket-status" className="label">Update status</label>
                <select
                  id="ticket-status"
                  className="input"
                  value={ticket.status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={busy || nextStatuses.length === 0}
                >
                  <option value={ticket.status}>{STATUS_LABEL[ticket.status]}</option>
                  {nextStatuses.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {nextStatuses.length
                    ? 'Only valid next steps are available.'
                    : 'This ticket is closed and cannot be moved to another status.'}
                </p>
              </div>

              {(ticket.first_response_at || ticket.sla_response_due_at || ticket.sla_resolve_due_at) && (
                <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  {ticket.first_response_at && <p>First response: <strong className="text-slate-700">{fmtDate(ticket.first_response_at)}</strong></p>}
                  {ticket.sla_response_due_at && <p>Response due: <strong className="text-slate-700">{fmtDate(ticket.sla_response_due_at)}</strong></p>}
                  {ticket.sla_resolve_due_at && <p>Resolution due: <strong className="text-slate-700">{fmtDate(ticket.sla_resolve_due_at)}</strong></p>}
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className="card space-y-4 p-5 sm:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Ticket history</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Audit trail</h2>
          </div>
          {audit.length === 0
            ? <EmptyState title={loading ? 'Loading activity…' : 'No activity yet'} />
            : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {audit.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 p-3 text-xs">
                    <div className="font-semibold text-slate-700">{item.action}</div>
                    <div className="mt-1 text-slate-500">{item.actor_name || 'System'} · {fmtDate(item.created_at)}</div>
                    {(item.old_value || item.new_value) && (
                      <div className="mt-2 break-words text-slate-400">
                        {item.old_value ? `From ${JSON.stringify(item.old_value)} ` : ''}
                        {item.new_value ? `to ${JSON.stringify(item.new_value)}` : ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </Layout>
  );
}
