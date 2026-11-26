import { useState } from 'react';
import { fmtDate } from '../../utils/format';
import EmptyState from '../common/EmptyState';

export default function TicketThread({
  messages = [],
  onSend,
  disabled = false,
  placeholder = 'Write a reply…',
  replyHint = 'Your reply will be visible to the support team.',
}) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!reply.trim() || !onSend) return;
    setError('');
    setBusy(true);
    try {
      await onSend(reply);
      setReply('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Your reply could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {messages.length === 0
        ? <EmptyState title="No messages yet" message="Start the conversation." />
        : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl border p-4 text-sm ${
                  m.sender_role === 'customer'
                    ? 'border-slate-200 bg-white'
                    : 'border-brand-100 bg-brand-50/70'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{m.sender_name}</span>
                  <span className="capitalize text-slate-400">{m.sender_role}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={m.created_at}>{fmtDate(m.created_at)}</time>
                </div>
                <div className="whitespace-pre-wrap text-slate-800">{m.body}</div>
              </li>
            ))}
          </ul>
        )}

      {!disabled && (
        <form onSubmit={submit} className="space-y-2 pt-2">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <textarea
            className="input min-h-[80px]"
            aria-label="Write a reply"
            placeholder={placeholder}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">{replyHint}</span>
            <button className="btn-primary" disabled={busy || !reply.trim()}>
              {busy ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </form>
      )}
      {disabled && <p className="text-sm text-slate-500">This ticket is closed.</p>}
    </div>
  );
}