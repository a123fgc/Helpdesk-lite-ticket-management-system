const { query } = require('../config/db');

async function getSlaForPriority(priority) {
  const { rows } = await query('SELECT * FROM sla_rules WHERE priority=$1', [priority]);
  return rows[0] || null;
}

/**
 * Compute SLA due dates from an SLA rule row + a creation date.
 * Pure: exported so it can be unit-tested without a database.
 */
function computeSlaFromRule(sla, createdAt = new Date()) {
  if (!sla) return { response_due: null, resolve_due: null };
  const base = new Date(createdAt).getTime();
  return {
    response_due: new Date(base + sla.response_minutes * 60000),
    resolve_due:  new Date(base + sla.resolution_minutes * 60000),
  };
}

/**
 * Compute SLA due dates from a creation date + priority.
 */
async function computeSla(priority, createdAt = new Date()) {
  return computeSlaFromRule(await getSlaForPriority(priority), createdAt);
}

/**
 * Find tickets that have breached SLA and haven't been flagged yet.
 */
async function findNewBreaches() {
  const { rows } = await query(
    `SELECT * FROM tickets
      WHERE sla_breach_notified = FALSE
        AND status NOT IN ('resolved','closed')
        AND (
          (first_response_at IS NULL AND sla_response_due_at IS NOT NULL AND NOW() > sla_response_due_at)
          OR
          (sla_resolve_due_at IS NOT NULL AND NOW() > sla_resolve_due_at)
        )`
  );
  return rows;
}

module.exports = { getSlaForPriority, computeSla, computeSlaFromRule, findNewBreaches };