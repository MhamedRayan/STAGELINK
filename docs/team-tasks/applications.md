# Applications — work brief

**Owner:** _Member 3_ · **Path:** `services/applications` · **Port:** 8003
**Contract:** `contracts/applications.yaml` · **Tests:** 16
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
cd services/applications
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Definition of done: contract updated first, migration included, tests for the new
behaviour and the permission/error paths, integration test if another service is
involved, docs/`.env.example` updated, PR states compatibility and migration
impact. CI must be green.

## Current state

Create/list/detail with UUIDs, the full company → university → student decision
chain with reasons, status guards, required dates, and confirmation-through-
internships with a service token and rollback.

It is the most complex service and has the **thinnest test suite (16)**. It also
trusts the request body for `company_user_id` and never checks the offer, which
is the highest-risk gap in the project.

## P0 tasks (before 11 Nov)

### P0-1 — Validate the offer on intake (blocking)

- On `POST /api/applications/`, call Offers `GET /api/internal/offers/<uuid>/`
  and require: offer exists, `status=published`, `deadline` in the future.
- Derive `company_user_id` from the offer response; reject a mismatching value
  in the body with `400`, or drop the field from the request entirely
  (preferred; update the contract).
- Map offers `404` → `400 {"offer_id": "Offer not found."}`; an unreachable
  service → `503` with a retryable error code.
- **Acceptance:** a student cannot apply to a draft/closed/expired/nonexistent
  offer; the company on the application always matches the offer owner; tests
  cover each rejection and the happy path.

### P0-2 — Withdrawal

- `POST /api/applications/<uuid>/withdraw/` — student owner only, allowed in
  `SUBMITTED`, `COMPANY_ACCEPTED`, `UNIVERSITY_VALIDATED`; sets `WITHDRAWN`,
  stores a reason, releases the reservation.
- Terminal states return `409` with a stable error code.
- **Acceptance:** the owner can withdraw; another student gets `404`;
  company/university cannot withdraw; tests cover each state.

### P0-3 — Auto-withdraw on confirmation

- When a student accepts and the internship is created, set the same student's
  other open applications (`SUBMITTED`, `COMPANY_ACCEPTED`,
  `UNIVERSITY_VALIDATED`, `STUDENT_ACCEPTED`) to `WITHDRAWN` in the same
  transaction and release their reservations.
- **Acceptance:** confirming one application withdraws the others and releases
  places; the confirmed one is untouched; an integration test proves it.

### P0-4 — Reservations and capacity

Agree the design with the Offers owner first, then record it as ADR-008.

- Provisional reservation on company `ACCEPT`; release on company/university
  rejection, student decline, withdrawal, or offer close; occupy on
  `CONFIRMED`.
- Enforce capacity: company `ACCEPT` must fail with `409` when
  reserved+occupied ≥ offer capacity. Recommended approach: keep a local
  `OfferReservation(offer_id unique, capacity, reserved, occupied)` row in
  Applications, lock it with `select_for_update()`, and refresh `capacity` from
  the Offers internal endpoint when the row is created. This keeps the
  lifecycle owned by Applications without distributed transactions.
- Expose `GET /api/internal/offers/<uuid>/capacity/` for the Offers capacity
  rule (Offers P0-3).
- **Acceptance:** capacity is never exceeded under concurrent accepts;
  rejections and withdrawals free places; tests cover races with
  `TransactionTestCase`.

## P1 tasks (before 28 Nov)

- **P1-1 Status history:** `ApplicationStatusHistory` (from, to, actor, reason,
  at) written on every transition; `GET /api/applications/<uuid>/history/` for
  participants and university admins.
- **P1-2 List ergonomics:** pagination, filters (`status`, `offer_id`,
  `student_user_id`, `company_user_id`, date range), and a university
  validation queue (`?status=COMPANY_ACCEPTED` for university admins).
- **P1-3 Error codes:** stable machine-readable `code` on conflicts
  (`CAPACITY_FULL`, `INVALID_STATE`, `OFFER_UNAVAILABLE`,
  `INTERNSHIP_UNAVAILABLE`) and map downstream `409` distinctly from `502`.
- **P1-4 Notifications:** emit the six spec events (company accepted,
  university validated, university rejected, student decision, withdrawal) with
  `transaction.on_commit`, stable dedup keys, and best-effort delivery that
  never blocks the business action. Coordinate with the Notifications owner.
- **P1-5 Reliability:** retry/backoff around the internship creation call plus a
  reconciliation command that finds `STUDENT_ACCEPTED` applications without an
  internship and retries idempotently.
- **P1-6 Tests:** raise coverage substantially — permission matrix per action,
  capacity, withdrawal, auto-withdraw, history, and downstream failure modes.

## Read first

`applications/models.py`, `views.py`, `serializers.py`, `services.py`,
`permissions.py`, `authentication.py`, `contracts/applications.yaml`,
`tests/integration/test_applications_internships.py`.

## Out of scope

Offer lifecycle (Offers), internship lifecycle (Internships), notification
storage (Notifications).
