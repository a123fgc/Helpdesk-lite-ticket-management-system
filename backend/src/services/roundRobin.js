const { query } = require('../config/db');

/**
 * Choose the position of the next agent in an ordered roster.
 *
 * Pure so the routing rule can be unit-tested without a database:
 *  - empty roster            -> -1 (nobody to assign)
 *  - no cursor / stale cursor -> 0  (start at the first agent)
 *  - otherwise               -> the slot after the previous assignee, wrapping
 *
 * @param {Array<{id: string}>} agents  ordered eligible agents
 * @param {string|null} lastAssignedId  the category's round-robin cursor
 * @returns {number} index into `agents`, or -1
 */
function nextAgentIndex(agents, lastAssignedId) {
  if (!agents || agents.length === 0) return -1;
  if (!lastAssignedId) return 0;
  const i = agents.findIndex((a) => a.id === lastAssignedId);
  return i === -1 ? 0 : (i + 1) % agents.length;
}

/**
 * Pick the next agent for a category using round-robin.
 * Uses categories.last_assigned_agent_id as the cursor.
 * Returns agent_id or null.
 */
async function pickAgentForCategory(categoryId) {
  // ordered list of eligible agents for this category
  const { rows: agents } = await query(
    `SELECT u.id
       FROM agent_categories ac
       JOIN users u ON u.id = ac.agent_id
      WHERE ac.category_id = $1 AND u.is_active = TRUE AND u.role = 'agent'
      ORDER BY u.created_at, u.id`,
    [categoryId]
  );
  if (!agents.length) return null;

  const { rows: catRows } = await query(
    'SELECT last_assigned_agent_id FROM categories WHERE id=$1',
    [categoryId]
  );
  const last = catRows[0]?.last_assigned_agent_id || null;

  const idx = nextAgentIndex(agents, last);
  if (idx === -1) return null;

  const picked = agents[idx].id;
  await query('UPDATE categories SET last_assigned_agent_id=$1 WHERE id=$2', [picked, categoryId]);
  return picked;
}

module.exports = { pickAgentForCategory, nextAgentIndex };
