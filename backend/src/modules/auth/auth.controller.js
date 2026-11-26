const svc = require('./auth.service');

exports.signup = async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password, full_name required' });
    }
    res.status(201).json(await svc.signup({ email, password, full_name }));
  } catch (e) { next(e); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    res.json(await svc.login({ email, password }));
  } catch (e) { next(e); }
};

exports.me = async (req, res, next) => {
  try {
    const { query } = require('../../config/db');
    const { rows } = await query(
      'SELECT id,email,full_name,role,created_at FROM users WHERE id=$1', [req.user.sub]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
};