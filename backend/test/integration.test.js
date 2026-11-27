/**
 * API integration tests.
 *
 * These run against a REAL PostgreSQL database, but only when one is supplied
 * explicitly:
 *
 *   TEST_DATABASE_URL=postgres://user:pass@host:5432/helpdesk_test npm test
 *
 * Without that variable the whole suite is skipped and no connection is made.
 * The suite creates its own rows (tagged with a unique run id) and removes
 * them again in `after()`; it never truncates or modifies existing data.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { integrationEnabled } = require('./helpers/testEnv');

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const RUN_ID = crypto.randomUUID().slice(0, 8);
const email = (label) => `it-${label}-${RUN_ID}@example.test`;

const opts = { skip: integrationEnabled ? false : 'set TEST_DATABASE_URL to run integration tests' };

let app;
let pool;
let baseUrl;
let server;

const ids = { users: [], categories: [], tickets: [] };

function tokenFor(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: json };
}

describe('API integration', opts, () => {
  let admin, agentX, agentY, customerA, customerB;
  let category;
  let ticketMine, ticketOther, ticketAssignedToY, ticketUnassigned;

  before(async () => {
    if (!integrationEnabled) return;

    // Loaded only now, so unit tests never touch a database.
    ({ pool } = require('../src/config/db'));
    app = require('../src/app');

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const hash = await bcrypt.hash('Integration123!', 10);
    const insertUser = async (label, role) => {
      const { rows } = await pool.query(
        `INSERT INTO users(email,password_hash,full_name,role)
         VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,role`,
        [email(label), hash, `IT ${label} ${RUN_ID}`, role]
      );
      ids.users.push(rows[0].id);
      return rows[0];
    };

    admin = await insertUser('admin', 'admin');
    agentX = await insertUser('agentx', 'agent');
    agentY = await insertUser('agenty', 'agent');
    customerA = await insertUser('custa', 'customer');
    customerB = await insertUser('custb', 'customer');

    const cat = (await pool.query(
      `INSERT INTO categories(name,description) VALUES ($1,$2) RETURNING id,name`,
      [`IT Category ${RUN_ID}`, 'integration fixture']
    )).rows[0];
    ids.categories.push(cat.id);
    category = cat;

    const insertTicket = async (label, fields) => {
      const { rows } = await pool.query(
        `INSERT INTO tickets(subject,description,category_id,priority,status,created_by,assigned_to)
         VALUES ($1,$2,$3,'medium',$4,$5,$6) RETURNING id`,
        [label, 'integration fixture ticket', cat.id, fields.status || 'open',
         fields.createdBy, fields.assignedTo || null]
      );
      ids.tickets.push(rows[0].id);
      return rows[0];
    };

    ticketMine = await insertTicket('IT mine', { createdBy: customerA.id });
    ticketOther = await insertTicket('IT other', { createdBy: customerB.id });
    ticketAssignedToY = await insertTicket('IT assigned-to-y', {
      createdBy: customerA.id, assignedTo: agentY.id, status: 'in_progress',
    });
    ticketUnassigned = await insertTicket('IT unassigned', { createdBy: customerA.id });
  });

  after(async () => {
    if (!integrationEnabled || !pool) return;
    try {
      await pool.query('DELETE FROM audit_log WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM notes WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM messages WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM surveys WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM attachments WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM webhook_events WHERE ticket_id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM tickets WHERE id = ANY($1::uuid[])', [ids.tickets]);
      await pool.query('DELETE FROM agent_categories WHERE agent_id = ANY($1::uuid[])', [ids.users]);
      await pool.query('DELETE FROM categories WHERE id = ANY($1::uuid[])', [ids.categories]);
      await pool.query('DELETE FROM audit_log WHERE actor_id = ANY($1::uuid[])', [ids.users]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids.users]);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await pool.end();
    }
  });

  // ── health ──────────────────────────────────────────────────────
  it('GET /api/health reports database connectivity', async () => {
    const r = await api('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
    assert.equal(r.body.db, 'up');
    // must not leak connection details
    assert.ok(!JSON.stringify(r.body).includes('postgres'));
    assert.ok(!JSON.stringify(r.body).includes('DATABASE_URL'));
  });

  // ── authentication ──────────────────────────────────────────────
  it('rejects a request with no token', async () => {
    const r = await api('GET', '/api/tickets');
    assert.equal(r.status, 401);
  });

  it('rejects a garbage token', async () => {
    const r = await api('GET', '/api/tickets', { token: 'not-a-jwt' });
    assert.equal(r.status, 401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: admin.id, role: 'admin' }, 'wrong-secret');
    const r = await api('GET', '/api/admin/metrics', { token: forged });
    assert.equal(r.status, 401);
  });

  it('rejects a token for a non-existent user', async () => {
    const orphan = jwt.sign(
      { sub: crypto.randomUUID(), role: 'admin' },
      process.env.JWT_SECRET
    );
    const r = await api('GET', '/api/admin/metrics', { token: orphan });
    assert.equal(r.status, 401);
  });

  // ── role restrictions ───────────────────────────────────────────
  it('forbids an agent from calling admin-only endpoints', async () => {
    const r = await api('GET', '/api/admin/metrics', { token: tokenFor(agentX) });
    assert.equal(r.status, 403);
  });

  it('forbids a customer from calling admin-only endpoints', async () => {
    const r = await api('GET', '/api/admin/agents', { token: tokenFor(customerA) });
    assert.equal(r.status, 403);
  });

  it('forbids a customer from listing agent notes', async () => {
    const r = await api('GET', `/api/notes/${ticketMine.id}`, { token: tokenFor(customerA) });
    assert.equal(r.status, 403);
  });

  it('forbids a customer from changing ticket status', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketMine.id}/status`,
      { token: tokenFor(customerA), body: { status: 'closed' } });
    assert.equal(r.status, 403);
  });

  it('forbids a customer from self-assigning a ticket', async () => {
    const r = await api('POST', `/api/tickets/${ticketMine.id}/assign-self`,
      { token: tokenFor(customerA) });
    assert.equal(r.status, 403);
  });

  it('forbids an agent from listing admin audit entries', async () => {
    const r = await api('GET', '/api/audit', { token: tokenFor(agentX) });
    assert.equal(r.status, 403);
  });

  // ── cross-user access ───────────────────────────────────────────
  it('scopes a customer ticket list to their own tickets', async () => {
    const r = await api('GET', '/api/tickets', { token: tokenFor(customerA) });
    assert.equal(r.status, 200);
    const idsSeen = r.body.data.map((t) => t.id);
    assert.ok(idsSeen.includes(ticketMine.id));
    assert.ok(!idsSeen.includes(ticketOther.id), 'leaked another customer\'s ticket');
  });

  it('blocks a customer from reading another customer\'s ticket', async () => {
    const r = await api('GET', `/api/tickets/${ticketOther.id}`, { token: tokenFor(customerA) });
    assert.equal(r.status, 403);
  });

  it('blocks a customer from reading another customer\'s messages', async () => {
    const r = await api('GET', `/api/messages/${ticketOther.id}`, { token: tokenFor(customerA) });
    assert.equal(r.status, 403);
  });

  it('blocks a customer from posting to another customer\'s ticket', async () => {
    const r = await api('POST', `/api/messages/${ticketOther.id}`,
      { token: tokenFor(customerA), body: { body: 'hello' } });
    assert.equal(r.status, 403);
  });

  it('lets a customer read their own ticket and messages', async () => {
    assert.equal((await api('GET', `/api/tickets/${ticketMine.id}`, { token: tokenFor(customerA) })).status, 200);
    assert.equal((await api('GET', `/api/messages/${ticketMine.id}`, { token: tokenFor(customerA) })).status, 200);
  });

  // ── agent vs. other agents' tickets ─────────────────────────────
  it('blocks an agent from changing the status of another agent\'s ticket', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketAssignedToY.id}/status`,
      { token: tokenFor(agentX), body: { status: 'resolved' } });
    assert.equal(r.status, 403);
  });

  it('blocks an agent from taking over another agent\'s ticket', async () => {
    const r = await api('POST', `/api/tickets/${ticketAssignedToY.id}/assign-self`,
      { token: tokenFor(agentX) });
    assert.equal(r.status, 403);
  });

  it('lets an agent take over an unassigned ticket', async () => {
    const r = await api('POST', `/api/tickets/${ticketUnassigned.id}/assign-self`,
      { token: tokenFor(agentX) });
    assert.equal(r.status, 200);
    assert.equal(r.body.assigned_to, agentX.id);
  });

  it('lets an admin change the status of another agent\'s ticket', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketAssignedToY.id}/status`,
      { token: tokenFor(admin), body: { status: 'resolved' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'resolved');
  });

  it('lets an agent act on their own ticket', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketUnassigned.id}/status`,
      { token: tokenFor(agentX), body: { status: 'in_progress' } });
    assert.equal(r.status, 200);
  });

  // ── validation / invalid input ──────────────────────────────────
  it('rejects an illegal status transition', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketUnassigned.id}/status`,
      { token: tokenFor(agentX), body: { status: 'closed' } });
    assert.equal(r.status, 400);
  });

  it('rejects an unknown status value', async () => {
    const r = await api('PATCH', `/api/tickets/${ticketUnassigned.id}/status`,
      { token: tokenFor(admin), body: { status: 'on_fire' } });
    assert.equal(r.status, 400);
  });

  it('rejects a ticket with missing fields', async () => {
    const r = await api('POST', '/api/tickets', { token: tokenFor(customerA), body: { subject: 'x' } });
    assert.equal(r.status, 400);
  });

  it('rejects a signup with a too-short password', async () => {
    const r = await api('POST', '/api/auth/signup', {
      body: { email: `it-short-${RUN_ID}@example.test`, password: 'abc', full_name: 'IT' },
    });
    assert.equal(r.status, 400);
  });

  it('rejects a malformed JSON body', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(res.status, 400);
  });

  it('returns 404 for an unknown route', async () => {
    const r = await api('GET', '/api/definitely-not-a-route', { token: tokenFor(admin) });
    assert.equal(r.status, 404);
  });

  // ── pagination / search validation ──────────────────────────────
  it('rejects a negative page number', async () => {
    const r = await api('GET', '/api/tickets?page=-1', { token: tokenFor(admin) });
    assert.equal(r.status, 400);
  });

  it('rejects a non-numeric limit', async () => {
    const r = await api('GET', '/api/tickets?limit=abc', { token: tokenFor(admin) });
    assert.equal(r.status, 400);
  });

  it('rejects an oversized search term', async () => {
    const r = await api('GET', `/api/tickets?search=${'x'.repeat(500)}`, { token: tokenFor(admin) });
    assert.equal(r.status, 400);
  });

  it('clamps an oversized limit instead of failing', async () => {
    const r = await api('GET', '/api/tickets?limit=99999', { token: tokenFor(admin) });
    assert.equal(r.status, 200);
    assert.ok(r.body.limit <= 100);
  });

  it('accepts a search containing LIKE wildcards', async () => {
    const r = await api('GET', '/api/tickets?search=%25%25%25', { token: tokenFor(admin) });
    assert.equal(r.status, 200);
  });

  // ── notes ───────────────────────────────────────────────────────
  it('returns 404 for notes on a non-existent ticket', async () => {
    const r = await api('GET', `/api/notes/${crypto.randomUUID()}`, { token: tokenFor(admin) });
    assert.equal(r.status, 404);
  });

  it('returns 404 when creating a note on a non-existent ticket', async () => {
    const r = await api('POST', `/api/notes/${crypto.randomUUID()}`,
      { token: tokenFor(admin), body: { body: 'note' } });
    assert.equal(r.status, 404);
  });

  // ── agent-category management ───────────────────────────────────
  it('forbids an agent from reading agent-category assignments', async () => {
    const r = await api('GET', '/api/admin/agent-categories', { token: tokenFor(agentX) });
    assert.equal(r.status, 403);
  });

  it('lists agent-category assignments for an admin', async () => {
    const r = await api('GET', '/api/admin/agent-categories', { token: tokenFor(admin) });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  it('rejects an assignment with a missing id', async () => {
    const r = await api('POST', '/api/admin/agent-categories',
      { token: tokenFor(admin), body: { agent_id: agentX.id } });
    assert.equal(r.status, 400);
  });

  it('404s when the agent does not exist', async () => {
    const r = await api('POST', '/api/admin/agent-categories', {
      token: tokenFor(admin),
      body: { agent_id: crypto.randomUUID(), category_id: category.id },
    });
    assert.equal(r.status, 404);
  });

  it('404s when the category does not exist', async () => {
    const r = await api('POST', '/api/admin/agent-categories', {
      token: tokenFor(admin),
      body: { agent_id: agentX.id, category_id: crypto.randomUUID() },
    });
    assert.equal(r.status, 404);
  });

  it('404s when assigning a customer (wrong role) to a category', async () => {
    const r = await api('POST', '/api/admin/agent-categories', {
      token: tokenFor(admin),
      body: { agent_id: customerA.id, category_id: category.id },
    });
    assert.equal(r.status, 404);
  });

  it('creates an assignment and rejects the duplicate', async () => {
    const created = await api('POST', '/api/admin/agent-categories', {
      token: tokenFor(admin),
      body: { agent_id: agentX.id, category_id: category.id },
    });
    assert.equal(created.status, 201);

    const dup = await api('POST', '/api/admin/agent-categories', {
      token: tokenFor(admin),
      body: { agent_id: agentX.id, category_id: category.id },
    });
    assert.equal(dup.status, 409);
  });

  it('filters assignments by agent_id', async () => {
    const r = await api('GET', `/api/admin/agent-categories?agent_id=${agentX.id}`,
      { token: tokenFor(admin) });
    assert.equal(r.status, 200);
    assert.ok(r.body.every((a) => a.agent_id === agentX.id));
    assert.ok(r.body.some((a) => a.category_id === category.id));
  });

  it('removes an assignment, then 404s on a second removal', async () => {
    const first = await api('DELETE',
      `/api/admin/agent-categories/${agentX.id}/${category.id}`, { token: tokenFor(admin) });
    assert.equal(first.status, 200);

    const second = await api('DELETE',
      `/api/admin/agent-categories/${agentX.id}/${category.id}`, { token: tokenFor(admin) });
    assert.equal(second.status, 404);
  });

  // ── database error handling ─────────────────────────────────────
  it('returns 404 (not 500) for a syntactically invalid UUID filter', async () => {
    const r = await api('GET', '/api/tickets?category_id=not-a-uuid', { token: tokenFor(admin) });
    assert.ok(r.status === 404 || r.status === 400, `unexpected status ${r.status}`);
  });

  it('does not leak SQL or connection strings on a server error', async () => {
    const r = await api('GET', '/api/tickets?page=1&category_id=not-a-uuid', { token: tokenFor(admin) });
    const text = JSON.stringify(r.body || {});
    assert.ok(!text.includes('SELECT'), 'leaked SQL');
    assert.ok(!text.includes('postgres://'), 'leaked connection string');
    assert.ok(!text.includes('pg_'), 'leaked driver internals');
  });
});
