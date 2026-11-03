"""Reference caller for the STAGELINK notifications service (P1-1).

Copy this module into a producer service (Applications, Internships, Offers)
or import it from a shared internal package. It implements the delivery rules
recorded in ADR-009 and ``api_contract.md``:

* send only after the business transaction commits (``transaction.on_commit``);
* bounded retry with exponential backoff on timeouts, connection errors and
  ``5xx`` responses only;
* a stable deduplication key per event and recipient, so retries and replays
  never create a second notification;
* best-effort delivery: a notification failure is logged and never fails the
  business action that triggered it.

Example::

    from notifications_client import NotificationClient, build_deduplication_key

    client = NotificationClient.from_env()

    client.notify_on_commit(
        recipient_user_id=application.student_user_id,
        type="application_validated",
        title="Application validated",
        message="The university validated your application.",
        related_object_type="application",
        related_object_id=application.id,
        deduplication_key=build_deduplication_key(
            "application", application.id, "validated", application.student_user_id
        ),
    )
"""

from __future__ import annotations

import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Iterable, Optional

import requests
from django.db import transaction

logger = logging.getLogger(__name__)

INTERNAL_NOTIFICATIONS_PATH = "/api/internal/notifications/"
SUCCESS_STATUSES = frozenset({200, 201})
DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_BASE_DELAY_SECONDS = 0.5
DEFAULT_MAX_DELAY_SECONDS = 5.0


class NotificationEvent:
    """Stable event names used in deduplication keys.

    These are not the notification ``type`` values; they describe *what
    happened* and must never change for an existing event, otherwise a retry
    would create a duplicate.
    """

    APPLICATION_PENDING_VALIDATION = "pending_validation"
    APPLICATION_VALIDATED = "validated"
    APPLICATION_REJECTED_BY_UNIVERSITY = "rejected_by_university"
    STUDENT_DECISION = "student_decision"
    APPLICATION_CONFIRMED = "confirmed"
    APPLICATION_WITHDRAWN = "withdrawn"
    INTERNSHIP_CREATED = "internship_created"
    SUPERVISOR_ASSIGNED = "supervisor_assigned"
    CANCELLATION_REQUESTED = "cancellation_requested"
    CANCELLATION_DECIDED = "cancellation_decided"
    SUBMISSION_REVIEWED = "submission_reviewed"
    EVALUATION_PUBLISHED = "evaluation_published"


def build_deduplication_key(
    object_type: str,
    object_id,
    event: str,
    recipient_user_id,
) -> str:
    """Return ``{object_type}:{object_id}:{event}:recipient:{user_id}``.

    The key is stable across retries and process restarts because it contains
    no timestamp, random value or attempt counter.
    """

    return f"{object_type}:{object_id}:{event}:recipient:{recipient_user_id}"


@dataclass(frozen=True)
class NotificationRequest:
    recipient_user_id: str
    type: str
    title: str
    message: str
    deduplication_key: str
    related_object_type: str = ""
    related_object_id: str = ""

    def as_payload(self) -> dict:
        return {
            "recipient_user_id": str(self.recipient_user_id),
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "related_object_type": self.related_object_type,
            "related_object_id": str(self.related_object_id),
            "deduplication_key": self.deduplication_key,
        }


class NotificationClient:
    """Best-effort client for ``POST /api/internal/notifications/``."""

    def __init__(
        self,
        base_url: str,
        service_token: str,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        base_delay: float = DEFAULT_BASE_DELAY_SECONDS,
        max_delay: float = DEFAULT_MAX_DELAY_SECONDS,
        session: Optional[requests.Session] = None,
        sleep=time.sleep,
    ):
        if not base_url:
            raise ValueError("A notifications base URL is required.")
        if not service_token:
            raise ValueError("A notifications service token is required.")
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1.")

        self.base_url = base_url.rstrip("/")
        self.service_token = service_token
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.session = session or requests.Session()
        self._sleep = sleep

    @classmethod
    def from_env(cls, **kwargs) -> "NotificationClient":
        """Build a client from the environment variables in ``api_contract.md``.

        ``NOTIFICATIONS_SERVICE_TOKEN`` is preferred; ``INTERNAL_SERVICE_TOKEN``
        is accepted as a fallback because all services already share it.
        """

        return cls(
            base_url=os.environ.get("NOTIFICATIONS_SERVICE_URL", ""),
            service_token=(
                os.environ.get("NOTIFICATIONS_SERVICE_TOKEN")
                or os.environ.get("INTERNAL_SERVICE_TOKEN", "")
            ),
            **kwargs,
        )

    def send(self, request: NotificationRequest) -> Optional[dict]:
        """Send one notification, retrying transient failures.

        Returns the notification payload on ``200``/``201`` and ``None`` when
        the request could not be delivered. It never raises, so callers can
        treat notification delivery as best effort.
        """

        url = f"{self.base_url}{INTERNAL_NOTIFICATIONS_PATH}"
        headers = {
            "X-Service-Token": self.service_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self.session.post(
                    url,
                    json=request.as_payload(),
                    headers=headers,
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                if not self._should_retry_exception(exc) or attempt == self.max_attempts:
                    logger.warning(
                        "Notification delivery failed after %s attempt(s) for %s: %s",
                        attempt,
                        request.deduplication_key,
                        exc,
                    )
                    return None
                self._backoff(attempt)
                continue

            if response.status_code in SUCCESS_STATUSES:
                return response.json()

            # 4xx is a caller bug: retrying cannot help and may amplify it.
            if 400 <= response.status_code < 500:
                logger.warning(
                    "Notification rejected (%s) for %s: %s",
                    response.status_code,
                    request.deduplication_key,
                    response.text,
                )
                return None

            if attempt == self.max_attempts:
                logger.warning(
                    "Notification delivery failed (%s) after %s attempt(s) for %s: %s",
                    response.status_code,
                    attempt,
                    request.deduplication_key,
                    response.text,
                )
                return None

            self._backoff(attempt)

        return None

    def notify_on_commit(
        self,
        request: Optional[NotificationRequest] = None,
        **fields,
    ) -> None:
        """Schedule ``send`` to run only after the current transaction commits.

        Pass either a :class:`NotificationRequest` or the individual fields:

        ``client.notify_on_commit(recipient_user_id=..., type=..., ...)``

        ``robust=True`` makes Django swallow an unexpected callback error, so a
        notification can never turn a successful business commit into a 500.
        """

        if request is None:
            request = NotificationRequest(**fields)
        elif fields:
            raise TypeError("Pass a NotificationRequest or keyword fields, not both.")

        transaction.on_commit(lambda: self.send(request), robust=True)

    def notify_many_on_commit(self, requests_: Iterable[NotificationRequest]) -> None:
        for request in requests_:
            self.notify_on_commit(request)

    def _backoff(self, attempt: int) -> None:
        delay = min(self.max_delay, self.base_delay * (2 ** (attempt - 1)))
        # Jitter avoids a thundering herd when a producer retries many events.
        self._sleep(delay + random.uniform(0, self.base_delay))

    @staticmethod
    def _should_retry_exception(exc: requests.RequestException) -> bool:
        return isinstance(
            exc,
            (
                requests.Timeout,
                requests.ConnectionError,
            ),
        )
