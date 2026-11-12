# STAGELINK Identity & Profiles

Standalone Django REST Framework service for accounts, authoritative roles, authentication, profile updates, and trusted-service user lookups. This service owns its PostgreSQL database and stores cross-service references as UUID values only; it has no cross-service database joins or foreign keys.

## Requirements

- Python 3.12+
- PostgreSQL 14 or newer
- Dependencies in `requirements.txt`

## Local setup

1. Create and activate a virtual environment, then install `requirements.txt`.
2. Copy `.env.example` to `.env`. Replace all placeholder secrets with randomly generated values. Keep `JWT_SIGNING_KEY` and `INTERNAL_SERVICE_TOKEN` distinct; share the user JWT key only with services that validate user access tokens, and share the service token only with trusted internal callers.
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

The shared `JWT_SIGNING_KEY` and `INTERNAL_SERVICE_TOKEN` live in the root
`.env`; keep them in sync with the services that validate user tokens or call
internal endpoints.

## Demo data

`seed_demo` creates the platform administrator, a verified company, a student,
a university administrator, a supervisor, and a published demo offer in one
idempotent command:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec identity python manage.py seed_demo
```

The default password is `StagelinkDemo!2026`; use `--password` to change it and
`--json` for machine-readable output. Rerunning the command resets the demo
passwords and converges the profile, verification and offer state without
creating duplicates. It refuses to run when `DJANGO_DEBUG` is false unless
`--force` is passed. Offers must be reachable because the offer is created
through the Offers HTTP API; pass `--skip-offer` when only Identity is running.

See [`docs/setup.md`](../../docs/setup.md#seed-demo-data) for the full account
list and options.

## Roles and account activation

The authoritative role values are `student`, `company`, `supervisor`, `university_admin`, and `platform_admin`. Public registration accepts only `student` and `company`, so clients cannot grant themselves administrative privileges. Company registration always creates an inactive account. A platform administrator verifies and activates company accounts through the verification API; superusers can be provisioned with `createsuperuser` and receive the `platform_admin` role.

The account endpoint permits edits to a user's own `name` and `email`. Role, activation state, password hash, UUID, and join date are protected. Role-specific student, company, and supervisor profiles are created idempotently whenever those users are created and are repaired on login if missing. Company accounts stay inactive until a platform administrator verifies them through the API.

Refresh tokens rotate on every use and the submitted token is blacklisted. Logging out blacklists one token. Changing the password or deactivating the account blacklists every refresh token for that user, so the client must sign in again. Access tokens are stateless and remain valid until they expire (15 minutes by default); they are not individually revocable across services.

## API

All routes are rooted at `/api/`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health/` | Public | Liveness probe for Docker and load balancers |
| `POST` | `/api/auth/register/` | Public, rate-limited | Register a student or inactive company |
| `POST` | `/api/auth/login/` | Public, rate-limited | Validate credentials and issue a JWT pair |
| `POST` | `/api/auth/refresh/` | Valid refresh token | Rotate the refresh token and issue a new access token |
| `POST` | `/api/auth/logout/` | User access token | Blacklist the supplied refresh token |
| `GET` | `/api/users/me/` | User access token | Read caller's profile |
| `PATCH` | `/api/users/me/` | User access token | Update caller's name or email |
| `POST` | `/api/users/me/password/` | User access token | Change password and revoke all refresh tokens |
| `POST` | `/api/users/me/deactivate/` | User access token | Deactivate the account and revoke all refresh tokens |
| `GET/PUT` | `/api/users/me/profile/` | User access token | Read or replace the caller's student, company, or supervisor profile |
| `GET` | `/api/companies/{uuid}/profile/` | Public | Read non-sensitive fields for an active, verified company |
| `GET` | `/api/internal/users/{uuid}/` | `X-Service-Token` | Return minimal user details to trusted services |
| `GET` | `/api/internal/users/` | `X-Service-Token` | Filter and paginate users, or batch lookup up to 100 UUIDs |
| `GET` | `/api/admin/companies/?status=pending\|active\|rejected` | Platform admin | List companies by verification status |
| `POST` | `/api/admin/companies/{uuid}/verify/` | Platform admin | Verify and activate a company |
| `POST` | `/api/admin/companies/{uuid}/reject/` | Platform admin | Reject a company with a required reason |
| `GET/POST` | `/api/admin/users/` | Platform admin | List accounts or provision a company, university admin, or supervisor |
| `PATCH` | `/api/admin/users/{uuid}/` | Platform admin | Update activation or company verification fields |

Role profile fields:

- Students: `university`, `department`, `specialty`, `academic_year`, `matricule`.
- Companies: `legal_name`, `address`, `contact_person`, `phone`, `website`, `description`.
- Supervisors: `department`, `grade`.

Profile references are plain text in this release; reference-data IDs are planned for P1. Role profile `PUT` replaces the submitted profile fields and cannot change account role, email, or activation state. `university_admin` and `platform_admin` accounts do not have a role-specific profile endpoint.

Internal directory filters accept `role`, `department`, and `page` and return **active accounts only**, so callers do not notify deactivated users. Batch lookup uses `ids` as a comma-separated list and cannot be combined with other filters; it returns only each matching user's `id` and `name` regardless of activation state, so historical display names keep working. Filtered directory results expose `id`, `name`, `email`, and `role`; the existing single-user endpoint is unchanged.

Provisioning accepts either a validated `password` or `generate_password: true`. A generated value is returned as `one_time_password` in the creation response only; it is not included in later reads. Company accounts created by either public registration or provisioning start pending and inactive. Admin updates cannot change role, email, or password.

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
    "role": "student",
    "is_active": true,
    "date_joined": "2026-10-17T10:00:00Z"
  }
}
```

Access tokens expire after 15 minutes and refresh tokens after 7 days by default; both durations can be configured with environment variables. Access tokens carry `user_id`, `email`, and `role` claims. User tokens use `JWT_SIGNING_KEY` and HS256 so each service can validate them locally.

Internal calls must send the shared `X-Service-Token` header whose value matches `INTERNAL_SERVICE_TOKEN`. The endpoint rejects user tokens, missing or incorrect service tokens, and requests made when no service token is configured. The token is never exposed to the frontend.

Internal lookup returns only `id`, `email`, `name`, `role`, and `is_active`; unknown UUIDs return `404`.

## Environment variables

`.env.example` lists the supported settings. `DJANGO_SECRET_KEY`, a database configuration (`DATABASE_URL` or `DB_*`), `JWT_SIGNING_KEY`, and `INTERNAL_SERVICE_TOKEN` are required in shared environments. Production must set `DJANGO_DEBUG=False`, strong independent signing secrets, appropriate `DJANGO_ALLOWED_HOSTS`, and HTTPS settings (`SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS`) for its reverse proxy setup. No secrets belong in source control.

## Migrations and tests

```powershell
python manage.py migrate
python manage.py test api
```

Tests cover public role limits, password hashing, company activation and verification, JWT claims, login behavior, role-specific profiles and protected fields, admin provisioning and permission checks, and service-only directory lookups. A database must be configured through `DATABASE_URL` or `DB_*`; CI runs the suite against PostgreSQL, while SQLite is sufficient for a quick local run.

## Local console client

Start the Django server, then open another terminal in the project root and run:

```powershell
.\.venv\Scripts\python.exe console_client.py
```

The menu can register and log in users, refresh a token, read or update the current profile, and call the internal user lookup endpoint. The API base URL defaults to `http://127.0.0.1:8000`; set `STAGELINK_API_URL` to use another local server address. Access and refresh tokens stay in memory for the current console session.

The internal lookup option sends the `INTERNAL_SERVICE_TOKEN` from `.env` in the `X-Service-Token` header. Keep this console client local; do not distribute it with the service token.
