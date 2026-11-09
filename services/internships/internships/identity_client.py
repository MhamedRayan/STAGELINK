"""
Client for the Identity service's internal user directory.

Used to verify that a user chosen as supervisor really exists, is active and
has the supervisor role. Calls use the shared X-Service-Token header and never
forward a user's token.
"""

import uuid

import requests
from django.conf import settings

from .exceptions import IdentityUnavailable


def fetch_identity_user(user_id):
    """
    Return the Identity user record as a dict, or None if the user does not exist.
    Raises IdentityUnavailable when Identity cannot answer.
    """
    url = (
        f"{settings.IDENTITY_BASE_URL.rstrip('/')}"
        f"/api/internal/users/{uuid.UUID(str(user_id))}/"
    )
    try:
        response = requests.get(
            url,
            headers={"X-Service-Token": settings.INTERNAL_SERVICE_TOKEN},
            timeout=settings.IDENTITY_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise IdentityUnavailable() from exc

    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise IdentityUnavailable()

    try:
        return response.json()
    except ValueError as exc:
        raise IdentityUnavailable() from exc
