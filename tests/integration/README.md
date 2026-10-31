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

## Stop the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
```
