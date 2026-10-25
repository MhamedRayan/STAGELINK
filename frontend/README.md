# Frontend

The STAGELINK web client is not implemented yet. This directory is reserved for
it so that the backend contracts and local ports can be planned consistently.

## Intended direction

- A TypeScript single-page application.
- Consumes the services through their OpenAPI contracts in `contracts/`.
- Runs on `http://localhost:3000` in local development (see `.env.example`).
- Talks to `identity` for authentication and to the domain services for
  offers, applications, internships and notifications.

The framework choice, build tooling and test strategy will be captured in
`docs/decisions.md` when the client is scaffolded. Until then, this directory
contains documentation only.
