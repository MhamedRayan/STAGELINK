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
  `cancelled` is reached only through an approved cancellation request.
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
  University-administrator recipients come from
  `UNIVERSITY_ADMIN_USER_IDS` until Identity exposes a role directory.
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
  (409, code `field_locked_while_published`); capacity can only increase;
  `description`, `requirements` and `deadline` stay editable. Drafts are fully
  editable and closed offers are not editable.
- **Draft deletion:** only drafts can be deleted, as a soft delete
  (`deleted_at`). A deleted offer returns 404 on every route, including the
  internal lookup.
- **Applications count:** Applications exposes an internal count per offer and
  Offers stores no counter, so there is one source of truth. This requires an
  endpoint in Applications.

**Consequences:** Offers needs a scheduler for the closing command. Editing
rules can be relaxed later without a migration. The capacity-reduction block
stays until Applications publishes its committed-places endpoint. Deleted
drafts stay in the database.
