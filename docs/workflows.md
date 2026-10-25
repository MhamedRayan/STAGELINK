# Workflows

## First-time setup

See [`setup.md`](setup.md). In short:

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

## Working on one service

```bash
cd services/offers
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

Run the service's checks before committing:

```bash
python manage.py check
python manage.py test
```

A service run this way uses SQLite unless `DB_ENGINE` and the `POSTGRES_*`
variables point at a running PostgreSQL instance.

## Contract-first API change

1. Open `contracts/<service>.yaml`.
2. Add or modify the operation, schemas and examples.
3. Validate the YAML and review the diff for accidental breaking changes:
   removed fields, narrowed enums, changed status codes, or new required
   request fields.
4. Implement the endpoint in the service.
5. Add service tests, plus an integration test if another service consumes it.
6. Update `docs/api-conventions.md` only when a shared rule changes.
7. Call out compatibility impact in the pull request.

## Database change

1. Update models in the owning service.
2. Generate a migration:

   ```bash
   cd services/<service>
   python manage.py makemigrations
   ```

3. Review the generated migration; do not edit old migrations that have been
   applied outside local development.
4. Apply and test:

   ```bash
   python manage.py migrate
   python manage.py test
   ```

5. Include the migration in the same pull request as the model and API change.

Data belonging to another service is not migrated here. Coordinate schema
changes at the API boundary instead.

## Cross-service change

- Identify the owning service for each field.
- Change producer contracts before consumer implementation.
- Add an integration test under `tests/integration/`.
- Keep consumers tolerant of additive fields and unknown optional values.
- Define a rollback plan when the change cannot be deployed atomically.

## Running tests

Per service:

```bash
cd services/identity
python manage.py test
```

All services locally:

```bash
for service in identity offers applications internships notifications; do
  (cd "services/$service" && python manage.py test) || exit 1
done
```

The GitHub Actions workflow runs the same per-service test command on every
push and pull request.

## Pull request flow

1. Branch from the latest default branch.
2. Make a focused change with tests.
3. Ensure CI passes.
4. Request review from a code owner.
5. Squash or merge according to repository settings; do not rewrite shared
   history.

## Release and deployment

Deployment is not automated yet. When introduced:

- Build one image per service from its own `Dockerfile`.
- Run migrations as a separate release step before rolling out new containers.
- Roll out services independently; contracts must support the transition
  window.
- Verify `/health/` after each rollout.

## Incident checklist

1. Confirm which service and version are affected.
2. Check container health, logs and database availability.
3. Roll back the affected service if the failure correlates with a release.
4. Capture a timeline and follow-up actions in an issue or decision record.
