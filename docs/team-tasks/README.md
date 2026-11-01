# STAGELINK — team task briefs

One file per service, ready to send to its owner. Each brief is self-contained;
this file holds the shared rules that apply to everyone.

**Milestones:** technical validation **11 Nov 2026**, delivery **28 Nov 2026**.

- **P0** — must land before the 11 Nov technical validation.
- **P1** — must land before the 28 Nov delivery.
- **P2** — after delivery / nice to have.

## Briefs

| Service | Owner | File |
| --- | --- | --- |
| Identity & Profiles | Member 2 | [`identity.md`](identity.md) |
| Offers | Member 3 | [`offers.md`](offers.md) |
| Applications | Member 3 | [`applications.md`](applications.md) |
| Internships | Member 4 | [`internships.md`](internships.md) |
| Notifications & Communication | Member 1 | [`notifications.md`](notifications.md) |

Cross-team work (CI, integration tests, ADRs, deployment, frontend) is in
[`cross-cutting.md`](cross-cutting.md).

> The member numbers are placeholders from `services/notifications/project.md`.
> Adjust them to the real assignments before sending.

---

## Shared rules (goes with every brief)

### Repository and process

- Repo: `github.com/MhamedRayan/STAGELINK`. Branch from `main` as
  `feat/<service>-<topic>`, one focused PR per task group, fill in
  `.github/pull_request_template.md`.
- Contract-first: change `contracts/<service>.yaml` first, then the code.
- Never commit `.env`, `db.sqlite3`, uploaded files, or generated artefacts.
- Do not run the destructive migrations (`offers/0002`,
  `internships/0002`) against an environment that holds data you care about.

### Conventions (decided in ADR-007 — do not change)

- Service-owned IDs and cross-service references are **UUIDs**, exposed as
  strings; routes use `<uuid:...>`.
- Roles are lowercase `snake_case`: `student`, `company`, `supervisor`,
  `university_admin`, `platform_admin`. Matching is exact and case-sensitive.
- User calls: `Authorization: Bearer <access-token>`.
- Service-to-service calls: `X-Service-Token: <shared secret>` on
  `/api/internal/...` endpoints. Internal endpoints must not accept user JWTs.
- No cross-service foreign keys. Store other services' IDs in plain UUID
  columns.
- Status/decision **enum values** stay uppercase (`SUBMITTED`, `ACCEPT`, …);
  only role names are lowercase.
- Cross-service operations must be idempotent and safe to retry. Never duplicate
  an internship, a notification, or a place reservation.

### Required checks before opening a PR

```bash
cd services/<service>
python manage.py check
python manage.py makemigrations --check --dry-run   # no missing migrations
python manage.py test
```

If you changed a service boundary, run the cross-service suite:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build \
  identity offers applications internships
python -m pip install -r tests/integration/requirements.txt
python -m unittest discover -s tests/integration -v
```

CI runs both `Django tests (<service>)` and `Integration tests`; a PR must be
green before review.

### Definition of done (every task)

- [ ] Contract updated in `contracts/` before the implementation.
- [ ] Migration added if the model changed (reviewed, named, reversible where
      possible).
- [ ] Tests cover the new behaviour **and** the permission/error paths.
- [ ] `manage.py check`, `makemigrations --check`, and the service suite pass.
- [ ] Integration test added or updated if another service is involved.
- [ ] `.env.example` / docs updated if a new setting or endpoint exists.
- [ ] PR description states compatibility and migration impact.

### Coordination points

- **Capacity/reservation** touches Offers + Applications: agree the API and
  ownership before coding.
- **Notification events** touch Applications + Internships + Notifications:
  agree payloads and dedup keys before coding.
- **Supervisor assignment** touches Internships + Identity (supervisor
  directory).
- Post the proposed endpoint/payload in the issue or PR before implementing.

### Known risks to communicate

- `offers/0002_uuid_identifiers` and `internships/0002_uuid_identifiers` drop
  existing rows. Only run them on fresh/dev databases.
- Existing applications were backfilled with placeholder dates
  (`2027-01-01` → `2027-06-30`).
- The applications → internships call is synchronous inside the DB transaction;
  a downstream success can be lost if the local commit fails (Applications
  P1-5).
- Notifications is specified inside Internship Management in the technical spec
  but is a separate service here; confirm the boundary with the supervisor.
