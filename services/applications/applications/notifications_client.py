"""Best-effort Notifications client for the Applications service.

Implements ADR-009: send after the business transaction commits, retry only
transient failures, use a deterministic deduplication key, and never fail the
business action because a notification could not be delivered.
"""

import logging
import random
import time

import requests
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

SUCCESS_STATUSES = frozenset({200, 201})


class NotificationEvent:
    """Stable event names used in deduplication keys."""

    PENDING_VALIDATION = "pending_validation"
    VALIDATED = "validated"
    REJECTED_BY_UNIVERSITY = "rejected_by_university"
    STUDENT_DECISION = "student_decision"
    CONFIRMED = "confirmed"
    WITHDRAWN = "withdrawn"


def build_deduplication_key(object_id, event, recipient_user_id):
    return f"application:{object_id}:{event}:recipient:{recipient_user_id}"


def _payload(*, recipient_user_id, notification_type, title, message, related_object_id, deduplication_key):
    return {
        "recipient_user_id": str(recipient_user_id),
        "type": notification_type,
        "title": title,
        "message": message,
        "related_object_type": "application",
        "related_object_id": str(related_object_id),
        "deduplication_key": deduplication_key,
    }


def _should_retry(exc):
    return isinstance(exc, (requests.Timeout, requests.ConnectionError))


def send(payload):
    """Deliver one notification. Returns True on success, never raises."""

    token = settings.INTERNAL_SERVICE_TOKEN
    if not settings.NOTIFICATIONS_ENABLED or not token:
        logger.debug("Notifications disabled or unconfigured; skipping %s", payload["deduplication_key"])
        return False

    url = f"{settings.NOTIFICATIONS_BASE_URL.rstrip('/')}/api/internal/notifications/"
    headers = {
        "X-Service-Token": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    attempts = max(1, settings.NOTIFICATIONS_MAX_ATTEMPTS)
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=settings.NOTIFICATIONS_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            if not _should_retry(exc) or attempt == attempts:
                logger.warning(
                    "Notification delivery failed after %s attempt(s) for %s: %s",
                    attempt,
                    payload["deduplication_key"],
                    exc,
                )
                return False
            _backoff(attempt)
            continue

        if response.status_code in SUCCESS_STATUSES:
            return True

        if 400 <= response.status_code < 500:
            logger.warning(
                "Notification rejected (%s) for %s: %s",
                response.status_code,
                payload["deduplication_key"],
                response.text,
            )
            return False

        if attempt == attempts:
            logger.warning(
                "Notification delivery failed (%s) after %s attempt(s) for %s: %s",
                response.status_code,
                attempt,
                payload["deduplication_key"],
                response.text,
            )
            return False
        _backoff(attempt)

    return False


def _backoff(attempt):
    delay = min(5.0, 0.5 * (2 ** (attempt - 1)))
    time.sleep(delay + random.uniform(0, 0.5))


def notify_on_commit(
    *,
    recipient_user_id,
    notification_type,
    title,
    message,
    related_object_id,
    event,
    related_object_type="application",
):
    """Schedule a notification to run after the current transaction commits."""

    if not recipient_user_id:
        return
    payload = _payload(
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_id=related_object_id,
        deduplication_key=build_deduplication_key(
            related_object_id, event, recipient_user_id
        ),
    )
    transaction.on_commit(lambda: send(payload), robust=True)


def notify_recipients_on_commit(
    *,
    resolve_recipients,
    notification_type,
    title,
    message,
    related_object_id,
    event,
    related_object_type="application",
):
    """Resolve recipients and send after the current transaction commits.

    ``resolve_recipients`` runs inside the on-commit callback, never inside the
    caller's transaction. This keeps a slow directory or Notifications call from
    extending database lock time. Recipient resolution failures are logged and
    never break the business action.
    """

    if not settings.NOTIFICATIONS_ENABLED:
        return

    def deliver():
        try:
            recipients = resolve_recipients() or ()
        except Exception as exc:  # noqa: BLE001 - best effort by design
            logger.warning(
                "Recipient resolution failed for application %s: %s",
                related_object_id,
                exc,
            )
            return

        for recipient_user_id in dict.fromkeys(recipients):
            if not recipient_user_id:
                continue
            payload = _payload(
                recipient_user_id=recipient_user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                related_object_id=related_object_id,
                deduplication_key=build_deduplication_key(
                    related_object_id, event, recipient_user_id
                ),
            )
            send(payload)

    transaction.on_commit(deliver, robust=True)
