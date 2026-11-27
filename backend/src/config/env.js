const path = require('path');

// Load backend/.env explicitly so configuration works no matter which
// directory the process was started from (repo root, backend/, PM2, tests).
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalUrl(name) {
  const v = process.env[name];
  if (!v || !v.trim()) return undefined;
  const value = v.trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use http:// or https://`);
  }
  return value;
}

function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function optionalSecret(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

// Every outbound webhook target, mapped to its event type. Absent/empty
// values stay `undefined` and are reported explicitly by webhookSender.
const webhookUrls = {
  'ticket.created':        optionalUrl('WEBHOOK_URL_TICKET_CREATED'),
  'ticket.status_changed': optionalUrl('WEBHOOK_URL_STATUS_CHANGED'),
  'ticket.resolved':       optionalUrl('WEBHOOK_URL_TICKET_RESOLVED'),
  'ticket.sla_breach':     optionalUrl('WEBHOOK_URL_SLA_BREACH'),
};

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  webhookSecret: required('WEBHOOK_SECRET'),
  // Make.com custom-webhook authentication header (x-make-apikey). Blank means
  // the receiver is expected to accept unsigned/unauthenticated requests.
  makeApiKey: optionalSecret('MAKE_WEBHOOK_API_KEY'),
  webhookUrls,
  webhookMaxRetries: Number(process.env.WEBHOOK_MAX_RETRIES || 5),
  webhookBaseDelayMs: Number(process.env.WEBHOOK_BASE_DELAY_MS || 60000),
  // Repeated logical events within this window collapse into one queue row.
  webhookIdempotencyWindowMs: positiveInt('WEBHOOK_IDEMPOTENCY_WINDOW_MS', 60000),
  // A delivery lease stops cron overlaps / resend from sending the same row twice.
  webhookClaimLeaseSeconds: positiveInt('WEBHOOK_CLAIM_LEASE_SECONDS', 60),
  webhookBatchSize: positiveInt('WEBHOOK_BATCH_SIZE', 20),

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  autoCloseDays: Number(process.env.AUTO_CLOSE_DAYS || 3),
  slaCheckCron: process.env.SLA_CHECK_CRON || '*/5 * * * *',
  webhookRetryCron: process.env.WEBHOOK_RETRY_CRON || '* * * * *',
  idempotencyCleanupCron: process.env.IDEMPOTENCY_CLEANUP_CRON || '17 4 * * *',
  idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24),

  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000),
};
