const { query } = require('../config/db');
const env = require('../config/env');

/**
 * Auto-close resolved tickets after N days without customer reply.
 */
async function autoCloseResolved() {
  const { rows } = await query(
    `SELECT id FROM tickets
      WHERE status = 'resolved'
        AND resolved_at IS NOT NULL
        AND resolved_at < NOW() - ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM messages m
           WHERE m.ticket_id = tickets.id
             AND m.sender_role = 'customer'
             AND m.created_at > tickets.resolved_at
        )`,
    [env.autoCloseDays]
  );

  for (const { id } of rows) {
    await query(
      `UPDATE tickets SET status='closed', closed_at=NOW() WHERE id=$1`,
      [id]
    );
    await query(
      `INSERT INTO audit_log(ticket_id,actor_id,actor_role,action,old_value,new_value)
       VALUES ($1,NULL,'system','auto_closed',NULL,$2)`,
      [id, JSON.stringify({ status: 'closed', reason: 'auto-close after ' + env.autoCloseDays + 'd' })]
    );
    // status_changed webhook
    const { queueWebhook } = require('./webhookSender');
    const t = (await query('SELECT * FROM tickets WHERE id=$1', [id])).rows[0];
    await queueWebhook('ticket.status_changed', t, { from: 'resolved', to: 'closed', actor: 'system' });
  }
  return rows.length;
}

module.exports = { autoCloseResolved };