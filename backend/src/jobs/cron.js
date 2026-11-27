const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../utils/logger');
const { findNewBreaches } = require('../services/slaEngine');
const { queueWebhook, processPendingWebhooks } = require('../services/webhookSender');
const { autoCloseResolved } = require('../services/autoClose');
const { cleanupExpiredIdempotencyKeys } = require('../services/idempotencyCleanup');
const { query } = require('../config/db');

const tasks = [];

function schedule(cronExpr, name, fn) {
  const task = cron.schedule(cronExpr, async () => {
    try {
      await fn();
    } catch (e) {
      logger.error(`${name}:`, e.message);
    }
  });
  tasks.push(task);
  return task;
}

function startCron() {
  // SLA checks + auto-close
  schedule(env.slaCheckCron, 'sla cron', async () => {
    const breached = await findNewBreaches();
    for (const t of breached) {
      await query(
        `UPDATE tickets SET sla_breached=TRUE, sla_breach_notified=TRUE WHERE id=$1`,
        [t.id]
      );
      await query(
        `INSERT INTO audit_log(ticket_id,actor_id,actor_role,action,new_value)
         VALUES ($1,NULL,'system','sla_breached',$2)`,
        [t.id, JSON.stringify({ priority: t.priority, sla_response_due_at: t.sla_response_due_at, sla_resolve_due_at: t.sla_resolve_due_at })]
      );
      await queueWebhook('ticket.sla_breach', t, {
        reason: 'SLA breached',
        sla_response_due_at: t.sla_response_due_at,
        sla_resolve_due_at: t.sla_resolve_due_at,
      });
    }
    if (breached.length) logger.warn(`${breached.length} new SLA breach(es)`);

    const closed = await autoCloseResolved();
    if (closed) logger.info(`auto-closed ${closed} ticket(s)`);
  });

  // webhook retries
  schedule(env.webhookRetryCron, 'webhook cron', async () => {
    await processPendingWebhooks();
  });

  // expired idempotency keys
  schedule(env.idempotencyCleanupCron, 'idempotency cron', async () => {
    await cleanupExpiredIdempotencyKeys();
  });

  logger.info('cron started');
}

/** Stops every scheduled task; called during graceful shutdown. */
function stopCron() {
  while (tasks.length) {
    try { tasks.pop().stop(); } catch { /* already stopped */ }
  }
}

module.exports = { startCron, stopCron };