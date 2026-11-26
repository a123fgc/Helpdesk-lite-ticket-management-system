import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import TicketStatusBadge from '../../components/tickets/TicketStatusBadge';
import TicketThread from '../../components/tickets/TicketThread';
import { ticketsApi, messagesApi } from '../../api/endpoints';
import { fmtDate } from '../../utils/format';
import { downloadAttachment } from '../../utils/downloadAttachment';

export default function TicketDetail() {
  const { id } = useParams();
  const requestVersion = useRef(0);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [messagesError, setMessagesError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');

  const load = useCallback(async ({ reset = false } = {}) => {
    const request = ++requestVersion.current;
    setLoading(true);
    setErr('');
    setMessagesError('');
    if (reset) {
      setTicket(null);
      setMessages([]);
    }
    const [ticketResult, messagesResult] = await Promise.allSettled([
      ticketsApi.get(id),
      messagesApi.list(id),
    ]);
    if (request !== requestVersion.current) return;
    if (ticketResult.status === 'fulfilled') {
      setTicket(ticketResult.value.data);
    } else {
      setErr(ticketResult.reason?.response?.data?.error || 'Could not load this ticket');
    }
    if (messagesResult.status === 'fulfilled') {
      setMessages(messagesResult.value.data);
    } else {
      setMessagesError('Conversation could not be loaded. Refresh the page to try again.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load({ reset: true });
    return () => { requestVersion.current += 1; };
  }, [load]);

  async function sendReply(body) {
    await messagesApi.create(id, body);
    await load();
  }

  async function downloadFile(attachment) {
    setAttachmentError('');
    try {
      await downloadAttachment(id, attachment);
    } catch {
      setAttachmentError('Could not download attachment');
    }
  }

  if (loading && !ticket) return <Layout><div className="flex items-center gap-3 text-sm text-slate-500"><Spinner />Loading your request…</div></Layout>;
  if (err && !ticket) {
    return (
      <Layout>
        <div role="alert" className="card space-y-3 p-6">
          <p className="text-sm text-red-700">{err}</p>
          <button type="button" className="btn-ghost" onClick={() => load({ reset: true })}>Try again</button>
        </div>
      </Layout>
    );
  }
  if (!ticket) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link to="/customer/tickets" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-700">
          <span aria-hidden="true">←</span> My tickets
        </Link>

        <div className="card space-y-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Request #{ticket.ticket_number} <span className="mx-1">·</span> {ticket.category_name}
              </div>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950">{ticket.subject}</h1>
            </div>
            <TicketStatusBadge status={ticket.status} priority={ticket.priority} sla={ticket.sla_breached} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-slate-100 py-3 text-xs text-slate-500">
            <span>Created {fmtDate(ticket.created_at)}</span>
            <span>{ticket.assigned_to_name ? `Assigned to ${ticket.assigned_to_name}` : 'Waiting for an agent'}</span>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Request details</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{ticket.description}</div>
          </div>

          {ticket.attachments?.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Attachments</div>
              {attachmentError && <p role="alert" className="mb-2 text-sm text-red-600">{attachmentError}</p>}
              <ul className="flex flex-wrap gap-2">
                {ticket.attachments.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:border-brand-200 hover:bg-brand-50" onClick={() => downloadFile(a)}>
                      <span aria-hidden="true">↓</span>
                      {a.original_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card space-y-4 p-5 sm:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-brand-600">Support conversation</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Messages</h2>
            <p className="mt-1 text-sm text-slate-500">Replies and updates about your request appear here.</p>
          </div>
          {messagesError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{messagesError}</div>}
          <TicketThread
            messages={messages}
            onSend={sendReply}
            disabled={ticket.status === 'closed'}
          />
          {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><Spinner className="h-4 w-4" />Refreshing conversation…</div>}
        </div>
      </div>
    </Layout>
  );
}