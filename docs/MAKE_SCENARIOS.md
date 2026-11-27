# Make.com Scenarios — HelpDesk Lite

Three scenarios, all usable on Make's free tier (1,000 ops/month is plenty for
testing).

## Prerequisites

1. Backend reachable on a **public HTTPS URL** (Render / Railway / ngrok).
2. An **API key** from **Admin → API Keys**. Shown once at creation — store it
   somewhere safe.
3. The `WEBHOOK_SECRET` value from `backend/.env`.
4. If the Make **Webhooks** module has an API key configured, the same value in
   `MAKE_WEBHOOK_API_KEY` in `backend/.env`. It is sent as `x-make-apikey`; a
   missing or rotated key returns **HTTP 401**.
5. The four `WEBHOOK_URL_*` values set in `backend/.env` — a blank value means
   that event is **not** queued, and the backend logs an explicit warning
   naming the missing variable. A deleted/recreated Make hook returns **HTTP
   410**; copy the new URL into `.env` and restart — queued/failed events pick
   up the new URL automatically.

```bash
# local development
ngrok http 5000
# then set, in backend/.env:
#   WEBHOOK_URL_TICKET_CREATED=https://<ngrok-id>.ngrok-free.app/hooks/ack
#   WEBHOOK_URL_STATUS_CHANGED=https://<ngrok-id>.ngrok-free.app/hooks/status
#   WEBHOOK_URL_TICKET_RESOLVED=https://<ngrok-id>.ngrok-free.app/hooks/resolved
#   WEBHOOK_URL_SLA_BREACH=https://<ngrok-id>.ngrok-free.app/hooks/breach
```

Restart the backend after changing `.env`.

> **Endpoints used below — all of these exist.** Anything else is just Make's
> own modules (Gmail, HTTP, Webhooks).
>
> | Direction | Endpoint |
> |---|---|
> | Out (backend → Make) | `POST <your Make webhook URL>` — a *Custom webhook* trigger |
> | In (Make → backend) | `POST /api/public/survey` |

---

## Verifying webhook signatures (do this in every scenario)

Every outbound request carries:

```
X-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with WEBHOOK_SECRET>
X-Event-Type: ticket.status_changed
X-Event-Id: <idempotency key>
X-Attempt: 1
x-make-apikey: <MAKE_WEBHOOK_API_KEY, when configured>
```

Duplicate/no-op events generated within `WEBHOOK_IDEMPOTENCY_WINDOW_MS`
(default 60 s) share one `X-Event-Id` and are queued only once. Use that header
in Make as a deduplication key if your scenario can be replayed.

### In Make

1. Add a **Webhooks → Custom webhook** trigger and copy its URL into the
   matching `WEBHOOK_URL_*` variable.
2. Immediately after the trigger, add **Tools → Parse JSON** (or a *Router*
   filter on `event`) so you can branch per event type.
3. Add **Crypto → Generate HMAC**:
   - Algorithm: `SHA256`
   - Secret: `WEBHOOK_SECRET` (store it in a Make **Data store**, not in the
     scenario inline)
   - Value: the **raw body string** Make received.
4. Compare the result with the incoming `X-Signature` header using **Tools →
   Compare** (`sha256=` + HMAC must equal the header) and **filter** the route
   so unsigned requests are dropped.

> Sign the raw bytes as received. Re-serialising parsed JSON changes key order
> and whitespace, and the signature will no longer match.

### Reference implementations

```js
// Node.js
const expected = 'sha256=' + crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(rawRequestBody)          // Buffer or string, not re-stringified JSON
  .digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
```

```python
# Python
import hmac, hashlib
expected = "sha256=" + hmac.new(SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
ok = hmac.compare_digest(expected, received_header)
```

---

## Scenario 1 — New ticket acknowledgement email

**Trigger**: Custom webhook · **Event**: `ticket.created`

1. In Make, create **Webhooks > Custom webhook** and copy its URL.
2. Set it in backend env and restart backend:
   ```env
   WEBHOOK_URL_TICKET_CREATED=https://hook.<region>.make.com/<id>
   ```
3. Add **Webhooks > Webhook response** with status `200` (the backend has a 10s delivery timeout).
4. (Recommended) Verify `X-Signature` as shown above.
5. Send email with **Gmail / Email / Microsoft 365 Email**:
   - **To**: `{{1.ticket.created_by_email}}`
   - **Subject**: `[#{{1.ticket.ticket_number}}] We received your request`
   - **Body**:
     ```text
     Hi {{1.ticket.created_by_name}},

     We've received your support request: "{{1.ticket.subject}}".
     Ticket: #{{1.ticket.ticket_number}}
     Priority: {{1.ticket.priority}}
     Category: {{1.ticket.category_name}}

     Our team will get back to you shortly.
     ```

Payload fields available: `ticket.created_by_email`, `ticket.created_by_name`, `ticket.ticket_number`, `ticket.subject`, `ticket.priority`, `ticket.category_name`, `ticket.description`, `ticket.status`.

---

## Scenario 2 — Post new tickets to Slack / Discord / Telegram (urgent handled differently)

**Trigger**: Custom webhook · **Event**: `ticket.created`

You can reuse the same Make webhook URL as Scenario 1 or create a separate one. The same `ticket.created` event can drive multiple Make scenarios.

1. Add **Webhooks > Custom webhook** (or reuse the Scenario 1 webhook).
2. Add **Webhooks > Webhook response** `200`.
3. Add a **Router** with filters on `{{1.ticket.priority}}`:
   - **Urgent path**: filter `ticket.priority` Equal to `urgent`
   - **Normal path**: all other priorities
4. **Urgent path** (handle differently): send a high-visibility alert.
   - **Slack**: post to an urgent/on-call channel, e.g. `:rotating_light: URGENT ticket #{{1.ticket.ticket_number}} — {{1.ticket.subject}} ({{1.ticket.category_name}}) from {{1.ticket.created_by_name}}`
   - **Discord**: post to an urgent channel with `@here`/role mention as your policy allows.
   - **Telegram**: send message to an ops chat/group.
5. **Normal path**: post a standard new-ticket notification.
   - **Slack**: `:ticket: New ticket #{{1.ticket.ticket_number}} — {{1.ticket.subject}} ({{1.ticket.priority}})`
   - **Discord**: normal channel message.
   - **Telegram**: normal chat message.

Suggested message fields: `ticket.ticket_number`, `ticket.subject`, `ticket.priority`, `ticket.status`, `ticket.category_name`, `ticket.created_by_name`, `ticket.created_by_email`.

---

## Scenario 3 — SLA breach alert

**Trigger**: Custom webhook · **Event**: `ticket.sla_breach`

1. Create a Make webhook → `WEBHOOK_URL_SLA_BREACH` in `backend/.env`.
2. Add **Webhooks > Webhook response** `200`.
3. **Filter**: `event` = `ticket.sla_breach`.
4. **Slack / Discord / Telegram / Email** alert:
   - Text: `:rotating_light: SLA breached on #{{1.ticket.ticket_number}} — {{1.ticket.subject}} ({{1.ticket.priority}})`
   - Include `{{1.reason}}`, `{{1.sla_response_due_at}}`, `{{1.sla_resolve_due_at}}`.

The backend fires this once per ticket: it flips `sla_breach_notified` before
queueing, so a breach is never announced twice.

---

## Scenario 4 — Satisfaction survey (1–5) when ticket is resolved

**Trigger**: Custom webhook · **Event**: `ticket.resolved`  
**Callback**: `POST /api/public/survey` (API key + Idempotency-Key required)

When a ticket is resolved, the backend emits `ticket.resolved` and includes a one-time `survey_token` (64 hex chars, unguessable). Use Make.com to send the survey to the customer, then post the rating back to the HelpDesk Lite API.

### Step A — Send survey on resolution

1. Create a Make webhook → set `WEBHOOK_URL_TICKET_RESOLVED` in `backend/.env`, restart backend.
2. Add **Webhooks > Webhook response** `200`.
3. Send a customer email/message with a 1–5 rating link or form:
   - **To**: `{{1.ticket.created_by_email}}`
   - **Subject**: `How did we do? Ticket #{{1.ticket.ticket_number}}`
   - **Body** example:
     ```text
     Hi {{1.ticket.created_by_name}},

     Your ticket #{{1.ticket.ticket_number}} ("{{1.ticket.subject}}") has been resolved.

     Please rate your experience (1-5):
     https://your-survey-host/survey?token={{1.survey_token}}
     ```

You can host the rating form in Make.com (Webhook/Instant trigger), a simple page, or a form tool. The important part is submitting the selected rating to the API below.

### Submit the rating (Make HTTP module)

```
POST https://<backend>/api/public/survey
Headers:
  X-API-Key:            <your API key>
  Idempotency-Key:       <any unique string, e.g. survey-{{1.survey_token}}-{{random()}}>
  Content-Type:         application/json
Body (raw JSON):
  {"token": "{{surveyToken}}", "rating": 5, "comment": "Optional feedback"}
```

**Both headers are mandatory.** Missing `X-API-Key` → `401`; missing
`Idempotency-Key` → `400`.

| Response | Meaning |
|---|---|
| `200 {"survey":{…}}` | Accepted |
| `200 {"already_submitted":true,…}` | This survey was already answered — the original result is returned, nothing is overwritten |
| `404` | Unknown or mistyped token |
| `400` | `rating` not in 1–5, or a required header is missing |

`rating` must be an integer from 1 to 5.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing arrives in Make | `WEBHOOK_URL_*` is blank | Set it in `backend/.env` and restart. The log will say `webhook NOT queued for "…" … Set WEBHOOK_URL_…`. |
| Events arrive, then stop | Delivery marked `failed` after `WEBHOOK_MAX_RETRIES` | Check **Admin → Webhook events** for `last_error`, fix the receiver, then press **Resend** |
| `429` from Make | Make's free-tier rate limit | Nothing to fix server-side; reduce event volume |
| Signature mismatch | Body was re-serialised before hashing | HMAC the raw body bytes exactly as received |
| `401` on `/api/public/survey` | Missing/invalid `X-API-Key`, or key revoked | Create a new key in **Admin → API Keys** |
| `400` on `/api/public/survey` | Missing `Idempotency-Key` header | Add a unique value per submission |
| No events at all, no warning either | Backend not restarted after `.env` changes | Restart the backend |

Full payload and header reference: [`docs/API.md`](./API.md#outbound-webhooks).
