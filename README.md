# Mini Job Queue Dashboard

A small full-stack app to create, track, and manage background jobs through a fixed status lifecycle. Built for the React + NestJS intern assignment.

**Stack:** NestJS 10 · TypeORM 0.3 · PostgreSQL · React (Vite) · TypeScript

---

> Backend runs on Render's free tier, which spins down after 15 minutes of inactivity. The first request after idle can take 30–60 seconds to respond — that's expected, not a bug.

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
```

Create a `.env` file:

```
VITE_API_URL=http://localhost:3000
```

Run it:

```bash
npm run dev
```

---

## API Reference

| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/jobs` | `{ title, type }` | 201, created job (status forced to `pending`) |
| GET | `/jobs` | — | 200, array of jobs |
| GET | `/jobs?status=running` | — | 200, filtered array |
| PATCH | `/jobs/:id/status` | `{ status }` | 200 updated job / 404 not found / 409 invalid transition |
| DELETE | `/jobs/:id` | — | 204 / 404 |
| GET | `/jobs/audit/flagged` | — | 200, array of flagged audit events |
| POST | `/jobs/:id/audit/recheck` | — | 200, re-evaluates a job's transition history |

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

## Bonus Feature: AI Audit Agent

Job queues in production don't just need to track state — they need to notice when something's behaving strangely. A job flipping between statuses several times a second, or getting hammered with the same illegal transition repeatedly, is usually a sign of a retry storm, a race condition slipping past validation, or a client misbehaving. The audit agent watches for that.

### How it works

```
status change comes in
        │
        ▼
 ┌─────────────────────┐
 │  Rule engine checks  │   deterministic, runs on every transition
 │  the job's recent    │   no external calls, always available
 │  transition history  │
 └──────────┬───────────┘
            │
     flagged? ──No──▶ log entry written, nothing further happens
            │
           Yes
            │
            ▼
 ┌─────────────────────┐
 │   Groq LLM call      │   only runs for flagged events
 │  generates a plain-  │   turns a reason code into a sentence
 │  English explanation │   a human can read at a glance
 └──────────┬───────────┘
            │
            ▼
   appended to audit.log
   + surfaced in the dashboard's audit panel
```

### What gets flagged

| Pattern | What it means |
|---|---|
| **Rapid flapping** | The same job changed status more than once within a few seconds — likely a race, a retry loop, or a script hammering the API |
| **Unusual timing** | A transition happened implausibly fast after the previous one — more consistent with an automated call than a human clicking a button |
| **Repeated illegal attempts** | Several rejected transitions on the same job in a short window — someone (or something) is trying to force an invalid state change |

### Why detection and explanation are separate

Detection is **rule-based and deterministic** on purpose. It has to run correctly on every single request, and it can't depend on a third-party API's latency or uptime — if the LLM call is slow, times out, or fails, the audit system should never miss a flag because of it.

The LLM is used only *after* a flag has already fired, purely to turn a machine-readable reason code into a short, readable sentence. If that call fails, the flag and its raw reason are still logged — the explanation is a nice-to-have layered on top of a system that works without it.

### Example

A job that's flipped from `pending → running → failed` twice within 3 seconds produces something like:

```json
{
  "timestamp": "2026-09-17T11:28:40.000Z",
  "jobId": "a1b2c3d4-...",
  "jobTitle": "nightly-report-export",
  "from": "running",
  "to": "failed",
  "flagged": true,
  "reasons": ["rapid_flapping: 3 transitions within 5000ms"]
}
```

Flagged events are visible live in the dashboard under the collapsible **"AI audit agent"** panel, and persisted to `audit.log` as newline-delimited JSON for anything that needs a fuller history than what's kept in memory.

---

## Assumptions & Trade-offs

- **No auth** — out of scope for this assignment; a real system would scope jobs per user/team.
- **No pagination on `GET /jobs`** — fine at demo scale.
- **Hard delete** — no restriction on deleting a running job, since the brief doesn't ask for it.
- **`synchronize: true`** in TypeORM — fine for a 2-day assignment; production would use committed migrations instead, since `synchronize` can silently alter or drop columns.
- **Audit log is a flat file**, not a database table — simplest option that satisfies "flag and log" without adding schema for a bonus feature; it also means the flagged-events list resets if the backend restarts, which is an acceptable trade-off at this scale.

