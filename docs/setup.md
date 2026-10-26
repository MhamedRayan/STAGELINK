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
gets its own database from Compose; the shared `JWT_SIGNING_KEY`,
`SERVICE_JWT_SIGNING_KEY`, and `INTERNAL_SERVICE_TOKEN` must be identical across
the services that use them.

## 3. Start the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

The first run builds five images and initialises five PostgreSQL databases.
Use `-d` to run in the background:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d
```

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

Cross-service suites under `tests/` will gain their own runner as they are
implemented.

## Reset local data

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

This permanently removes the local databases.

## Frontend

The web client is not implemented yet. `frontend/README.md` records the
intended stack and will be replaced when the application is scaffolded.

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
