const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Routes (mounted as we build them) ────────────────────
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