# Setup

## Prerequisites

| Tool                  | Version            |
| --------------------- | ------------------ |
| Git                   | 2.30+              |
| Docker Engine         | 24+                |
| Docker Compose plugin | 2.24+              |
| Python (local runs)   | 3.12               |

You need roughly 4 GB of free memory to run all five services and databases.

## 1. Clone the repository

```bash
git clone <repository-url> stagelink
cd stagelink
```

## 2. Create the environment file

```bash
cp .env.example .env
```

Review `.env`. The defaults are intended for local development only. Use real
secrets and a strong database password for any shared environment. Each service
gets its own database from Compose; the shared `JWT_SIGNING_KEY` and
`INTERNAL_SERVICE_TOKEN` must be identical across the services that use them.

## 3. Start the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

The first run builds five images and initialises five PostgreSQL databases. Use
`-d` to run in the background:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d
```

The stack also starts two scheduler sidecars, `scheduler-offers` and
`scheduler-applications`, which run the idempotent maintenance commands every
five minutes. Failed runs are retried on the next interval; stop them with the
rest of the stack.

## Account lifecycle

Registration, login and refresh are not the whole account API. The front end
should use these routes:

| Route | Purpose |
| --- | --- |
| `POST /api/auth/logout/` | Blacklist one refresh token. Idempotent. |
| `POST /api/users/me/password/` | Change password with `current_password` + `new_password`; revokes every refresh token. |
| `POST /api/users/me/deactivate/` | Deactivate the account with `password`; revokes every refresh token. |

Refresh tokens rotate on use: always store the new `refresh` value returned by
`POST /api/auth/refresh/`. Access tokens last 15 minutes by default and are not
individually revocable.

## 4. Verify the services

| Service         | URL                            |
| --------------- | ------------------------------ |
| `identity`      | http://localhost:8001/health/  |
| `offers`        | http://localhost:8002/health/  |
| `applications`  | http://localhost:8003/health/  |
| `internships`   | http://localhost:8004/health/  |
| `notifications` | http://localhost:8005/health/  |

```bash
for port in 8001 8002 8003 8004 8005; do
  curl --fail "http://localhost:$port/health/"
done
```

Each response should be similar to:

```json
{"status": "ok", "service": "identity"}
```

## Seed demo data

One command creates every account needed to demonstrate the full workflow,
including a verified company and a published offer:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec identity python manage.py seed_demo
```

| Role             | Email                         | Password              |
| ---------------- | ----------------------------- | --------------------- |
| Platform admin   | `admin@stagelink.demo`        | `StagelinkDemo!2026`  |
| Company          | `company@stagelink.demo`      | `StagelinkDemo!2026`  |
| Student          | `student@stagelink.demo`      | `StagelinkDemo!2026`  |
| University admin | `university@stagelink.demo`   | `StagelinkDemo!2026`  |
| Supervisor       | `supervisor@stagelink.demo`   | `StagelinkDemo!2026`  |

The company account is active and verified, the student and supervisor have
complete role profiles, and the company owns a published
`Software Engineering Internship` offer with capacity 3. Every account can log
in immediately through `POST /api/auth/login/`.

The command is idempotent. Rerunning it resets the demo account passwords,
converges the profile and verification state, and leaves an already-published
offer untouched. It refuses to run while `DJANGO_DEBUG` is false unless you pass
`--force`, which prevents accidental seeding of a production database.

Useful options:

```bash
# Identity only (Offers is not running yet)
... exec identity python manage.py seed_demo --skip-offer

# Machine-readable output
... exec identity python manage.py seed_demo --json

# Point at a different Offers instance or change the offer
... exec identity python manage.py seed_demo \
  --offers-url http://localhost:8002 \
  --offer-title "Data Engineering Internship" \
  --offer-capacity 5 \
  --offer-deadline-days 60
```

`--password` and `--domain` change the shared demo password and email domain.
Identity writes its own accounts directly through the ORM and creates the offer
through the Offers HTTP API; it never reads the Offers database.

## Uploads and media

The internships service stores student submissions on the `internships-media`
Docker volume mounted at `/app/media`:

```bash
# The volume must be listed
docker volume ls | grep internships-media

# An upload created through the API must survive a recreate
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec internships find /app/media -type f
```

Files are never served from a public URL; downloads use the authorised endpoint.
The 10 MB limit is controlled by `MAX_SUBMISSION_SIZE_BYTES`. If you add a
reverse proxy, set `client_max_body_size` slightly above it. Backup and restore
procedures are in [`media-storage.md`](media-storage.md).

## 5. Useful Compose commands

```bash
# Follow all logs
docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f

# Follow one service
docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f offers

# Rebuild one service after a dependency change
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build offers

# Stop containers but keep database volumes
docker compose --env-file .env -f infra/docker/docker-compose.yml down

# Stop and remove local database volumes
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
```

## Run a service outside Docker

```bash
cd services/offers
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

Without database environment variables, every service uses SQLite at
`services/<service>/db.sqlite3`. This is convenient for unit tests but does not
exercise PostgreSQL-specific behaviour.

To use a running Compose database from the host, expose the database port in a
local override file and set `DB_ENGINE=django.db.backends.postgresql` plus
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. `identity` and
`applications` also accept a `DATABASE_URL`, which takes precedence when set.
By default, database ports are not published to the host.

## Run tests

```bash
cd services/identity
python manage.py check
python manage.py test
```

Repeat for the other services, or run all of them:

```bash
for service in identity offers applications internships notifications; do
  (cd "services/$service" && python manage.py test) || exit 1
done
```

The shared CI workflow runs every suite against PostgreSQL. To reproduce that
locally, provide `DB_ENGINE=django.db.backends.postgresql` plus the `DB_*`
variables; the notifications concurrency test in particular is only meaningful
against PostgreSQL.

Cross-service tests live in `tests/integration/` and run against the Compose
stack over real HTTP:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build \
  identity offers applications internships

# The real-account flow test uses the demo platform administrator.
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec -T identity python manage.py seed_demo

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r tests/integration/requirements.txt
python -m unittest discover -s tests/integration -v
```

The suite reads `JWT_SIGNING_KEY` and `INTERNAL_SERVICE_TOKEN` from the
environment; its defaults match `.env.example`. `tests/integration/test_identity.py`
creates real accounts through the API and signs them in, rather than minting
tokens. If the platform administrator has not been seeded, the full-flow test
skips with instructions. See
[`tests/integration/README.md`](../tests/integration/README.md) for the covered
scenarios and cleanup commands.

## Reset local data

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

This permanently removes the local databases.

## Frontend

The web client is not implemented yet. `frontend/README.md` records the
intended stack and will be replaced when the application is scaffolded.

The APIs accept browser requests from the origins in `CORS_ALLOWED_ORIGINS`.
The Compose default allows `http://localhost:3000` and
`http://127.0.0.1:3000`. Update the root `.env` if the front end uses another
port. Authentication uses the `Authorization: Bearer <access>` header, not
cookies.

For production deployment, TLS, backups, schedulers and the security checklist,
see [deployment.md](deployment.md).

## Troubleshooting

### `env file .env not found`

The commands must run from the repository root, and the file must exist:

```bash
cp .env.example .env
```

### Port already in use

Change the host side of the mapping in
`infra/docker/docker-compose.yml` (for example `"8102:8000"`) or stop the
process using the port:

```bash
ss -ltnp | grep 8002
```

### A container exits immediately

Inspect its logs:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml logs --tail=100 offers
```

Common causes are an unavailable database, a failed migration, or an invalid
environment value.

### Database authentication failure

The PostgreSQL volume keeps the credentials from its first initialisation.
After changing `POSTGRES_USER` or `POSTGRES_PASSWORD`, recreate the volumes with
`down -v` in local development only.

### Changes are not visible

Images copy source code at build time. Rebuild the affected service:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build offers
```
