const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const { query } = require('../config/db');
const logger = require('../utils/logger');

function sign(body) {
  return 'sha256=' + crypto.createHmac('sha256', env.webhookSecret).update(body).digest('hex');
}

/**
 * Insert a webhook event into the queue (no network call here).
 * Caller passes eventType + ticket row + extra metadata.
 */
async function queueWebhook(eventType, ticket, meta = {}) {
  const targetUrl = env.webhookUrls[eventType];
  if (!targetUrl) {
    logger.warn(`No webhook URL for ${eventType} — skipping queue`);
    return null;
  }

  const idempotencyKey = `${eventType}:${ticket.id}:${ticket.updated_at || ticket.created_at}:${Date.now()}`;
  const payload = {
    event: eventType,
    event_id: idempotencyKey,
    occurred_at: new Date().toISOString(),
    ticket: {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      category_id: ticket.category_id,
      priority: ticket.priority,
      status: ticket.status,
      created_by: ticket.created_by,
      assigned_to: ticket.assigned_to,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
    },
    ...meta,
  };

  const { rows } = await query(
    `INSERT INTO webhook_events(event_type,ticket_id,payload,target_url,idempotency_key)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [eventType, ticket.id, payload, targetUrl, idempotencyKey]
  );
  logger.info(`📥 webhook queued: ${eventType} for ticket ${ticket.ticket_number}`);
  return rows[0];
}

/**
 * Try to deliver a single webhook event. Updates status/attempts/next_retry_at.
 */
async function attemptDelivery(event) {
  const body = JSON.stringify(event.payload);
  const headers = {
    'Content-Type': 'application/json',
    'X-Event-Type': event.event_type,
    'X-Event-Id': event.idempotency_key,
    'X-Signature': sign(body),
  };

  try {
    const res = await axios.post(event.target_url, body, { headers, timeout: 10000 });
    await query(
      `UPDATE webhook_events
          SET status='delivered', attempts=attempts+1, delivered_at=NOW(), last_error=NULL, next_retry_at=NULL
        WHERE id=$1`,
      [event.id]
    );
    logger.info(`✅ webhook delivered ${event.event_type} (${res.status})`);
    return true;
  } catch (err) {
    const attempts = event.attempts + 1;
    const maxRetries = env.webhookMaxRetries;
    const exhausted = attempts >= maxRetries;
    const backoffMs = env.webhookBaseDelayMs * Math.pow(2, attempts - 1);
    const nextRetry = exhausted ? null : new Date(Date.now() + backoffMs);

    await query(
      `UPDATE webhook_events
          SET attempts=$1, status=$2, last_error=$3, next_retry_at=$4
        WHERE id=$5`,
      [
        attempts,
        exhausted ? 'failed' : 'pending',
        String(err.message || err).slice(0, 500),
        nextRetry,
        event.id,
      ]
    );
    logger.warn(`❌ webhook failed ${event.event_type} attempt ${attempts}/${maxRetries}`);
    return false;
  }
}

/**
 * Process every pending event whose next_retry_at is due.
 */
async function processPendingWebhooks() {
  const { rows } = await query(
    `SELECT * FROM webhook_events
      WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC LIMIT 20`
  );
  for (const ev of rows) await attemptDelivery(ev);
  return rows.length;
}

/** Admin manual resend */
async function resendEvent(id) {
  const { rows } = await query('SELECT * FROM webhook_events WHERE id=$1', [id]);
  if (!rows.length) { const e = new Error('event not found'); e.status = 404; throw e; }
  const ev = rows[0];
  await query(
    `UPDATE webhook_events SET status='pending', attempts=0, next_retry_at=NULL, last_error=NULL WHERE id=$1`,
    [id]
  );
  return attemptDelivery({ ...ev, attempts: 0 });
}

module.exports = {
  queueWebhook,
  attemptDelivery,
  processPendingWebhooks,
  resendEvent,
  sign,
};