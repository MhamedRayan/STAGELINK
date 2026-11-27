# Decisions

This file records architecturally significant decisions. Add a new entry when
a choice constrains future work, changes a service boundary, or is expensive to
reverse. Keep entries short and immutable; supersede rather than rewrite.

Format:

```text
## ADR-NNN: Title
Status: proposed | accepted | superseded by ADR-NNN
Date: YYYY-MM-DD
Context: ...
Decision: ...
Consequences: ...
```

---

## ADR-001: Domain-aligned services

**Status:** accepted
**Date:** 2026-10-19

**Context:** The platform covers distinct concerns with different lifecycles:
accounts, offers, applications, internships and notifications. A single
monolith would simplify early development but couple unrelated release and data
ownership concerns.

**Decision:** Split the backend into five independently deployable Django
services aligned with those domains. Each service owns its data and exposes an
HTTP API.

**Consequences:** Clear ownership and independent deployment, at the cost of
more infrastructure, cross-service testing and distributed failure modes.
Cross-cutting changes may require coordinated contract updates.

---

## ADR-002: Django and Django REST Framework

**Status:** accepted
**Date:** 2026-10-19

**Context:** The team needs a mature Python framework with an ORM, migrations,
admin tooling and a well-understood API layer.

**Decision:** Use Django for each service and Django REST Framework for HTTP
APIs.

**Consequences:** Consistent tooling and a large ecosystem. Services share
framework conventions but must not share code through cross-service database
access. Shared libraries, if introduced, require versioning and ownership.

---

## ADR-003: Contract-first OpenAPI

**Status:** accepted
**Date:** 2026-10-19

**Context:** Service consumers need a stable, reviewable interface, and
independent deployments require an explicit compatibility boundary.

**Decision:** Maintain one OpenAPI 3.0 document per service in `contracts/`.
Change the contract before or alongside implementation. Treat breaking changes
as versioned changes.

**Consequences:** API review becomes part of the pull request. Contracts can
drift if not checked; add automated validation as the next improvement.

---

## ADR-004: One database per service

**Status:** accepted
**Date:** 2026-10-19

**Context:** Shared tables would recreate monolith coupling and make
independent schema evolution unsafe.

**Decision:** Each service uses its own PostgreSQL database in Docker Compose.
SQLite is allowed for local, single-service runs and tests. Services may not
query another service's database.

**Consequences:** Data needed across domains must be fetched via APIs or stored
as an owned projection. Cross-service reporting needs a separate read model.

---

## ADR-005: Docker Compose for local orchestration

**Status:** accepted
**Date:** 2026-10-19

**Context:** Developers need a reproducible way to run five services and their
databases without provisioning cloud infrastructure.

**Decision:** Provide `infra/docker/docker-compose.yml` with one service
container and one PostgreSQL container per service. Configuration comes from
the root `.env` file.

**Consequences:** The full stack runs with one command but consumes
significant local resources. Production orchestration is deliberately out of
scope for this scaffold.

---

## ADR-006: GitHub Actions for continuous integration

**Status:** accepted
**Date:** 2026-10-25

**Context:** Every service needs a repeatable test signal before merge.

**Decision:** Run each service's Django test suite in a GitHub Actions matrix
on pushes and pull requests. Every suite uses the same PostgreSQL major version
as Docker Compose.

**Consequences:** Failures are isolated by service and database-specific
behaviour is covered. Build caching and integration/end-to-end jobs can be added
as the test suites grow.

---

## ADR-007: UUID identifiers, canonical roles, and service tokens

**Status:** accepted
**Date:** 2026-10-31

**Context:** The services were scaffolded independently and disagreed on
identifier types, role spellings, and internal authentication. Those differences
made cross-service calls unreliable and forced consumers to translate values at
every boundary.

**Decision:**

- Service-owned resource identifiers and cross-service references are UUIDs.
  APIs expose them as UUID strings, and service routes use UUID converters.
- Role values are lowercase `snake_case`: `student`, `company`, `supervisor`,
  `university_admin`, `platform_admin`. Role matching is exact and
  case-sensitive.
- Trusted service-to-service calls authenticate with the shared
  `X-Service-Token` header. User-facing calls continue to use
  `Authorization: Bearer <access-token>`.

**Consequences:** Payloads and routes are consistent across services and cannot
leak database row order. Existing integer identifiers in offers and internships
cannot be mapped to the UUIDs they reference, so adopting this decision requires
recreating those development tables. The shared service token is a simple
secret; rotating it requires a coordinated deployment. Finer-grained service
authorization would need a signed service token or mutual TLS in the future.

---

## ADR-009: Notification delivery, retry, and reconciliation

**Status:** accepted
**Date:** 2026-11-03

**Context:** Business actions (application decisions, internship creation,
supervisor assignment) must succeed even when the notifications service is
slow or unavailable. A synchronous call inside the business transaction would
hold row locks, couple two databases, and turn a notification outage into a
failed decision. At the same time, callers must not silently lose events and
must not create duplicates when they retry.

**Decision:**

- Producers send notifications **after** the business transaction commits,
  using `transaction.on_commit`. The callback is best effort: its failure is
  logged and never rolls back the business action.
- Delivery uses bounded retries with exponential backoff and jitter. Only
  timeouts, connection errors, and `5xx` responses are retried. `4xx` responses
  are treated as permanent caller errors and are not retried.
- Every request carries a deterministic deduplication key of the form
  `{object_type}:{object_id}:{event}:recipient:{user_id}`. The notifications
  service enforces it with a unique constraint, so replaying the same event
  returns `200` with the existing row instead of creating a second one.
- There is no caller-side outbox in v1. Deduplication makes replay safe, and
  the reference client (`services/notifications/docs/examples/notifications_client.py`)
  centralises the retry and `on_commit` rules.
- Reconciliation: a producer that needs to confirm delivery can re-send the
  same events with the same keys. The service is the source of truth for what
  was stored. If bulk reconciliation becomes necessary, add a read-only
  "recent events" endpoint rather than a second write path.
- Retention is enforced by the `purge_notifications` command: read
  notifications are deleted after `NOTIFICATION_RETENTION_DAYS` (default 180)
  and every notification after `NOTIFICATION_HARD_RETENTION_DAYS` (default 365).

**Consequences:** A notification outage degrades communication but never blocks
the workflow. Delivery is at-least-once from the producer's perspective and
exactly-once in storage. A process that crashes after commit but before the
callback runs can still lose an event; the same deterministic key lets a
reconciliation job replay it safely. The shared service token remains the
trust boundary for internal writes.

## ADR-010: Internship submissions, review, evaluation and side effects

**Status:** accepted
**Date:** 2026-11-08

**Context:** The internship record needs the rest of the academic workflow:
the student's final report, the supervisor's review, the final grade, and the
cross-service consequences of cancellation. These steps touch files, external
services, and irreversible state, so their rules must be explicit.

**Decision:**

- The internship lifecycle remains `confirmed → in_progress → completed`.
  University administration may start a confirmed placement manually, and the
  idempotent `start_due_internships` scheduler starts the rest when their start
  date is reached. `cancelled` is reached only through an approved cancellation
  request.
- The student on the internship uploads versioned final submissions while the
  internship is `in_progress`. At most one version is pending. A rejected
  version allows a resubmission; an approved version ends the upload flow.
- Submission status values are uppercase `SUBMITTED`, `APPROVED`, `REJECTED`.
  Existing internship and cancellation values remain lowercase because they are
  already shipped.
- Files are validated by extension and size (maximum 10 MB), stored under
  `MEDIA_ROOT` on a mounted volume, and never served directly. Every download
  goes through an authorised endpoint. The student, the assigned supervisor and
  university administration can read submissions; the company cannot.
- The assigned supervisor reviews a pending version with a mandatory reason.
  Approval or rejection stores the reviewer, time and reason and writes an audit
  entry.
- The assigned supervisor records exactly one evaluation, with a grade from 0 to
  20. An approved submission is required. Creating the evaluation moves the
  internship to `completed` in the same transaction.
- The audit history is append-only. Every state change writes its entry in the
  same transaction as the change it describes.
- Notifications are best effort and scheduled with `transaction.on_commit`.
  Failures are logged and never roll back the internship change. Recipient IDs
  are UUIDs and deduplication keys are stable per event and recipient.
  University-administrator recipients come from the Identity role directory
  and are filtered to the student's institution.
- Approving a cancellation queues a call to
  `POST /api/internal/applications/{source_application_id}/release-place/` on
  the Applications service. That endpoint is owned by Applications and is
  expected to be idempotent. The `place_released_at` marker records success, and
  the `release_cancelled_places` management command retries failures. The
  cancellation itself is never blocked by an Applications outage.

**Consequences:** Uploaded files require an operational backup in addition to
the database; see [`media-storage.md`](media-storage.md). The release call and
some notifications depend on contracts owned by other services, so integration
tests for those seams stay gated until the endpoints and UUID recipient support
land. Because evaluations are immutable in v1, a correction requires a
deliberate administrative data change rather than a second API call.

## ADR-008: Offers lifecycle rules (deadline, published edits, draft deletion, applications count)

**Status:** accepted
**Date:** 2026-11-05

**Context:** The Offers service needs clear rules for what happens when a
deadline passes, what a company may change after publishing, how drafts are
removed, and where the applications count per offer comes from.

**Decision:**

- **Deadline:** published offers whose deadline has passed are closed by the
  idempotent management command `close_expired_offers`, run by a scheduler. A
  lazy check on read was rejected because list queries filter on status and
  reads should not write. Between runs an expired offer may still appear as
  published.
- **Published edits:** while published, `title` and `location` cannot change
  (409, code `field_locked_while_published`); capacity may increase, and may
  decrease only down to the committed places reported by Applications (409,
  code `capacity_below_committed`). If Applications is unavailable the
  reduction fails closed with 503. `description`, `requirements` and `deadline`
  stay editable. Drafts are fully editable and closed offers are not editable.
- **Draft deletion:** only drafts can be deleted, as a soft delete
  (`deleted_at`). A deleted offer returns 404 on every route, including the
  internal lookup.
- **Applications count:** Applications exposes
  `GET /api/internal/offers/<uuid>/applications-count/` and Offers stores no
  counter, so there is one source of truth.

**Consequences:** Offers needs a scheduler for the closing command. Editing
rules can be relaxed later without a migration. Capacity reductions depend on
Applications at edit time but fail closed rather than risk overbooking.
Deleted drafts stay in the database.

---

## ADR-011: Application reservations, capacity ownership, and confirmation flow

**Status:** accepted
**Date:** 2026-11-09

**Context:** Applications orchestrates the application state machine but owns
none of the offer, account, internship or notification data. The original
implementation trusted the caller for the owning company and never checked the
offer, so a student could apply to a draft, closed or nonexistent offer and
choose which company could decide. Capacity was decorative and unlimited
accepts were possible. The applications → internships call also ran inside the
database transaction, so a downstream success could be lost if the local commit
failed.

**Decision:**

- **Offer validation on intake.** `POST /api/applications/` calls Offers
  `GET /api/internal/offers/<uuid>/` and requires an existing, `published`
  offer with a future deadline. `company_user_id` is removed from the request
  body and derived from the offer, so the owning company can never be spoofed.
  A missing offer maps to `400 OFFER_NOT_FOUND`, an unavailable Offers service
  to `503 OFFERS_UNAVAILABLE`, and a closed or expired offer to
  `409 OFFER_UNAVAILABLE`.
- **Reservations belong to Applications.** Applications keeps one
  `OfferReservation(offer_id unique, capacity, reserved, occupied)` row per
  offer, locked with `select_for_update()`. Offers stores no counter.
  - Company `ACCEPT` reserves one place and fails with `409 CAPACITY_FULL` when
    `reserved + occupied >= capacity`.
  - University rejection, student decline, withdrawal and auto-withdrawal
    release the provisional place.
  - Confirmation moves one place from `reserved` to `occupied`.
  - An approved internship cancellation calls
    `POST /api/internal/applications/<uuid>/release-place/`, which frees one
    `occupied` place and is idempotent through `place_released_at`.
  - The cached `capacity` is refreshed from Offers when a reservation is
    created and may increase, but is never silently lowered below committed
    places.
- **Capacity visibility for Offers.** `GET
  /api/internal/offers/<uuid>/capacity/` returns `reserved`, `occupied`,
  `committed` and `available`. When no reservation row exists, nothing is
  committed and `capacity`/`available` are null. Offers can use this to allow
  safe capacity reductions.
- **Withdrawal.** The owning student may withdraw in `SUBMITTED`,
  `COMPANY_ACCEPTED`, `UNIVERSITY_VALIDATED` or `STUDENT_ACCEPTED`. Terminal
  states return `409 INVALID_STATE`. `withdrawal_reason` and `withdrawn_at` are
  stored, and any provisional place is released.
- **Auto-withdrawal.** Confirming one application withdraws the same student's
  other open applications in the same transaction and releases their places.
- **History.** Every transition writes an append-only
  `ApplicationStatusHistory` row with the actor, role and reason in the same
  transaction as the change.
- **Confirmation is not called inside a transaction.** Student acceptance first
  commits `STUDENT_ACCEPTED`, then calls Internships outside the transaction.
  Success finalizes `CONFIRMED`; a permanent `409` reverts to
  `UNIVERSITY_VALIDATED`; a transient failure leaves `STUDENT_ACCEPTED` and
  returns `503 DOWNSTREAM_UNAVAILABLE`. The
  `reconcile_confirmed_applications` command retries `STUDENT_ACCEPTED` rows
  idempotently using the source application id.
- **Errors and notifications.** Errors use the shared `{code, message,
  details}` envelope. Notifications are best effort, scheduled with
  `transaction.on_commit`, and use stable deduplication keys of the form
  `application:<id>:<event>:recipient:<user_id>`. University-administrator
  recipients are resolved from the Identity role directory
  (`GET /api/internal/users/?role=university_admin`, active accounts only),
  filtered to the student's institution, plus the recorded
  `university_user_id`. The directory lookup runs inside the after-commit
  callback, never inside the application transaction, so Identity latency never
  extends row locks. When Identity is unavailable, university administrators
  are skipped rather than broadcast globally; the business action never fails
  because Identity is down. Successful and failed directory lookups are cached
  briefly to avoid one call per notification.

**Consequences:** Applications now depends on Offers for intake and acceptance
and on Notifications for delivery; both are best effort except intake and
capacity, which fail closed. Confirming requires the reconciliation command to
be scheduled, otherwise a transient internships outage leaves applications in
`STUDENT_ACCEPTED`. The reservation row is the single source of truth for
committed places, so Offers must call the capacity endpoint before reducing
capacity. Administrator notifications also depend on Identity, but only after
commit and with a configured fallback, so an Identity outage delays neither the
state transition nor the response. The application contract changes
incompatibly (`company_user_id` is no longer accepted and list responses are
paginated); this is acceptable because the platform has no production clients
yet.

---

## ADR-012: Account lifecycle and refresh-token revocation

**Status:** accepted
**Date:** 2026-11-12

**Context:** Accounts could register, sign in and refresh, but could not sign
out, change a password or deactivate. A stolen refresh token therefore stayed
usable for its full lifetime, and a deactivated account kept working in services
that only verify the JWT signature.

**Decision:** Identity owns the account lifecycle:

- Refresh tokens rotate on every refresh; the submitted token is blacklisted.
- `POST /api/auth/logout/` blacklists one refresh token and is idempotent.
- `POST /api/users/me/password/` verifies the current password, applies
  Django's password validators, and blacklists every refresh token issued to
  the account.
- `POST /api/users/me/deactivate/` requires the password, sets
  `is_active=false`, and blacklists every refresh token.
- Access tokens stay stateless and valid until they expire (15 minutes by
  default). Cross-service revocation of an individual access token is out of
  scope; deactivation is enforced wherever the user row is loaded.

**Consequences:** Clients must persist the rotated refresh token and must sign
in again after a password change or deactivation. The blacklist tables need the
normal backup and retention policy. A password change cannot revoke an already
issued access token, so the short access lifetime is a security control, not a
tuning knob.

---

## ADR-013: Directory-resolved notification recipients

**Status:** accepted
**Date:** 2026-11-12

**Context:** Applications and Internships needed university-administrator
recipients. A static `UNIVERSITY_ADMIN_USER_IDS` list drifts from the real
account directory and requires a redeploy whenever staff change.

**Decision:** Both services resolve active university administrators from the
Identity directory (`GET /api/internal/users/?role=university_admin`) after the
business transaction commits. Successful lookups are cached briefly and failed
lookups are cached for a shorter period. Recipients are always filtered to the
student's institution, so one university's event is never delivered to another
university's administrators. If Identity is unavailable, the notification is
skipped; an empty directory result is authoritative. An unavailable directory
never fails the business action.

**Consequences:** Identity becomes a soft dependency of notification fan-out,
not of the state transition. Notifications may be delayed or dropped during an
Identity outage, but they are never broadcast across institutions. The
`UNIVERSITY_ADMIN_USER_IDS` setting is no longer used as a fallback because a
global list cannot preserve tenant isolation.

---

## ADR-014: Browser access and deployment hardening

**Status:** accepted
**Date:** 2026-11-12

**Context:** The front end will run on a different origin from the APIs. The
services also need a consistent production configuration: TLS, secure cookies,
HSTS, proxy headers, scheduled commands, backups and log retention.

**Decision:** Every service installs `django-cors-headers` and allows only the
origins in `CORS_ALLOWED_ORIGINS`; credentials are disabled because
authentication uses the `Authorization` header, not cookies. All services apply
the same `SECURE_*`, cookie, referrer and frame settings, with
`SECURE_PROXY_SSL_HEADER` enabled only behind a trusted TLS-terminating proxy.
The three idempotent commands run as Compose scheduler sidecars every five
minutes. The production procedure is documented in `docs/deployment.md`.

**Consequences:** Adding a new front-end origin requires a configuration change,
not a code change. The services remain independent and can be deployed behind
one reverse proxy or several. Local Compose uses generous login limits; a
production deployment must set the documented secure values.

---

## ADR-015: Single-origin web delivery

**Status:** accepted
**Date:** 2026-11-23

**Context:** The browser client talks to five services. Using separate origins
would require per-service CORS configuration, complicate token handling and
make local and deployed behaviour diverge. Deep links also need an SPA fallback.

**Decision:** Build the React client into static assets and serve them through
one nginx container. nginx proxies `/svc/<service>/` to that service and
returns 404 for any `/api/internal/` path. Unknown paths fall back to
`index.html`. Vite's development proxy uses the same prefixes, and the Compose
`web` service uses the same nginx configuration.

**Consequences:** The browser only sees one origin and CORS stays disabled.
Adding a service means adding one proxy block in both nginx and Vite. Upload
proxying allows 12 MiB so the 10 MiB submission limit is not truncated by the
proxy.

---

## ADR-016: Frontend CI gates and browser smoke test

**Status:** accepted
**Date:** 2026-11-23

**Context:** Type errors, lint regressions and broken role redirects were only
caught locally. The other CI jobs exercise Django services but never load the
client.

**Decision:** CI runs a `web-gates` job (`npm run typecheck`, `lint`, `test`,
`build`) and a `web-smoke` job that starts the full Compose stack including
`web`, seeds demo accounts and runs a Playwright test per role: login, expected
redirect, expected dashboard heading. Browsers are installed in CI only;
Playwright is not a runtime dependency of the client image.

**Consequences:** Frontend regressions fail the same pull request as backend
regressions. The smoke test needs a seeded stack, so it is intentionally small
and serial; detailed behaviour stays in unit and integration tests.

---

## ADR-017: Deterministic demo ids and an opt-in name directory

**Status:** accepted
**Date:** 2026-11-23

**Context:** The APIs return user and company UUIDs but not display names.
Demos need readable names; production must not ship a hard-coded account list.

**Decision:** `seed_demo` derives demo ids from a fixed `uuid5` namespace and
writes `frontend/src/demo/directory.json`. The client loads it only when
`VITE_DEMO_DIRECTORY=1`; otherwise it degrades to `Role · 3f2a9c` via
`shortId()`. The directory is demo data, never an authoritative name service.

**Consequences:** A fresh seed always produces the same ids, so the generated
file matches every demo run. Unknown ids are rendered safely, and production
builds do not embed demo accounts.

---

## ADR-018: Provisioning, institution scope and user directory

**Status:** accepted
**Date:** 2026-11-23

**Context:** The original API could not provision students at all, restricted
all user management to `platform_admin`, and returned only UUIDs for the
students, supervisors and companies referenced by applications and
internships. Browser clients cannot call `/api/internal/` routes, so names had
to come from a demo-only JSON file (ADR-017). University administrators had no
way to manage their own students or supervisors, and there was no
institution-scoping field for supervisors or university administrators.

**Decision:** Add `student` to the admin-provisionable roles. Allow
`university_admin` callers on user provisioning/list/detail endpoints, scoped
to `student` and `supervisor` accounts whose profile university matches the
administrator's own university (case-insensitive, trimmed). Introduce
`UniversityAdminProfile` and `SupervisorProfile.university`; university
administrators may edit scoped accounts but may not change roles, create
companies or other administrators, or touch company verification. Expose a
bearer-authenticated directory (`GET /api/users/`, `GET /api/users/{id}/`) and
a batch resolver (`GET /api/users/lookup/?ids=...`, max 100) so clients resolve
UUIDs to display names. Names are resolved at read time by the client and
never copied into other services' payloads. Any authenticated caller receives
`id`, `name` and `role`; supervisors and companies also receive a student's
`university`, `department`, `specialty` and `academic_year`; email, phone and
`matricule` remain private to the account owner and university/platform
administrators. Public registration is reduced to `company`. A lightweight
anonymous endpoint exposes company `verification_status` without exposing
unverified profile details.

**Consequences:** Identity remains the single source of truth for names and
academic data; other services keep plain UUID references. Client code can use
the batch resolver instead of ADR-017's demo directory, but ADR-017 stays in
place for deterministic demo ids. Relationship-based restriction of academic
fields (only the supervisor/company actually involved with a student) is not
enforced by Identity because it has no application or internship context; it
would require a service-token-backed context check in a later wave. Student
self-registration is no longer available, so provisioning is mandatory.

---

## ADR-019: Tenant isolation for university administrators

**Status:** accepted
**Date:** 2026-11-24

**Context:** University administrators could list every application and
internship, and notifications resolved a global administrator list. A
university administrator provisioned without an institution therefore saw the
whole platform. Identity is the only service that knows which institution an
account belongs to.

**Decision:** Add a `university` claim to access and refresh tokens, re-read
from the account's role profile on refresh. Applications and Internships scope
university-administrator reads, detail lookups and decisions to students of the
caller's institution. The student IDs are resolved through the Identity
internal directory (`?role=student&university=...`) and cached briefly. A
missing or blank claim means an empty result, never a global roster. When
Identity is unavailable the request fails closed with `503` after the cache
expires. Supervisor assignment verifies that the supervisor belongs to the
caller's institution. Platform provisioning requires a non-blank university for
`student`, `supervisor` and `university_admin` accounts.

**Consequences:** Cross-institution data is invisible even when an ID is known.
Identity is a hard dependency for scoped reads; an outage degrades to `503`
rather than leaking data. Notifications are skipped during an outage, as
recorded in ADR-013. Existing accounts with a blank institution must be
corrected before they can use the university portal.
