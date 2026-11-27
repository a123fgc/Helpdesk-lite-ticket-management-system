const { query } = require('../../config/db');
const { resendEvent, redactUrl, safeError } = require('../../services/webhookSender');
const { paginate } = require('../../utils/paginate');

/**
 * Admin visibility without secrets: the webhook URL contains a Make.com token,
 * the payload can contain a survey token, and legacy `last_error` values may
 * embed a URL. Return a safe projection instead of raw rows.
 */
function safeRow(row) {
  if (!row) return null;
  const out = { ...row, target_url: redactUrl(row.target_url) };
  out.last_error = row.last_error ? safeError({ message: String(row.last_error) }) : null;
  if (out.payload && typeof out.payload === 'object') {
    out.payload = JSON.parse(JSON.stringify(out.payload));
    for (const key of Object.keys(out.payload)) {
      if (/token|apikey|api_key|secret|signature/i.test(key)) out.payload[key] = '[redacted]';
    }
  }
  out.eligible_for_resend = row.status === 'failed';
  return out;
}

async function list({ filters }) {
  const { page, limit, offset } = paginate(filters);
  const conds = [];
  const vals = [];
  let i = 1;

  if (filters.status)     { conds.push(`status = $${i++}`);     vals.push(filters.status); }
  if (filters.event_type) { conds.push(`event_type = $${i++}`); vals.push(filters.event_type); }
  if (filters.ticket_id)  { conds.push(`ticket_id = $${i++}`);  vals.push(filters.ticket_id); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const total = (await query(`SELECT COUNT(*)::int n FROM webhook_events ${where}`, vals)).rows[0].n;
  const rows = (await query(
    `SELECT * FROM webhook_events ${where}
     ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  )).rows;
  return { data: rows.map(safeRow), page, limit, total };
}

async function get(id) {
  const { rows } = await query('SELECT * FROM webhook_events WHERE id=$1', [id]);
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return safeRow(rows[0]);
}

async function resend(id) {
  // Preserve the sender's delivery result. It returns details (including the
  // actual delivered boolean and failure status), not a boolean itself.
  return resendEvent(id);
}

module.exports = { list, get, resend };
