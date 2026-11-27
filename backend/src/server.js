const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { pool } = require('./config/db');
const { startCron, stopCron } = require('./jobs/cron');

let server = null;
let shuttingDown = false;

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('DB connected');
  } catch (err) {
    logger.error('DB connection failed:', err.message);
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
  });

  startCron();
}

/**
 * Graceful shutdown, in order:
 *   1. guard against duplicate signals (SIGTERM + SIGINT together)
 *   2. stop scheduling new cron work
 *   3. stop accepting new connections and release idle keep-alive sockets
 *   4. let in-flight requests finish, up to SHUTDOWN_TIMEOUT_MS
 *   5. close the HTTP server and the PostgreSQL pool
 *
 * Any failure is logged and never prevents the process from exiting.
 */
function shutdown(signal) {
  if (shuttingDown) {
    logger.warn(`${signal} received while already shutting down - ignoring`);
    return;
  }
  shuttingDown = true;
  logger.info(`${signal} received - shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error(`Shutdown timed out after ${env.shutdownTimeoutMs}ms - forcing exit`);
    process.exit(1);
  }, env.shutdownTimeoutMs);

  stopCron();

  if (!server) {
    return finish(forceExit);
  }

  // Node >= 18.2: drop idle keep-alive sockets so close() can complete.
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  server.close((err) => {
    if (err) logger.error('Error while closing HTTP server:', err.message);

    if (typeof server.closeAllConnections === 'function') {
      // Requests already drained (or we ran out of time); release the rest.
      server.closeAllConnections();
    }

    pool.end()
      .then(() => logger.info('DB pool closed'))
      .catch((poolErr) => logger.error('Error closing DB pool:', poolErr.message))
      .finally(() => finish(forceExit));
  });

  // Sockets still mid-request keep the server open; re-run this once the
  // deadline approaches so close() resolves even if a request hangs.
  const drain = setTimeout(() => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  }, Math.max(0, env.shutdownTimeoutMs - 1000));
  drain.unref();
}

function finish(timer) {
  clearTimeout(timer);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
