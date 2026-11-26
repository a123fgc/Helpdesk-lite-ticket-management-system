const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');

async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!claims || typeof claims.sub !== 'string') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { rows } = await query(
      'SELECT role FROM users WHERE id=$1 AND is_active=TRUE',
      [claims.sub]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = { ...claims, role: rows[0].role };
    next();
  } catch (e) {
    next(e);
  }
}
module.exports = { authRequired };