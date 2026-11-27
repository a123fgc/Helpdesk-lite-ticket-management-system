const axios = require('axios');
const crypto = require('crypto');
const http = require('node:http');
const https = require('node:https');
const db = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const {
  resolveAndPinWebhookTarget,
  createPinnedLookup,
} = require('../utils/webhookTarget');

// Keep a live reference to the pool so tests can stub delivery without a DB.
const query = (text, params) => db.query(text, params);

/**
 * HMAC-SHA256 signature of the raw request body.
 * The secret can be injected for tests; production always uses WEBHOOK_SECRET.
 */
function sign(body, secret = env.webhookSecret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Exponential backoff for a delivery attempt that has just failed.
 *
 * @param {number} failedAttempts - attempts made so far, *including* the one
 *   that just failed (i.e. `event.attempts + 1`).
 * @returns {Date|null} when to retry, or `null` once `maxRetries` is reached.
 *
 * Delay is `base * 2^(failedAttempts - 1)`, capped at `maxDelayMs`.
 */
function computeNextRetry(failedAttempts, { baseDelayMs = env.webhookBaseDelayMs, maxRetries = env.webhookMaxRetries, maxDelayMs = 6 * 60 * 60 * 1000, now = Date.now() } = {}) {
  if (failedAttempts >= maxRetries) return null;
  const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, failedAttempts - 1));
  return new Date(now + delay);
}

/**
 * Reduce an arbitrary error to something safe to write to logs and to the
 * `last_error` column. Axios messages embed the full target URL (which can
 * contain signed tokens), so the URL is never included.
 */
function safeError(err) {
  if (!err) return 'unknown error';
  if (err.response && err.response.status) return `HTTP ${err.response.status}`;
  if (err.code) return String(err.code);
  const msg = String(err.message || err).replace(/https?:\/\/\S+/g, '[url]');
  return msg.slice(0, 300);
}

/** Show only the shape of a target URL, never the token-bearing path. */
function redactUrl(value) {
  if (!value) return value;
  try {
    const u = new URL(value);
    const parts = u.pathname.split('/').filter(Boolean);
    const tail = parts.length ? parts[parts.length - 1].slice(-4) : '';
    return `${u.origin}/***/${tail}`;
  } catch {
    return '[redacted]';
  }
}

// Receiver rejected the request for a reason a retry cannot fix.
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 410]);
// Everything without an HTTP response (DNS/timeout/socket) is transient, as
// are throttling and server-side failures.
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

function isPermanentError(err) {
  const status = err && err.response && err.response.status;
  return err?.code === 'ERR_WEBHOOK_TARGET_REJECTED'
    || PERMANENT_STATUSES.has(status)
    || (status >= 300 && status < 400);
}

function isTransientError(err) {
  if (!err || !err.response || !err.response.status) return true;
  const status = err.response.status;
  return (status >= 500 && status < 600) || TRANSIENT_STATUSES.has(status);
}

function failureKind(err) {
  return isPermanentError(err) ? 'permanent' : 'transient';
}

/**
 * Deterministic key for a *logical* event: the same ticket/status transition
 * generated twice in a short window is one event, not two. A caller may pass
 * `meta.idempotencyKey` when it already has a stable business key.
 */
function stableIdempotencyKey(eventType, ticket, meta = {}, now = Date.now()) {
  if (meta.idempotencyKey) return String(meta.idempotencyKey);
  const identity = {
    event: eventType,
    ticket_id: ticket.id,
    from: meta.from ?? null,
    to: meta.to ?? null,
    reason: meta.reason ?? null,
    actor: meta.actor ?? null,
    // Bounded window: repeated clicks in one burst dedupe, a genuine later
    // transition of the same type is still a distinct event.
    window: Math.floor(now / env.webhookIdempotencyWindowMs),
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 32);
  return `${eventType}:${ticket.id}:${hash}`;
}

/**
 * Insert a webhook event into the queue (no network call here).
 *
 * Queueing is best-effort: a configuration or database failure is logged and
 * swallowed so ticket creation / status updates can never be broken by a
 * webhook problem.
 */
async function queueWebhook(eventType, ticket, meta = {}) {
  const targetUrl = env.webhookUrls[eventType];
  if (!targetUrl) {
    logger.warn(
      `webhook NOT queued for "${eventType}" (ticket ${ticket.ticket_number ?? ticket.id}): ` +
      `no target URL configured. Set ${webhookEnvVar(eventType)} in backend/.env.`
    );
    return null;
  }

  const idempotencyKey = stableIdempotencyKey(eventType, ticket, meta);

  try {
    // Best-effort enrichment so external automation (Make.com, etc.) has the
    // context it needs without extra lookups. Additive only.
    let enrichment = {};
    try {
      const { rows } = await query(
        `SELECT
           c.full_name  AS created_by_name,
           c.email      AS created_by_email,
           a.full_name  AS assigned_to_name,
           cat.name     AS category_name
         FROM tickets t
         LEFT JOIN users c ON c.id = t.created_by
         LEFT JOIN users a ON a.id = t.assigned_to
         LEFT JOIN categories cat ON cat.id = t.category_id
         WHERE t.id = $1`,
        [ticket.id]
      );
      if (rows[0]) enrichment = rows[0];
    } catch (err) {
      logger.warn(`webhook enrichment lookup failed for ticket ${ticket.id}: ${safeError(err)}`);
    }

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
        category_name: ticket.category_name || enrichment.category_name || null,
        priority: ticket.priority,
        status: ticket.status,
        created_by: ticket.created_by,
        created_by_name: ticket.created_by_name || enrichment.created_by_name || null,
        created_by_email: ticket.created_by_email || enrichment.created_by_email || null,
        assigned_to: ticket.assigned_to,
        assigned_to_name: ticket.assigned_to_name || enrichment.assigned_to_name || null,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
      },
      ...meta,
    };

    const { rows } = await query(
      `INSERT INTO webhook_events(event_type,ticket_id,payload,target_url,idempotency_key)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [eventType, ticket.id, payload, targetUrl, idempotencyKey]
    );
    if (!rows.length) {
      logger.info(`webhook duplicate suppressed: ${eventType} for ticket ${ticket.ticket_number ?? ticket.id}`);
      return null;
    }
    logger.info(`webhook queued: ${eventType} for ticket ${ticket.ticket_number}`);
    return rows[0];
  } catch (err) {
    // Never let a webhook failure break the ticket operation that triggered it.
    logger.warn(`webhook NOT queued for "${eventType}" (ticket ${ticket.ticket_number ?? ticket.id}): ${safeError(err)}`);
    return null;
  }
}

/** Environment variable that should be set for a given event type. */
function webhookEnvVar(eventType) {
  const map = {
    'ticket.created': 'WEBHOOK_URL_TICKET_CREATED',
    'ticket.status_changed': 'WEBHOOK_URL_STATUS_CHANGED',
    'ticket.resolved': 'WEBHOOK_URL_TICKET_RESOLVED',
    'ticket.sla_breach': 'WEBHOOK_URL_SLA_BREACH',
  };
  return map[eventType] || 'WEBHOOK_URL_*';
}

/**
 * The current env URL wins over the URL snapshot stored on the row. This is
 * what makes a new Make.com hook URL apply to already-queued and failed events
 * instead of reproducing the old 410 forever.
 */
function resolveTargetUrl(event) {
  return env.webhookUrls[event.event_type] || event.target_url;
}

async function refreshTargetUrl(event) {
  const current = resolveTargetUrl(event);
  if (!current || current === event.target_url) return event;
  const { rows } = await query(
    'UPDATE webhook_events SET target_url=$1 WHERE id=$2 RETURNING *',
    [current, event.id]
  );
  logger.info(`webhook target refreshed for ${event.event_type}`);
  return rows[0] || { ...event, target_url: current };
}

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/**
 * Atomically mark rows as being delivered. SKIP LOCKED means two cron ticks,
 * two app instances, or cron + manual resend can never deliver the same row.
 */
async function claimPendingWebhooks(limit = env.webhookBatchSize) {
  const { rows } = await query(
    `WITH due AS (
       SELECT id FROM webhook_events
        WHERE status='pending'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND (lease_until IS NULL OR lease_until <= NOW())
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE webhook_events e
        SET lease_until = NOW() + ($2::int * INTERVAL '1 second')
       FROM due
      WHERE e.id = due.id
     RETURNING e.*`,
    [limit, env.webhookClaimLeaseSeconds]
  );
  return rows;
}

/** Claim one *failed* event for a manual resend, resetting its retry counters. */
async function claimForResend(id) {
  const { rows } = await query(
    `WITH target AS (
       SELECT id FROM webhook_events
        WHERE id=$2 AND status='failed'
          AND (lease_until IS NULL OR lease_until <= NOW())
        FOR UPDATE SKIP LOCKED
     )
     UPDATE webhook_events e
        SET lease_until = NOW() + ($1::int * INTERVAL '1 second'),
            attempts=0, status='pending', last_error=NULL,
            next_retry_at=NULL, failure_kind=NULL
       FROM target
      WHERE e.id = target.id
     RETURNING e.*`,
    [env.webhookClaimLeaseSeconds, id]
  );
  return rows[0] || null;
}

/**
 * Try to deliver a single webhook event. Updates status/attempts/next_retry_at.
 */
async function attemptDelivery(event) {
  const current = await refreshTargetUrl(event);
  const body = JSON.stringify(current.payload);
  const headers = {
    'Content-Type': 'application/json',
    'X-Event-Type': current.event_type,
    'X-Event-Id': current.idempotency_key,
    'X-Signature': sign(body),
    'X-Attempt': String(current.attempts + 1),
  };
  // Make.com custom webhooks reject with 401 when this header is configured
  // there but missing from the request. Never log its value.
  if (env.makeApiKey) headers['x-make-apikey'] = env.makeApiKey;

  let agent;
  try {
    // Resolve every hostname immediately before sending, reject any unsafe
    // answer, and pin the socket lookup to one validated address. This path is
    // shared by first delivery, cron retries, and manual resend.
    const target = await resolveAndPinWebhookTarget(current.target_url, { nodeEnv: env.nodeEnv });
    const lookup = createPinnedLookup(target.hostname, target.address, target.addressFamily);
    const isHttps = target.url.protocol === 'https:';
    agent = isHttps
      ? new https.Agent({ lookup, keepAlive: false })
      : new http.Agent({ lookup, keepAlive: false });

    const res = await axios.post(current.target_url, body, {
      headers,
      timeout: 10000,
      maxRedirects: 0,
      maxContentLength: 64 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
      proxy: false,
      ...(isHttps ? { httpsAgent: agent } : { httpAgent: agent }),
    });
    // axios resolves 2xx only, but be explicit so a changed adapter cannot
    // silently mark a 3xx/4xx response as delivered.
    if (res.status < 200 || res.status >= 300) {
      const rejected = new Error(`HTTP ${res.status}`);
      rejected.response = { status: res.status };
      throw rejected;
    }
    await query(
      `UPDATE webhook_events
          SET status='delivered', attempts=attempts+1, delivered_at=NOW(),
              last_error=NULL, next_retry_at=NULL, lease_until=NULL,
              failure_kind=NULL, last_attempt_at=NOW()
        WHERE id=$1`,
      [current.id]
    );
    logger.info(`webhook delivered ${current.event_type} (${res.status})`);
    return true;
  } catch (err) {
    if (!isPermanentError(err) && !isTransientError(err)) {
      logger.error(`webhook ${current.event_type} could not be classified:`, safeError(err));
    }
    const attempts = current.attempts + 1;
    const permanent = isPermanentError(err);
    const nextRetry = permanent ? null : computeNextRetry(attempts);
    const reason = safeError(err);

    await query(
      `UPDATE webhook_events
          SET attempts=$1, status=$2, last_error=$3, next_retry_at=$4,
              lease_until=NULL, failure_kind=$5, last_attempt_at=NOW()
        WHERE id=$6`,
      [
        attempts,
        nextRetry ? 'pending' : 'failed',
        reason,
        nextRetry,
        failureKind(err),
        current.id,
      ]
    );
    logger.warn(
      `webhook failed ${current.event_type} attempt ${attempts}/${env.webhookMaxRetries}: ${reason}` +
      (permanent ? ' (permanent error, no retry)'
        : nextRetry ? ` (next retry ${nextRetry.toISOString()})`
        : ' (retries exhausted)')
    );
    return false;
  } finally {
    if (agent) agent.destroy();
  }
}

/**
 * Process every pending event whose next_retry_at is due. Rows are claimed
 * atomically before any network call, so overlapping workers cannot duplicate
 * attempts.
 */
async function processPendingWebhooks() {
  const rows = await claimPendingWebhooks();
  for (const ev of rows) {
    try {
      await attemptDelivery(ev);
    } catch (e) {
      // One poisoned row must not stop the rest of the batch. Its lease
      // expires on its own so a later tick can pick it up again.
      logger.error(`webhook ${ev.event_type} could not be attempted:`, safeError(e));
    }
  }
  return rows.length;
}

/**
 * Admin manual resend. Only failed events are eligible; the end result
 * reflects the real external delivery outcome (the controller maps
 * `delivered:false` to HTTP 502).
 */
async function resendEvent(id) {
  const claimed = await claimForResend(id);
  if (!claimed) {
    const { rows } = await query('SELECT status, lease_until FROM webhook_events WHERE id=$1', [id]);
    if (!rows.length) throw httpError(404, 'webhook event not found');
    if (rows[0].lease_until && new Date(rows[0].lease_until) > new Date()) {
      throw httpError(409, 'webhook event is currently being delivered');
    }
    throw httpError(409, `webhook event cannot be resent while status is "${rows[0].status}"`);
  }

  const delivered = await attemptDelivery({ ...claimed, attempts: 0 });
  if (!delivered) {
    const { rows } = await query('SELECT status, last_error FROM webhook_events WHERE id=$1', [id]);
    return {
      id,
      delivered: false,
      status: rows[0]?.status || 'failed',
      error: rows[0]?.last_error || 'unknown error',
    };
  }
  return { id, delivered: true, status: 'delivered' };
}

module.exports = {
  queueWebhook,
  attemptDelivery,
  processPendingWebhooks,
  resendEvent,
  sign,
  computeNextRetry,
  safeError,
  redactUrl,
  webhookEnvVar,
  isPermanentError,
  isTransientError,
  failureKind,
  stableIdempotencyKey,
  resolveTargetUrl,
  refreshTargetUrl,
  claimPendingWebhooks,
  claimForResend,
};
