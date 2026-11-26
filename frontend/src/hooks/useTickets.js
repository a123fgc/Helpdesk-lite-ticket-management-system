import { useEffect, useState } from 'react';
import { ticketsApi } from '../api/endpoints';

/**
 * Fetches tickets with the given filters.
 * `filters` can be any query object supported by GET /api/tickets.
 * Returns { data, page, limit, total, loading, error, reload }.
 */
export function useTickets(filters) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0); // manual reload trigger

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    ticketsApi.list(filters)
      .then((r) => { if (active) setData(r.data); })
      .catch((e) => { if (active) setError(e.response?.data?.error || 'Failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(filters), tick]); // filters compared structurally

  return { ...(data || {}), loading, error, reload: () => setTick((n) => n + 1) };
}