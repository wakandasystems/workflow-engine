# Submission & Approval Workflow

A two-sided web application for a generic request submission and approval process. Applicants submit applications and track their status. Reviewers see incoming applications and approve, reject, or return them for changes — with a full audit trail.

**Assignment B** from the Full-Stack Developer Technical Assessment.

## Live Demo

> **URL:** _[to be added after deployment]_
>
> **Test Credentials:**
> | Role | Email | Password |
> |------|-------|----------|
> | Applicant | `applicant@example.com` | `password123` |
> | Applicant 2 | `applicant2@example.com` | `password123` |
> | Reviewer | `reviewer@example.com` | `password123` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router |
| Backend | Node.js + Express 5 + TypeScript |
| Database | MySQL 8.0 |
| ORM | Prisma (schema-first, auto-migrations) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Validation | Zod (backend), HTML5 + client-side (frontend) |
| Testing | Vitest + Supertest |
| Containerization | Docker Compose |

---

## Running Locally

### Prerequisites

- Node.js 20+
- MySQL 8.0 running locally (or use Docker Compose)

### Option A: Docker Compose (database + backend)

```bash
docker-compose up -d
```

This starts MySQL and the backend on port 3001. Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Option B: Manual Setup

**1. Database**

Ensure MySQL is running and create the database:

```sql
CREATE DATABASE IF NOT EXISTS form_engine;
```

**2. Backend**

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Backend starts on http://localhost:3001

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on http://localhost:5173

---

## Data Model

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│    users     │     │  applications    │     │  audit_logs  │
├──────────────┤     ├──────────────────┤     ├──────────────┤
│ id (UUID PK) │◄────│ applicant_id FK  │     │ id (UUID PK) │
│ email        │     │ id (UUID PK)     │◄────│ application_id│
│ password_hash│     │ title            │     │ actor_id FK  │
│ name         │     │ category         │     │ old_status   │
│ role (enum)  │     │ description      │     │ new_status   │
│ created_at   │     │ amount           │     │ comment      │
└──────────────┘     │ status (enum)    │     │ created_at   │
                     │ created_at       │     └──────────────┘
                     │ updated_at       │
                     └──────────────────┘
```

### Key Schema Decisions

- **UUIDs for primary keys** — avoids enumeration attacks and works well for distributed systems.
- **Enum for status** — database-level constraint ensures only valid statuses can exist; the state machine logic is enforced in application code.
- **Enum for roles** — simple two-role system (APPLICANT, REVIEWER) enforced at the database level.
- **Audit log as append-only table** — every status transition is recorded with actor, old/new status, optional comment, and timestamp. Never updated or deleted.
- **MySQL with Prisma** — Prisma provides type-safe queries, automatic migrations, and a clean schema-first workflow.

---

## Workflow State Machine

```
DRAFT ──submit──► SUBMITTED ──start_review──► UNDER_REVIEW ──approve──► APPROVED
  ▲                                              │
  └────────── return_for_changes ◄───────────────┤
                                                 └──reject──► REJECTED
```

### Transition Rules

| Action | From | To | Who | Comment Required |
|--------|------|-----|-----|:---:|
| `submit` | DRAFT | SUBMITTED | Owner (Applicant) | No |
| `start_review` | SUBMITTED | UNDER_REVIEW | Reviewer | No |
| `approve` | UNDER_REVIEW | APPROVED | Reviewer | No |
| `reject` | UNDER_REVIEW | REJECTED | Reviewer | Yes |
| `return_for_changes` | UNDER_REVIEW | DRAFT | Reviewer | Yes |

### Enforcement

- **State machine is a pure function** (`validateTransition`) — easy to test, no side effects.
- **Role checks** — the transition table defines which role can perform each action.
- **Ownership checks** — applicants can only submit/edit their own applications.
- **Comment validation** — reject and return_for_changes require a non-empty comment.
- **Illegal transitions return appropriate HTTP status codes** — 403 for authorization failures, 409 for invalid state transitions, 400 for validation errors.
- **All checks are server-side** — an applicant cannot approve their own application even by calling the API directly.

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/auth/login` | Login, returns JWT | Public |
| `GET` | `/api/auth/me` | Current user info | Authenticated |
| `GET` | `/api/applications` | List applications (filtered by role) | Authenticated |
| `POST` | `/api/applications` | Create draft | Applicant |
| `GET` | `/api/applications/:id` | Get application + audit trail | Authenticated |
| `PATCH` | `/api/applications/:id` | Update draft | Owner |
| `DELETE` | `/api/applications/:id` | Delete draft | Owner |
| `POST` | `/api/applications/:id/transition` | Perform state transition | Authenticated |

### Error Responses

All errors return structured JSON:

```json
{
  "error": "Human-readable message",
  "details": { "field": ["Validation error"] }
}
```

---

## Testing

**40 tests total** — all passing.

### State Machine Unit Tests (21 tests)
- All 5 legal transitions verified
- Illegal transitions: wrong status, wrong role, non-owner, missing comment, empty comment, terminal states, unknown actions

### API Integration Tests (19 tests)
- Auth: missing token, invalid token, login success/failure
- CRUD: create, validation errors, role enforcement, edit, cross-user protection
- Workflow: full happy path, reject path, return-for-changes round-trip, audit log creation
- **Authorization enforcement**: applicant self-approve blocked (403), applicant self-review blocked (403), cross-user submit blocked (403), edit-after-submit blocked (409), reject-without-comment blocked (400)

Run tests:

```bash
cd backend
npm test
```

---

## Trade-offs & What I'd Add With More Time

### Trade-offs Made

1. **Simple JWT auth without refresh tokens** — sufficient for an assessment; production would need refresh token rotation, token revocation, and proper session management.

2. **No pagination on list endpoints** — fine for a demo with few records; would add cursor-based pagination for production.

3. **Prisma `db push` instead of versioned migrations** — faster for prototyping; production would use `prisma migrate dev` for versioned, reviewable migration files.

4. **No file attachments** — the assignment listed this as optional; I prioritized the core workflow and tests.

5. **Seeded users instead of registration** — the assignment specified this is fine; production would need a proper registration flow.

### What I'd Add

- **Versioned migrations** — `prisma migrate dev` for production-safe schema changes.
- **Pagination + search** — cursor-based pagination on list endpoints, full-text search on title/description.
- **Email/in-app notifications** — notify applicants on status changes, reviewers on new submissions.
- **Rate limiting** — protect auth endpoints from brute force.
- **Request logging middleware** — structured logging with correlation IDs.
- **E2E tests** — Playwright tests for the full user journey.
- **CI/CD pipeline** — GitHub Actions for lint, test, build, deploy.

---

## AI Tools Usage

### Tools Used

- **Claude Code (Claude Opus 4.6)** — AI coding assistant used via CLI.

### How It Was Used

- **Scaffolding** — generating initial project structure, boilerplate configuration files, and component templates.
- **Code generation** — writing CRUD routes, state machine logic, test cases, and React components with guidance on architecture decisions.
- **Debugging** — diagnosing MySQL compatibility issues (TEXT columns can't have defaults), fixing dependency installation issues.
- **Documentation** — drafting this README structure.

### What I Verified

- **Every test** — ran all 40 tests and verified they pass against a real MySQL database.
- **State machine correctness** — manually verified each transition rule matches the assignment specification.
- **Authorization enforcement** — confirmed via tests that role checks and ownership checks work correctly, including edge cases (self-approval, cross-user access).
- **Frontend behavior** — tested login flow, form creation/editing, status transitions, and audit trail display.
- **Error handling** — verified that validation errors, auth failures, and illegal transitions all return proper HTTP status codes and structured error messages.
