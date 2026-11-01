# Offers — work brief

**Owner:** _Member 3_ · **Path:** `services/offers` · **Port:** 8002
**Contract:** `contracts/offers.yaml` · **Tests:** 100
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
cd services/offers
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Definition of done: contract updated first, migration included, tests for the new
behaviour and the permission/error paths, integration test if another service is
involved, docs/`.env.example` updated, PR states compatibility and migration
impact. CI must be green.

## Current state

Complete `draft → published → closed` lifecycle with ownership checks, publish
validation, UUID IDs, public search/filter/pagination, and 100 tests.

But the public list only ever returns **published** offers, there is **no
internal lookup** for applications, and capacity is not connected to anything.

## P0 tasks (before 11 Nov)

### P0-1 — Internal offer lookup for Applications

Applications must stop trusting client-supplied offer/company IDs.

- `GET /api/internal/offers/<uuid>/` with `X-Service-Token` (no user JWT
  accepted). Return `id`, `company_user_id`, `title`, `status`, `deadline`,
  `capacity`, `created_at`.
- Unknown ID → `404` (same shape as a missing resource; do not leak existence).
- **Acceptance:** a valid token returns the offer for any status; missing or
  wrong token returns `403`; tests cover both and the UUID route.

### P0-2 — Company "my offers" listing

- `GET /api/offers/?mine=true&status=draft|published|closed&ordering=deadline`
  for company callers: returns the caller's own offers in every status,
  paginated. Public callers keep the published-only list.
- Add `ordering` on `deadline` and `created_at` (both directions) and a
  `deadline_after` filter for the public list.
- **Acceptance:** a company sees its drafts; another company never sees them;
  anonymous callers cannot use `mine=true`; tests cover both.

### P0-3 — Capacity contract

- Keep `capacity` as the offer's total; coordinate with Applications, which
  owns the reservation lifecycle. Do not add reservation state here.
- Publish-time and edit-time rule: capacity must stay ≥ 1 and, once the offer is
  published, cannot be reduced below the number of committed places reported by
  Applications (use their internal count endpoint, see Applications P0-4; if it
  is not ready yet, block capacity reduction on published offers).
- **Acceptance:** a PATCH that lowers capacity below committed places returns
  `409`; tests cover the boundary.

## P1 tasks (before 28 Nov)

- **P1-1 Deadline handling:** close an offer after its deadline (management
  command or lazy check on read); document the choice.
- **P1-2 Edit rules:** restrict which fields may change while published and
  record an ADR decision.
- **P1-3 Draft delete/archive:** soft delete for `draft` only; `404` afterwards.
- **P1-4 Applications count per offer:** for the company dashboard, either an
  internal count in Applications or a cached counter updated by Applications.

## Read first

`offers/models.py`, `offers/views.py`, `offers/services.py`, `offers/filters.py`,
`offers/permissions.py`, `contracts/offers.yaml`.

## Out of scope

Applications, reservations (owned by Applications), users.
