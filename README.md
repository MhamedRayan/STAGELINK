# STAGELINK

STAGELINK is a service-oriented platform that connects students with internship
opportunities and helps companies manage the full internship lifecycle.

The repository is organised as a set of independently deployable Django
services with explicit, contract-first HTTP APIs.

## Services

| Service         | Responsibility                                      | Local port |
| --------------- | --------------------------------------------------- | ---------- |
| `identity`      | Accounts, authentication and profiles               | `8001`     |
| `offers`        | Internship offers and search                        | `8002`     |
| `applications`  | Applications and their status transitions           | `8003`     |
| `internships`   | Active internships and supervision                  | `8004`     |
| `notifications` | User notifications and delivery preferences         | `8005`     |

The planned web client lives in [`frontend/`](frontend/README.md). It is not
implemented yet.

## Repository layout

```text
services/    Django services, one database per service
contracts/   OpenAPI descriptions, one per service
frontend/    Web client (placeholder)
tests/       Cross-service integration, end-to-end tests and fixtures
infra/       Local infrastructure, currently Docker Compose
docs/        Architecture, conventions, workflows and decisions
```

## Quick start

```bash
cp .env.example .env

docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

Once the containers are healthy, every service exposes a health endpoint:

```bash
curl http://localhost:8001/health/
curl http://localhost:8002/health/
curl http://localhost:8003/health/
curl http://localhost:8004/health/
curl http://localhost:8005/health/
```

To run a single service without Docker:

```bash
cd services/offers
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

See [`docs/setup.md`](docs/setup.md) for prerequisites and troubleshooting.

## Development

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.
- API changes start in [`contracts/`](contracts) and follow
  [`docs/api-conventions.md`](docs/api-conventions.md).
- Architectural context is documented in
  [`docs/architecture.md`](docs/architecture.md).
- Record non-trivial decisions in [`docs/decisions.md`](docs/decisions.md).

## Testing

Each service has its own test suite:

```bash
cd services/identity
python manage.py test
```

Cross-service tests live under `tests/integration/` and run against the Docker
Compose stack:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build \
  identity offers applications internships

python -m pip install -r tests/integration/requirements.txt
python -m unittest discover -s tests/integration -v
```

Continuous integration runs the unit tests for all services and the integration
suite on every push and pull request. See
[`tests/integration/README.md`](tests/integration/README.md) for details.
