# HelpDesk Lite

A compact customer-support help desk: customers open tickets, agents work a
shared queue with SLA tracking and internal notes, and admins configure
categories, SLA rules, API keys, webhooks and a full audit trail.

## Features

- **Three roles** — `customer`, `agent`, `admin`, enforced server-side on every
  request (the UI only hides what the API also refuses).
- **Ticket lifecycle** — `open → in_progress → waiting_on_customer → resolved
  → closed`, with validated transitions.
- **Round-robin assignment** — new tickets go to the next active agent assigned
  to that category; admins manage the assignments in the UI.
- **SLA engine** — per-priority response/resolution deadlines, breach detection
  on a schedule, auto-close of stale resolved tickets.
- **Public thread + internal notes** — customers and agents converse in the
  thread; notes are agent/admin only.
- **Attachments** — up to 2 files per ticket, magic-byte validated, stored
  under generated UUID names, downloaded only by ticket participants.
- **Surveys** — one unguessable token per resolved ticket, single-use
  submission through a key-protected public endpoint.
- **Webhooks** — four event types, HMAC-SHA256 signed, queued with exponential
  backoff retries and manual resend from the admin UI.
- **Audit log** — every change recorded with actor, old and new value.
- **Idempotency** — `Idempotency-Key` support with atomic claims and a TTL sweep.
- **Admin console** — metrics, agents, agent-categories, categories, SLA rules,
  API keys, webhook events, audit log.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, React Router 6, Vite 5, Tailwind CSS 3, Axios |
| Backend | Node.js 18+, Express 4, `pg`, JWT, bcrypt, multer, node-cron |
| Database | PostgreSQL 13+ (uses `pgcrypto`) |
| Tests | Node's built-in `node:test` runner — **no extra dependencies** |

## Project structure

```
helpdesk-lite/
├── README.md                 ← you are here
├── .gitignore                ← repo-wide ignore rules
├── docs/
│   ├── API.md                ← full API reference
│   ├── SCHEMA.md             ← database schema
│   └── MAKE_SCENARIOS.md     ← Make.com integration guide
├── backend/
│   ├── .env.example          ← every environment variable, documented
│   ├── scripts/check-syntax.js
│   └── src/
│       ├── app.js            ← Express app, middleware, route mounting
│       ├── server.js         ← listener + graceful shutdown
│       ├── config/           ← env, database pool
│       ├── db/               ← migrations, migrate runner, seed
│       ├── jobs/cron.js      ← SLA scan, webhook retries, TTL sweep
│       ├── middleware/       ← auth, roles, rate limits, idempotency, errors
│       ├── modules/          ← one folder per resource (routes/controller/service)
│       ├── services/         ← round-robin, SLA engine, webhooks, audit
│       └── utils/            ← logger, pagination, password, tokens
└── frontend/
    ├── .env.example
    └── src/
        ├── api/              ← axios client + endpoint map
        ├── components/       ← common UI + layout
        ├── context/          ← auth state
        ├── hooks/            ← useTickets, usePagination
        ├── pages/            ← customer / agent / admin screens
        └── routes/           ← ProtectedRoute
```

## Prerequisites

- **Node.js ≥ 18** (developed and tested on Node 24)
- **npm ≥ 9**
- **PostgreSQL 13+** (local, or a hosted instance such as Neon/Railway)

## Installation

```bash
git clone <repo-url> helpdesk-lite
cd helpdesk-lite

# backend
cd backend && npm install

# frontend
cd ../frontend && npm install
```

## Environment configuration

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`. **Required** values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs/verifies access tokens |
| `WEBHOOK_SECRET` | Signs outbound webhook bodies |

Generate strong secrets (never commit them):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Every variable is documented inline in
[`backend/.env.example`](backend/.env.example).

### Frontend

```bash
cd frontend
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Where the browser sends API requests |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | **Dev only** — where the Vite dev proxy forwards `/api` |

`VITE_*` values are compiled into the bundle and are therefore **public** —
never put secrets in them.

- **Development:** leave both at their defaults. `npm run dev` serves the app
  on `:5173` and proxies `/api` to `:5000`.
- **Production, same origin:** leave `VITE_API_BASE_URL=/api` and have your
  reverse proxy forward `/api` to Express. A production build **never** uses
  the Vite proxy — that config only exists for `vite dev`.
- **Production, separate origin:** set an absolute URL, e.g.
  `VITE_API_BASE_URL=https://api.example.com/api`, and set the backend's
  `CLIENT_ORIGIN` to the frontend origin so CORS allows the browser.

## Database setup

```bash
cd backend
npm run migrate
```

- Creates the schema if missing and records applied files in `_migrations`.
- `001_init.sql` is **idempotent** — re-running it against a database that
  already has the schema records it instead of failing.
- Migrations are additive and backward compatible; they never drop tables,
  never delete rows, and never reset the `ticket_number` sequence.

To verify what is applied:

```sql
SELECT filename, applied_at FROM _migrations ORDER BY filename;
```

## Seed instructions

Seeding **clears application data**. It is refused in production and requires
an explicit opt-in.

```bash
cd backend
ALLOW_DESTRUCTIVE_SEED=true npm run seed
```

Creates an admin, 4 agents, 20 customers, 5 categories, SLA rules and 60
sample tickets. Login details are printed at the end:

```
admin:    admin@helpdesk.test / Password123!
agent:    agent1@helpdesk.test / Password123!
customer: customer1@helpdesk.test / Password123!
```

> These are **development-only** credentials. Change them before deploying.

## Backend startup

```bash
cd backend
npm run dev      # nodemon, auto-reload
npm start        # plain node
```

The API listens on `http://localhost:5000` (or `PORT`). Health check:

```bash
curl http://localhost:5000/api/health
# {"status":"ok","db":"up","ts":1730000000000}
```

`503 {"status":"error","db":"down"}` means the database is unreachable — the
response deliberately contains no connection details.

## Frontend startup

```bash
cd frontend
npm run dev      # http://localhost:5173
```

## Testing

```bash
cd backend
npm test         # 97 unit tests + opt-in integration suite
npm run check    # syntax-check every file under src/, scripts/, test/
```

Tests use Node's built-in runner — nothing extra to install.

- **Unit tests** cover SLA calculations, status transitions, round-robin
  selection, authorization/role rules, survey-token generation, pagination and
  search validation, webhook signatures, backoff/retry, log redaction and
  error-handling status mapping. They run with **isolated configuration** and
  never read `backend/.env`.
- **Integration tests** (`test/integration.test.js`) exercise the real HTTP API
  — unauthorized requests, cross-customer access, agent-vs-agent restrictions,
  validation failures and database error mapping. They are **skipped unless**
  you provide a dedicated test database:

```bash
# isolated database only — never point this at production
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/helpdesk_test npm test
```

The suite creates its own tagged rows and deletes them afterwards; it never
truncates or modifies existing data.

## Documentation

| Document | Contents |
|---|---|
| [`docs/API.md`](docs/API.md) | Every endpoint, roles, request/response shapes, error codes, pagination, outbound webhook events and signature verification |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Tables, relationships, constraints, indexes, concurrency notes |
| [`docs/MAKE_SCENARIOS.md`](docs/MAKE_SCENARIOS.md) | Working Make.com scenarios, webhook configuration and signature verification |
| [`backend/.env.example`](backend/.env.example) | Every environment variable with safe placeholders |

## Deployment

1. **Database** — provision PostgreSQL; run `npm run migrate`.
2. **Backend environment** — set `NODE_ENV=production`, `DATABASE_URL`,
   `JWT_SECRET`, `WEBHOOK_SECRET`, `CLIENT_ORIGIN`, and the `WEBHOOK_URL_*`
   values you actually want.
3. **Behind a reverse proxy** — set `TRUST_PROXY=1` so rate limiting sees real
   client IPs.
4. **Run** — `npm start`. Send `SIGTERM` to shut down: the server stops
   accepting connections, drains in-flight requests (up to
   `SHUTDOWN_TIMEOUT_MS`, default 10 s), stops scheduled jobs, closes the HTTP
   server and the connection pool. Repeated signals are ignored.
5. **Frontend** — `npm run build`, then serve `frontend/dist` from any static
   host or reverse proxy, forwarding `/api` to the backend.
6. **Health check** — point your platform's health check at `GET /api/health`.
7. **Uploads** — persist `backend/uploads/` (or your `UPLOAD_DIR`); it is
   git-ignored and holds real user files.
8. **Secrets** — inject them from your platform's secret store, not from a
   committed file.

### Post-deploy checklist

- [ ] `GET /api/health` returns `200` with `db: "up"`
- [ ] Login works for admin, agent and customer
- [ ] `TRUST_PROXY` set if a proxy is in front
- [ ] `CLIENT_ORIGIN` exactly matches the deployed frontend origin
- [ ] Every intended `WEBHOOK_URL_*` is non-blank (the log warns otherwise)
- [ ] Platform health check wired to `/api/health`
- [ ] `backend/uploads` on persistent storage
- [ ] Development seed accounts disabled or re-passworded

---

## Security notes

### What the application enforces

- **Authorization** is checked server-side on every request. Customers can read
  only their own tickets, messages and attachments. Agents can only change
  status of or take over tickets that are unassigned or already theirs;
  admins may take over any ticket. Admin endpoints require the `admin` role.
- **Tokens are re-validated against the database on every request**, so
  deactivating a user revokes access immediately.
- **Password policy** — minimum 8 characters, common passwords rejected;
  hashed with bcrypt (cost 10).
- **Rate limiting** — 300 req/min globally, 10 req/min on login and signup.
- **Uploads** — max 2 files, size-limited, extension **and** magic-byte
  checked, stored under server-generated UUID names. Downloads re-verify
  ownership and resolve the path inside the upload root (path-traversal
  safe).
- **SQL** — every query is parameterised. Search input is length-limited and
  LIKE wildcards are escaped.
- **Errors** — 5xx responses return only `Internal server error`; SQL,
  connection strings and stack traces are logged server-side and never sent to
  a client.
- **Security headers** via Helmet; CORS restricted to `CLIENT_ORIGIN`.
- **Webhooks** are HMAC-SHA256 signed; delivery logs redact URLs.
- **Survey tokens** are 256-bit CSPRNG values, never derived from ticket IDs.
- **API keys** are stored SHA-256 hashed and shown exactly once.
- **Idempotency claims** are taken atomically, so concurrent replays cannot
  double-execute.

### Known trade-off: JWT in `localStorage`

The frontend stores the access token in `localStorage` (`hd_token`).

- **Risk:** an XSS bug would let an attacker read the token and call the API as
  that user until it expires.
- **Current mitigation:** short-ish `JWT_EXPIRES_IN`, HttpOnly is not used, and
  the server re-checks the user's active status on every request.
- **Recommended migration (not implemented — a partial migration would break
  login):** move to an `HttpOnly; Secure; SameSite=Lax` refresh cookie plus a
  short-lived in-memory access token, with `credentials: true` already enabled
  on CORS, a `SameSite`-aware CSRF token on state-changing routes, a
  `POST /api/auth/logout` that revokes the refresh token, and a matching
  frontend change to stop reading `localStorage`. This must be done end to end
  in one release: backend cookie issue/verify/revoke, CORS, CSRF, login/logout,
  frontend storage and session bootstrap. Do not ship it halfway.

### Secrets

`.env` is ignored at the repo root, in `backend/` and in `frontend/`. If a real
`.env` was ever committed, **adding it to `.gitignore` does not un-expose it** —
it stays in history. Rotate the exposed values and purge history separately.

---

## Manual actions required

These need a human decision and are therefore **not** performed automatically:

1. **Rotate any credential that was ever committed.** Specifically:
   `DATABASE_URL` (database password), `JWT_SECRET`, `WEBHOOK_SECRET`, and any
   API key ever printed or committed. Generate replacements with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Rotating `JWT_SECRET` signs everyone out; rotating `WEBHOOK_SECRET` makes
   receivers reject signatures until they update.
2. **Legacy survey tokens.** Surveys created before the fix still hold
   `tok_<ticket-uuid>` tokens. They remain valid so links already emailed keep
   working. To rotate the ones that have not been answered yet (this
   invalidates those links):

   ```sql
   UPDATE surveys SET token = encode(gen_random_bytes(32), 'hex')
    WHERE submitted_at IS NULL AND token LIKE 'tok_%';
   ```

3. **Set the `WEBHOOK_URL_*` values you want.** Blank means that event is not
   queued — by design, with an explicit warning in the log.
4. **Decide on the cookie-based authentication migration** above before
   production launch if XSS is a realistic threat model for you.

## Recommended next steps before production

- [ ] Rotate every secret listed above; inject them from a secret store
- [ ] Confirm no `.env` or key file is tracked: `git ls-files | grep -i env`
- [ ] Put the app behind HTTPS and set `TRUST_PROXY=1`
- [ ] Set a strict `CLIENT_ORIGIN`
- [ ] Enable database backups and TLS (`sslmode=require`)
- [ ] Ship `backend/uploads` on persistent storage
- [ ] Run the integration suite against a disposable test database
- [ ] Wire uptime monitoring to `GET /api/health`
- [ ] Review log volume and ship logs somewhere durable
- [ ] Consider the `pg_trgm` index if ticket volume grows (see
      [`docs/SCHEMA.md`](docs/SCHEMA.md#indexing-policy))
- [ ] Consider the HttpOnly-cookie authentication migration
