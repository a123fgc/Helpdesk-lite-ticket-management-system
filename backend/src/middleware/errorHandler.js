const logger = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

/**
 * Central error handler.
 *  - 4xx: the message is intentional (thrown by services with `status`), so it
 *    is safe to return to the caller.
 *  - 5xx: the message may contain SQL, connection details or stack fragments.
 *    Those are logged server-side and replaced with a generic message.
 */
function errorHandler(err, req, res, _next) {
  // Body-parser failures carry `type` rather than `status`; handle them first
  // so they are not swallowed by the generic 500 branch below.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  const status = Number(err.status) || statusFromDatabaseError(err);

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -`, err.stack || err.message);
    return res.status(status).json({ error: 'Internal server error' });
  }

  res.status(status).json({
    error: err.message || 'Request failed',
    ...(err.details ? { details: err.details } : {}),
  });
}

/**
 * Maps well-known PostgreSQL error codes to client-safe 4xx responses.
 * Without this, a malformed UUID in a query parameter surfaces as a raw
 * driver exception (500) instead of a validation error (400).
 *
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
function statusFromDatabaseError(err) {
  if (!err || !err.code) return 500;
  switch (String(err.code)) {
    case '22P02': // invalid_text_representation (e.g. "not-a-uuid" for a uuid column)
    case '22001': // string_data_right_truncation (value too long for the column)
    case '22003': // numeric_value_out_of_range
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return 400;
    case '23505': // unique_violation
      return 409;
    case '23503': // foreign_key_violation (referenced row does not exist)
      return 400;
    case '23514': // check_violation (value rejected by a CHECK constraint)
      return 400;
    default:
      return 500;
  }
}

module.exports = { notFound, errorHandler, statusFromDatabaseError };
