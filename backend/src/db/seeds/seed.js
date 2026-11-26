const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
require('dotenv').config();

// deterministic-ish random
let seed = 42;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (a, b) => Math.floor(rand() * (b - a + 1)) + a;
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run the destructive seed in production.');
    process.exitCode = 1;
    return;
  }
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    console.error('❌ Seed clears application data. Set ALLOW_DESTRUCTIVE_SEED=true to confirm a non-production run.');
    process.exitCode = 1;
    return;
  }

  console.log('🌱 seeding…');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // wipe (order matters)
    await client.query(`TRUNCATE idempotency_keys, audit_log, webhook_events, surveys, notes, messages,
                        attachments, tickets, agent_categories, sla_rules, categories, api_keys, users
                        RESTART IDENTITY CASCADE`);

    // ── SLA rules ───────────────────────────────────────────
    const sla = [
      ['low',    24 * 60, 72 * 60],
      ['medium',  8 * 60, 48 * 60],
      ['high',    4 * 60, 24 * 60],
      ['urgent',  1 * 60,  8 * 60],
    ];
    for (const [p, r, res] of sla) {
      await client.query(
        'INSERT INTO sla_rules(priority, response_minutes, resolution_minutes) VALUES ($1,$2,$3)',
        [p, r, res]
      );
    }

    // ── users ───────────────────────────────────────────────
    const pw = await bcrypt.hash('Password123!', 10);

    const admin = (await client.query(
      `INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,'admin') RETURNING id`,
      ['admin@helpdesk.test', pw, 'Ava Admin']
    )).rows[0];

    const agentNames = ['Aria Agent','Ben Agent','Cara Agent','Dev Agent'];
    const agents = [];
    for (let i = 0; i < agentNames.length; i++) {
      const r = await client.query(
        `INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,'agent') RETURNING id`,
        [`agent${i + 1}@helpdesk.test`, pw, agentNames[i]]
      );
      agents.push(r.rows[0].id);
    }

    const customers = [];
    for (let i = 1; i <= 20; i++) {
      const r = await client.query(
        `INSERT INTO users(email,password_hash,full_name,role) VALUES ($1,$2,$3,'customer') RETURNING id`,
        [`customer${i}@helpdesk.test`, pw, `Customer ${i}`]
      );
      customers.push(r.rows[0].id);
    }

    // ── categories ──────────────────────────────────────────
    const cats = ['Billing','Technical','Account','Shipping','General'];
    const catIds = [];
    for (const name of cats) {
      const r = await client.query(
        'INSERT INTO categories(name,description) VALUES ($1,$2) RETURNING id',
        [name, `${name} issues`]
      );
      catIds.push(r.rows[0].id);
    }

    // agent → categories (all agents handle all)
    for (const a of agents) {
      for (const c of catIds) {
        await client.query('INSERT INTO agent_categories(agent_id,category_id) VALUES ($1,$2)', [a, c]);
      }
    }

    // ── tickets ─────────────────────────────────────────────
    const statuses = ['open','in_progress','waiting_on_customer','resolved','closed'];
    const priorities = ['low','medium','high','urgent'];
    const sampleSubjects = [
      'Cannot log in to my account',
      'Refund not received',
      'App crashes on startup',
      'Order delayed again',
      'Invoice amount is wrong',
      'Password reset link expired',
      'Payment failed but charged',
      'Feature request: dark mode',
      'Getting 500 error on checkout',
      'Wrong shipping address',
    ];
    const sampleMsgs = [
      'Hi, I need help with this.',
      'Thanks, any update?',
      'I have attached a screenshot.',
      'This is still not resolved.',
      'Great, that worked. Thank you!',
    ];

    const tickets = [];
    for (let i = 0; i < 60; i++) {
      const status = pick(statuses);
      const priority = pick(priorities);
      const createdBy = pick(customers);
      const assignedTo = ['open'].includes(status) ? null : pick(agents);
      const cat = pick(catIds);
      const createdAt = daysAgo(randInt(0, 30));

      const slaRow = (await client.query('SELECT * FROM sla_rules WHERE priority=$1', [priority])).rows[0];
      const responseDue = new Date(createdAt.getTime() + slaRow.response_minutes * 60000);
      const resolveDue  = new Date(createdAt.getTime() + slaRow.resolution_minutes * 60000);

      let resolvedAt = null, closedAt = null;
      if (status === 'resolved' || status === 'closed') {
        resolvedAt = new Date(createdAt.getTime() + randInt(1, 48) * 3600000);
        if (status === 'closed') closedAt = new Date(resolvedAt.getTime() + randInt(1, 72) * 3600000);
      }

      const firstResponseAt = assignedTo ? new Date(createdAt.getTime() + randInt(10, 300) * 60000) : null;
      const slaBreached = firstResponseAt ? firstResponseAt > responseDue : false;

      const t = (await client.query(
        `INSERT INTO tickets
         (subject,description,category_id,priority,status,created_by,assigned_to,
          sla_response_due_at,sla_resolve_due_at,first_response_at,
          sla_breached,resolved_at,closed_at,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          pick(sampleSubjects), 'Detailed description of the issue.', cat, priority, status,
          createdBy, assignedTo, responseDue, resolveDue, firstResponseAt,
          slaBreached, resolvedAt, closedAt, createdAt,
        ]
      )).rows[0];

      tickets.push(t);

      // conversation
      const n = randInt(1, 4);
      for (let m = 0; m < n; m++) {
        const senderIsCustomer = m === 0 || rand() > 0.5;
        const sender = senderIsCustomer ? createdBy : (assignedTo || pick(agents));
        const role = senderIsCustomer ? 'customer' : 'agent';
        await client.query(
          'INSERT INTO messages(ticket_id,sender_id,sender_role,body,created_at) VALUES ($1,$2,$3,$4,$5)',
          [t.id, sender, role, pick(sampleMsgs),
           new Date(createdAt.getTime() + (m + 1) * randInt(30, 600) * 60000)]
        );
      }

      // internal note
      if (assignedTo && rand() > 0.5) {
        await client.query(
          'INSERT INTO notes(ticket_id,author_id,body) VALUES ($1,$2,$3)',
          [t.id, assignedTo, 'Internal: customer is VIP, handle with care.']
        );
      }

      // survey for resolved/closed
      if (status === 'resolved' || status === 'closed') {
        await client.query(
          `INSERT INTO surveys(ticket_id,rating,comment,token,submitted_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [t.id, randInt(1, 5), 'Overall fine.', 'tok_' + t.id, new Date()]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ seed done');
    console.log(`   admin:    admin@helpdesk.test / Password123!`);
    console.log(`   agent:    agent1@helpdesk.test / Password123!`);
    console.log(`   customer: customer1@helpdesk.test / Password123!`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed failed', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();