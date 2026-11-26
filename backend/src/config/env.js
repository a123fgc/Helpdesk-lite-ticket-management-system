require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  webhookSecret: required('WEBHOOK_SECRET'),
  webhookUrls: {
    'ticket.created':        process.env.WEBHOOK_URL_TICKET_CREATED,
    'ticket.status_changed': process.env.WEBHOOK_URL_STATUS_CHANGED,
    'ticket.resolved':       process.env.WEBHOOK_URL_TICKET_RESOLVED,
    'ticket.sla_breach':     process.env.WEBHOOK_URL_SLA_BREACH,
  },
  webhookMaxRetries: Number(process.env.WEBHOOK_MAX_RETRIES || 5),
  webhookBaseDelayMs: Number(process.env.WEBHOOK_BASE_DELAY_MS || 60000),

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  autoCloseDays: Number(process.env.AUTO_CLOSE_DAYS || 3),
  slaCheckCron: process.env.SLA_CHECK_CRON || '*/5 * * * *',
  webhookRetryCron: process.env.WEBHOOK_RETRY_CRON || '* * * * *',
};