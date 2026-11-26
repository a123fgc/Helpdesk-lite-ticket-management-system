const { query } = require('../../config/db');
const { audit } = require('../../services/auditLog');

async function list({ user, ticketId }) {
  // visibility
  const t = (await query('SELECT created_by FROM tickets WHERE id=$1', [ticketId])).rows[0];
  if (!t) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (user.role === 'customer' && t.created_by !== user.sub) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }
  const { rows } = await query(
    `SELECT m.*, u.full_name AS sender_name
       FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.ticket_id=$1 ORDER BY m.created_at ASC`,
    [ticketId]
  );
  return rows;
}

async function create({ user, ticketId, body }) {
  if (!body || !body.trim()) { const e = new Error('body required'); e.status = 400; throw e; }
  const t = (await query('SELECT * FROM tickets WHERE id=$1', [ticketId])).rows[0];
  if (!t) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (user.role === 'customer' && t.created_by !== user.sub) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }

  const { rows } = await query(
    `INSERT INTO messages(ticket_id,sender_id,sender_role,body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [ticketId, user.sub, user.role, body]
  );

  // first agent/admin response marks first_response_at if null
  if (['agent','admin'].includes(user.role)) {
    await query(
      `UPDATE tickets SET first_response_at=COALESCE(first_response_at,NOW()),
              status = CASE WHEN status='open' THEN 'in_progress' ELSE status END
        WHERE id=$1`,
      [ticketId]
    );
  }
  // customer reply moves waiting_on_customer → in_progress
  if (user.role === 'customer' && t.status === 'waiting_on_customer') {
    await query(`UPDATE tickets SET status='in_progress' WHERE id=$1`, [ticketId]);
  }

  await audit({
    ticketId, actorId: user.sub, actorRole: user.role,
    action: 'message_added', newValue: { message_id: rows[0].id },
  });
  return rows[0];
}

module.exports = { list, create };