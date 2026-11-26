import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import TicketForm from '../../components/tickets/TicketForm';
import { ticketsApi } from '../../api/endpoints';

export default function CreateTicket() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(fd) {
    setErr(''); setBusy(true);
    try {
      const r = await ticketsApi.create(fd);
      nav(`/customer/tickets/${r.data.id}`);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not create ticket');
    } finally { setBusy(false); }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">We’re here to help</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Create a support request</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Share a few details so our team can get to the right solution faster.
          </p>
        </div>
        <TicketForm onSubmit={onSubmit} busy={busy} error={err} />
      </div>
    </Layout>
  );
}