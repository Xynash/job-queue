# Mini Job Queue Dashboard

A small full-stack app to create, track, and manage background jobs through a fixed status lifecycle. Built for the React + NestJS intern assignment.

**Stack:** NestJS 10 · TypeORM 0.3 · PostgreSQL · React (Vite) · TypeScript

---

## Live Links

- **Frontend:** _[add deployed URL]_
- **Backend/API:** _[add deployed URL]_
- **Repo:** https://github.com/Xynash/job-queue

---

## Job Status Flow

```
pending → running → completed
                   ↘ failed
```

`completed` and `failed` are terminal — no transitions out of them. `pending` can only move to `running`.

---

## Setup

### Backend

```bash
cd backend
npm install
```

Create a `.env` file (see `.env.example`):

```
DATABASE_URL=postgres://user:password@localhost:5432/jobqueue
PORT=3000
GROQ_API_KEY=your_groq_api_key
```

Run it:

```bash
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Update the API base URL in `src/api.ts` if your backend isn't running on `localhost:3000`.

---

## API Reference

| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/jobs` | `{ title, type }` | 201, created job (status forced to `pending`) |
| GET | `/jobs` | — | 200, array of jobs |
| GET | `/jobs?status=running` | — | 200, filtered array |
| PATCH | `/jobs/:id/status` | `{ status }` | 200 updated job / 404 not found / 409 invalid transition |
| DELETE | `/jobs/:id` | — | 204 / 404 |

**Job shape:**
```json
{
  "id": "uuid",
  "title": "string",
  "type": "string",
  "status": "pending | running | completed | failed",
  "createdAt": "ISO 8601 timestamp"
}
```

---

## Key Design Decision: Handling the Race Condition

The assignment asks what happens if two clients try to move the same `pending` job to `running` at the same time.

**The rule is enforced only on the backend.** The frontend disables buttons for illegal transitions as a UX nicety, but that has zero effect on correctness — the API re-validates every request regardless of who calls it (browser, curl, Postman, etc.).

Instead of reading a job's status in code and then writing (which leaves a race window where both requests can pass the check), the status update is a single atomic, conditional SQL update:

```sql
UPDATE jobs SET status = 'running'
WHERE id = :id AND status IN (:validFromStatuses)
```

Postgres only lets one concurrent request actually match and modify that row. If zero rows are affected, a follow-up check tells us why: job doesn't exist → `404`; job exists but wasn't in a valid starting state (illegal transition, or another request already won the race) → `409`.

Tested manually by firing the same `pending → running` request from two terminals at once — first got `200`, second got `409`.

---

## Validation

- `class-validator` DTOs + a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled.
- A client can't sneak a `status` field into `POST /jobs` — it's rejected with `400` (can't force-create a job in a non-pending state).
- `status` is also a Postgres `ENUM` at the DB level, so an invalid value can never be persisted.

---

## Bonus: AI Audit Agent

Every status change is reviewed for suspicious patterns:

- **Rapid flapping** — multiple transitions on the same job within a few seconds
- **Unusual timing** — a transition happening implausibly fast after the last one
- **Repeated illegal attempts** — several rejected transitions on the same job in a short window

Detection itself is **rule-based and deterministic** — it has to run reliably on every request without depending on an external API's latency or availability. For flagged events only, a Groq LLM call generates a short human-readable explanation of what was flagged and why, which is logged and shown in a collapsible panel on the dashboard. Keeping detection separate from explanation means the audit system still works correctly even if the LLM call is slow or fails.

Logged to `audit.log` as newline-delimited JSON; flagged events are also exposed via `GET /jobs/audit-log` for the UI panel.

---

## Assumptions & Trade-offs

- **No auth** — out of scope for this assignment; a real system would scope jobs per user/team.
- **No pagination on `GET /jobs`** — fine at demo scale.
- **Hard delete** — no restriction on deleting a running job, since the brief doesn't ask for it.
- **`synchronize: true`** in TypeORM — fine for a 2-day assignment; production would use committed migrations instead, since `synchronize` can silently alter or drop columns.
- **Audit log is a flat file**, not a database table — simplest option that satisfies "flag and log" without adding schema for a bonus feature.

With more time, I'd add auth, pagination, and move the audit log into the database so it survives across deployments.
