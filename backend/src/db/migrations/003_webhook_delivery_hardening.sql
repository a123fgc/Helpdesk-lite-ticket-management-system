-- Webhook delivery hardening:
--  * lease_until lets the retry worker claim rows atomically, so overlapping
--    cron ticks / multiple app instances / manual resend cannot deliver the
--    same event twice.
--  * last_attempt_at and failure_kind make failures explainable to admins.
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS lease_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_kind    VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_webhook_events_claim
  ON webhook_events(status, next_retry_at, lease_until)
  WHERE status = 'pending';

-- Legacy rows were retried regardless of the HTTP status. Stop the ones that
-- already recorded a permanent rejection immediately (HTTP 410 was common),
-- so this migration takes effect without waiting for another retry tick.
UPDATE webhook_events
   SET status = 'failed', next_retry_at = NULL, failure_kind = 'permanent'
 WHERE status = 'pending'
   AND last_error ~* '^HTTP (400|401|403|404|410)$';

UPDATE webhook_events
   SET failure_kind = 'permanent'
 WHERE failure_kind IS NULL
   AND last_error ~* '^HTTP (400|401|403|404|410)$';
