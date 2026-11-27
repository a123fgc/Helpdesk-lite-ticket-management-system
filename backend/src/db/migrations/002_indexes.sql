-- ============================================================
-- 002 — indexes for proven query patterns
-- Backward compatible: additive only, no data is modified.
-- ============================================================

-- Round-robin assignment filters agent_categories by category_id alone
-- (see services/roundRobin.js). The composite PRIMARY KEY (agent_id,
-- category_id) cannot serve that lookup because category_id is not the
-- leading column, so every new ticket did a full scan of this table.
CREATE INDEX IF NOT EXISTS idx_agent_categories_category
  ON agent_categories (category_id);

-- The idempotency TTL sweep (services/idempotencyCleanup.js) deletes rows
-- older than the configured age on a schedule. An index on created_at keeps
-- that DELETE from scanning the whole table as it grows.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created
  ON idempotency_keys (created_at);
