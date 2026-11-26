const { query } = require('../../config/db');

async function list() {
  return (await query(
    `SELECT * FROM sla_rules ORDER BY
       CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`
  )).rows;
}

async function upsert({ priority, response_minutes, resolution_minutes }) {
  if (!priority) { const e = new Error('priority required'); e.status = 400; throw e; }
  if (!(response_minutes > 0) || !(resolution_minutes > 0)) {
    const e = new Error('response_minutes and resolution_minutes must be > 0'); e.status = 400; throw e;
  }
  const { rows } = await query(
    `INSERT INTO sla_rules(priority,response_minutes,resolution_minutes)
     VALUES ($1,$2,$3)
     ON CONFLICT (priority) DO UPDATE
       SET response_minutes=EXCLUDED.response_minutes,
           resolution_minutes=EXCLUDED.resolution_minutes,
           updated_at=NOW()
     RETURNING *`,
    [priority, response_minutes, resolution_minutes]
  );
  return rows[0];
}

module.exports = { list, upsert };