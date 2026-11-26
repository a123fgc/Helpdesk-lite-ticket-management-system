const { query } = require('../../config/db');

async function submitSurvey({ token, rating, comment }) {
  if (!token) { const e = new Error('token required'); e.status = 400; throw e; }
  if (!(rating >= 1 && rating <= 5)) { const e = new Error('rating must be 1..5'); e.status = 400; throw e; }

  const { rows } = await query('SELECT * FROM surveys WHERE token=$1', [token]);
  if (!rows.length) { const e = new Error('Invalid survey token'); e.status = 404; throw e; }
  const s = rows[0];
  if (s.submitted_at) {
    return { already_submitted: true, survey: s };
  }
  const upd = (await query(
    `UPDATE surveys SET rating=$1, comment=$2, submitted_at=NOW()
      WHERE id=$3 RETURNING *`,
    [rating, comment || null, s.id]
  )).rows[0];

  // audit on the ticket
  await query(
    `INSERT INTO audit_log(ticket_id,actor_id,actor_role,action,new_value)
     VALUES ($1,NULL,'system','survey_submitted',$2)`,
    [s.ticket_id, JSON.stringify({ rating, comment: comment || null })]
  );

  return { survey: upd };
}

module.exports = { submitSurvey };