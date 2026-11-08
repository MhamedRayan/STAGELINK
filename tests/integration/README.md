# Integration tests

These tests drive the running services over HTTP. They complement the per-service
unit tests by checking the contracts at the service boundary: headers, payload
field names, UUIDs, dates, status codes, and rollback behaviour.

## Prerequisites

Start the stack from the repository root:

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build \
  identity offers applications internships
```

Wait until the health endpoints respond:

```bash
for port in 8001 8002 8003 8004; do
  curl --fail "http://localhost:$port/health/"
done
```

## Run the suite

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r tests/integration/requirements.txt
python -m unittest discover -s tests/integration -v
```

The tests read `JWT_SIGNING_KEY` and `INTERNAL_SERVICE_TOKEN` from the
environment. Their defaults match `.env.example`, so they work with an unmodified
local stack. If you changed those values, export the same values before running
the suite.

The suite mints its own user tokens with the shared signing key. That keeps it
independent of Identity registration throttles and of privileged account
provisioning; it still exercises the exact token claims the services validate.

## What is covered

- A fully approved application is confirmed after `internships` accepts the
  internal create call.
- The internship carries the application's UUIDs and dates.
- Repeating the internal create is idempotent and returns `200`.
- The internal endpoint rejects missing and incorrect service tokens.
- A downstream conflict returns `502` and rolls back the application state.

## Pending internship scenarios

These are part of the internship delivery but stay gated on other services:

| Scenario | Blocked on |
| --- | --- |
| Supervisor assignment visible to the supervisor | Identity provisioning of a real supervisor account (Identity P0-4), or a seed command |
| Cancellation approval releases the place | `POST /api/internal/applications/{id}/release-place/` in Applications |
| Exactly one notification on confirmation | Notifications UUID recipient support (Notifications P0-1) |

The service-level tests in `services/internships` cover the same rules with the
external clients mocked, so the internship behaviour is verified while the seams
are unavailable.

## Stop the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
```
