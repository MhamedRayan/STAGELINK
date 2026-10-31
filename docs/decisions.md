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
