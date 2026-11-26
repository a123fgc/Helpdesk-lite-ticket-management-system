const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../utils/logger');
const { findNewBreaches } = require('../services/slaEngine');
const { queueWebhook, processPendingWebhooks } = require('../services/webhookSender');
const { autoCloseResolved } = require('../services/autoClose');
const { query } = require('../config/db');

function startCron() {
  // SLA checks
  cron.schedule(env.slaCheckCron, async () => {
    try {
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
      if (breached.length) logger.warn(`⚠ ${breached.length} new SLA breaches`);

      const closed = await autoCloseResolved();
      if (closed) logger.info(`📪 auto-closed ${closed} tickets`);
    } catch (e) { logger.error('sla cron:', e.message); }
  });

  // webhook retries
  cron.schedule(env.webhookRetryCron, async () => {
    try { await processPendingWebhooks(); }
    catch (e) { logger.error('webhook cron:', e.message); }
  });

  logger.info('⏰ cron started');
}

module.exports = { startCron };