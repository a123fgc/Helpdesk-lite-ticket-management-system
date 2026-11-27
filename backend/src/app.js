const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const { query } = require('./config/db');
const { globalLimiter, authLimiter } = require('./middleware/rateLimits');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Required for express-rate-limit to see the real client IP when running
// behind a reverse proxy (Render, Railway, nginx, ...). Set TRUST_PROXY to
// the number of hops; leave unset when the app is directly exposed.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // This service serves JSON only (no HTML/JS), so a CSP would not protect
  // anything here. The React bundle is served by the frontend host, which is
  // where CSP belongs.
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(globalLimiter);

// health - verifies DB connectivity without leaking connection details
app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'up', ts: Date.now() });
  } catch {
    res.status(503).json({ status: 'error', db: 'down', ts: Date.now() });
  }
});

// Routes
// Credential endpoints get their own, much stricter limiter.
app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);

app.use('/api/auth',       require('./modules/auth/auth.routes'));
app.use('/api/users',      require('./modules/users/users.routes'));
app.use('/api/tickets',    require('./modules/tickets/tickets.routes'));
app.use('/api/messages',   require('./modules/messages/messages.routes'));
app.use('/api/notes',      require('./modules/notes/notes.routes'));
app.use('/api/categories', require('./modules/categories/categories.routes'));
app.use('/api/sla',        require('./modules/sla/sla.routes'));
app.use('/api/webhooks',   require('./modules/webhooks/webhooks.routes'));
app.use('/api/audit',      require('./modules/audit/audit.routes'));
app.use('/api/admin',      require('./modules/admin/admin.routes'));
app.use('/api/public',     require('./modules/public/public.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
