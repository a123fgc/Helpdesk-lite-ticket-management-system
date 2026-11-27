# Helpdesk Lite Project Plan

## Goal

Run a dependable customer support application where customers submit tickets,
agents resolve them, and administrators manage the support workflow.

## Current scope

- Customer, agent, and administrator accounts with role-based access.
- Ticket creation, assignment, status changes, messages, internal notes, and attachments.
- SLA tracking, audit history, customer surveys, and outbound webhooks.
- React frontend, Express API, and PostgreSQL database.

## Milestone 1: Complete production deployment

- [ ] Deploy the backend service from the `backend` directory on Railway.
- [ ] Confirm the backend starts with `npm start` and uses Railway's `PORT`.
- [ ] Apply all database migrations to the production database.
- [ ] Confirm `GET /api/health` reports the database as up.
- [ ] Deploy the frontend from the `frontend` directory on Vercel.
- [ ] Set Vercel's `VITE_API_BASE_URL` to the backend public URL followed by `/api`.
- [ ] Set the backend's `CLIENT_ORIGIN` to the exact frontend origin.
- [ ] Redeploy after environment variable or routing changes.
- [ ] Verify direct visits to `/login` and `/signup` load the React app.
- [ ] Verify login: valid credentials return success, invalid credentials return 401,
  and missing credentials return 400 rather than 404.

## Milestone 2: Production behavior checks

- [ ] Check ticket creation, assignment, replies, status changes, and attachment downloads
  with customer, agent, and administrator accounts.
- [ ] Confirm authorization prevents each role from accessing restricted actions.
- [ ] Confirm webhook events are queued, delivered, retried, and visible to administrators.
- [ ] Confirm scheduled SLA and cleanup jobs run without database errors.
- [ ] Check browser and server logs for request failures; never log credentials or tokens.

## Milestone 3: Operational readiness

- [ ] Configure and verify automated PostgreSQL backups and a restore procedure.
- [ ] Review Railway and Vercel deployment logs after each release.
- [ ] Record API response errors and latency so production problems can be diagnosed.
- [ ] Document the release steps and required environment variable names without storing
  secret values in the repository.

## Release acceptance criteria

- Frontend routes load directly on the deployed domain.
- Frontend API requests go to the deployed backend, not the frontend host.
- Backend health check succeeds and production migrations are current.
- Login and the core ticket workflow work with the correct role permissions.
- No secrets are committed, and deployment logs show no recurring application errors.
