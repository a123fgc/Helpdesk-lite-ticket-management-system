
---

## 📄 `docs/SCHEMA.md` (short)

```markdown
# Schema

Full DDL: `backend/src/db/migrations/001_init.sql`.

| Table | Purpose |
|---|---|
| `users` | all roles |
| `categories` | ticket categories + round-robin cursor |
| `sla_rules` | per-priority response/resolution minutes |
| `agent_categories` | which agents handle which categories |
| `tickets` | ticket rows, SLA tracking, lifecycle timestamps |
| `attachments` | files tied to a ticket |
| `messages` | public customer ↔ agent thread |
| `notes` | internal, agent/admin only |
| `surveys` | one per ticket, token + rating 1–5 |
| `api_keys` | admin-managed, hashed |
| `webhook_events` | outbound event log + retry queue |
| `audit_log` | every change to a ticket |
| `idempotency_keys` | stores responses for POST replays |