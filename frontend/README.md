# Frontend

This directory currently contains a **throwaway API tester** for backend
development. It is not the real web client.

## API tester

`index.html` is a single self-contained file (HTML + CSS + vanilla JS, no
dependencies, no build step). It exercises the running services over HTTP and
shows every request and response in a log panel.

It covers:

- **Account** — login, current user, change password, deactivate, logout.
- **Offers** — list published or own offers, create, publish, close.
- **Applications** — apply, list (with optional status filter), company /
  university / student decisions, withdraw.
- **Internships** — list, assign a supervisor, start, complete.
- **Notifications** — list, unread count, mark one read, mark all read.

Refresh tokens rotate: the tester stores the new `refresh` returned by every
refresh and the old one is blacklisted. Password changes and deactivation sign
the user out.

### Run it

Start the backend stack first (see [`docs/setup.md`](../docs/setup.md)), then:

```bash
python3 -m http.server 3000 --directory frontend
```

Open <http://localhost:3000>. The origin is already in the default
`CORS_ALLOWED_ORIGINS`, so no backend change is needed.

The demo accounts are listed on the login screen; the password for all of them
is `StagelinkDemo!2026`. Seed them with:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec -T identity python manage.py seed_demo
```

### Limitations

- Lists show the first page only (offers 10, applications/internships/
  notifications 20). Use the API directly or add paging if you need more.
- No registration form; create accounts through Identity or `seed_demo`.
- No routing, state management, styling system or tests. It is meant to be
  replaced when the real client is scaffolded.

## Real client

The production web client is not implemented yet. The intended direction is a
TypeScript single-page application that consumes the OpenAPI contracts in
[`contracts/`](../contracts/) and runs on `http://localhost:3000` in local
development.

- Sends `Authorization: Bearer <access>` on every API call. There are no
  cookies, so `CORS_ALLOWED_ORIGINS` only needs to list the front-end origin.
- Stores the rotated `refresh` token returned by every refresh; the previous
  one is blacklisted.
- Calls `POST /api/auth/logout/`, `POST /api/users/me/password/` and
  `POST /api/users/me/deactivate/` for account lifecycle. Password changes and
  deactivation revoke all refresh tokens.
- Never calls `/api/internal/` routes; those require the service token.

The framework choice, build tooling and test strategy will be captured in
`docs/decisions.md` when the client is scaffolded.
