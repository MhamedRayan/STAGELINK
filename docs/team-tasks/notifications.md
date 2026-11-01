# Notifications & Communication — work brief

**Owner:** _Member 1_ · **Path:** `services/notifications` · **Port:** 8005
**Contract:** `contracts/notifications.yaml` · **Tests:** 62
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
cd services/notifications
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Definition of done: contract updated first, migration included, tests for the new
behaviour and the permission/error paths, integration test if another service is
involved, docs/`.env.example` updated, PR states compatibility and migration
impact. CI must be green.

## Current state

In-app notifications with list (`20/page`, `?unread=true`), unread count,
idempotent mark-one-read, read-all, and an internal create guarded by
`X-Service-Token` with deduplication (`201` created / `200` existing). Privacy
is enforced by scoping every query to the caller.

It is the **last integer service**, its OpenAPI contract documents only
`/health/`, and **no service calls it yet**.

## P0 tasks (before 11 Nov)

### P0-1 — Move to UUIDs (ADR-007 compliance)

- `Notification.id` → `UUIDField(primary_key=True, default=uuid.uuid4)`.
- `recipient_user_id` → `UUIDField(db_index=True)`; remove the integer
  `min_value` validator.
- `MarkReadView` route `<int:pk>` → `<uuid:pk>`; update `api/urls.py`.
- JWT auth: parse `user_id` as `uuid.UUID` (reject malformed values);
  `DevHeaderAuthentication` accepts UUIDs only; keep the algorithm allow-list,
  expiry requirement, and access-token-type check.
- Migration: these tables hold no production data, so a destructive recreate is
  acceptable — say so explicitly in the migration docstring and PR.
- **Acceptance:** all 62 existing tests updated and passing; a token with a
  non-UUID `user_id` gets `401`; notification routes reject non-UUID IDs; no
  integer identifiers remain in the service or its docs.

### P0-2 — Real contract

- Rewrite `contracts/notifications.yaml` to cover every endpoint: list,
  unread-count, mark-read, read-all, internal create, health. Document
  `X-Service-Token`, the `200` vs `201` dedup semantics, UUID schemas, and
  pagination.
- Update `api_contract.md` and `README.md` (remove "integer / TO AGREE").
- **Acceptance:** the contract validates as OpenAPI 3.0.3; a reviewer can
  implement a client from it alone; `docs/setup.md` examples use UUIDs.

### P0-3 — Recipient resolution contract

- Document exactly how callers obtain recipient IDs. Until Identity exposes the
  directory (Identity P0-2), support explicit IDs; afterwards use
  `role=university_admin` and `role=supervisor` lookups.
- **Acceptance:** the contract has a "who calls what" table with one row per
  event.

## P1 tasks (before 28 Nov)

- **P1-1 Caller helper:** publish a small client helper (Python snippet or
  shared module under `tests/`/`docs/`) implementing retry with backoff,
  `transaction.on_commit`, and the dedup-key convention
  `{object_type}:{object_id}:{event}:recipient:{user_id}`.
- **P1-2 Delivery reliability:** decide and document the retry/reconciliation
  strategy for notification calls (ADR-009). Options: a caller-side outbox
  table, or a notifications-side "recent events" endpoint the caller reconciles
  against. Deduplication already makes retries safe.
- **P1-3 Integration test:** student accepts → the company and the university
  admin each have exactly one notification, and a replayed request does not
  duplicate it.
- **P1-4 Optional:** retention/cleanup command, admin list view.

## Read first

`api/models.py`, `api/views.py`, `api/serializers.py`, `api/authentication.py`,
`api/permissions.py`, `api_contract.md`, `service.md`, `project.md`,
`contracts/notifications.yaml`.

## Out of scope

Email/SMS, deciding recipients, application/internship business rules.
