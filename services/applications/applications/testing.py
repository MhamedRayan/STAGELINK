"""Shared helpers for the Applications test modules.

The name deliberately does not start with ``test`` so Django's test discovery
does not collect it as a test module.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from .models import Application, ApplicationStatus

STUDENT_ID = uuid.uuid4()
COMPANY_ID = uuid.uuid4()
UNIVERSITY_ID = uuid.uuid4()
OTHER_STUDENT_ID = uuid.uuid4()


class DummyUser:
    def __init__(self, user_id, role):
        self.id = user_id
        self.role = role
        self.is_authenticated = True

    @property
    def is_anonymous(self):
        return False


def make_offer(
    *,
    offer_id=None,
    company_user_id=None,
    status="published",
    deadline=None,
    capacity=2,
    title="Backend internship",
):
    deadline = deadline or (datetime.now(timezone.utc) + timedelta(days=30))
    return {
        "id": str(offer_id or uuid.uuid4()),
        "company_user_id": str(company_user_id or COMPANY_ID),
        "title": title,
        "status": status,
        "deadline": deadline.isoformat(),
        "capacity": capacity,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def make_application(
    *,
    student_user_id=None,
    company_user_id=None,
    offer_id=None,
    status=ApplicationStatus.SUBMITTED,
    start_date=None,
    end_date=None,
):
    return Application.objects.create(
        offer_id=offer_id or uuid.uuid4(),
        company_user_id=company_user_id or COMPANY_ID,
        student_user_id=student_user_id or STUDENT_ID,
        start_date=start_date or date(2027, 2, 1),
        end_date=end_date or date(2027, 6, 30),
        status=status,
    )
