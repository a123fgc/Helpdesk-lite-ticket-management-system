const crypto = require('crypto');
const { query } = require('../../config/db');
const { hashKey } = require('../../middleware/apiKey');

// ── API keys ────────────────────────────────────────────
async function listApiKeys() {
  return (await query(
    `SELECT id,name,key_prefix,is_active,last_used_at,revoked_at,created_at
       FROM api_keys ORDER BY created_at DESC`
  )).rows;
}

async function createApiKey({ actorId, name }) {
  if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
  const raw = 'hdk_' + crypto.randomBytes(24).toString('hex');
  const prefix = raw.slice(0, 10);
  const hash = hashKey(raw);
  const { rows } = await query(
    `INSERT INTO api_keys(name,key_hash,key_prefix,created_by) VALUES ($1,$2,$3,$4)
     RETURNING id,name,key_prefix,is_active,created_at`,
    [name, hash, prefix, actorId]
  );
  return { ...rows[0], key: raw }; // shown only once
}

async function revokeApiKey(id) {
  const { rows } = await query(
    `UPDATE api_keys SET is_active=FALSE, revoked_at=NOW() WHERE id=$1
     RETURNING id,name,key_prefix,is_active,revoked_at`,
    [id]
  );
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return rows[0];
}

// ── metrics (dashboard) ────────────────────────────────
async function dashboardMetrics() {
  // tickets by status
  const byStatus = (await query(
    `SELECT status, COUNT(*)::int n FROM tickets GROUP BY status`
  )).rows;

  // avg first response time (hours) for tickets that had a first response
  const fr = (await query(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600), 0) AS avg_hours
       FROM tickets WHERE first_response_at IS NOT NULL`
  )).rows[0];

  // SLA compliance %
  const sla = (await query(
    `SELECT
       COUNT(*)::int AS total,
       SUM(CASE WHEN sla_breached THEN 0 ELSE 1 END)::int AS compliant
     FROM tickets WHERE status NOT IN ('open')`
  )).rows[0];
  const slaPct = sla.total ? Math.round((sla.compliant / sla.total) * 10000) / 100 : 100;

  // average satisfaction
  const sat = (await query(
    `SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*)::int AS n
       FROM surveys WHERE rating IS NOT NULL`
  )).rows[0];

  // workload per agent
  const workload = (await query(
    `SELECT u.id, u.full_name,
            COUNT(t.id)::int AS assigned,
            SUM(CASE WHEN t.status IN ('open','in_progress','waiting_on_customer') THEN 1 ELSE 0 END)::int AS active,
            SUM(CASE WHEN t.status IN ('resolved','closed') THEN 1 ELSE 0 END)::int AS done
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to = u.id
      WHERE u.role='agent' AND u.is_active=TRUE
      GROUP BY u.id, u.full_name
      ORDER BY u.full_name`
  )).rows;

  return {
    tickets_by_status: byStatus,
    avg_first_response_hours: Math.round(fr.avg_hours * 100) / 100,
    sla_compliance_pct: slaPct,
    avg_satisfaction: Math.round(sat.avg_rating * 100) / 100,
    satisfaction_count: sat.n,
    workload_per_agent: workload,
  };
}

// ── agent management ───────────────────────────────────
async function listAgents() {
  return (await query(
    `SELECT id,email,full_name,is_active,created_at FROM users WHERE role='agent' ORDER BY full_name`
  )).rows;
}

async function createAgent({ email, password, full_name }) {
  const bcrypt = require('bcrypt');
  const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rowCount) { const e = new Error('Email exists'); e.status = 409; throw e; }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,'agent')
     RETURNING id,email,full_name,role,is_active,created_at`,
    [email, hash, full_name]
  );
  return rows[0];
}

async function setAgentActive({ id, isActive }) {
  const { rows } = await query(
    `UPDATE users SET is_active=$1 WHERE id=$2 AND role='agent'
     RETURNING id,email,full_name,is_active`,
    [isActive, id]
  );
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return rows[0];
}

module.exports = {
  listApiKeys, createApiKey, revokeApiKey,
  dashboardMetrics,
  listAgents, createAgent, setAgentActive,
};