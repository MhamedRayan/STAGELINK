# Deployment

This guide describes a single-host production deployment of the five Django
services behind one reverse proxy. It assumes PostgreSQL for every service and
a TLS-terminating proxy such as nginx, Caddy or a cloud load balancer.

For local development use [setup.md](setup.md). Docker Compose in this
repository is a development stack; it is not a hardened production manifest.

## Architecture

| Service | Public path (suggested) | Database | Owns |
| --- | --- | --- | --- |
| Identity | `/api/auth/`, `/api/users/`, `/api/companies/`, `/api/admin/` | `identity` | Accounts, profiles, tokens, directory |
| Offers | `/api/offers/` | `offers` | Offer lifecycle and capacity |
| Applications | `/api/applications/` | `applications` | Applications and reservations |
| Internships | `/api/internships/` | `internships` | Internship lifecycle and evaluations |
| Notifications | `/api/notifications/` | `notifications` | Stored notifications and read state |

Internal endpoints under `/api/internal/` must **not** be exposed by the reverse
proxy. They are called service-to-service with `X-Service-Token`.

Each service has its own database and its own database role. No service reads
another service's tables.

## 1. Prerequisites

- Docker with Compose, or Python 3.12+ and PostgreSQL 16 per service.
- A domain, a TLS certificate, and a reverse proxy.
- A secret manager or an `.env` file with `0600` permissions.
- A backup target for PostgreSQL dumps and the Internships media volume.

## 2. Secrets and environment

Start from the repository `.env.example` and change **every** value marked
`dev-only`, `replace-with` or `replace-me`.

Generate independent secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Required production values:

```dotenv
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<64+ random characters, unique per service>
DJANGO_ALLOWED_HOSTS=api.example.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com

JWT_SIGNING_KEY=<32+ random characters, identical in all services>
INTERNAL_SERVICE_TOKEN=<32+ random characters, identical in all services>

SECURE_SSL_REDIRECT=true
SECURE_HSTS_SECONDS=31536000
SECURE_PROXY_SSL_HEADER=true

LOGIN_THROTTLE_RATE=10/minute
REGISTER_THROTTLE_RATE=10/hour

POSTGRES_USER=stagelink
POSTGRES_PASSWORD=<strong password>
```

Notes:

- `DJANGO_SECRET_KEY` and `JWT_SIGNING_KEY` must be different. Identity refuses
  to start in production when they are weak, identical or still contain
  `replace-with`.
- Only Identity issues user tokens. Every other service verifies them with the
  same `JWT_SIGNING_KEY`.
- `INTERNAL_SERVICE_TOKEN` is a shared secret. Rotate it by deploying all
  services together; mixed values cause internal calls to return `403`.
- `SECURE_PROXY_SSL_HEADER=true` is safe only when a trusted proxy overwrites
  `X-Forwarded-Proto`. Do not trust client-supplied values directly.
- List every deployed front-end origin in `CORS_ALLOWED_ORIGINS`. Do not use a
  wildcard with credentials. The APIs use Bearer tokens, so
  `CORS_ALLOW_CREDENTIALS` stays disabled.

## 3. Build and migrate

Build images once per release and push them to your registry:

```bash
for service in identity offers applications internships notifications; do
  docker build -t registry.example.com/stagelink/$service:$TAG services/$service
  docker push registry.example.com/stagelink/$service:$TAG
done
```

Run migrations before starting new application containers:

```bash
for service in identity offers applications internships notifications; do
  docker run --rm --env-file .env registry.example.com/stagelink/$service:$TAG \
    python manage.py migrate --noinput
done
```

Collect static files if the reverse proxy serves them itself; otherwise
WhiteNoise serves them from the image:

```bash
python manage.py collectstatic --noinput
```

Deployment order for a first install:

1. Identity (accounts must exist before other services receive tokens).
2. Offers.
3. Applications.
4. Internships.
5. Notifications.

For later releases the order is not critical, but deploy Identity and the
services that verify its token format together whenever the JWT settings change.

## 4. Reverse proxy and TLS

Terminate TLS at the proxy and forward only public routes. Example nginx
fragment:

```nginx
upstream identity      { server identity:8000; }
upstream offers        { server offers:8000; }
upstream applications  { server applications:8000; }
upstream internships   { server internships:8000; }
upstream notifications { server notifications:8000; }

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 12m;   # Internships submissions default to 10 MiB.

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/auth/            { proxy_pass http://identity; }
    location /api/users/           { proxy_pass http://identity; }
    location /api/companies/       { proxy_pass http://identity; }
    location /api/admin/           { proxy_pass http://identity; }
    location /api/offers/          { proxy_pass http://offers; }
    location /api/applications/    { proxy_pass http://applications; }
    location /api/internships/     { proxy_pass http://internships; }
    location /api/notifications/   { proxy_pass http://notifications; }

    # Internal service-to-service routes are never public.
    location /api/internal/ { return 404; }
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}
```

If all services share one hostname, route by path as above. If each service has
its own hostname, create one server block per service and set
`DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` accordingly.

Health checks are unauthenticated:

```bash
curl -fsS https://api.example.com/health/
```

Each service returns `{"status": "ok", "service": "<name>"}` on its own port.

## 5. Scheduled commands

Two idempotent commands must run regularly. The development Compose file runs
them as sidecar containers every five minutes. In production use cron, systemd
timers, Kubernetes CronJobs or your platform scheduler:

```cron
*/5 * * * * docker run --rm --env-file /srv/stagelink/.env registry.example.com/stagelink/offers:1.0.0 python manage.py close_expired_offers
*/5 * * * * docker run --rm --env-file /srv/stagelink/.env registry.example.com/stagelink/applications:1.0.0 python manage.py reconcile_confirmed_applications --limit 100 --older-than 60
```

Replace `1.0.0` with the deployed tag. The examples assume the database hostnames
in the environment file resolve from the scheduler host; adjust the `DB_HOST`
values when running outside the Compose network.

- `close_expired_offers` closes published offers whose deadline passed.
- `reconcile_confirmed_applications` retries applications stuck in
  `STUDENT_ACCEPTED` after a transient Internships failure.

Both are safe to run concurrently and safe to repeat. Alert if either command
fails repeatedly; the reconciliation command measures whether the confirmation
flow is healthy.

## 6. Backups and restore

Back up each database independently:

```bash
for db in identity offers applications internships notifications; do
  pg_dump --format=custom --no-owner \
    "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db-$db:5432/$db" \
    > "backups/$db-$(date +%F-%H%M).dump"
done
```

Also back up the Internships media volume (`/app/media`) with your volume
snapshot or object-storage sync tool. The database alone does not contain
uploaded submissions.

Restore into a fresh database, then run migrations:

```bash
pg_restore --no-owner --dbname "$DATABASE_URL" backups/identity-2026-11-12-0200.dump
python manage.py migrate --noinput
```

Test a restore at least once before launch and after any schema change that
adds or removes tables. Keep dumps encrypted and apply a retention policy that
matches your institution's rules.

## 7. Logs and monitoring

- Run containers with a log driver that ships stdout/stderr to your log store.
  Do not rely on container-local files; they disappear with the container.
- Application logs are structured enough to grep by request path, status and
  service. Identity logs authentication failures; Applications and Internships
  log downstream and notification failures.
- Monitor `/health/` for every service, database connectivity, disk usage for
  PostgreSQL and the media volume, and the exit status of the two scheduled
  commands.
- Alert on repeated `503` responses from Applications, Internships or
  Notifications; they indicate a downstream outage, not a client error.

## 8. Release and rollback

1. Tag the repository and build immutable images.
2. Back up the databases.
3. Run migrations.
4. Start the new containers and wait for health checks.
5. Run a smoke test: login, list offers, open one internship.
6. Keep the previous image tags until the new release is verified.

Rollback:

```bash
docker compose -f /srv/stagelink/docker-compose.yml up -d \
  --no-deps identity=<previous-tag> ...
```

If a release contains a destructive migration, roll back the application only
after restoring the matching database dump. Prefer additive migrations so a
rollback does not require data loss.

## 9. Staging

Run a second Compose project with:

- different `COMPOSE_PROJECT_NAME`, database volumes and hostnames;
- a staging `.env` with different secrets and a staging domain;
- `DJANGO_DEBUG=false`, real TLS and the same CORS/proxy settings as production;
- seeded demo data only in staging, never in production.

Use staging to verify the front-end origin, the TLS redirect, the proxy header
and the scheduled commands before touching production.

## 10. Production checklist

- [ ] `DJANGO_DEBUG=false` on every service.
- [ ] Unique, strong `DJANGO_SECRET_KEY` per service.
- [ ] `JWT_SIGNING_KEY` shared and distinct from Django secrets.
- [ ] `INTERNAL_SERVICE_TOKEN` shared and strong.
- [ ] `SECURE_SSL_REDIRECT=true`, HSTS enabled, proxy header enabled.
- [ ] `CORS_ALLOWED_ORIGINS` lists only the real front-end origins.
- [ ] `/api/internal/` blocked at the proxy.
- [ ] PostgreSQL roles use strong passwords and are not superusers.
- [ ] Backups scheduled and a restore tested.
- [ ] Media volume backed up.
- [ ] Both scheduler commands running and monitored.
- [ ] Health checks and log shipping configured.
- [ ] Login/registration throttles set to production values.
- [ ] Demo credentials from `seed_demo` changed or removed.
- [ ] TLS certificate renewal automated.

## Front-end integration

The front end is a separate origin and uses Bearer tokens:

1. `POST /api/auth/login/` returns `access` and `refresh`.
2. Send `Authorization: Bearer <access>` on every API call.
3. Keep the refresh token in memory or secure storage; refresh before the
   15-minute access token expires. The refresh response rotates the token, so
   replace the stored value with the new `refresh` every time.
4. On `401`, clear local state and send the user to login.
5. After a password change or deactivation, all refresh tokens are revoked; the
   client must sign in again.
6. Internal `/api/internal/` endpoints are never called by the browser.

The API contracts in `contracts/` are the source of truth for request and
response shapes. Run `python -m unittest discover -s tests/integration -v`
against staging after deploying a release.
