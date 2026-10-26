# STAGELINK: Notifications & Communication service

Django REST Framework microservice that stores in-app notifications, shows each user only their own, tracks read state, and accepts trusted internal requests from other services.

Related documents: `project.md` (whole system), `service.md` (this service's plan), `api_contract.md` (how other services and the frontend use this API).

## Requirements
- Python 3.12 or newer
- PostgreSQL for production/Compose (SQLite is the local default)

## Setup
```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env  (then edit .env)
python manage.py migrate
python manage.py runserver 8005
```

Check it works: open http://127.0.0.1:8005/health/ (or `/api/health/`) → `{"status": "ok", "service": "notifications"}`.

## Environment variables (`.env`, never committed)

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key. Generate one: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_DEBUG` | `True` for development, `False` in production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated host names |
| `DB_ENGINE` | Leave unset for SQLite or use `django.db.backends.postgresql` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | This service's own PostgreSQL database |
| `JWT_ALGORITHM` | `HS256` (shared secret) or `RS256` (public key). Must match Identity & Profiles |
| `JWT_SIGNING_KEY` | HS256: shared secret. RS256: public key in PEM, newlines written as `\n` |
| `JWT_USER_ID_CLAIM`, `JWT_ROLE_CLAIM` | Token claim names (defaults `user_id`, `role`) |
| `INTERNAL_SERVICE_TOKEN` | Secret sent by other services in `X-Service-Token`. Empty = internal endpoint closed |
| `DEV_AUTH_ENABLED` | Development shortcut: trust the `X-User-Id` header. Defaults to the value of `DJANGO_DEBUG`. **Must be off in production** |

## API

Interactive documentation (Swagger UI): http://127.0.0.1:8000/api/docs/ · raw schema: `/api/schema/`.

| Method | URL | Auth | Purpose |
|---|---|---|---|
| GET | `/health/` or `/api/health/` | none | Health check |
| GET | `/api/notifications/` | user JWT | My notifications, newest first, paginated (`?unread=true`, `?page=2`) |
| GET | `/api/notifications/unread-count/` | user JWT | `{"unread_count": N}` |
| PATCH | `/api/notifications/{id}/read/` | user JWT | Mark one notification as read (idempotent) |
| POST | `/api/notifications/read-all/` | user JWT | Mark all my notifications as read |
| POST | `/api/internal/notifications/` | `X-Service-Token` | Create a notification (service to service, deduplicated) |

Details and examples for other services: `api_contract.md`.

## Docker

The service is built by the monorepo-wide Compose file:

```bash
cd ../..
cp .env.example .env               # then edit shared secrets and database credentials
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build notifications
```

This starts the service and its own PostgreSQL database. The API is then at http://localhost:8005 (docs: http://localhost:8005/api/docs/). Migrations run automatically at start.

Notes:
- Add the service host name to `DJANGO_ALLOWED_HOSTS` so other containers can call it.
- In production set `DJANGO_DEBUG=False` (this also turns off the development-only `X-User-Id` shortcut), use strong values for `DJANGO_SECRET_KEY` and `INTERNAL_SERVICE_TOKEN`, and put the real `JWT_*` values from Identity & Profiles.

## Tests
```bash
python manage.py test
```

The suite uses SQLite by default. Configure PostgreSQL with `DB_ENGINE=django.db.backends.postgresql` (plus the `DB_*` variables) to exercise the concurrency test under the same database engine used by Compose and CI. The PostgreSQL user needs permission to create test databases.

## Project structure
```
config/              settings, root URLs, WSGI/ASGI
api/
  models.py          Notification model
  serializers.py     user view and internal create validation
  views.py           endpoints
  authentication.py  JWT validation (+ development-only header stub)
  permissions.py     service-token permission
  schema.py          OpenAPI descriptions of the auth classes
  tests/             automated tests
```

## Rules
- One database per service; other services' IDs are plain fields, never foreign keys.
- Naming conventions: see `project.md` section 7.1.
- Secrets only in environment variables; `.env` is never committed.
