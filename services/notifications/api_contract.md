# Notifications Service: Integration Guide for Other Services

Owner: Member 1 (Notifications & Communication). Status: implemented and manually tested. Values marked **TO AGREE** are open questions at the bottom.

## 1. What this service does

Stores in-app notifications, shows each user **only their own**, and tracks read state. It does **not** decide who must be notified or why: the calling service decides and sends **one request per recipient**. No email/SMS in v1.

Base URL (dev): `http://localhost:8005` (Docker Compose service hostname: `notifications:8000`).

## 2. Creating a notification (service → service)

`POST /api/internal/notifications/`

Header: `X-Service-Token: <shared secret>` (given privately by Member 1, never committed to Git).
A user JWT is **not** accepted on this endpoint.

Body (JSON):

| Field | Type | Rules |
|---|---|---|
| `recipient_user_id` | integer | required, ≥ 1 (the user ID from Identity & Profiles) |
| `type` | string | required, one of the types in section 4 |
| `title` | string | required, ≤ 255 chars |
| `message` | string | required |
| `related_object_type` | string | optional, ≤ 64 chars, e.g. `application`, `internship` |
| `related_object_id` | string | optional, ≤ 64 chars (plain ID from your service, no foreign key) |
| `deduplication_key` | string | required, ≤ 255 chars, **stable per event and recipient** (section 3) |

Example:
```json
{
  "recipient_user_id": 42,
  "type": "application_validated",
  "title": "Application validated",
  "message": "The university validated your application. You can now accept or decline.",
  "related_object_type": "application",
  "related_object_id": "1234",
  "deduplication_key": "application:1234:validated:recipient:42"
}
```

Responses:

| Status | Meaning |
|---|---|
| `201` | Notification created |
| `200` | Same `deduplication_key` already exists: the **existing** notification is returned unchanged (nothing new is created) |
| `400` | Validation error (unknown type, missing field, too long, recipient ≤ 0) |
| `403` | Missing or wrong `X-Service-Token` |

## 3. Retries and deduplication

- Build `deduplication_key` from the event, **not** from the time: `{object_type}:{object_id}:{event}:recipient:{user_id}`.
  Example: `application:1234:rejected_by_university:recipient:42`.
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
            "recipient_user_id": recipient_user_id,
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

## 4. Notification types and who sends them (tentative, **TO AGREE**)

| Event (from the functional spec, FR-13) | `type` | Recipient | Sent by |
|---|---|---|---|
| Company accepts an application | `application_pending_validation` | university admin(s) | Offers & Applications |
| University validates | `application_validated` | student | Offers & Applications |
| University rejects | `application_rejected_by_university` | student **and** company | Offers & Applications |
| Student accepts or declines | `student_decision` | company | Offers & Applications |
| Automatic withdrawal | `application_withdrawn` | student / company | Offers & Applications |
| Internship created | `internship_created` | student / company | Internship Management |
| Supervisor assigned | `supervisor_assigned` | student / supervisor | Internship Management |
| Cancellation requested | `cancellation_requested` | other parties | Internship Management |
| Cancellation decided | `cancellation_decided` | other parties | Internship Management |
| Submission reviewed | `submission_reviewed` | student | Internship Management |
| Evaluation published | `evaluation_published` | student | Internship Management |
| Anything else | `generic` | any | any |

To add or rename a type, ask Member 1 (it needs a one-line change plus a migration).

## 5. Endpoints for the frontend (user JWT)

Header: `Authorization: Bearer <access token from Identity & Profiles>`.

| Method | URL | Result |
|---|---|---|
| GET | `/api/notifications/` | Paginated list of **my** notifications, newest first. Optional `?unread=true`, `?page=2` (20 per page) |
| GET | `/api/notifications/unread-count/` | `{"unread_count": N}` (suggested polling: every 30–60 s) |
| PATCH | `/api/notifications/{id}/read/` | Marks **that one** notification as read (idempotent) and returns it |

List response:
```json
{
  "count": 1, "next": null, "previous": null,
  "results": [
    {"id": 1, "type": "application_validated", "title": "...", "message": "...",
     "related_object_type": "application", "related_object_id": "1234",
     "is_read": false, "created_at": "2026-10-16T18:53:43Z", "read_at": null}
  ]
}
```

Errors: `401` missing/invalid/expired token (or a refresh token) · `404` notification does not exist **or belongs to someone else** (existence is never revealed).

## 6. Token rules (what this service checks)

- Signature + expiry validated locally; `exp` is **mandatory**; only the configured algorithm is accepted.
- The user ID is read from a configurable claim (default `user_id`, integer or numeric string).
- Tokens with `token_type` other than `access` are rejected.

## 7. Questions I need answered

**Member for Identity & Profiles**
1. JWT algorithm: HS256 (shared secret) or RS256 (public key)? How do I get the key?
2. Name of the claim holding the user ID? (default assumed: `user_id`) And the role claim? (default: `role`)
3. Are user IDs integers? (I assumed positive integers.)
4. Is there an endpoint to list all university-admin user IDs? (needed so callers can notify "all admins")

**Members for Offers & Applications and Internship Management**
5. Do the types and recipients in section 4 match your events? Tell me what to add or rename.
6. Who resolves "all university admins": you (via Identity) and send one request per admin? (my proposal)

**Everyone**
7. Service port and hostname in Docker Compose (currently `notifications` on host port `8005`).
8. Environment variable names: `NOTIFICATIONS_SERVICE_URL` and `NOTIFICATIONS_SERVICE_TOKEN` on your side: OK?
