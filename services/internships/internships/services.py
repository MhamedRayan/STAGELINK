from django.db import IntegrityError, transaction

from .models import Internship, InternshipStatus


class ActiveInternshipConflict(Exception):
    """The student already has a Confirmed or In progress internship."""


def _find_by_source_application(source_application_id):
    return Internship.objects.filter(source_application_id=source_application_id).first()


def create_internship(
    *,
    source_application_id,
    student_user_id,
    company_user_id,
    offer_id,
    start_date,
    end_date,
):
    """
    Create an internship for an accepted application.

    Returns (internship, created). created is False when the internship
    already existed for this source_application_id (an idempotent retry).

    Raises ActiveInternshipConflict if the student already has an active
    internship from a different application.
    """
    existing = _find_by_source_application(source_application_id)
    if existing is not None:
        return existing, False

    try:
        with transaction.atomic():
            internship = Internship.objects.create(
                source_application_id=source_application_id,
                student_user_id=student_user_id,
                company_user_id=company_user_id,
                offer_id=offer_id,
                start_date=start_date,
                end_date=end_date,
                status=InternshipStatus.CONFIRMED,
            )
        return internship, True
    except IntegrityError:
        # Two identical requests raced. The other one committed first, so the
        # row exists now. Return it instead of failing.
        existing = _find_by_source_application(source_application_id)
        if existing is not None:
            return existing, False
        # No row for this application, so the database refused because the
        # student already has an active internship.
        raise ActiveInternshipConflict("Student already has an active internship.")
