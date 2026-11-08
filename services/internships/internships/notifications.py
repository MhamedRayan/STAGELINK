"""
Notification events emitted by the internships service.

Each function decides who should be told about an internship event and queues a
best-effort notification per recipient. Deduplication keys are stable across
retries, so the Notifications service can safely ignore a repeated delivery.
"""

import logging
import uuid

from django.conf import settings

from .notifications_client import schedule_notification

logger = logging.getLogger(__name__)

RELATED_OBJECT_TYPE = "internship"


def _key(internship, *parts):
    return ":".join(("internship", str(internship.pk), *map(str, parts)))


def _recipient_key(user_id):
    return f"recipient:{user_id}"


def _participants(internship):
    """Student and company, in a stable order, without duplicates."""
    return list(dict.fromkeys([internship.student_user_id, internship.company_user_id]))


def _send(internship, *, recipient_user_id, event_key, notification_type, title, message):
    schedule_notification(
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_type=RELATED_OBJECT_TYPE,
        related_object_id=internship.pk,
        deduplication_key=_key(internship, event_key, _recipient_key(recipient_user_id)),
    )


def university_admin_user_ids():
    """
    Configured university administrators.

    Identity does not expose a role directory yet, so the recipients come from
    UNIVERSITY_ADMIN_USER_IDS. Invalid values are ignored rather than breaking
    the business action.
    """
    configured = []
    for raw in settings.UNIVERSITY_ADMIN_USER_IDS:
        try:
            configured.append(uuid.UUID(str(raw)))
        except (TypeError, ValueError):
            logger.warning("Ignoring invalid UNIVERSITY_ADMIN_USER_IDS value: %r", raw)
    return configured


def notify_internship_created(internship):
    for user_id in _participants(internship):
        _send(
            internship,
            recipient_user_id=user_id,
            event_key="created",
            notification_type="internship_created",
            title="Internship created",
            message="An internship has been created for you.",
        )


def notify_supervisor_assigned(internship, supervisor_user_id):
    recipients = dict.fromkeys([internship.student_user_id, supervisor_user_id])
    for user_id in recipients:
        _send(
            internship,
            recipient_user_id=user_id,
            event_key=f"supervisor_assigned:{supervisor_user_id}",
            notification_type="supervisor_assigned",
            title="Supervisor assigned",
            message="A supervisor has been assigned to the internship.",
        )


def _other_participant(internship, user_id):
    if user_id == internship.student_user_id:
        return internship.company_user_id
    if user_id == internship.company_user_id:
        return internship.student_user_id
    return None


def notify_cancellation_requested(internship, cancellation):
    recipients = [_other_participant(internship, cancellation.requested_by_user_id)]
    recipients.extend(university_admin_user_ids())

    seen = set()
    for user_id in recipients:
        if user_id is None or user_id in seen:
            continue
        seen.add(user_id)
        _send(
            internship,
            recipient_user_id=user_id,
            event_key=f"cancellation_requested:{cancellation.pk}",
            notification_type="cancellation_requested",
            title="Cancellation requested",
            message="A cancellation has been requested for an internship.",
        )


def notify_cancellation_decided(internship, cancellation, *, approved):
    decision = "approved" if approved else "rejected"
    recipients = [
        cancellation.requested_by_user_id,
        _other_participant(internship, cancellation.requested_by_user_id),
    ]

    seen = set()
    for user_id in recipients:
        if user_id is None or user_id in seen:
            continue
        seen.add(user_id)
        _send(
            internship,
            recipient_user_id=user_id,
            event_key=f"cancellation_{decision}:{cancellation.pk}",
            notification_type="cancellation_decided",
            title=f"Cancellation {decision}",
            message=f"The internship cancellation was {decision}.",
        )


def notify_submission_reviewed(internship, submission, *, approved):
    decision = "approved" if approved else "rejected"
    _send(
        internship,
        recipient_user_id=internship.student_user_id,
        event_key=f"submission_reviewed:{submission.pk}:{decision}",
        notification_type="submission_reviewed",
        title=f"Submission {decision}",
        message=f"Your final submission was {decision}.",
    )


def notify_evaluation_published(internship, evaluation):
    _send(
        internship,
        recipient_user_id=internship.student_user_id,
        event_key=f"evaluation_published:{evaluation.pk}",
        notification_type="evaluation_published",
        title="Evaluation published",
        message="Your internship evaluation has been published.",
    )
