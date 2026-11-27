# API Reference

Base URL: **`/api`**

All request and response bodies are JSON (`Content-Type: application/json`),
except `POST /api/tickets`, which is `multipart/form-data`.

---

## Authentication

| Scheme | Used by | Header |
|---|---|---|
| JWT (Bearer) | The React app and any script acting as a logged-in user | `Authorization: Bearer <token>` |
| API key | The public/integration API (`/api/public/*`) | `X-API-Key: <key>` |
| Idempotency key | Required alongside API keys on `POST /api/public/*` | `Idempotency-Key: <unique value>` |

Obtain a JWT from `POST /api/auth/login` or `POST /api/auth/signup`. Tokens
expire after `JWT_EXPIRES_IN`. The role attached to a token is re-read from the
database on **every** request, so deactivating a user invalidates their session
immediately even while the token is still unexpired.

### Roles

| Role | Scope |
|---|---|
| `customer` | Only their own tickets, messages and attachments. Cannot read internal notes, audit data, or change ticket status. |
| `agent` | The whole ticket queue for reading. May **only** change status of, or take ownership of, tickets that are unassigned or already assigned to them. Full access to internal notes. |
| `admin` | Everything, including agent/category/SLA/API-key/webhook/audit administration and taking over any ticket. |

### Rate limits

| Scope | Limit |
|---|---|
| Global, every endpoint | 300 requests / minute / IP |
| `POST /api/auth/login`, `POST /api/auth/signup` | 10 requests / minute / IP |

Set `TRUST_PROXY` on the backend when it runs behind a reverse proxy, otherwise
all requests appear to come from the proxy's IP.

---

## Error responses

Every failure returns the same shape:

```json
{ "error": "human readable message", "details": { "optional": "extra context" } }
```

| Status | Meaning |
|---|---|
| `400` | Validation failure, malformed JSON, invalid UUID, invalid pagination/search |
| `401` | Missing, malformed, expired or forged token; missing/invalid API key |
| `403` | Authenticated but not permitted for this role or resource |
| `404` | Resource does not exist, or the caller may not know it exists |
| `409` | Conflict — duplicate idempotency key in flight, duplicate assignment |
| `413` | Request body exceeds 2 MB |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error. The body is always the generic string `Internal server error`; details are logged server-side only and never returned. |

---

## Pagination

List endpoints that return a collection accept:

| Query param | Default | Bounds |
|---|---|---|
| `page` | `1` | integer ≥ 1, ≤ 100000 → otherwise `400` |
| `limit` | `20` | integer ≥ 1, ≤ 100 (larger values are clamped, not rejected) |

Response envelope:

```json
{ "data": [ ... ], "page": 1, "limit": 20, "total": 137 }
```

---

## Endpoints

### Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | Checks database connectivity. `200 {"status":"ok","db":"up"}` when healthy, `503 {"status":"error","db":"down"}` when not. Contains no connection details. |

### Auth

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/signup` | none (rate-limited) | `{full_name, email, password}` → `201 {user, token}`. Always creates a **customer**. Password must be ≥ 8 characters and not a common password. |
| POST | `/auth/login` | none (rate-limited) | `{email, password}` → `{user, token}` |
| GET | `/auth/me` | JWT | Current user (`id, email, full_name, role, created_at`) |

### Tickets

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/tickets` | customer | `multipart/form-data`: `subject`, `description`, `category_id`, `priority`, optional `attachments[]` (max 2: PDF/JPEG/PNG/GIF/WebP). → `201` ticket |
| GET | `/tickets` | all | Scoped: customers see only their own; agents/admins see everything. |
| GET | `/tickets/summary` | all | `{total, by_status}`; scoped to the caller for customers |
| GET | `/tickets/:id` | all (customers: own only) | Includes `attachments[]` |
| GET | `/tickets/:id/attachments/:attachmentId` | ticket participant | Streams the file with its original name |
| POST | `/tickets/:id/assign-self` | agent, admin | Takes ownership. An **agent** gets `403` if another agent already owns the ticket; an **admin** may take over any ticket. |
| PATCH | `/tickets/:id/status` | agent, admin | Body `{status}`. Customers always get `403`. |

`GET /tickets` query params: `status`, `priority`, `category_id`, `assigned_to`,
`unassigned=true`, `mine=true`, `search`, `page`, `limit`.

- `search` is limited to **200 characters** (`400` beyond that). `%`, `_` and
  `\` are escaped, so the term matches literally rather than as a wildcard.
- Search matches `subject`, `description`, or an exact `ticket_number`.

**Status transitions** (enforced for agents; admins may set any status):

```
open                → in_progress
in_progress         → waiting_on_customer | resolved
waiting_on_customer → in_progress | resolved
resolved            → closed | in_progress
closed              → (terminal)
```

Transitioning to the same status is always allowed. Any other illegal
transition returns `400`. An unknown status value returns `400`.

### Messages (public ticket thread)

| Method | Path | Roles |
|---|---|---|
| GET | `/messages/:ticketId` | any authenticated user; customers only for their own tickets |
| POST | `/messages/:ticketId` | same; body `{body}` |

An agent/admin reply sets `first_response_at` (once) and moves `open` →
`in_progress`. A customer reply moves `waiting_on_customer` → `in_progress`.

### Notes (internal — never visible to customers)

| Method | Path | Roles |
|---|---|---|
| GET | `/notes/:ticketId` | agent, admin |
| POST | `/notes/:ticketId` | agent, admin; body `{body}` |

A ticket that does not exist returns `404`.

### Categories

| Method | Path | Roles |
|---|---|---|
| GET | `/categories` | any authenticated user (customers need it to open a ticket). `?include_inactive=true` includes deactivated rows. |
| POST | `/categories` | admin; `{name, description}` |
| PATCH | `/categories/:id` | admin; `{name?, description?, is_active?}` |
| DELETE | `/categories/:id` | admin — **soft delete**: sets `is_active=false` |

### Users

| Method | Path | Roles |
|---|---|---|
| GET | `/users/agents` | agent, admin — active agents (`id, email, full_name, is_active`) |

### SLA rules

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/sla` | admin | — |
| PUT | `/sla` | admin | `{priority, response_minutes, resolution_minutes}` — upserts; both minutes must be > 0 |

### Webhooks (delivery log)

| Method | Path | Roles |
|---|---|---|
| GET | `/webhooks` | admin — filters: `status`, `event_type`, `ticket_id`, `page`, `limit` |
| GET | `/webhooks/:id` | admin — includes `payload` and `last_error` |
| POST | `/webhooks/:id/resend` | admin — resets attempts and delivers immediately |

### Audit log

| Method | Path | Roles |
|---|---|---|
| GET | `/audit` | admin — filters: `ticket_id`, `actor_id`, `action`, `from`, `to`, `page`, `limit` |
| GET | `/audit/ticket/:ticketId` | agent, admin |

### Admin

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/admin/metrics` | admin | — |
| GET | `/admin/api-keys` | admin | — |
| POST | `/admin/api-keys` | admin | `{name}` → `201` with `key` **shown once** |
| POST | `/admin/api-keys/:id/revoke` | admin | — |
| GET | `/admin/agents` | admin | All agents including disabled ones |
| POST | `/admin/agents` | admin | `{email, password, full_name}` — password ≥ 8 chars |
| PATCH | `/admin/agents/:id/active` | admin | `{is_active: boolean}` |

#### Agent ↔ category assignments

These rows drive round-robin routing: the next ticket in a category goes to the
next *assigned, active* agent for that category.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/admin/agent-categories` | admin | Optional `?agent_id=<uuid>` filter. Returns rows with denormalised names. |
| POST | `/admin/agent-categories` | admin | `{agent_id, category_id}` → `201` |
| DELETE | `/admin/agent-categories/:agentId/:categoryId` | admin | → `200` |

Responses and errors:

- `400` — `agent_id`/`category_id` missing
- `404` — agent does not exist, is not an `agent` role, or category does not exist
- `409` — that assignment already exists
- `404` on DELETE — assignment does not exist

Removing an assignment also clears the category's round-robin cursor when the
cursor still points at the removed agent. All mutations run inside a
transaction.

Example row:

```json
{
  "agent_id": "3f1c…",
  "category_id": "9a2b…",
  "agent_name": "Aria Agent",
  "agent_email": "agent1@helpdesk.test",
  "agent_active": true,
  "category_name": "Billing",
  "category_active": true
}
```

### Public API (Make.com and other integrations)

#### `POST /api/public/survey`

Headers:

```
X-API-Key: <key from Admin → API Keys>
Idempotency-Key: <any unique string>
Content-Type: application/json
```

Body:

```json
{ "token": "<64-hex survey token>", "rating": 5, "comment": "optional" }
```

Responses:

| Status | Meaning |
|---|---|
| `200` | Submitted. Body: `{"survey": {...}}` |
| `200` | Already answered: `{"already_submitted": true, "survey": {...}}` |
| `400` | Missing token, or `rating` outside 1–5, or missing `Idempotency-Key` |
| `401` | Missing or invalid API key |
| `404` | Token does not exist |
| `409` | Same `Idempotency-Key` is currently being processed |

`rating` must be an integer 1–5. Each survey can be submitted **once**;
subsequent calls return the stored result rather than overwriting it.

---

## Outbound webhooks

Configured through `WEBHOOK_URL_*` in `backend/.env` — see
[`backend/.env.example`](../backend/.env.example).

| Event | Environment variable | Fired when |
|---|---|---|
| `ticket.created` | `WEBHOOK_URL_TICKET_CREATED` | A ticket is created |
| `ticket.status_changed` | `WEBHOOK_URL_STATUS_CHANGED` | Status changes, including self-assignment that flips `open` → `in_progress` and auto-close |
| `ticket.resolved` | `WEBHOOK_URL_TICKET_RESOLVED` | Status becomes `resolved`; payload includes `survey_token` |
| `ticket.sla_breach` | `WEBHOOK_URL_SLA_BREACH` | The SLA scan first detects a breach |

**If a variable is blank the event is not queued**, and an explicit warning is
written to the log naming the missing variable — a missing configuration never
looks like success.

### Request

```
POST <configured URL>
Content-Type: application/json
X-Event-Type: ticket.status_changed
X-Event-Id: <idempotency key>
X-Signature: sha256=<hex HMAC-SHA256>
X-Attempt: 1
x-make-apikey: <MAKE_WEBHOOK_API_KEY, when configured>
```

```json
{
  "event": "ticket.status_changed",
  "event_id": "ticket.status_changed:<ticket uuid>:<stable 32-char digest>",
  "occurred_at": "2026-01-01T12:00:00.000Z",
  "ticket": {
    "id": "…",
    "ticket_number": 42,
    "subject": "…",
    "description": "…",
    "category_id": "…",
    "category_name": "Billing",
    "priority": "high",
    "status": "in_progress",
    "created_by": "…",
    "created_by_name": "Jane Customer",
    "created_by_email": "jane@example.com",
    "assigned_to": "…",
    "assigned_to_name": "Alex Agent",
    "created_at": "…",
    "updated_at": "…"
  },
  "from": "open",
  "to": "in_progress",
  "actor": "<user uuid or 'system'>"
}
```

Event-specific extra fields: `survey_token` (`ticket.resolved`), `reason` /
`sla_response_due_at` / `sla_resolve_due_at` (`ticket.sla_breach`). The ticket
payload also includes best-effort enrichment fields (`created_by_name`,
`created_by_email`, `assigned_to_name`, `category_name`) for automation consumers.

### Verifying the signature

```
expected = "sha256=" + HMAC_SHA256(raw_request_body, WEBHOOK_SECRET) hex
```

Compare with a **timing-safe** comparison. Sign the raw body bytes exactly as
received — do not re-serialize the parsed JSON first, or the signature will not
match.

### Delivery and retries

- Any 2xx response = delivered.
- **Permanent errors are never retried**: HTTP 400, 401, 403, 404 and 410
  immediately mark the event `failed` with `next_retry_at = NULL`.
- **Transient errors** (network failures/timeouts, 429, 408, 425 and all 5xx)
  retry with exponential backoff `base × 2^(attempt−1)`
  (`WEBHOOK_BASE_DELAY_MS`, default 60 s), capped at 6 hours, up to
  `WEBHOOK_MAX_RETRIES` (default 5) attempts, after which the event is marked
  `failed`.
- Retries are driven by a cron worker (`WEBHOOK_RETRY_CRON`, default every
  minute). Rows are atomically leased (`FOR UPDATE SKIP LOCKED`) so overlapping
  workers cannot deliver the same event twice.
- The current `WEBHOOK_URL_*` value always wins over the URL stored on an old
  event, so pasting a fresh Make.com URL and restarting fixes queued and failed
  events too.
- `POST /api/webhooks/:id/resend` only accepts events whose status is `failed`
  (404 = unknown, 409 = not eligible/already in progress). It returns **200**
  only when Make accepted the event; an external failure returns **502** with a
  redacted reason in `error`.
- Admin list/detail endpoints return a masked `target_url` and redact token /
  secret fields in the payload. `last_error` stores a redacted reason (HTTP
  status, error code, or a message with URLs stripped). Target URLs and secrets
  are never written to the log.
