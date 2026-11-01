# Identity & Profiles — work brief

**Owner:** _Member 2_ · **Path:** `services/identity` · **Port:** 8001
**Contract:** `contracts/identity.yaml` · **Tests:** 16
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
cd services/identity
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Definition of done: contract updated first, migration included, tests for the new
behaviour and the permission/error paths, integration test if another service is
involved, docs/`.env.example` updated, PR states compatibility and migration
impact. CI must be green.

## Current state

UUID users, case-insensitive unique email, strong password validation, the five
canonical roles, company accounts created inactive, JWT issue/refresh (15 min /
7 days, `role` + `email` claims), `GET/PATCH /api/users/me/`, and an internal
UUID lookup protected by `X-Service-Token`. Django admin can create accounts.

There are **no profiles**, **no verification API**, **no provisioning API**, and
**no directory endpoints** for other services.

## P0 tasks (before 11 Nov)

### P0-1 — Role-specific profiles

- Models: `StudentProfile` (university, department, specialty, academic year,
  matricule), `CompanyProfile` (legal name, address, contact person, phone,
  website, description), `SupervisorProfile` (department, grade/academic rank).
  One-to-one with `User`; UUID PK; plain text for reference data until P1.
- Endpoints: `GET/PUT /api/users/me/profile/` returning the payload for the
  caller's role; create the profile automatically on registration/login
  (idempotent `get_or_create`). Profile edits must not change `role`, `email`
  ownership, or `is_active`.
- Expose a public `GET /api/companies/<uuid>/profile/` with non-sensitive
  fields if the offer pages need it.
- **Acceptance:** a student/company/supervisor can read and update their own
  profile; another role gets `403`; validation errors are field-specific; tests
  cover both.

### P0-2 — Internal directory endpoints

Other services cannot resolve recipients or supervisors today.

- `GET /api/internal/users/?role=<role>&department=<id>&page=<n>` — paginated,
  returns `id`, `name`, `email`, `role`; same `X-Service-Token` guard as the
  existing lookup; fail closed.
- `GET /api/internal/users/?ids=<uuid>,<uuid>` — batch lookup (for display
  names), max 100 IDs.
- Keep `GET /api/internal/users/<uuid>/` unchanged.
- **Acceptance:** only a valid service token gets a response; an unknown role
  returns `400`; results are paginated; tests cover token failure, filtering,
  and batch.

### P0-3 — Company verification

- `GET /api/admin/companies/?status=pending|active|rejected` (platform admin).
- `POST /api/admin/companies/<uuid>/verify/` → sets `is_active=True`, stores
  `verified_by` and `verified_at`.
- `POST /api/admin/companies/<uuid>/reject/` with a mandatory reason; keeps the
  account inactive and records the reason.
- **Acceptance:** only `platform_admin` can call these; a non-admin gets `403`;
  verified companies can log in and publish offers; tests cover both decisions.

### P0-4 — Account provisioning API

- `POST /api/admin/users/` (platform admin): create `company`,
  `university_admin`, or `supervisor` accounts with an initial password or a
  generated one-time password. Never allow creating `platform_admin` through
  this endpoint.
- `GET /api/admin/users/?role=<role>` and `PATCH /api/admin/users/<uuid>/`
  limited to `is_active` (and company verification fields).
- **Acceptance:** public registration still allows only `student` and
  `company`; the admin endpoint enforces role restrictions; tests cover
  privilege-escalation attempts.

## P1 tasks (before 28 Nov)

- **P1-1 Reference data:** `University`, `Department`, `Specialty` models with
  read endpoints, referenced by profiles; seed the real university/departments
  from the spec.
- **P1-2 Account lifecycle:** change password, logout/refresh blacklist
  (`token_blacklist` app), refresh rotation, deactivate account; document the
  chosen policy.
- **P1-3 Tests:** expand to cover provisioning, verification, directory, and
  profile permission matrices.

## Read first

`api/models.py`, `api/views.py`, `api/serializers.py`, `api/permissions.py`,
`docs/decisions.md` (ADR-007), `contracts/identity.yaml`.

## Out of scope

Notification storage, offers, internships, application decisions.
