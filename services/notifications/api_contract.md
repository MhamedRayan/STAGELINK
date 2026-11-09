# Notifications Service: Integration Guide for Other Services

Owner: Member 1 (Notifications & Communication). Status: implemented and manually tested. The machine-readable contract is `contracts/notifications.yaml` (OpenAPI 3.0.3, version 0.3.0).

## 1. What this service does

Stores in-app notifications, shows each user **only their own**, and tracks read state. It does **not** decide who must be notified or why: the calling service decides and sends **one request per recipient**. No email/SMS in v1.

Base URL (dev): `http://localhost:8005` (Docker Compose service hostname: `notifications:8000`).

All identifiers — notification IDs, recipient user IDs, and cross-service references — are **UUIDs** and travel as JSON strings. The service stores other services' IDs as plain fields; it has no cross-service foreign keys.

## 2. Creating a notification (service → service)

`POST /api/internal/notifications/`

Header: `X-Service-Token: <shared secret>` (given privately by Member 1, never committed to Git).
A user JWT is **not** accepted on this endpoint, and the endpoint fails closed when no token is configured on the server.

Body (JSON):

| Field | Type | Rules |
|---|---|---|
| `recipient_user_id` | string (UUID) | required, the user ID from Identity & Profiles |
| `type` | string | required, one of the types in section 4 |
| `title` | string | required, ≤ 255 chars |
| `message` | string | required |
| `related_object_type` | string | optional, ≤ 64 chars, e.g. `application`, `internship` |
| `related_object_id` | string | optional, ≤ 64 chars (plain ID from your service, no foreign key) |
| `deduplication_key` | string | required, ≤ 255 chars, **stable per event and recipient** (section 3) |

Example:
```json
{
  "recipient_user_id": "3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f",
  "type": "application_validated",
  "title": "Application validated",
  "message": "The university validated your application. You can now accept or decline.",
  "related_object_type": "application",
  "related_object_id": "b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c",
  "deduplication_key": "application:b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c:validated:recipient:3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f"
}
```

Responses:

| Status | Meaning |
|---|---|
| `201` | Notification created |
| `200` | Same `deduplication_key` already exists: the **existing** notification is returned unchanged (nothing new is created, even if the retry changed the content) |
| `400` | Validation error (unknown type, missing field, too long, `recipient_user_id` not a UUID) |
| `403` | Missing or wrong `X-Service-Token` |

Response body (both `201` and `200`):
```json
{
  "id": "9c8b7a65-4d3e-4f21-8a90-123456789abc",
  "recipient_user_id": "3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f",
  "type": "application_validated",
  "title": "Application validated",
  "message": "The university validated your application. You can now accept or decline.",
  "related_object_type": "application",
  "related_object_id": "b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c",
  "deduplication_key": "application:b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c:validated:recipient:3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f"
}
```

## 3. Retries and deduplication

- Build `deduplication_key` from the event, **not** from the time: `{object_type}:{object_id}:{event}:recipient:{user_id}`.
  Example: `application:1234:rejected_by_university:recipient:3f2c9a1e-7b4d-4c6a-9e2f-1a2b3c4d5e6f`.
- If your call times out or returns `5xx`, **retry with the exact same key**: it is safe and never creates a duplicate.
- Do **not** retry `400` or `403`: fix the request or the token first.
- An event with two recipients (e.g. university rejection → student **and** company) = **two requests**, one key each.
- Notification failure must not roll back your business action; log it and retry later (reconcilable).

Python example (`requests`):
```python
import os
import requests

def send_notification(recipient_user_id, type, title, message, related_object_type, related_object_id, deduplication_key):
    response = requests.post(
        f"{os.environ['NOTIFICATIONS_SERVICE_URL']}/api/internal/notifications/",
        json={
            "recipient_user_id": str(recipient_user_id),
            "type": type,
            "title": title,
            "message": message,
            "related_object_type": related_object_type,
            "related_object_id": str(related_object_id),
            "deduplication_key": deduplication_key,
        },
        headers={"X-Service-Token": os.environ["NOTIFICATIONS_SERVICE_TOKEN"]},
        timeout=5,
    )
    response.raise_for_status()  # 201 or 200 are both success
    return response.json()
```

### 3.1 Reference client (P1-1)

`services/notifications/docs/examples/notifications_client.py` is a ready-to-copy
module that implements the rules above:

- `NotificationClient.from_env()` reads `NOTIFICATIONS_SERVICE_URL` and
  `NOTIFICATIONS_SERVICE_TOKEN` (falling back to `INTERNAL_SERVICE_TOKEN`).
- `notify_on_commit(...)` runs the HTTP call after the current transaction
  commits, so a notification never blocks or rolls back a business action.
- Transient failures (timeout, connection error, `5xx`) are retried with
  exponential backoff and jitter; `4xx` is never retried.
- `build_deduplication_key(object_type, object_id, event, recipient_user_id)`
  produces the canonical key.
- Delivery failures are logged and returned as `None`; they never raise.

```python
from notifications_client import NotificationClient, build_deduplication_key

client = NotificationClient.from_env()
client.notify_on_commit(
    recipient_user_id=application.student_user_id,
    type="application_validated",
    title="Application validated",
    message="The university validated your application.",
    related_object_type="application",
    related_object_id=application.id,
    deduplication_key=build_deduplication_key(
        "application", application.id, "validated", application.student_user_id
    ),
)
```

The retry/reconciliation policy is recorded in **ADR-009** (`docs/decisions.md`).

## 4. Notification types and who sends them

| Event (from the functional spec, FR-13) | `type` | Recipient | Sent by |
|---|---|---|---|
| Company accepts an application | `application_pending_validation` | university admin(s) | Offers & Applications |
| University validates | `application_validated` | student | Offers & Applications |
| University rejects | `application_rejected_by_university` | student **and** company | Offers & Applications |
| Student accepts or declines | `student_decision` | company | Offers & Applications |
| Application confirmed (internship created) | `application_confirmed` | company and university admin | Offers & Applications |
| Automatic withdrawal | `application_withdrawn` | student / company | Offers & Applications |
| Internship created | `internship_created` | student / company | Internship Management |
| Supervisor assigned | `supervisor_assigned` | student / supervisor | Internship Management |
| Cancellation requested | `cancellation_requested` | other parties | Internship Management |
| Cancellation decided | `cancellation_decided` | other parties | Internship Management |
| Submission reviewed | `submission_reviewed` | student | Internship Management |
| Evaluation published | `evaluation_published` | student | Internship Management |
| Anything else | `generic` | any | any |

To add or rename a type, ask Member 1 (it needs a one-line change plus a migration).

### 4.1 Who calls what: recipient resolution (P0-3)

The caller resolves recipient IDs and sends one request per recipient. Identity currently does not expose a role-based directory lookup, so callers use the explicit UUIDs already stored on their own records. Once Identity P0-2 ships `role=university_admin` / `role=supervisor` lookups, callers can resolve those groups dynamically instead.

| Event | Caller | Recipient | How the recipient is resolved |
|---|---|---|---|
| Company accepts an application | Applications | university admin(s) | Explicit `university_user_id` on the application; when several admins must be notified, the caller resolves them from Identity once the directory exists and sends one request per admin |
| University validates | Applications | student | `student_user_id` on the application |
| University rejects | Applications | student and company | `student_user_id` and `company_user_id` on the application (two requests) |
| Student accepts or declines | Applications | company | `company_user_id` on the application |
| Application confirmed | Applications | company and university admin | `company_user_id` and `university_user_id` on the application (two requests) |
| Application withdrawn | Applications | student / company | `student_user_id` and `company_user_id` on the application, depending on who withdrew |
| Internship created | Internships | student and company | `student_user_id` and `company_user_id` on the internship |
| Supervisor assigned | Internships | student and supervisor | `student_user_id` and `supervisor_user_id` on the internship |
| Cancellation requested / decided | Internships | other parties | IDs stored on the internship |
| Submission reviewed / evaluation published | Internships | student | `student_user_id` on the internship |

Rules for callers:

- Never send a role name as `recipient_user_id`; always send a concrete user UUID.
- One request = one recipient. Use a distinct `deduplication_key` per recipient.
- Do not query this service for recipients; it stores notifications only.

## 5. Endpoints for the frontend (user JWT)

Header: `Authorization: Bearer <access token from Identity & Profiles>`.

| Method | URL | Result |
|---|---|---|
| GET | `/api/notifications/` | Paginated list of **my** notifications, newest first. Optional `?unread=true`, `?page=2` (20 per page) |
| GET | `/api/notifications/unread-count/` | `{"unread_count": N}` (suggested polling: every 30–60 s) |
| PATCH | `/api/notifications/{id}/read/` | Marks **that one** notification as read (idempotent) and returns it |
| POST | `/api/notifications/read-all/` | Marks all **my** unread notifications as read and returns `{"marked_read": N}` |

`{id}` is a UUID. A non-UUID identifier returns `404` exactly like a missing or foreign notification.

List response:
```json
{
  "count": 1, "next": null, "previous": null,
  "results": [
    {"id": "9c8b7a65-4d3e-4f21-8a90-123456789abc", "type": "application_validated", "title": "...", "message": "...",
     "related_object_type": "application", "related_object_id": "b6a1f0c2-8d3e-4f5a-9b7c-0d1e2f3a4b5c",
     "is_read": false, "created_at": "2026-10-16T18:53:43Z", "read_at": null}
  ]
}
```

Errors: `401` missing/invalid/expired token (or a refresh token) · `404` notification does not exist **or belongs to someone else** (existence is never revealed).

## 6. Token rules (what this service checks)

- Signature + expiry validated locally; `exp` is **mandatory**; only the configured algorithm is accepted.
- The user ID is read from a configurable claim (default `user_id`) and must be a **UUID string**. Any other value is rejected with `401`.
- Tokens with `token_type` other than `access` are rejected.
- The development-only `X-User-Id` header (when `DEV_AUTH_ENABLED=true`) accepts UUIDs only.

## 7. Response error shapes

The service returns standard DRF error bodies, not a custom envelope:

- `401`, `403`, `404`: `{"detail": "..."}`
- `400`: an object keyed by field name, each value a list of messages, e.g.
  ```json
  {"recipient_user_id": ["\"not-a-uuid\" is not a valid UUID."]}
  ```

## 8. Environment variables expected by callers

| Variable | Purpose |
|---|---|
| `NOTIFICATIONS_SERVICE_URL` | Base URL of this service, e.g. `http://notifications:8000` |
| `NOTIFICATIONS_SERVICE_TOKEN` | Shared secret sent as `X-Service-Token` |

## 9. Retention (P1-4)

Notifications are not kept forever. The operator runs:

```bash
python manage.py purge_notifications --dry-run
python manage.py purge_notifications
```

- Read notifications whose `read_at` is older than `NOTIFICATION_RETENTION_DAYS`
  (default 180) are deleted.
- Every notification created more than `NOTIFICATION_HARD_RETENTION_DAYS`
  (default 365) ago is deleted regardless of read state.
- `--older-than-days` and `--hard-delete-after-days` override the settings.
- The command is idempotent and safe to run from cron. Callers must not assume a
  notification still exists after the retention window.

Support staff can inspect notifications read-only in the Django admin at
`/admin/`; the admin refuses to create, edit, or delete rows so that events can
only come from trusted services.
