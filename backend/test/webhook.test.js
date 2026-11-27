const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const crypto = require('crypto');
const { sign, computeNextRetry, safeError, webhookEnvVar } = require('../src/services/webhookSender');

const SECRET = 'unit-test-webhook-secret-not-a-real-credential';

describe('webhook signature (HMAC-SHA256)', () => {
  const body = JSON.stringify({ event: 'ticket.status_changed', ticket: { id: 'abc' } });

  it('prefixes the hex digest with "sha256="', () => {
    const sig = sign(body, SECRET);
    assert.ok(sig.startsWith('sha256='));
    assert.match(sig.slice('sha256='.length), /^[0-9a-f]{64}$/);
  });

  it('matches the reference HMAC computed independently', () => {
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    assert.equal(sign(body, SECRET), expected);
  });

  it('is deterministic for the same body and secret', () => {
    assert.equal(sign(body, SECRET), sign(body, SECRET));
  });

  it('changes when the body changes', () => {
    assert.notEqual(sign(body, SECRET), sign(body + ' ', SECRET));
    assert.notEqual(sign('{}', SECRET), sign('[]', SECRET));
  });

  it('changes when the secret changes', () => {
    assert.notEqual(sign(body, SECRET), sign(body, 'another-secret'));
  });

  it('uses the configured WEBHOOK_SECRET by default', () => {
    const viaDefault = sign(body);
    const expected = 'sha256='
      + crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(body).digest('hex');
    assert.equal(viaDefault, expected);
  });

  it('signs the exact bytes that are transmitted', () => {
    const transmitted = JSON.stringify({ a: 1 });
    assert.equal(sign(transmitted, SECRET), sign(JSON.stringify({ a: 1 }), SECRET));
  });
});

describe('webhook retry backoff', () => {
  const base = 60000;
  const opts = { baseDelayMs: base, maxRetries: 5, now: 1_700_000_000_000 };

  it('starts at the configured base delay', () => {
    assert.equal(computeNextRetry(1, opts).getTime(), opts.now + base);
  });

  it('doubles on every subsequent failure', () => {
    assert.equal(computeNextRetry(2, opts).getTime(), opts.now + base * 2);
    assert.equal(computeNextRetry(3, opts).getTime(), opts.now + base * 4);
    assert.equal(computeNextRetry(4, opts).getTime(), opts.now + base * 8);
  });

  it('returns null once maxRetries is reached (no further attempt)', () => {
    assert.equal(computeNextRetry(5, opts), null);
    assert.equal(computeNextRetry(50, opts), null);
  });

  it('still schedules a retry on the final permitted attempt', () => {
    assert.ok(computeNextRetry(4, opts) instanceof Date);
  });

  it('caps the delay so a long outage cannot schedule absurd waits', () => {
    const out = computeNextRetry(20, { ...opts, maxRetries: 100, maxDelayMs: 3600000 });
    assert.equal(out.getTime(), opts.now + 3600000);
  });

  it('always returns a future date', () => {
    for (let n = 1; n < 4; n++) {
      assert.ok(computeNextRetry(n, opts).getTime() > opts.now);
    }
  });

  it('uses the defaults from configuration when no options are given', () => {
    const out = computeNextRetry(1);
    assert.ok(out instanceof Date);
    assert.ok(out.getTime() > Date.now());
  });
});

describe('safeError (log redaction)', () => {
  it('never echoes the target URL', () => {
    const err = new Error('connect ECONNREFUSED https://hooks.example.com/secret-token/xyz');
    const safe = safeError(err);
    assert.ok(!safe.includes('hooks.example.com'));
    assert.ok(safe.includes('[url]'));
  });

  it('reports an HTTP status when the receiver answered', () => {
    assert.equal(safeError({ response: { status: 500 } }), 'HTTP 500');
    assert.equal(safeError({ response: { status: 401 } }), 'HTTP 401');
  });

  it('reports the axios error code when there is no response', () => {
    assert.equal(safeError({ code: 'ECONNREFUSED' }), 'ECONNREFUSED');
    assert.equal(safeError({ code: 'ETIMEDOUT' }), 'ETIMEDOUT');
  });

  it('truncates very long messages', () => {
    const safe = safeError(new Error('x'.repeat(5000)));
    assert.ok(safe.length <= 300);
  });

  it('handles missing errors without throwing', () => {
    assert.equal(safeError(null), 'unknown error');
    assert.equal(safeError(undefined), 'unknown error');
    assert.equal(safeError('boom'), 'boom');
  });

  it('redacts http and https URLs alike', () => {
    assert.ok(!safeError(new Error('post http://a/b failed')).includes('http://a/b'));
    assert.ok(!safeError(new Error('post https://a/b failed')).includes('https://a/b'));
  });
});

describe('webhook environment variable mapping', () => {
  it('maps every supported event to its env var', () => {
    assert.equal(webhookEnvVar('ticket.created'), 'WEBHOOK_URL_TICKET_CREATED');
    assert.equal(webhookEnvVar('ticket.status_changed'), 'WEBHOOK_URL_STATUS_CHANGED');
    assert.equal(webhookEnvVar('ticket.resolved'), 'WEBHOOK_URL_TICKET_RESOLVED');
    assert.equal(webhookEnvVar('ticket.sla_breach'), 'WEBHOOK_URL_SLA_BREACH');
  });

  it('falls back to a generic hint for unknown events', () => {
    assert.equal(webhookEnvVar('ticket.exploded'), 'WEBHOOK_URL_*');
  });
});

describe('queueWebhook with no target URL configured', () => {
  const { queueWebhook } = require('../src/services/webhookSender');
  const logger = require('../src/utils/logger');
  const env = require('../src/config/env');
  let originalWebhookUrls;

  before(() => {
    originalWebhookUrls = { ...env.webhookUrls };
    for (const key of Object.keys(env.webhookUrls)) env.webhookUrls[key] = undefined;
  });

  after(() => {
    Object.assign(env.webhookUrls, originalWebhookUrls);
  });

  const ticket = {
    id: 't-1', ticket_number: 42,
    subject: 'SUBJECT_MARKER must not leak',
    description: 'DESCRIPTION_MARKER must not leak',
    category_id: 'c', priority: 'high', status: 'open',
    created_by: 'u1', assigned_to: null, created_at: new Date(), updated_at: new Date(),
  };

  async function captureWarnings(fn) {
    const captured = [];
    const original = logger.warn;
    logger.warn = (...args) => captured.push(args.join(' '));
    try {
      const result = await fn();
      return { captured, result };
    } finally {
      logger.warn = original;
    }
  }

  it('does not queue anything and says so explicitly', async () => {
    const { captured, result } = await captureWarnings(
      () => queueWebhook('ticket.status_changed', ticket)
    );
    assert.equal(result, null);
    assert.equal(captured.length, 1, 'expected exactly one warning');
    assert.match(captured[0], /NOT queued/);
    assert.match(captured[0], /ticket\.status_changed/);
    assert.match(captured[0], /WEBHOOK_URL_STATUS_CHANGED/);
    assert.match(captured[0], /no target URL configured/);
  });

  it('is not silent for any supported event type', async () => {
    for (const eventType of Object.keys(require('../src/config/env').webhookUrls)) {
      const { captured, result } = await captureWarnings(
        () => queueWebhook(eventType, ticket)
      );
      assert.equal(result, null, `${eventType} should not be queued`);
      assert.equal(captured.length, 1, `${eventType} should log a warning`);
      assert.ok(captured[0].includes(eventType), `${eventType} missing from warning`);
      assert.ok(captured[0].includes(webhookEnvVar(eventType)), 'env var name missing');
    }
  });

  it('never writes the ticket contents or connection details into the warning', async () => {
    const { captured } = await captureWarnings(
      () => queueWebhook('ticket.status_changed', ticket)
    );
    const warning = captured[0];
    assert.ok(!warning.includes('SUBJECT_MARKER'), 'subject leaked');
    assert.ok(!warning.includes('DESCRIPTION_MARKER'), 'description leaked');
    assert.ok(!warning.includes('postgres://'), 'connection string leaked');
    assert.ok(!warning.includes('DATABASE_URL'), 'env value leaked');
  });
});
