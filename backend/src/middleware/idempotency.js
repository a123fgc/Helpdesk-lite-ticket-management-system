const { query } = require('../config/db');

/**
 * Idempotency for POST endpoints.
 * Client sends `Idempotency-Key: <uuid>` (or we derive from body hash).
 * If the key was already used, we return the stored response.
 * Otherwise, we let the handler run, then persist its response.
 */
function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });
  req.idempotencyKey = String(key).slice(0, 200);

  (async () => {
    const { rows } = await query('SELECT response FROM idempotency_keys WHERE key=$1', [req.idempotencyKey]);
    if (rows.length) {
      return res.status(200).json({ ...rows[0].response, idempotent_replay: true });
    }
    // wrap res.json to store it
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        await query(
          'INSERT INTO idempotency_keys(key, endpoint, response) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING',
          [req.idempotencyKey, req.originalUrl, body]
        );
      } catch (e) { /* ignore races */ }
      return originalJson(body);
    };
    next();
  })().catch(next);
}

module.exports = { idempotency };