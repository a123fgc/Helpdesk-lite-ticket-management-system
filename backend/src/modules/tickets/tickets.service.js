const { query } = require('../../config/db');
const env = require('../../config/env');
const fs = require('fs');
const path = require('path');
const { pickAgentForCategory } = require('../../services/roundRobin');
const { computeSla } = require('../../services/slaEngine');
const { queueWebhook } = require('../../services/webhookSender');
const { audit } = require('../../services/auditLog');
const { paginate } = require('../../utils/paginate');

const ALLOWED_STATUSES = ['open','in_progress','waiting_on_customer','resolved','closed'];
const VALID_TRANSITIONS = {
  open:                 ['in_progress'],
  in_progress:          ['waiting_on_customer','resolved'],
  waiting_on_customer:  ['in_progress','resolved'],
  resolved:             ['closed','in_progress'],
  closed:               [],
};

async function createTicket({ user, body, attachments }) {
  const { subject, description, category_id, priority } = body;
  if (!subject || !description || !category_id || !priority) {
    const e = new Error('subject, description, category_id, priority required'); e.status = 400; throw e;
  }

  // validate category
  const cat = await query('SELECT id FROM categories WHERE id=$1 AND is_active=TRUE', [category_id]);
  if (!cat.rowCount) { const e = new Error('Invalid category'); e.status = 400; throw e; }

  const sla = await computeSla(priority, new Date());

  // round-robin auto-assign
  const assignedTo = await pickAgentForCategory(category_id);

  const { rows } = await query(
    `INSERT INTO tickets
       (subject,description,category_id,priority,status,created_by,assigned_to,
        sla_response_due_at,sla_resolve_due_at)
     VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8) RETURNING *`,
    [subject, description, category_id, priority, user.sub, assignedTo, sla.response_due, sla.resolve_due]
  );
  const ticket = rows[0];

  // attachments
  if (attachments && attachments.length) {
    for (const a of attachments) {
      await query(
        `INSERT INTO attachments(ticket_id,uploaded_by,original_name,stored_name,mime_type,size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ticket.id, user.sub, a.originalname, a.filename, a.mimetype, a.size]
      );
    }
  }

  await audit({
    ticketId: ticket.id, actorId: user.sub, actorRole: user.role,
    action: 'ticket_created',
    newValue: { status: ticket.status, priority: ticket.priority, assigned_to: assignedTo },
  });

  await queueWebhook('ticket.created', ticket);

  return ticket;
}

async function listTickets({ user, filters }) {
  const { page, limit, offset } = paginate({ query: filters });
  const conds = [];
  const vals = [];
  let i = 1;

  // role scoping
  if (user.role === 'customer') {
    conds.push(`created_by = $${i++}`); vals.push(user.sub);
  } else if (user.role === 'agent') {
    if (filters.mine === 'true') {
      conds.push(`assigned_to = $${i++}`); vals.push(user.sub);
    }
  }

  if (filters.status)      { conds.push(`status = $${i++}`);      vals.push(filters.status); }
  if (filters.unassigned === 'true') { conds.push('assigned_to IS NULL'); }
  if (filters.priority)    { conds.push(`priority = $${i++}`);    vals.push(filters.priority); }
  if (filters.category_id) { conds.push(`category_id = $${i++}`); vals.push(filters.category_id); }
  if (filters.assigned_to) { conds.push(`assigned_to = $${i++}`); vals.push(filters.assigned_to); }
  if (filters.search) {
    conds.push(`(subject ILIKE $${i} OR description ILIKE $${i} OR ticket_number::text = $${i + 1})`);
    vals.push(`%${filters.search}%`, filters.search); i += 2;
  }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM tickets ${where}`, vals);
  const rows = (await query(
    `SELECT t.*,
            u.full_name AS created_by_name,
            a.full_name AS assigned_to_name,
            c.name      AS category_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN users a ON a.id = t.assigned_to
       LEFT JOIN categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  )).rows;

  return { data: rows, page, limit, total: totalRes.rows[0].n };
}

async function ticketSummary({ user }) {
  const conditions = [];
  const values = [];
  if (user.role === 'customer') {
    conditions.push('created_by=$1');
    values.push(user.sub);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT status,COUNT(*)::int AS total
       FROM tickets ${where}
      GROUP BY status`,
    values
  );
  const counts = Object.fromEntries(rows.map((row) => [row.status, row.total]));
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return { total, by_status: counts };
}

async function getTicket({ user, id }) {
  const { rows } = await query(
    `SELECT t.*, u.full_name AS created_by_name, a.full_name AS assigned_to_name, c.name AS category_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN users a ON a.id = t.assigned_to
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.id=$1`,
    [id]
  );
  const ticket = rows[0];
  if (!ticket) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (user.role === 'customer' && ticket.created_by !== user.sub) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }
  const attachments = (await query(
    `SELECT id,original_name,mime_type,size_bytes,created_at
       FROM attachments WHERE ticket_id=$1 ORDER BY created_at`,
    [id]
  )).rows;
  return { ...ticket, attachments };
}

async function getAttachment({ user, ticketId, attachmentId }) {
  const { rows } = await query(
    `SELECT a.stored_name,a.original_name,t.created_by
       FROM attachments a
       JOIN tickets t ON t.id=a.ticket_id
      WHERE a.id=$1 AND a.ticket_id=$2`,
    [attachmentId, ticketId]
  );
  const attachment = rows[0];
  if (!attachment) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (user.role === 'customer' && attachment.created_by !== user.sub) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }
  if (path.basename(attachment.stored_name) !== attachment.stored_name) {
    const e = new Error('Not found'); e.status = 404; throw e;
  }

  const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
  const filePath = path.resolve(uploadRoot, attachment.stored_name);
  const relativePath = path.relative(uploadRoot, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    const e = new Error('Not found'); e.status = 404; throw e;
  }

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch (e) {
    if (e.code === 'ENOENT') {
      const notFound = new Error('Attachment not found');
      notFound.status = 404;
      throw notFound;
    }
    throw e;
  }

  return { filePath, originalName: attachment.original_name };
}

async function assignToSelf({ user, id }) {
  if (user.role !== 'agent') { const e = new Error('Forbidden'); e.status = 403; throw e; }
  const old = (await query('SELECT * FROM tickets WHERE id=$1', [id])).rows[0];
  if (!old) { const e = new Error('Not found'); e.status = 404; throw e; }

  const { rows } = await query(
    `UPDATE tickets SET assigned_to=$1, status = CASE WHEN status='open' THEN 'in_progress' ELSE status END
      WHERE id=$2 RETURNING *`,
    [user.sub, id]
  );
  await audit({
    ticketId: id, actorId: user.sub, actorRole: user.role, action: 'assigned',
    oldValue: { assigned_to: old.assigned_to }, newValue: { assigned_to: user.sub },
  });
  if (old.status !== rows[0].status) {
    await queueWebhook('ticket.status_changed', rows[0], { from: old.status, to: rows[0].status, actor: user.sub });
  }
  return rows[0];
}

async function changeStatus({ user, id, newStatus }) {
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    const e = new Error('Invalid status'); e.status = 400; throw e;
  }
  const old = (await query('SELECT * FROM tickets WHERE id=$1', [id])).rows[0];
  if (!old) { const e = new Error('Not found'); e.status = 404; throw e; }

  if (user.role === 'agent' && !VALID_TRANSITIONS[old.status].includes(newStatus) && newStatus !== old.status) {
    const e = new Error(`Illegal transition ${old.status} → ${newStatus}`); e.status = 400; throw e;
  }
  if (user.role === 'customer') {
    const e = new Error('Customers cannot change status'); e.status = 403; throw e;
  }

  const resolvedAt = newStatus === 'resolved' ? new Date() : old.resolved_at;
  const closedAt   = newStatus === 'closed'   ? new Date() : old.closed_at;

  const { rows } = await query(
    `UPDATE tickets
        SET status=$1, resolved_at=$2, closed_at=$3
      WHERE id=$4 RETURNING *`,
    [newStatus, resolvedAt, closedAt, id]
  );
  const ticket = rows[0];

  await audit({
    ticketId: id, actorId: user.sub, actorRole: user.role,
    action: 'status_changed',
    oldValue: { status: old.status }, newValue: { status: newStatus },
  });
  await queueWebhook('ticket.status_changed', ticket, { from: old.status, to: newStatus, actor: user.sub });
  if (newStatus === 'resolved') {
    // create survey token
    const token = 'tok_' + ticket.id;
    await query(
      `INSERT INTO surveys(ticket_id,token) VALUES ($1,$2)
       ON CONFLICT (ticket_id) DO NOTHING`,
      [ticket.id, token]
    );
    await queueWebhook('ticket.resolved', ticket, { survey_token: token });
  }
  return ticket;
}

module.exports = {
  createTicket, listTickets, ticketSummary, getTicket, getAttachment, assignToSelf, changeStatus,
  ALLOWED_STATUSES, VALID_TRANSITIONS,
};