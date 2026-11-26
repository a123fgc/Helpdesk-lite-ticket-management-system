const { query } = require('../../config/db');

async function listAgents() {
  return (await query(
    `SELECT id,email,full_name,is_active FROM users
      WHERE role='agent' AND is_active=TRUE ORDER BY full_name`
  )).rows;
}

module.exports = { listAgents };