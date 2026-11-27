const { query } = require('../../config/db');
const { audit } = require('../../services/auditLog');

async function list({ ticketId }) {
  const exists = await query('SELECT 1 FROM tickets WHERE id=$1', [ticketId]);
  if (!exists.rowCount) { const e = new Error('Not found'); e.status = 404; throw e; }
  return (await query(
    `SELECT n.*, u.full_name AS author_name
       FROM notes n JOIN users u ON u.id=n.author_id
      WHERE n.ticket_id=$1 ORDER BY n.created_at ASC`,
    [ticketId]
  )).rows;
}

async function create({ user, ticketId, body }) {
  if (!body || !body.trim()) { const e = new Error('body required'); e.status = 400; throw e; }
  const exists = await query('SELECT 1 FROM tickets WHERE id=$1', [ticketId]);
  if (!exists.rowCount) { const e = new Error('Not found'); e.status = 404; throw e; }
  const { rows } = await query(
    `INSERT INTO notes(ticket_id,author_id,body) VALUES ($1,$2,$3) RETURNING *`,
    [ticketId, user.sub, body]
  );
  await audit({
    ticketId, actorId: user.sub, actorRole: user.role,
    action: 'note_added', newValue: { note_id: rows[0].id },
  });
  return rows[0];
}

module.exports = { list, create };  