"""Shared helpers for the internships test modules (not a test module itself)."""

import shutil
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone

import jwt
from django.test import override_settings

TEST_JWT_KEY = "test-jwt-signing-key-with-enough-length-0123456789"


class TemporaryMediaMixin:
    """Point MEDIA_ROOT at a throwaway directory and remove it afterwards."""

    @classmethod
    def setUpClass(cls):
        cls._media_dir = tempfile.mkdtemp(prefix="stagelink-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_dir, ignore_errors=True)


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


def make_submission(
    internship,
    *,
    version=1,
    status=None,
    submitted_by=None,
    filename="report.pdf",
    content=b"%PDF-1.4 test content",
    content_type="application/pdf",
    reviewed_by=None,
    reason="",
):
    """
    Create a stored submission row directly.

    The caller must use TemporaryMediaMixin (or override MEDIA_ROOT), because
    the file is written to disk.
    """
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.utils import timezone

    from .models import InternshipSubmission, SubmissionStatus

    upload = SimpleUploadedFile(filename, content, content_type=content_type)
    return InternshipSubmission.objects.create(
        internship=internship,
        version=version,
        file=upload,
        original_filename=filename,
        content_type=content_type,
        size_bytes=len(content),
        submitted_by_user_id=submitted_by or internship.student_user_id,
        status=status or SubmissionStatus.SUBMITTED,
        reviewed_by_user_id=reviewed_by,
        reviewed_at=timezone.now() if reviewed_by else None,
        review_reason=reason,
    )


def make_evaluation(internship, *, supervisor=None, grade="15.00", comment=""):
    from .models import InternshipEvaluation

    return InternshipEvaluation.objects.create(
        internship=internship,
        supervisor_user_id=supervisor or internship.supervisor_user_id,
        grade=grade,
        comment=comment,
    )
