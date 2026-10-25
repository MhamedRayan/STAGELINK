# API conventions

All public service APIs follow these rules. Individual contracts in
`contracts/` add domain-specific operations.

## Base URL and versioning

- Resource endpoints live under `/api/v1/`.
- Operational endpoints such as `/health/` are unversioned.
- A breaking change requires a new version path. Additive changes may stay in
  the current version.
- Local port assignments are listed in the root `README.md`.

## Contracts first

`contracts/<service>.yaml` is the source of truth. The workflow is:

1. Change the contract.
2. Review the compatibility impact.
3. Implement the service and tests.
4. Update consumers.

Contracts must remain valid OpenAPI 3.0 documents.

## Formatting

- Request and response bodies are JSON (`application/json`).
- Field names use `snake_case`.
- Resource identifiers are opaque strings/UUIDs; do not expose database row
  order as an identifier.
- Timestamps use ISO 8601 in UTC, for example `2026-10-25T14:30:00Z`.
- Durations are expressed in a named unit, for example `duration_weeks`.
- Monetary values use a decimal string plus an ISO 4217 currency code; never
  use binary floating point for money.

## Methods and status codes

| Method   | Intended use                                  |
| -------- | --------------------------------------------- |
| `GET`    | Read a resource or collection; no side effects |
| `POST`   | Create a resource or trigger an action        |
| `PATCH`  | Partial update                                |
| `PUT`    | Full replacement where explicitly documented  |
| `DELETE` | Remove a resource                             |

Use `200` for successful reads and updates, `201` with a `Location` header for
creation, `202` for accepted asynchronous work, `204` for deletion without a
body, `400` for malformed input, `401` for missing/invalid credentials, `403`
for insufficient permission, `404` for absent resources, `409` for state
conflicts, `422` for semantically invalid input, and `429` for rate limiting.

## Errors

Errors use a stable envelope:

```json
{
  "code": "offer_not_available",
  "message": "The offer is no longer accepting applications.",
  "details": {
    "offer_id": "9f1c0d7e-1d89-4d9a-8f13-3f4c0c6a2b1e"
  }
}
```

`code` is machine-readable and stable. `message` is human-readable and may
change. `details` is optional and may contain field-level validation context.
Never return stack traces or internal exception text.

## Collections

- Use cursor pagination for large or frequently changing collections and
  `limit`/`offset` for small, stable ones.
- Default page size is 20; the maximum is 100.
- Collection responses include the items plus pagination metadata:

  ```json
  {
    "results": [],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 0
    }
  }
  ```

- Filter with explicit, documented query parameters. Unknown parameters are
  rejected with `400` once validation middleware is in place.

## Authentication and authorization

Send a bearer access token:

```http
Authorization: Bearer <access-token>
```

Permissions are checked in the owning service. A gateway or frontend must not
be the only place where authorization is enforced.

## Idempotency

Creating operations that may be retried accept an `Idempotency-Key` header.
The key is scoped to the authenticated user and operation. Reusing a key with a
different payload returns `409`.

## Health and readiness

Every service implements:

```http
GET /health/
```

```json
{
  "status": "ok",
  "service": "offers"
}
```

A service that cannot serve traffic should return `503` in the same schema when
readiness checks are added.
