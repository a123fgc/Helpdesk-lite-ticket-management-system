const { query } = require('../../config/db');
const { resendEvent } = require('../../services/webhookSender');
const { paginate } = require('../../utils/paginate');

async function list({ filters }) {
  const { page, limit, offset } = paginate({ query: filters });
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
  return { data: rows, page, limit, total };
}

async function get(id) {
  const { rows } = await query('SELECT * FROM webhook_events WHERE id=$1', [id]);
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return rows[0];
}

async function resend(id) {
  const ok = await resendEvent(id);
  return { id, delivered: ok };
}

module.exports = { list, get, resend };