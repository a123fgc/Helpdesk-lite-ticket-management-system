const { query } = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Deletes idempotency keys older than IDEMPOTENCY_TTL_HOURS.
 *
 * Safety properties:
 *  - Only rows whose `created_at` is older than the TTL are removed, so a key
 *    belonging to a request that is still in flight (seconds old) can never be
 *    deleted by this sweep.
 *  - The TTL is far longer than any realistic request duration, so replays
 *    remain available for the whole window clients rely on.
 *  - A single indexed DELETE keeps the cost flat regardless of table size.
 */
async function cleanupExpiredIdempotencyKeys(ttlHours = env.idempotencyTtlHours) {
  const hours = Number(ttlHours);
  if (!Number.isFinite(hours) || hours < 1) {
    throw new Error('idempotency TTL must be at least 1 hour');
  }
  const { rowCount } = await query(
    `DELETE FROM idempotency_keys WHERE created_at < NOW() - ($1 || ' hours')::interval`,
    [hours]
  );
  if (rowCount) logger.info(`idempotency sweep removed ${rowCount} expired key(s)`);
  return rowCount;
}

module.exports = { cleanupExpiredIdempotencyKeys };
