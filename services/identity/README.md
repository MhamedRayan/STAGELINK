# STAGELINK Identity & Profiles

Standalone Django REST Framework service for accounts, authoritative roles, authentication, profile updates, and trusted-service user lookups. This service owns its PostgreSQL database and stores cross-service references as UUID values only; it has no cross-service database joins or foreign keys.

## Requirements

- Python 3.12+
- PostgreSQL 14 or newer
- Dependencies in `requirements.txt`

## Local setup

1. Create and activate a virtual environment, then install `requirements.txt`.
2. Copy `.env.example` to `.env`. Replace all placeholder secrets with randomly generated values. Keep `JWT_SIGNING_KEY` and `SERVICE_JWT_SIGNING_KEY` distinct; share the user JWT key only with services that validate user access tokens, and share the service JWT key only with trusted service callers.
3. Create a dedicated PostgreSQL database and set either `DATABASE_URL` or the `DB_*` variables to its connection details.
4. Run `python manage.py migrate` and create the first platform administrator with `python manage.py createsuperuser`.
5. Start locally with `python manage.py runserver`. For deployment, serve `config.wsgi:application` with Gunicorn behind an HTTPS-terminating reverse proxy.

The custom `api.User` model and its first migration are included. Do not replace the model or run a different initial migration after databases contain user records.

## Running in the monorepo

The service is built from `services/identity` by the repository-level Compose
file. It is published on host port `8001`:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build identity
curl http://localhost:8001/health/
```

The shared `JWT_SIGNING_KEY` and `SERVICE_JWT_SIGNING_KEY` live in the root
`.env`; keep them in sync with the services that validate the corresponding
tokens.

## Roles and account activation

The authoritative role values are `Student`, `Company`, `Supervisor`, `University Administration`, and `Platform Administrator`. Public registration accepts only `Student` and `Company`, so clients cannot grant themselves administrative privileges. Company registration always creates an inactive account. A platform administrator can manually verify and activate company accounts through Django admin; superusers can be provisioned with `createsuperuser` and receive the `Platform Administrator` role.

The profile endpoint permits edits to a user's own `name` and `email`. Role, activation state, password hash, UUID, and join date are protected. Password changes should be handled through a separate authenticated flow before being exposed to users.

## API

All routes are rooted at `/api/`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health/` | Public | Liveness probe for Docker and load balancers |
| `POST` | `/api/auth/register/` | Public, rate-limited | Register a student or inactive company |
| `POST` | `/api/auth/login/` | Public, rate-limited | Validate credentials and issue a JWT pair |
| `POST` | `/api/auth/refresh/` | Valid refresh token | Issue a new access token |
| `GET` | `/api/users/me/` | User access token | Read caller's profile |
| `PATCH` | `/api/users/me/` | User access token | Update caller's name or email |
| `GET` | `/api/internal/users/{uuid}/` | Scoped service JWT | Return minimal user details to trusted services |

Successful login response:

```json
{
  "token_type": "Bearer",
  "access": "<short-lived access JWT>",
  "refresh": "<refresh JWT>",
  "expires_in": 900,
  "user": {
    "id": "<uuid>",
    "email": "student@example.edu",
    "name": "Sample Student",
    "role": "Student",
    "is_active": true,
    "date_joined": "2026-10-17T10:00:00Z"
  }
}
```

Access tokens expire after 15 minutes and refresh tokens after 7 days by default; both durations can be configured with environment variables. Access tokens carry `user_id`, `email`, and `role` claims. User tokens use `JWT_SIGNING_KEY` and HS256 so each service can validate them locally.

Internal calls must use a separate HS256 service JWT signed with `SERVICE_JWT_SIGNING_KEY`, with `iss` set to `SERVICE_JWT_ISSUER`, `aud` set to `SERVICE_JWT_AUDIENCE`, a trusted service name in `sub`, `scope` exactly `identity:users:read`, and standard `iat` and `exp` claims no more than five minutes apart. The endpoint rejects user tokens, missing/expired tokens, and service tokens with any other scope. Never expose the service signing key to the frontend.

Internal lookup returns only `id`, `email`, `name`, `role`, and `is_active`; unknown UUIDs return `404`.

## Environment variables

`.env.example` lists the supported settings. `DJANGO_SECRET_KEY`, a database configuration (`DATABASE_URL` or `DB_*`), `JWT_SIGNING_KEY`, and `SERVICE_JWT_SIGNING_KEY` are required in shared environments. Production must set `DJANGO_DEBUG=False`, strong independent signing secrets, appropriate `DJANGO_ALLOWED_HOSTS`, and HTTPS settings (`SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS`) for its reverse proxy setup. No secrets belong in source control.

## Migrations and tests

```powershell
python manage.py migrate
python manage.py test api
```

Tests cover public role limits, password hashing, company activation defaults, JWT claims, login behavior, profile access and protected fields, and service-only internal lookups. A database must be configured through `DATABASE_URL` or `DB_*`; CI runs the suite against PostgreSQL, while SQLite is sufficient for a quick local run.

## Local console client

Start the Django server, then open another terminal in the project root and run:

```powershell
.\.venv\Scripts\python.exe console_client.py
```

The menu can register and log in users, refresh a token, read or update the current profile, and call the internal user lookup endpoint. The API base URL defaults to `http://127.0.0.1:8000`; set `STAGELINK_API_URL` to use another local server address. Access and refresh tokens stay in memory for the current console session.

The internal lookup option creates a short-lived development service token using `SERVICE_JWT_SIGNING_KEY` from `.env`. Keep this console client local; do not distribute it with the service key.
