const crypto = require('crypto');
const { query } = require('../config/db');

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Verifies X-API-Key against api_keys table.
 * On success sets req.apiKey and updates last_used_at.
 */
async function apiKeyRequired(req, res, next) {
  try {
    const raw = req.headers['x-api-key'];
    if (!raw) return res.status(401).json({ error: 'Missing X-API-Key' });
    const hash = hashKey(raw);

    const { rows } = await query(
      `SELECT * FROM api_keys WHERE key_hash=$1 AND is_active=TRUE AND revoked_at IS NULL`,
      [hash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid API key' });

    req.apiKey = rows[0];
    await query('UPDATE api_keys SET last_used_at=NOW() WHERE id=$1', [rows[0].id]);
    next();
  } catch (e) { next(e); }
}

module.exports = { apiKeyRequired, hashKey };