-- ============================================================
-- HelpDesk Lite — Initial Schema
-- Idempotent by design: every statement is safe to re-run, so a database
-- that already has this schema (but no _migrations record) heals instead of
-- failing, and a partial/failed first run can be retried.
-- No statement here modifies or deletes existing data.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  role           VARCHAR(20)  NOT NULL CHECK (role IN ('admin','agent','customer')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── CATEGORIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    VARCHAR(100) UNIQUE NOT NULL,
  description             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  last_assigned_agent_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SLA RULES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_rules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority           VARCHAR(20) UNIQUE NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
  response_minutes   INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── AGENT ↔ CATEGORY ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_categories (
  agent_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, category_id)
);

-- ── TICKETS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number         SERIAL UNIQUE,
  subject               VARCHAR(255) NOT NULL,
  description           TEXT NOT NULL,
  category_id           UUID NOT NULL REFERENCES categories(id),
  priority              VARCHAR(20) NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
  status                VARCHAR(30) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','waiting_on_customer','resolved','closed')),
  created_by            UUID NOT NULL REFERENCES users(id),
  assigned_to           UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_response_due_at   TIMESTAMPTZ,
  sla_resolve_due_at    TIMESTAMPTZ,
  first_response_at     TIMESTAMPTZ,
  sla_breached          BOOLEAN NOT NULL DEFAULT FALSE,
  sla_breach_notified   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at           TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status      ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority    ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category    ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned    ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by  ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at  ON tickets(created_at DESC);

-- ── ATTACHMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);

-- ── MESSAGES (public thread) ────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES users(id),
  sender_role  VARCHAR(20) NOT NULL CHECK (sender_role IN ('admin','agent','customer')),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id, created_at);

-- ── INTERNAL NOTES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_ticket ON notes(ticket_id, created_at);

-- ── SURVEYS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surveys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  token        VARCHAR(255) UNIQUE NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_surveys_ticket ON surveys(ticket_id);

-- ── API KEYS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  key_hash     VARCHAR(255) NOT NULL,
  key_prefix   VARCHAR(12)  NOT NULL,
  created_by   UUID NOT NULL REFERENCES users(id),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- ── WEBHOOK EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       VARCHAR(50) NOT NULL
                   CHECK (event_type IN ('ticket.created','ticket.status_changed','ticket.resolved','ticket.sla_breach')),
  ticket_id        UUID REFERENCES tickets(id) ON DELETE SET NULL,
  payload          JSONB NOT NULL,
  target_url       TEXT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','delivered','failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_retry_at    TIMESTAMPTZ,
  idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status     ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_events_ticket     ON webhook_events(ticket_id);

-- ── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   UUID REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_ticket ON audit_log(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id);

-- ── IDEMPOTENCY KEYS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         VARCHAR(255) PRIMARY KEY,
  endpoint    VARCHAR(255) NOT NULL,
  response    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated    ON users;
DROP TRIGGER IF EXISTS trg_tickets_updated  ON tickets;
DROP TRIGGER IF EXISTS trg_sla_updated      ON sla_rules;
DROP TRIGGER IF EXISTS trg_webhook_updated  ON webhook_events;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_updated  BEFORE UPDATE ON tickets        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sla_updated      BEFORE UPDATE ON sla_rules      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_webhook_updated  BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
