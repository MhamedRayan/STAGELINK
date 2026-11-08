"""
Client for the Applications service's internal place-release endpoint.

Called after an approved cancellation, so the place reserved by the source
application is returned to the offer. The endpoint is idempotent: a repeated
call releases at most once.
"""

import logging
import uuid

import requests
from django.conf import settings

from .exceptions import ApplicationsUnavailable

logger = logging.getLogger(__name__)


def release_place(source_application_id):
    """
    Ask Applications to release the place reserved by this application.

    Raises ApplicationsUnavailable on a network error or a non-success answer.
    """
    url = (
        f"{settings.APPLICATIONS_BASE_URL.rstrip('/')}"
        "/api/internal/applications/"
        f"{uuid.UUID(str(source_application_id))}/release-place/"
    )
    try:
        response = requests.post(
            url,
            headers={"X-Service-Token": settings.INTERNAL_SERVICE_TOKEN},
            timeout=settings.APPLICATIONS_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ApplicationsUnavailable() from exc

    # 200 and 204 both mean the place is released (or already was).
    if response.status_code not in (200, 204):
        raise ApplicationsUnavailable(
            details={"status": response.status_code},
        )
