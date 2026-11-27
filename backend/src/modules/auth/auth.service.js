const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const env = require('../../config/env');
const { assertValidPassword } = require('../../utils/password');

async function signup({ email, password, full_name }) {
  assertValidPassword(password);
  const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rowCount) {
    const err = new Error('Email already registered'); err.status = 409; throw err;
  }
  const hash = await bcrypt.hash(password, 10);
  // signup always creates a customer
  const { rows } = await query(
    `INSERT INTO users(email,password_hash,full_name,role)
     VALUES ($1,$2,$3,'customer') RETURNING id,email,full_name,role,created_at`,
    [email, hash, full_name]
  );
  return { user: rows[0], token: issue(rows[0]) };
}

async function login({ email, password }) {
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user || !user.is_active) {
    const err = new Error('Invalid credentials'); err.status = 401; throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) { const err = new Error('Invalid credentials'); err.status = 401; throw err; }

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    token: issue(user),
  };
}

function issue(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.full_name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

module.exports = { signup, login };