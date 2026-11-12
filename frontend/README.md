# Frontend

The STAGELINK web client is not implemented yet. This directory is reserved for
it so that the backend contracts and local ports can be planned consistently.

## Intended direction

- A TypeScript single-page application.
- Consumes the services through their OpenAPI contracts in `contracts/`.
- Runs on `http://localhost:3000` in local development (see `.env.example`).
- Talks to `identity` for authentication and to the domain services for
  offers, applications, internships and notifications.
- Sends `Authorization: Bearer <access>` on every API call. There are no
  cookies, so `CORS_ALLOWED_ORIGINS` only needs to list the front-end origin.
- Stores the rotated `refresh` token returned by every refresh; the previous
  one is blacklisted.
- Calls `POST /api/auth/logout/`, `POST /api/users/me/password/` and
  `POST /api/users/me/deactivate/` for account lifecycle. Password changes and
  deactivation revoke all refresh tokens.
- Never calls `/api/internal/` routes; those require the service token.

The framework choice, build tooling and test strategy will be captured in
`docs/decisions.md` when the client is scaffolded. Until then, this directory
contains documentation only.
