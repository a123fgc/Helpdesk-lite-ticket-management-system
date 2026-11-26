const { query } = require('../../config/db');

async function list({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE is_active = TRUE';
  return (await query(
    `SELECT id,name,description,is_active,last_assigned_agent_id,created_at
       FROM categories ${where}
       ORDER BY name`
  )).rows;
}

async function create({ name, description }) {
  if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
  const { rows } = await query(
    `INSERT INTO categories(name,description) VALUES ($1,$2) RETURNING *`,
    [name, description || null]
  );
  return rows[0];
}

async function update({ id, name, description, is_active }) {
  const { rows } = await query(
    `UPDATE categories
        SET name = COALESCE($1,name),
            description = COALESCE($2,description),
            is_active = COALESCE($3,is_active)
      WHERE id=$4 RETURNING *`,
    [name || null, description ?? null, is_active ?? null, id]
  );
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return rows[0];
}

async function remove(id) {
  // soft-delete: mark inactive
  const { rows } = await query(
    `UPDATE categories SET is_active=FALSE WHERE id=$1 RETURNING id,name,is_active`,
    [id]
  );
  if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
  return rows[0];
}

module.exports = { list, create, update, remove };