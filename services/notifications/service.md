# Service: Notifications & Communication (Member 1)

Difficulty: Easy–Medium · MVP target: **21 Oct 2026** · Tech validation: 11 Nov · Delivery: 28 Nov

## 1. Purpose and boundaries

Store in-app notifications, let each user see **only their own**, track read state, and accept trusted internal requests from other services.

**Owns**
- Notification content/type, recipient user ID, related object reference, creation time, read state.
- Unread count, mark-one-read, optional mark-all-read.
- Deduplication of repeated event requests.

**Does NOT own**
- Application or internship decisions (Offers & Applications / Internship Management).
- User accounts and roles (Identity & Profiles).
- Email or SMS (out of scope in v1).
- Deciding *who* should be notified: the caller sends the recipient ID(s).

## 2. Data model

```python
# api/models.py
from django.db import models

class Notification(models.Model):
    class Type(models.TextChoices):
        APPLICATION_PENDING_VALIDATION = "application_pending_validation"   # → university admin
        APPLICATION_VALIDATED          = "application_validated"            # → student
        APPLICATION_REJECTED_BY_UNIV   = "application_rejected_by_university"  # → student + company
        STUDENT_DECISION               = "student_decision"                 # → company
        APPLICATION_WITHDRAWN          = "application_withdrawn"            # → student / company
        INTERNSHIP_CREATED             = "internship_created"
        SUPERVISOR_ASSIGNED            = "supervisor_assigned"
        CANCELLATION_REQUESTED         = "cancellation_requested"
        CANCELLATION_DECIDED           = "cancellation_decided"
        SUBMISSION_REVIEWED            = "submission_reviewed"
        EVALUATION_PUBLISHED           = "evaluation_published"
        GENERIC                        = "generic"

    recipient_user_id   = models.BigIntegerField(db_index=True)   # plain ID, NO foreign key
    type                = models.CharField(max_length=64, choices=Type.choices)
    title               = models.CharField(max_length=255)
    message             = models.TextField()
    related_object_type = models.CharField(max_length=64, blank=True)   # "application", "internship", ...
    related_object_id   = models.CharField(max_length=64, blank=True)   # plain ID from the other service
    deduplication_key   = models.CharField(max_length=255, unique=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    read_at             = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient_user_id", "-created_at"]),
            models.Index(fields=["recipient_user_id", "read_at"]),
        ]
```

Notes:
- Confirm with Identity whether user IDs are integers or UUIDs; adjust `recipient_user_id` accordingly.
- The Type list is a proposal derived from FR-13; share it with the other members and trim/extend.

## 3. API endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health/` | none | Health check |
| GET | `/api/notifications/` | user JWT | Caller's notifications, paginated, newest first. Optional `?unread=true` |
| GET | `/api/notifications/unread-count/` | user JWT | `{"unread_count": N}` |
| PATCH | `/api/notifications/{id}/read/` | user JWT | Mark read **only if caller is recipient**; otherwise 404. Idempotent (keeps first `read_at`) |
| POST | `/api/notifications/read-all/` | user JWT | *(optional)* mark all caller's notifications read |
| POST | `/api/internal/notifications/` | service token | Create notification, deduplicated |

### Internal create contract (draft, to agree with other members)

Request:
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
- `201 Created`: new notification created.
- `200 OK`: same `deduplication_key` already exists → return the **existing** notification (no duplicate). This makes caller retries safe.
- `400`: validation error · `401/403`: missing or invalid service token.

**Deduplication key convention** (stable event ID **per recipient**):
`{object_type}:{object_id}:{event}:recipient:{user_id}`: e.g. `application:1234:rejected_by_university:recipient:42`.
One request = one recipient. If an event has two recipients (university rejection → student + company), the caller sends two requests (or we later add a bulk endpoint). Decide with the team.

## 4. Authentication and permissions

**User endpoints**
- Validate the JWT locally (signature + expiry) with `djangorestframework-simplejwt`. **Agree with the Identity & Profiles member on:** algorithm (HS256 shared secret vs RS256 public key), the claim holding the user ID (`user_id`?), and the role claim.
- No local `User` table: write a small custom authentication class returning a lightweight stateless user object (`.id`, `.role`, `.is_authenticated = True`).
- Every queryset is filtered by `recipient_user_id = request.user.id`. Accessing another user's notification returns **404** (don't leak existence).

**Internal endpoint**
- Authenticate trusted services with a shared secret in a header (e.g. `X-Service-Token`), compared with `hmac.compare_digest`, read from env (`INTERNAL_SERVICE_TOKEN`). A user JWT must **not** grant access here.
- Optionally one token per calling service (`INTERNAL_SERVICE_TOKENS=offers:xxx,internships:yyy`) so calls can be traced.

## 5. Project setup

```bash
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install django djangorestframework "psycopg[binary]" django-environ \
            djangorestframework-simplejwt drf-spectacular django-cors-headers
django-admin startproject config .
python manage.py startapp api
```

Settings checklist (`config/settings.py`):
- `INSTALLED_APPS += ["rest_framework", "api"]` (+ `corsheaders`, `drf_spectacular`)
- Database from env via `django-environ` (`DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`), own database `notifications`
- `REST_FRAMEWORK`: default auth = custom JWT class, default permission = `IsAuthenticated`, `DEFAULT_PAGINATION_CLASS` = `PageNumberPagination`, `PAGE_SIZE = 20`
- Env: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `JWT_ALGORITHM`, `JWT_SIGNING_KEY` (or public key), `INTERNAL_SERVICE_TOKEN`

Suggested layout:
```
config/            settings, urls, wsgi
api/
  models.py
  serializers.py   # NotificationSerializer, InternalNotificationCreateSerializer
  views.py
  permissions.py   # IsInternalService
  authentication.py  # stateless JWT auth
  urls.py
  tests/
.env.example       # no secrets
Dockerfile
README.md
```

Then: `python manage.py makemigrations && python manage.py migrate`, `python manage.py runserver`, `python manage.py test`.

## 6. Build order

1. **Model + migration + health endpoint** (`GET /api/health/`).
2. **List, unread-count, mark-read** endpoints (first with a dev stub for auth).
3. **Real JWT auth, recipient-only permissions, pagination.**
4. **Internal create endpoint** with service-token auth and unique `deduplication_key` (handle the race: `get_or_create` / catch `IntegrityError` and return the existing row).
5. Optional: mark-all-read, `?unread=true` filter, OpenAPI docs (drf-spectacular), Dockerfile, README.

**Definition of done:** users can only access their own notifications; repeated requests with the same deduplication key never create duplicates.

## 7. Tests to write

- **Model/unit:** unique `deduplication_key`; `read_at` set once.
- **Permissions:** user A cannot list/read/mark user B's notifications (expect 404); anonymous → 401; user JWT cannot call the internal endpoint; invalid/missing service token → 401/403.
- **Behavior:** unread-count correct; marking one notification leaves the others unread; marking twice is idempotent; mark-all-read affects only the caller.
- **Dedup/retry:** same key twice → one row, second response 200 with same ID; concurrent duplicate requests → one row.
- **Pagination:** page size, ordering newest first.
- **Validation:** missing fields, unknown `type`, oversized strings.

## 8. Deliverables for my service

Source code, migrations, API documentation (OpenAPI + the contract in §3), README (prerequisites, env vars, DB setup, run, test, Docker), `.env.example`, tests + results, Dockerfile / compose entry.

## 9. Open questions to settle with the team (this week)

1. **Service count:** tech spec says 3 services with notifications owned by *Internship Management*; the team guide gives us a **standalone** Notifications service. Confirm with Dr. Yahiaten/the team. Either way, keep the REST contract above so it can be merged later.
2. **JWT details:** algorithm, key sharing, claim names, ID type: ask the Identity member.
3. **Recipient resolution:** who resolves "all university admins"? Proposed: the *caller* gets admin IDs from Identity and sends one request per recipient.
4. **Event/type catalogue and dedup-key format:** share §2 and §3 with Offers & Applications and Internship Management members.
5. **Service-to-service auth:** one shared token or one per service; how it is distributed (env only).
6. **Ports/hostnames** in Docker Compose (currently `notifications` on host port `8005`) and who writes the shared compose file/reverse proxy.
7. **Frontend polling:** the frontend will poll `unread-count` (no websockets in v1). Agree on interval with the frontend member.
8. **Retention/archiving:** none in v1 unless asked.

## 10. Suggested schedule

| Date | Goal |
|---|---|
| 15–16 Oct | Project skeleton, model, migration, health endpoint; send contract (§3) to the team |
| 17–19 Oct | List / unread-count / mark-read, permissions, pagination, JWT auth |
| 20 Oct | Internal create + dedup, core tests → ready for **MVP 21 Oct** |
| 21 Oct – 11 Nov | Integrate with other services, mark-all-read, concurrency tests, OpenAPI, Docker |
| 11–28 Nov | Fixes, README, deployment config, demo preparation |
