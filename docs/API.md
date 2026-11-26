# API

Base URL: `/api`. Auth: `Authorization: Bearer <jwt>` unless noted.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` | `{full_name, email, password}` → always customer |
| POST | `/auth/login` | `{email, password}` → `{user, token}` |
| GET | `/auth/me` | returns current user |

## Tickets

| Method | Path | Roles |
|---|---|---|
| POST | `/tickets` | customer; multipart `subject, description, category_id, priority, attachments[]` |
| GET | `/tickets` | all; scoped: customer = own, agent = all (optional `mine=true`) |
| GET | `/tickets/summary` | all; ticket counts by status, scoped to customer when applicable |
| GET | `/tickets/:id` | all (customers only own) |
| GET | `/tickets/:id/attachments/:attachmentId` | authenticated ticket participant; downloads the attachment |
| POST | `/tickets/:id/assign-self` | agent |
| PATCH | `/tickets/:id/status` | agent/admin; body `{status}` |

Query params for `GET /tickets`: `status, priority, category_id, assigned_to, mine, search, page, limit`.

Ticket attachments are private and require a bearer token. Customers can download files only
from their own tickets; agents and admins can download ticket attachments. Uploads accept
PDF, JPEG, PNG, GIF, and WebP files, with a maximum of two files per ticket and the configured
per-file size limit.

## Messages / Notes

| Method | Path | Roles |
|---|---|---|
| GET | `/messages/:ticketId` | ticket participants |
| POST | `/messages/:ticketId` | ticket participants; `{body}` |
| GET | `/notes/:ticketId` | agent/admin |
| POST | `/notes/:ticketId` | agent/admin; `{body}` |

## Admin

| Method | Path |
|---|---|
| GET | `/admin/metrics` |
| GET, POST | `/admin/api-keys` |
| POST | `/admin/api-keys/:id/revoke` |
| GET, POST | `/admin/agents` |
| PATCH | `/admin/agents/:id/active` |
| GET, POST | `/categories` (POST admin-only) |
| PATCH, DELETE | `/categories/:id` |
| GET, PUT | `/sla` |
| GET | `/webhooks`, `/webhooks/:id` |
| POST | `/webhooks/:id/resend` |
| GET | `/audit` (admin-only) |
| GET | `/audit/ticket/:ticketId` (agents and admins) |

## Public (API key + idempotency)

**`POST /api/public/survey`**

Headers:
- `X-API-Key: <key>`
- `Idempotency-Key: <unique>`

Body:
```json
{ "token": "tok_<uuid>", "rating": 1, "comment": "optional" }
```