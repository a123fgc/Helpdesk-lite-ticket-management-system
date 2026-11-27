const { pool, query } = require('../../config/db');

/**
 * Agent ↔ category assignments.
 *
 * These rows are exactly what `services/roundRobin.js` reads when it decides
 * who receives a new ticket, so every change made here takes effect on the
 * very next ticket created for that category.
 */

function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

function notFound(message) {
  const e = new Error(message);
  e.status = 404;
  return e;
}

/** Current assignments, newest category first. Optional `agent_id` filter. */
async function list({ agentId } = {}) {
  const conds = [];
  const vals = [];
  if (agentId) {
    vals.push(agentId);
    conds.push(`ac.agent_id = $${vals.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  return (await query(
    `SELECT ac.agent_id, ac.category_id,
            u.full_name AS agent_name, u.email AS agent_email, u.is_active AS agent_active,
            c.name      AS category_name, c.is_active AS category_active
       FROM agent_categories ac
       JOIN users u      ON u.id = ac.agent_id
       JOIN categories c ON c.id = ac.category_id
       ${where}
      ORDER BY u.full_name, c.name`,
    vals
  )).rows;
}

/**
 * Assign a category to an agent.
 * Runs in a transaction so the existence checks and the insert cannot drift
 * apart if a user or category disappears mid-request.
 */
async function assign({ agentId, categoryId }) {
  if (!agentId || !categoryId) throw badRequest('agent_id and category_id required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const agent = (await client.query(
      `SELECT id, full_name FROM users WHERE id = $1 AND role = 'agent'`,
      [agentId]
    )).rows[0];
    if (!agent) throw notFound('Agent not found');

    const category = (await client.query(
      'SELECT id, name FROM categories WHERE id = $1',
      [categoryId]
    )).rows[0];
    if (!category) throw notFound('Category not found');

    const existing = (await client.query(
      'SELECT 1 FROM agent_categories WHERE agent_id = $1 AND category_id = $2',
      [agentId, categoryId]
    )).rowCount;
    if (existing) {
      const e = new Error('This agent is already assigned to that category');
      e.status = 409;
      throw e;
    }

    await client.query(
      'INSERT INTO agent_categories(agent_id, category_id) VALUES ($1, $2)',
      [agentId, categoryId]
    );

    await client.query('COMMIT');
    return {
      agent_id: agentId,
      category_id: categoryId,
      agent_name: agent.full_name,
      category_name: category.name,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove one assignment. Also clears the round-robin cursor when it still
 * points at the agent we just removed from that category, so the next ticket
 * does not start from a stale position.
 */
async function remove({ agentId, categoryId }) {
  if (!agentId || !categoryId) throw badRequest('agent_id and category_id required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      'DELETE FROM agent_categories WHERE agent_id = $1 AND category_id = $2',
      [agentId, categoryId]
    );
    if (!rowCount) throw notFound('Assignment not found');

    await client.query(
      'UPDATE categories SET last_assigned_agent_id = NULL WHERE id = $1 AND last_assigned_agent_id = $2',
      [categoryId, agentId]
    );

    await client.query('COMMIT');
    return { agent_id: agentId, category_id: categoryId, removed: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { list, assign, remove };
