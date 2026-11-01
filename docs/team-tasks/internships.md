# Internships — work brief

**Owner:** _Member 4_ · **Path:** `services/internships` · **Port:** 8004
**Contract:** `contracts/internships.yaml` · **Tests:** 38
**Milestones:** technical validation 11 Nov 2026 · delivery 28 Nov 2026

> Read [`README.md`](README.md) for the shared conventions, required checks, and
> definition of done. Short version:
>
> - UUID identifiers and cross-service references, exposed as strings.
> - Lowercase roles: `student`, `company`, `supervisor`, `university_admin`,
>   `platform_admin`; enum values elsewhere stay uppercase.
> - Service-to-service calls use `X-Service-Token` on `/api/internal/...`;
>   user calls use `Authorization: Bearer <access-token>`.
> - No cross-service foreign keys; store other services' IDs as plain UUIDs.
> - Contract first, tests and migrations in the same PR, CI green before review.

---

## Before you open a PR

```bash
cd services/internships
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Definition of done: contract updated first, migration included, tests for the new
behaviour and the permission/error paths, integration test if another service is
involved, docs/`.env.example` updated, PR states compatibility and migration
impact. CI must be green.

## Current state

UUID model with idempotent internal creation, one-active-internship-per-student
enforced by a PostgreSQL partial unique index, and role-scoped list/detail.

The lifecycle fields exist (`status`, `supervisor_user_id`) but nothing changes
them: there is **no supervisor assignment, no transitions, no cancellations,
no submissions, no reviews, no evaluations, and no audit history**. This is the
largest functional gap in the project.

## P0 tasks (before 11 Nov)

### P0-1 — Supervisor assignment

- `POST /api/internships/<uuid>/assign-supervisor/` — `university_admin` only,
  body `{"supervisor_user_id": "<uuid>"}`.
- Validate the supervisor through Identity's internal directory: the user must
  exist and have role `supervisor`; otherwise `400`.
- Allow reassignment with a reason; store `assigned_by`, `assigned_at`; audit
  the change.
- **Acceptance:** only university admins can assign; non-supervisors are
  rejected; the supervisor immediately sees the internship in
  `GET /api/internships/`; tests cover both.

### P0-2 — Lifecycle transitions and audit

- Explicit endpoints with a state machine:
  - `POST /api/internships/<uuid>/start/` → `confirmed → in_progress`
    (university admin; also allowed lazily when `start_date` has passed).
  - `POST /api/internships/<uuid>/complete/` → `in_progress → completed`
    (only when an evaluation exists — see P1-4; until then, university admin
    with a documented rule).
  - Cancellation **only** via an approved request (P1-1), never a direct
    status write.
- Reject invalid transitions and wrong roles with `409`/`403` and a stable
  error code.
- `InternshipAudit` model: internship, action, from_status, to_status, actor,
  reason, at; written on create, assign, and every transition.
- `GET /api/internships/<uuid>/history/` for university admins, the assigned
  supervisor, and the student/company on that internship.
- **Acceptance:** every transition is tested for allowed/denied roles and
  valid/invalid source states; audit rows are created exactly once.

### P0-3 — List ergonomics

- Pagination and filters: `status`, `student_user_id`, `company_user_id`,
  `supervisor_user_id`, date range; ordering.
- `GET /api/internships/?mine=true` for supervisors (assigned only) and
  companies (own only).
- **Acceptance:** filters never widen visibility; tests cover each role.

## P1 tasks (before 28 Nov)

- **P1-1 Cancellation requests:** `InternshipCancellationRequest` (requested_by,
  reason, state, decided_by, decided_at); endpoints to initiate (student or
  company on that internship), list, and decide (university admin). Approval
  moves the internship to `cancelled` and must release the place through
  Applications/Offers (coordinate the internal call).
- **P1-2 Final submission:** model + `POST /api/internships/<uuid>/submissions/`
  with file upload (≤ 10 MB; PDF/DOCX/PPTX/JPG/JPEG/PNG/CSV), storage under a
  mounted media volume, versioning, a download endpoint with permission checks,
  and resubmission after rejection.
- **P1-3 Review:** supervisor `approve`/`reject` with a mandatory reason; only
  the assigned supervisor; rejected submissions allow resubmission.
- **P1-4 Evaluation:** supervisor grade /20 + optional comment; only after an
  approved submission; visible to student, company, and university admins;
  completing it moves the internship to `completed`.
- **P1-5 Notifications:** internship created, supervisor assigned, cancellation
  requested/decided, submission reviewed, evaluation published — via
  `transaction.on_commit`, best effort (coordinate with the Notifications
  owner).
- **P1-6 Media deployment:** document the upload volume, size/type limits, and
  backup requirement in `docs/` and Compose.

## Read first

`internships/models.py`, `views.py`, `serializers.py`, `services.py`,
`selectors.py`, `authentication.py`, `permissions.py`,
`contracts/internships.yaml`.

## Out of scope

Application decisions (Applications), offer data (Offers), user accounts
(Identity), notification storage (Notifications).
