"""Business rules for the Applications service.

Everything that changes an application, a reservation or its history lives
here, so views stay thin and the rules are exercised directly by tests.
"""

import logging
import time
from datetime import timezone as dt_timezone

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from . import notifications_client
from .errors import (
    CAPACITY_FULL,
    DOWNSTREAM_UNAVAILABLE,
    DUPLICATE_APPLICATION,
    INTERNSHIP_CONFLICT,
    INVALID_STATE,
    NOT_FOUND,
    OFFER_NOT_FOUND,
    OFFER_UNAVAILABLE,
    OFFERS_UNAVAILABLE,
    BusinessError,
)
from .models import (
    OPEN_STATUSES,
    RESERVED_STATUSES,
    WITHDRAWABLE_STATUSES,
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    DecisionChoices,
    OfferReservation,
    StudentDecisionChoices,
)
from .notifications_client import NotificationEvent
from .offers_client import OfferNotFound, OffersUnavailable, get_offer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

def record_transition(application, from_status, to_status, *, actor_user_id=None, actor_role="", reason=""):
    """Append one history row. Must run in the same transaction as the change."""

    return ApplicationStatusHistory.objects.create(
        application=application,
        from_status=from_status or "",
        to_status=to_status,
        actor_user_id=actor_user_id,
        actor_role=actor_role or "",
        reason=reason or "",
    )


# ---------------------------------------------------------------------------
# Offers validation (P0-1)
# ---------------------------------------------------------------------------

def _parse_deadline(value):
    if not value:
        return None
    parsed = parse_datetime(str(value))
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def fetch_offer(offer_id):
    """Fetch an offer and translate transport errors into API errors."""

    try:
        return get_offer(offer_id)
    except OfferNotFound:
        raise BusinessError(
            OFFER_NOT_FOUND,
            "Offer not found.",
            status_code=400,
            details={"offer_id": str(offer_id)},
        )
    except OffersUnavailable as exc:
        logger.warning("Offers unavailable while validating %s: %s", offer_id, exc)
        raise BusinessError(
            OFFERS_UNAVAILABLE,
            "The offers service is unavailable. Please retry shortly.",
            status_code=503,
        )


def ensure_offer_is_open(offer):
    """Require a published offer whose deadline is still in the future."""

    if offer.get("status") != "published":
        raise BusinessError(
            OFFER_UNAVAILABLE,
            "This offer is not accepting applications.",
            status_code=409,
            details={"offer_id": str(offer.get("id"))},
        )

    deadline = _parse_deadline(offer.get("deadline"))
    if deadline is None or deadline <= timezone.now():
        raise BusinessError(
            OFFER_UNAVAILABLE,
            "The application deadline for this offer has passed.",
            status_code=409,
            details={"offer_id": str(offer.get("id"))},
        )


# ---------------------------------------------------------------------------
# Reservations and capacity (P0-4)
# ---------------------------------------------------------------------------

def _lock_reservation(offer_id):
    return OfferReservation.objects.select_for_update().filter(offer_id=offer_id).first()


def _ensure_reservation(offer_id, capacity):
    """Return a locked reservation, creating it with the current capacity."""

    reservation = _lock_reservation(offer_id)
    if reservation is not None:
        if capacity > reservation.capacity:
            reservation.capacity = capacity
            reservation.save(update_fields=["capacity", "updated_at"])
        return reservation

    try:
        with transaction.atomic():
            return OfferReservation.objects.create(
                offer_id=offer_id,
                capacity=capacity,
            )
    except IntegrityError:
        # Another request created it between our read and write.
        reservation = _lock_reservation(offer_id)
        if reservation is None:
            raise
        if capacity > reservation.capacity:
            reservation.capacity = capacity
            reservation.save(update_fields=["capacity", "updated_at"])
        return reservation


def reserve_place(offer_id, capacity):
    """Reserve one provisional place. Raises CAPACITY_FULL at the limit."""

    reservation = _ensure_reservation(offer_id, capacity)
    if reservation.committed >= reservation.capacity:
        raise BusinessError(
            CAPACITY_FULL,
            "This offer has no places left.",
            status_code=409,
            details={"offer_id": str(offer_id), "capacity": reservation.capacity},
        )
    reservation.reserved += 1
    reservation.save(update_fields=["reserved", "updated_at"])
    return reservation


def release_reserved_place(offer_id):
    """Return one provisional place, if any is held."""

    reservation = _lock_reservation(offer_id)
    if reservation is None or reservation.reserved <= 0:
        return
    reservation.reserved -= 1
    reservation.save(update_fields=["reserved", "updated_at"])


def occupy_place(offer_id):
    """Convert one provisional place into a confirmed place."""

    reservation = _lock_reservation(offer_id)
    if reservation is None:
        return
    if reservation.reserved > 0:
        reservation.reserved -= 1
    reservation.occupied += 1
    reservation.save(update_fields=["reserved", "occupied", "updated_at"])


def release_occupied_place(offer_id):
    """Free one confirmed place after an approved internship cancellation."""

    reservation = _lock_reservation(offer_id)
    if reservation is None or reservation.occupied <= 0:
        return
    reservation.occupied -= 1
    reservation.save(update_fields=["occupied", "updated_at"])


def offer_capacity_snapshot(offer_id):
    """Shape returned to Offers so it can decide whether a reduction is safe."""

    reservation = OfferReservation.objects.filter(offer_id=offer_id).first()
    if reservation is None:
        return {
            "offer_id": str(offer_id),
            "capacity": None,
            "reserved": 0,
            "occupied": 0,
            "committed": 0,
            "available": None,
        }
    return {
        "offer_id": str(offer_id),
        "capacity": reservation.capacity,
        "reserved": reservation.reserved,
        "occupied": reservation.occupied,
        "committed": reservation.committed,
        "available": reservation.available,
    }


# ---------------------------------------------------------------------------
# Notifications (P1-4)
# ---------------------------------------------------------------------------

def _university_admins(application):
    recipients = set(settings.UNIVERSITY_ADMIN_USER_IDS or [])
    if application.university_user_id:
        recipients.add(str(application.university_user_id))
    return sorted(recipients)


def _notify(*, app, recipient_user_id, notification_type, title, message, event):
    notifications_client.notify_on_commit(
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_id=app.id,
        event=event,
    )


def _notify_pending_validation(app):
    for recipient in _university_admins(app):
        _notify(
            app=app,
            recipient_user_id=recipient,
            notification_type="application_pending_validation",
            title="Application waiting for validation",
            message=f"An application for {app.offer_id} needs university validation.",
            event=NotificationEvent.PENDING_VALIDATION,
        )


def _notify_validated(app):
    _notify(
        app=app,
        recipient_user_id=app.student_user_id,
        notification_type="application_validated",
        title="Application validated",
        message="The university validated your application. You can now accept or decline it.",
        event=NotificationEvent.VALIDATED,
    )


def _notify_university_rejected(app):
    for recipient in {str(app.student_user_id), str(app.company_user_id)}:
        _notify(
            app=app,
            recipient_user_id=recipient,
            notification_type="application_rejected_by_university",
            title="Application rejected by the university",
            message="The university rejected this application.",
            event=NotificationEvent.REJECTED_BY_UNIVERSITY,
        )


def _notify_student_decision(app):
    _notify(
        app=app,
        recipient_user_id=app.company_user_id,
        notification_type="student_decision",
        title="Student decision recorded",
        message=f"The student recorded a decision ({app.student_decision}) on your application.",
        event=NotificationEvent.STUDENT_DECISION,
    )


def _notify_confirmed(app):
    recipients = {str(app.company_user_id)}
    recipients.update(_university_admins(app))
    for recipient in sorted(recipients):
        _notify(
            app=app,
            recipient_user_id=recipient,
            notification_type="application_confirmed",
            title="Application confirmed",
            message="The student accepted the application and the internship was created.",
            event=NotificationEvent.CONFIRMED,
        )


def _notify_withdrawn(app):
    _notify(
        app=app,
        recipient_user_id=app.company_user_id,
        notification_type="application_withdrawn",
        title="Application withdrawn",
        message="The student withdrew this application.",
        event=NotificationEvent.WITHDRAWN,
    )


# ---------------------------------------------------------------------------
# Internships call (P1-5)
# ---------------------------------------------------------------------------

class InternshipConflict(Exception):
    """Internships rejected the call because the student has an active internship."""


class InternshipUnavailable(Exception):
    """Internships could not be reached or failed transiently."""


def _post_internship(payload):
    url = settings.INTERNSHIP_SERVICE_URL
    headers = {
        "X-Service-Token": settings.INTERNAL_SERVICE_TOKEN,
        "X-Idempotency-Key": payload["source_application_id"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    attempts = max(1, settings.INTERNSHIP_CREATION_ATTEMPTS)
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=settings.INTERNSHIP_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(min(2.0, 0.3 * (2 ** (attempt - 1))))
            continue

        if response.status_code in (200, 201):
            return response
        if response.status_code == 409:
            raise InternshipConflict(response.text)
        if 500 <= response.status_code < 600 and attempt < attempts:
            last_error = f"HTTP {response.status_code}: {response.text}"
            time.sleep(min(2.0, 0.3 * (2 ** (attempt - 1))))
            continue
        raise InternshipUnavailable(
            f"HTTP {response.status_code}: {response.text}"
        )

    raise InternshipUnavailable(str(last_error) if last_error else "Internships unavailable")


def create_official_internship_record(application):
    """Create the internship record. Idempotent through the source application id.

    Raises ``InternshipConflict`` for a permanent 409 and ``InternshipUnavailable``
    for transient failures. Returns the HTTP response on success.
    """

    if not settings.INTERNAL_SERVICE_TOKEN:
        logger.error(
            "INTERNAL_SERVICE_TOKEN is not configured; cannot create internship for App %s",
            application.id,
        )
        raise InternshipUnavailable("INTERNAL_SERVICE_TOKEN is not configured")

    payload = {
        "source_application_id": str(application.id),
        "offer_id": str(application.offer_id),
        "student_user_id": str(application.student_user_id),
        "company_user_id": str(application.company_user_id),
        "start_date": application.start_date.isoformat(),
        "end_date": application.end_date.isoformat(),
    }
    return _post_internship(payload)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def submit_application(*, student_user_id, offer_id, start_date, end_date):
    """Validate the offer with Offers and create the application (P0-1)."""

    offer = fetch_offer(offer_id)
    ensure_offer_is_open(offer)
    company_user_id = offer.get("company_user_id")
    if not company_user_id:
        raise BusinessError(
            OFFERS_UNAVAILABLE,
            "The offers service returned an incomplete offer.",
            status_code=503,
        )

    try:
        with transaction.atomic():
            application = Application.objects.create(
                offer_id=offer_id,
                company_user_id=company_user_id,
                student_user_id=student_user_id,
                start_date=start_date,
                end_date=end_date,
                status=ApplicationStatus.SUBMITTED,
            )
            record_transition(
                application,
                "",
                ApplicationStatus.SUBMITTED,
                actor_user_id=student_user_id,
                actor_role="student",
            )
            return application
    except IntegrityError:
        raise BusinessError(
            DUPLICATE_APPLICATION,
            "You have already applied for this offer.",
            status_code=400,
            details={"offer_id": str(offer_id)},
        )


def decide_as_company(*, application_id, company_user_id, decision, reason="", actor_role="company"):
    """Record the company decision and reserve a place on acceptance (P0-4)."""

    if decision == DecisionChoices.ACCEPT:
        # Fetch the offer before locking the row: do not hold the application
        # lock while an HTTP call is in flight.
        with transaction.atomic():
            offer_id = (
                Application.objects.select_for_update()
                .filter(pk=application_id, company_user_id=company_user_id)
                .values_list("offer_id", flat=True)
                .first()
            )
            if offer_id is None:
                raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        offer = fetch_offer(offer_id)
        ensure_offer_is_open(offer)

        with transaction.atomic():
            application = (
                Application.objects.select_for_update()
                .filter(pk=application_id, company_user_id=company_user_id)
                .first()
            )
            if application is None:
                raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
            if application.status != ApplicationStatus.SUBMITTED:
                raise BusinessError(
                    INVALID_STATE,
                    f"Cannot make a company decision on an application in state '{application.status}'.",
                    status_code=409,
                )

            reserve_place(offer_id, int(offer.get("capacity") or 0))
            previous = application.status
            application.company_decision = decision
            application.company_reason = reason or ""
            application.status = ApplicationStatus.COMPANY_ACCEPTED
            application.save()
            record_transition(
                application,
                previous,
                application.status,
                actor_user_id=company_user_id,
                actor_role=actor_role,
                reason=reason or "",
            )
            _notify_pending_validation(application)
            return application

    with transaction.atomic():
        application = (
            Application.objects.select_for_update()
            .filter(pk=application_id, company_user_id=company_user_id)
            .first()
        )
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.status != ApplicationStatus.SUBMITTED:
            raise BusinessError(
                INVALID_STATE,
                f"Cannot make a company decision on an application in state '{application.status}'.",
                status_code=409,
            )

        previous = application.status
        application.company_decision = decision
        application.company_reason = reason or ""
        application.status = ApplicationStatus.COMPANY_REJECTED
        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=company_user_id,
            actor_role=actor_role,
            reason=reason or "",
        )
        return application


def decide_as_university(*, application_id, university_user_id, decision, reason="", actor_role="university_admin"):
    with transaction.atomic():
        application = Application.objects.select_for_update().filter(pk=application_id).first()
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.status != ApplicationStatus.COMPANY_ACCEPTED:
            raise BusinessError(
                INVALID_STATE,
                "The university can only evaluate applications accepted by the company.",
                status_code=409,
            )

        previous = application.status
        application.university_decision = decision
        application.university_reason = reason or ""
        application.university_user_id = university_user_id

        if decision == DecisionChoices.ACCEPT:
            application.status = ApplicationStatus.UNIVERSITY_VALIDATED
        else:
            application.status = ApplicationStatus.UNIVERSITY_REJECTED
            release_reserved_place(application.offer_id)

        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=university_user_id,
            actor_role=actor_role,
            reason=reason or "",
        )
        if decision == DecisionChoices.ACCEPT:
            _notify_validated(application)
        else:
            _notify_university_rejected(application)
        return application


def decide_as_student(*, application_id, student_user_id, decision, actor_role="student"):
    """Record the student decision; acceptance confirms through Internships.

    The internship call happens *after* the local STUDENT_ACCEPTED commit, not
    inside a database transaction. A transient failure leaves the application in
    STUDENT_ACCEPTED so the reconciliation command can retry idempotently.
    """

    with transaction.atomic():
        application = (
            Application.objects.select_for_update()
            .filter(pk=application_id, student_user_id=student_user_id)
            .first()
        )
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.status != ApplicationStatus.UNIVERSITY_VALIDATED:
            raise BusinessError(
                INVALID_STATE,
                "The student can only decide after university validation.",
                status_code=409,
            )

        previous = application.status
        application.student_decision = decision
        if decision == StudentDecisionChoices.DECLINE:
            application.status = ApplicationStatus.STUDENT_DECLINED
            application.save()
            record_transition(
                application,
                previous,
                application.status,
                actor_user_id=student_user_id,
                actor_role=actor_role,
            )
            release_reserved_place(application.offer_id)
            _notify_student_decision(application)
            return application

        application.status = ApplicationStatus.STUDENT_ACCEPTED
        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=student_user_id,
            actor_role=actor_role,
        )

    try:
        create_official_internship_record(application)
    except InternshipConflict as exc:
        logger.info("Internship conflict for App %s: %s", application.id, exc)
        _revert_student_acceptance(application.pk, actor_user_id=student_user_id, actor_role=actor_role)
        raise BusinessError(
            INTERNSHIP_CONFLICT,
            "The student already has an active internship.",
            status_code=409,
        )
    except InternshipUnavailable as exc:
        logger.warning("Internship unavailable for App %s: %s", application.id, exc)
        raise BusinessError(
            DOWNSTREAM_UNAVAILABLE,
            "The internship service is unavailable. The acceptance was recorded and will be retried.",
            status_code=503,
            details={"retryable": True},
        )

    return finalize_confirmation(application.pk, actor_user_id=student_user_id, actor_role=actor_role)


def _revert_student_acceptance(application_id, *, actor_user_id=None, actor_role="", reason="internship conflict"):
    with transaction.atomic():
        application = Application.objects.select_for_update().filter(pk=application_id).first()
        if application is None or application.status != ApplicationStatus.STUDENT_ACCEPTED:
            return application
        previous = application.status
        application.status = ApplicationStatus.UNIVERSITY_VALIDATED
        application.student_decision = None
        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            reason=reason,
        )
        return application


def finalize_confirmation(application_id, *, actor_user_id=None, actor_role=""):
    """Mark a STUDENT_ACCEPTED application CONFIRMED and free the student's other places."""

    with transaction.atomic():
        application = Application.objects.select_for_update().filter(pk=application_id).first()
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.status == ApplicationStatus.CONFIRMED:
            return application
        if application.status != ApplicationStatus.STUDENT_ACCEPTED:
            raise BusinessError(
                INVALID_STATE,
                f"Cannot confirm an application in state '{application.status}'.",
                status_code=409,
            )

        previous = application.status
        application.status = ApplicationStatus.CONFIRMED
        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
        )
        occupy_place(application.offer_id)
        _notify_student_decision(application)
        _notify_confirmed(application)
        _auto_withdraw_other_applications(
            student_user_id=application.student_user_id,
            exclude_application_id=application.id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
        )
        return application


def _auto_withdraw_other_applications(*, student_user_id, exclude_application_id, actor_user_id=None, actor_role=""):
    """Withdraw every other open application for the same student (P0-3)."""

    others = list(
        Application.objects.select_for_update()
        .filter(student_user_id=student_user_id, status__in=OPEN_STATUSES)
        .exclude(pk=exclude_application_id)
    )
    for other in others:
        previous = other.status
        held_place = previous in RESERVED_STATUSES
        other.status = ApplicationStatus.WITHDRAWN
        other.withdrawal_reason = "Automatically withdrawn after another application was confirmed."
        other.withdrawn_at = timezone.now()
        other.save()
        record_transition(
            other,
            previous,
            other.status,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            reason="automatic withdrawal on confirmation",
        )
        if held_place:
            release_reserved_place(other.offer_id)
        _notify_withdrawn(other)
    return others


def withdraw_application(*, application_id, student_user_id, reason="", actor_role="student"):
    """Withdraw an application and free its provisional place (P0-2)."""

    with transaction.atomic():
        application = (
            Application.objects.select_for_update()
            .filter(pk=application_id, student_user_id=student_user_id)
            .first()
        )
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.status not in WITHDRAWABLE_STATUSES:
            raise BusinessError(
                INVALID_STATE,
                f"Cannot withdraw an application in state '{application.status}'.",
                status_code=409,
            )

        previous = application.status
        held_place = previous in RESERVED_STATUSES
        application.status = ApplicationStatus.WITHDRAWN
        application.withdrawal_reason = reason or ""
        application.withdrawn_at = timezone.now()
        application.save()
        record_transition(
            application,
            previous,
            application.status,
            actor_user_id=student_user_id,
            actor_role=actor_role,
            reason=reason or "",
        )
        if held_place:
            release_reserved_place(application.offer_id)
        _notify_withdrawn(application)
        return application


def release_place_for_application(application_id):
    """Internal, idempotent place release used after an internship cancellation."""

    with transaction.atomic():
        application = Application.objects.select_for_update().filter(pk=application_id).first()
        if application is None:
            raise BusinessError(NOT_FOUND, "Application not found.", status_code=404)
        if application.place_released_at is not None:
            return application, False

        if application.status == ApplicationStatus.CONFIRMED:
            release_occupied_place(application.offer_id)
        elif application.status in RESERVED_STATUSES:
            release_reserved_place(application.offer_id)

        application.place_released_at = timezone.now()
        application.save(update_fields=["place_released_at", "updated_at"])
        return application, True


def reconcile_accepted_application(application_id):
    """Retry a STUDENT_ACCEPTED application that never reached CONFIRMED."""

    application = Application.objects.filter(
        pk=application_id,
        status=ApplicationStatus.STUDENT_ACCEPTED,
    ).first()
    if application is None:
        return "skipped"

    try:
        create_official_internship_record(application)
    except InternshipConflict:
        _revert_student_acceptance(application.pk, reason="reconciliation: internship conflict")
        return "reverted"
    except InternshipUnavailable:
        return "retry"

    finalize_confirmation(application.pk, actor_role="system")
    return "confirmed"
