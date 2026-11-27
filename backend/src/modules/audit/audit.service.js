const { query } = require('../../config/db');
const { paginate } = require('../../utils/paginate');

async function list({ filters }) {
  const { page, limit, offset } = paginate(filters);
  const conds = [];
  const vals = [];
  let i = 1;

  if (filters.ticket_id) { conds.push(`a.ticket_id = $${i++}`);  vals.push(filters.ticket_id); }
  if (filters.actor_id)  { conds.push(`a.actor_id = $${i++}`);   vals.push(filters.actor_id); }
  if (filters.action)    { conds.push(`a.action = $${i++}`);     vals.push(filters.action); }
  if (filters.from)      { conds.push(`a.created_at >= $${i++}`); vals.push(filters.from); }
  if (filters.to)        { conds.push(`a.created_at <= $${i++}`); vals.push(filters.to); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const total = (await query(`SELECT COUNT(*)::int n FROM audit_log a ${where}`, vals)).rows[0].n;

  const rows = (await query(
    `SELECT a.*, u.full_name AS actor_name, t.ticket_number
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN tickets t ON t.id = a.ticket_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  )).rows;

  return { data: rows, page, limit, total };
}

async function byTicket(ticketId) {
  return (await query(
    `SELECT a.*, u.full_name AS actor_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.ticket_id = $1
      ORDER BY a.created_at ASC`,
    [ticketId]
  )).rows;
}

module.exports = { list, byTicket };