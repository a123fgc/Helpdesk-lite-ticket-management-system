# Database Schema

Source of truth: [`backend/src/db/migrations/`](../backend/src/db/migrations/)

| Migration | Contents |
|---|---|
| `001_init.sql` | Full initial schema (idempotent — safe to re-run) |
| `002_indexes.sql` | Indexes for proven query patterns (additive only) |

Apply with `npm run migrate` from `backend/`. Applied files are recorded in
`_migrations` and skipped on later runs.

PostgreSQL **13+**. `CREATE EXTENSION pgcrypto` supplies `gen_random_uuid()`.

---

## Entity-relationship overview

```
users ─┬─< tickets >── categories ──< agent_categories >── users (agent)
       │      │                        │
       │      ├──< attachments         └── last_assigned_agent_id → users
       │      ├──< messages
       │      ├──< notes
       │      ├──< surveys        (1:1, UNIQUE ticket_id)
       │      ├──< webhook_events (ON DELETE SET NULL)
       │      └──< audit_log      (ON DELETE CASCADE)
       │
       ├──< api_keys             (created_by)
       └──< agent_categories     (agent_id)

sla_rules          standalone, keyed by priority
idempotency_keys   standalone, keyed by client-supplied key
```

`→` = foreign key. `<` = one-to-many child.

---

## Tables

### `users`
Every account, all three roles.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` |
| `email` | VARCHAR(255) | **UNIQUE NOT NULL** |
| `password_hash` | VARCHAR(255) | NOT NULL (bcrypt) |
| `full_name` | VARCHAR(150) | NOT NULL |
| `role` | VARCHAR(20) | NOT NULL, `CHECK (role IN ('admin','agent','customer'))` |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `TRUE` (deactivated users cannot authenticate) |
| `created_at`, `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_users_role (role)`.

### `categories`
Ticket categories; also stores the round-robin cursor.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | **UNIQUE NOT NULL** |
| `description` | TEXT | nullable |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `TRUE` (deletion is a soft delete) |
| `last_assigned_agent_id` | UUID | FK → `users(id)` **ON DELETE SET NULL** — round-robin cursor |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

### `sla_rules`
One row per priority.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `priority` | VARCHAR(20) | **UNIQUE NOT NULL**, `CHECK IN ('low','medium','high','urgent')` |
| `response_minutes` | INTEGER | NOT NULL |
| `resolution_minutes` | INTEGER | NOT NULL |
| `created_at`, `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

### `agent_categories`
Which agents may receive tickets in which category — the input to round-robin
routing (`services/roundRobin.js`).

| Column | Type | Constraints |
|---|---|---|
| `agent_id` | UUID | FK → `users(id)` ON DELETE CASCADE, **part of PK** |
| `category_id` | UUID | FK → `categories(id)` ON DELETE CASCADE, **part of PK** |

- **PK `(agent_id, category_id)`** is what makes duplicate assignments
  impossible at the storage layer.
- Index: `idx_agent_categories_category (category_id)` (migration `002`) —
  the PK cannot serve lookups that filter on `category_id` alone, which is
  exactly what round-robin does on every new ticket.

### `tickets`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `ticket_number` | SERIAL | **UNIQUE** — monotonically increasing, gap-free per transaction rollback; never reset |
| `subject` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | NOT NULL |
| `category_id` | UUID | FK → `categories(id)` NOT NULL |
| `priority` | VARCHAR(20) | NOT NULL, `CHECK IN ('low','medium','high','urgent')` |
| `status` | VARCHAR(30) | NOT NULL DEFAULT `'open'`, `CHECK IN ('open','in_progress','waiting_on_customer','resolved','closed')` |
| `created_by` | UUID | FK → `users(id)` NOT NULL |
| `assigned_to` | UUID | FK → `users(id)` **ON DELETE SET NULL** (nullable = unassigned) |
| `sla_response_due_at`, `sla_resolve_due_at` | TIMESTAMPTZ | nullable |
| `first_response_at` | TIMESTAMPTZ | nullable |
| `sla_breached`, `sla_breach_notified` | BOOLEAN | NOT NULL DEFAULT `FALSE` |
| `resolved_at`, `closed_at` | TIMESTAMPTZ | nullable |
| `created_at`, `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Indexes: `status`, `priority`, `category_id`, `assigned_to`, `created_by`,
`created_at DESC`.

`ticket_number` is a PostgreSQL `SERIAL`, backed by a sequence. Generation is
atomic server-side, so concurrent inserts cannot collide and no application
level locking is required. Existing values and the sequence are preserved by
every migration in this project.

### `attachments`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → `tickets(id)` ON DELETE CASCADE |
| `uploaded_by` | UUID | FK → `users(id)` NOT NULL |
| `original_name`, `stored_name` | VARCHAR(255) | NOT NULL (`stored_name` is a server-generated UUID filename) |
| `mime_type` | VARCHAR(100) | nullable |
| `size_bytes` | BIGINT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_attachments_ticket (ticket_id)`.

### `messages`
The public customer ↔ agent thread.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → `tickets(id)` ON DELETE CASCADE |
| `sender_id` | UUID | FK → `users(id)` NOT NULL |
| `sender_role` | VARCHAR(20) | NOT NULL, `CHECK IN ('admin','agent','customer')` |
| `body` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_messages_ticket (ticket_id, created_at)`.

### `notes`
Internal notes — visible to agents and admins only, never to customers.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → `tickets(id)` ON DELETE CASCADE |
| `author_id` | UUID | FK → `users(id)` NOT NULL |
| `body` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_notes_ticket (ticket_id, created_at)`.

### `surveys`
Exactly one row per ticket, created when a ticket is resolved.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → `tickets(id)` ON DELETE CASCADE, **UNIQUE** (1:1) |
| `rating` | INTEGER | `CHECK (rating BETWEEN 1 AND 5)`, nullable until submitted |
| `comment` | TEXT | nullable |
| `token` | VARCHAR(255) | **UNIQUE NOT NULL** — 64 hex chars from `crypto.randomBytes(32)` |
| `submitted_at` | TIMESTAMPTZ | nullable (`NULL` = not yet answered; a second submission is refused) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Indexes: `idx_surveys_ticket (ticket_id)` plus the implicit unique indexes on
`ticket_id` and `token`.

> **Token migration.** Rows created before the fix still hold legacy
> `tok_<ticket-uuid>` tokens. They remain valid so links already emailed keep
> working; rotating them would break those links. New surveys always get a
> secure token. See “Manual actions” in the root README for the optional
> rotation script.

### `api_keys`
Admin-managed keys for the public API. Stored **hashed** (SHA-256); the raw
key is returned exactly once at creation.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | NOT NULL |
| `key_hash` | VARCHAR(255) | NOT NULL |
| `key_prefix` | VARCHAR(12) | NOT NULL (display only) |
| `created_by` | UUID | FK → `users(id)` NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `TRUE` |
| `last_used_at`, `revoked_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_api_keys_prefix (key_prefix)`.

### `webhook_events`
Outbound delivery log **and** retry queue.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `event_type` | VARCHAR(50) | NOT NULL, `CHECK IN ('ticket.created','ticket.status_changed','ticket.resolved','ticket.sla_breach')` |
| `ticket_id` | UUID | FK → `tickets(id)` **ON DELETE SET NULL** (event history survives ticket deletion) |
| `payload` | JSONB | NOT NULL |
| `target_url` | TEXT | NOT NULL |
| `status` | VARCHAR(20) | NOT NULL DEFAULT `'pending'`, `CHECK IN ('pending','delivered','failed')` |
| `attempts` | INTEGER | NOT NULL DEFAULT `0` |
| `last_error` | TEXT | nullable, URL-redacted |
| `next_retry_at` | TIMESTAMPTZ | nullable |
| `idempotency_key` | VARCHAR(255) | **UNIQUE NOT NULL** |
| `delivered_at` | TIMESTAMPTZ | nullable |
| `created_at`, `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Indexes: `status`, partial `(next_retry_at) WHERE status='pending'`,
`ticket_id`.

### `audit_log`
Append-only record of every change.

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `ticket_id` | UUID | FK → `tickets(id)` ON DELETE CASCADE |
| `actor_id` | UUID | FK → `users(id)` ON DELETE SET NULL (`NULL` = system actor) |
| `actor_role` | VARCHAR(20) | nullable |
| `action` | VARCHAR(60) | NOT NULL |
| `old_value`, `new_value` | JSONB | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Indexes: `(ticket_id, created_at DESC)`, `(actor_id)`.

### `idempotency_keys`
Replay cache for `POST` requests that send an `Idempotency-Key` header.

| Column | Type | Constraints |
|---|---|---|
| `key` | VARCHAR(255) | **PK** (client-supplied) |
| `endpoint` | VARCHAR(255) | NOT NULL |
| `response` | JSONB | nullable — `NULL` means the original request is still running |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

Index: `idx_idempotency_keys_created (created_at)` (migration `002`) — backs
the TTL sweep in `services/idempotencyCleanup.js`, which only ever deletes rows
older than `IDEMPOTENCY_TTL_HOURS`.

### `_migrations`
Managed by `src/db/migrate.js`, not by a migration file.

| Column | Type | Constraints |
|---|---|---|
| `filename` | VARCHAR(255) | PK |
| `applied_at` | TIMESTAMPTZ | NOT NULL DEFAULT `NOW()` |

---

## Triggers

`set_updated_at()` — `BEFORE UPDATE` on `users`, `tickets`, `sla_rules`,
`webhook_events`; sets `NEW.updated_at = NOW()`.

Recreated idempotently by `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` in
`001_init.sql`, so re-running the migration never fails on an existing trigger.

---

## Concurrency notes

- **Ticket numbers** come from a `SERIAL` sequence — safe under concurrent
  inserts, no application locking, never reset.
- **Round-robin cursor** (`categories.last_assigned_agent_id`) is a single
  `UPDATE`; a lost race between two concurrent assignments degrades to one
  repeated agent rather than an error.
- **Duplicate agent-category assignments** are impossible: the composite
  primary key rejects them before application code runs, and the API also
  checks explicitly for a clear `409`.
- **Idempotency claims** are taken with `INSERT … ON CONFLICT DO NOTHING`, so
  two concurrent requests with the same key cannot both execute.

---

## Indexing policy

Indexes are added only for a query pattern that actually exists:

| Index | Justification |
|---|---|
| `idx_agent_categories_category` | Round-robin filters by `category_id` alone; the PK leads with `agent_id` |
| `idx_idempotency_keys_created` | Recurring TTL sweep deletes by age |

A trigram (`pg_trgm`) GIN index for `ILIKE '%term%'` ticket search is **not**
installed by default: it requires an extension the hosting provider may not
permit, and the current table sizes do not justify it. See “Recommended next
steps” in the root README if ticket volume grows.
