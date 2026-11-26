# Make.com Scenarios — HelpDesk Lite

Three scenarios. All free-tier (1,000 ops/mo is plenty for testing).

Prereqs:
1. Backend running on a **public URL** (Render free / Railway / ngrok).
2. An **API key** from Admin → API Keys. Copy once, store safe.
3. `WEBHOOK_SECRET` value from `backend/.env`.

> If you're on localhost during dev, expose with `ngrok http 5000` and use the https URL as `WEBHOOK_URL_*` in `backend/.env`.

---

## Scenario 1 — New ticket acknowledgement email

**Trigger**: Custom webhook

1. Create a new webhook, copy its URL → paste into `backend/.env` as `WEBHOOK_URL_TICKET_CREATED`.
2. Add a **Webhook response** module (HTTP 200) so the backend gets a fast ack.
3. Add a **Filter**: `event = ticket.created`.
4. Add **Gmail / Email → Send an email**:
   - To: `{{1.ticket.created_by}}` — but we only have the UUID. Fetch email via Make → **HTTP GET** `https://<backend>/api/tickets/{{1.ticket.id}}/email` with header `X-Make-Lookup-Key: <lookup key>`. (If you don't add this endpoint, use a static inbox for tests.)
   - Subject: `[#{{1.ticket.ticket_number}}] We received your request`
   - Body: