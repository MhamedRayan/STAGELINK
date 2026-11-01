# Cross-cutting work — integration lead

These tasks do not belong to a single service owner.

> Shared conventions and the definition of done are in [`README.md`](README.md).

## P0 (before 11 Nov)

### Contract validation in CI

Add a step that validates every file in `contracts/` as OpenAPI 3.0.3 (for
example with `openapi-spec-validator`). The notifications stub proves contracts
drift silently today.

**Acceptance:** a malformed or unsupported contract fails the PR; all five
contracts validate on `main`.

### Expand the integration suite

Today there is one seam (applications → internships). Add:

- a student rejected when applying to an unpublished or expired offer;
- the capacity limit, including two concurrent accepts;
- withdrawal and auto-withdraw on confirmation;
- supervisor assignment visible to the supervisor;
- exactly one notification emitted on confirmation (depends on Notifications
  P0-1 and Applications P1-4).

**Acceptance:** each scenario fails against the current code where applicable and
passes after the owning service lands; the suite runs in CI on every PR.

### Seed/demo data

A management command or fixture script that creates a platform admin, a verified
company with a published offer, a student, a university admin, and a supervisor.

**Acceptance:** one command produces a stack where the full flow can be demoed
without touching Django admin.

## P1 (before 28 Nov)

### ADRs to record

- **ADR-008** place reservations and capacity ownership (Applications vs
  Offers).
- **ADR-009** notification delivery, retry, and reconciliation.
- **ADR-010** internship lifecycle and cancellation.

Update `docs/architecture.md` and `docs/api-conventions.md` to match.

### Deployment readiness

- Reverse proxy + TLS (none in the repo today).
- CORS or same-origin proxying for the frontend. No service currently sends CORS
  headers.
- Strong secrets with `DEBUG=false`, real `ALLOWED_HOSTS`, HTTPS redirect.
- `SECURE_PROXY_SSL_HEADER` plus secure-cookie settings in the four services
  that currently ignore `SECURE_*` entirely (only identity reads them).
- `pg_dump` backup procedure with off-host copies.
- Centralized/persistent logs.
- A staging Compose variant or overlay.
- Write it up in `docs/deployment.md`.

### Frontend decision

`frontend/` is still a placeholder. The spec requires a React/Next.js client.
Choose the framework and record it as an ADR before the technical validation,
otherwise the demo is API-only.

## Known risks to communicate

- `offers/0002_uuid_identifiers` and `internships/0002_uuid_identifiers` drop
  existing rows. Only run them on fresh/dev databases.
- Existing applications were backfilled with placeholder dates
  (`2027-01-01` → `2027-06-30`).
- The applications → internships call is synchronous inside the DB transaction;
  a downstream success can be lost if the local commit fails (Applications
  P1-5).
- Notifications is specified inside Internship Management in the technical spec
  but is a separate service here; confirm the boundary with the supervisor.
