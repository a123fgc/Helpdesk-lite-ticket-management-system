const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { pool } = require('./config/db');
const { startCron } = require('./jobs/cron');

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('DB connected');
  } catch (err) {
    logger.error('DB connection failed:', err.message);
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
  });

  startCron();
}

start();