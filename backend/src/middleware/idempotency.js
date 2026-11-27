const { query } = require('../config/db');

/**
 * Idempotency for POST endpoints.
 *
 * Client sends `Idempotency-Key: <uuid>`. The key is *claimed* atomically with
 * an INSERT ... ON CONFLICT DO NOTHING, so two concurrent requests with the
 * same key cannot both execute the handler.
 *
 *  - 2xx response  -> response body is stored and replayed for later calls.
 *  - 4xx/5xx       -> claim is released so an honest retry can run again.
 *  - claim held, no response yet -> 409 (the first request is still running).
 */
function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });
  req.idempotencyKey = String(key).slice(0, 200);

  (async () => {
    const { rowCount } = await query(
      'INSERT INTO idempotency_keys(key, endpoint) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING',
      [req.idempotencyKey, req.originalUrl]
    );

    if (!rowCount) {
      const { rows } = await query('SELECT response FROM idempotency_keys WHERE key=$1', [req.idempotencyKey]);
      const stored = rows[0] && rows[0].response;
      if (stored) return res.status(200).json({ ...stored, idempotent_replay: true });
      return res.status(409).json({
        error: 'A request with this Idempotency-Key is already in progress',
      });
    }

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      // Only successful outcomes become replays; errors must stay retryable.
      // The write is awaited so the replay is durable before the client sees
      // the response.
      try {
        if (res.statusCode >= 400) {
          await query('DELETE FROM idempotency_keys WHERE key=$1', [req.idempotencyKey]);
        } else {
          await query('UPDATE idempotency_keys SET response=$1 WHERE key=$2', [body, req.idempotencyKey]);
        }
      } catch {
        /* best effort - the TTL sweep cleans up abandoned keys */
      }
      return originalJson(body);
    };
    next();
  })().catch(next);
}

module.exports = { idempotency };
