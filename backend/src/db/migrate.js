const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
// Load backend/.env regardless of the directory the command was run from.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

async function run() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (rows.length) { console.log(`⏭  skip ${file}`); continue; }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`▶  applying ${file}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations(filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`✅ ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`❌ ${file} failed:`, err.message);
      process.exit(1);
    }
  }
  await pool.end();
  console.log('🏁 migrations complete');
}
run().catch((e) => { console.error(e); process.exit(1); });