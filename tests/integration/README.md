# Integration tests

These tests drive the running services over HTTP. They complement the per-service
unit tests by checking the contracts at the service boundary: headers, payload
field names, UUIDs, dates, status codes, and rollback behaviour.

## Prerequisites

Start the stack from the repository root:

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build \
  identity offers applications internships notifications
```

Wait until the health endpoints respond:

```bash
for port in 8001 8002 8003 8004 8005; do
  curl --fail "http://localhost:$port/health/"
done
```

The real-account flow uses the demo platform administrator. Seed it once:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec -T identity python manage.py seed_demo
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

`test_applications_internships.py` and `test_notifications.py` mint user tokens
with the shared signing key. That keeps them independent of registration
throttles while still exercising the exact claims the services validate.

`test_identity.py` does not mint tokens. It registers real accounts through the
API, signs in with real passwords, and uses the issued access tokens for the
whole journey. The platform administrator is the only bootstrap account; the
full-flow test skips with instructions if `seed_demo` has not been run.

## What is covered

- **Applications → Internships:** a fully approved application is confirmed
  after `internships` accepts the internal create call; the internship carries
  the application's UUIDs and dates; repeating the internal create is
  idempotent; missing or incorrect service tokens are rejected; a downstream
  conflict rolls back the application state.
- **Capacity:** the reservation model blocks a second acceptance when the offer
  is full, and confirmation withdraws the student's other open applications.
- **Notifications:** internal creation is idempotent, the recipient sees exactly
  one notification, mark-read is idempotent, a user JWT cannot call the internal
  endpoint, and a student confirmation notifies the company and the university
  administrator exactly once.
- **Identity lifecycle:** register → login → read profile → change password →
  old refresh token rejected → new login → logout → refresh rejected →
  deactivate → login rejected.
- **Identity company verification:** registration creates an inactive company;
  it stays unable to log in until a platform administrator verifies it.
- **Full real-account flow:** a registered company is verified, creates and
  publishes an offer; a registered student applies; the company accepts; a
  provisioned university administrator validates; the student accepts and an
  internship is created; the university administrator assigns a provisioned
  supervisor; the supervisor sees the internship; the internal application-count
  endpoint reports the confirmed application.

## Conventions

Integration tests use unique emails, offer titles and application IDs, so the
suite can run repeatedly against the same database. They leave their data in
place; use `down -v` only when you want a clean local environment.

## Stop the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
```
