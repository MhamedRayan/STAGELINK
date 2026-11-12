"""
Best-effort client for the Notifications service.

Calls are made with the shared X-Service-Token header and never forward a user's
token. Delivery failures are logged and swallowed: a notification must never
roll back or fail the internship change that triggered it.

Every notification is scheduled with transaction.on_commit, so nothing is sent
for a transaction that rolls back.
"""

import logging

import requests
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def notify(
    *,
    recipient_user_id,
    notification_type,
    title,
    message,
    related_object_id,
    deduplication_key,
    related_object_type="internship",
):
    """
    POST one notification. Returns True on success, False on any failure.

    The caller supplies who should be notified; the Notifications service owns
    storage and read state.
    """
    if not settings.NOTIFICATIONS_ENABLED:
        return False

    url = (
        f"{settings.NOTIFICATIONS_BASE_URL.rstrip('/')}"
        "/api/internal/notifications/"
    )
    payload = {
        "recipient_user_id": str(recipient_user_id),
        "type": notification_type,
        "title": title,
        "message": message,
        "related_object_type": related_object_type,
        "related_object_id": str(related_object_id),
        "deduplication_key": deduplication_key,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"X-Service-Token": settings.INTERNAL_SERVICE_TOKEN},
            timeout=settings.NOTIFICATIONS_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(
            "Notification %s for user %s could not be delivered: %s",
            notification_type,
            recipient_user_id,
            exc,
        )
        return False

    return True


def schedule_notification(**kwargs):
    """Queue a notification to be sent only if the current transaction commits."""
    transaction.on_commit(lambda: notify(**kwargs))


def schedule_notifications(
    *,
    resolve_recipients,
    deduplication_key_for,
    notification_type,
    title,
    message,
    related_object_type="internship",
    related_object_id,
):
    """Resolve recipients and send only after the current transaction commits.

    ``resolve_recipients`` runs inside the on-commit callback, never inside the
    caller's transaction, so a slow directory lookup cannot extend database lock
    time. Resolution failures are logged and never break the business action.
    """

    if not settings.NOTIFICATIONS_ENABLED:
        return

    def deliver():
        try:
            recipients = resolve_recipients() or ()
        except Exception as exc:  # noqa: BLE001 - best effort by design
            logger.warning(
                "Recipient resolution failed for %s %s: %s",
                related_object_type,
                related_object_id,
                exc,
            )
            return

        for recipient_user_id in dict.fromkeys(recipients):
            if not recipient_user_id:
                continue
            notify(
                recipient_user_id=recipient_user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                related_object_type=related_object_type,
                related_object_id=related_object_id,
                deduplication_key=deduplication_key_for(recipient_user_id),
            )

    transaction.on_commit(deliver, robust=True)
