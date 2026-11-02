"""Shared helpers for the internships test modules (not a test module itself)."""

import uuid
from datetime import date, datetime, timedelta, timezone

import jwt

TEST_JWT_KEY = "test-jwt-signing-key-with-enough-length-0123456789"


def make_token(user_id, role, *, ttl=timedelta(minutes=15)):
    now = datetime.now(timezone.utc)
    payload = {"user_id": str(user_id), "role": role, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, TEST_JWT_KEY, algorithm="HS256")


def new_id():
    return uuid.uuid4()


def make_internship(
    *,
    student=None,
    company=None,
    supervisor=None,
    start=date(2027, 2, 1),
    end=None,
    status=None,
):
    """
    Create an internship through the real create service, so the fixture also
    gets its CREATED audit entry, exactly as in production. Supervisor and status
    are then set directly, because these helpers stand in for earlier history.
    """
    from .models import Internship
    from .services import create_internship

    end = end or start + timedelta(days=120)
    internship, _ = create_internship(
        source_application_id=new_id(),
        student_user_id=student or new_id(),
        company_user_id=company or new_id(),
        offer_id=new_id(),
        start_date=start,
        end_date=end,
    )

    updates = {}
    if supervisor is not None:
        updates["supervisor_user_id"] = supervisor
    if status is not None:
        updates["status"] = status
    if updates:
        Internship.objects.filter(pk=internship.pk).update(**updates)
        internship.refresh_from_db()
    return internship


def identity_user(user_id, role="supervisor", is_active=True):
    return {
        "id": str(user_id),
        "email": "user@example.test",
        "name": "Test User",
        "role": role,
        "is_active": is_active,
    }
