const { query } = require('../config/db');

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

  let idx = 0;
  if (last) {
    const i = agents.findIndex((a) => a.id === last);
    if (i !== -1) idx = (i + 1) % agents.length;
  }
  const picked = agents[idx].id;

  await query('UPDATE categories SET last_assigned_agent_id=$1 WHERE id=$2', [picked, categoryId]);
  return picked;
}

module.exports = { pickAgentForCategory };