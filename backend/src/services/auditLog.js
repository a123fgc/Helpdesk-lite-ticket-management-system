const { query } = require('../config/db');

async function audit({ ticketId, actorId, actorRole, action, oldValue, newValue }) {
  await query(
    `INSERT INTO audit_log(ticket_id,actor_id,actor_role,action,old_value,new_value)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [ticketId, actorId, actorRole, action, oldValue || null, newValue || null]
  );
}
module.exports = { audit };