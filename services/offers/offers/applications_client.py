"""Client for the Applications service's committed-places snapshot.

Offers owns the advertised capacity, Applications owns reservations. Before an
offer's capacity can be reduced, Offers asks Applications how many places are
already committed. The call is fail-closed: if Applications cannot answer, the
reduction is refused rather than risking overbooking.
"""

import uuid

import requests
from django.conf import settings


class ApplicationsUnavailable(Exception):
    """Applications could not answer the capacity snapshot request."""


def get_offer_capacity(offer_id):
    """Return the capacity snapshot for an offer.

    Raises ``ApplicationsUnavailable`` when the service is not configured,
    cannot be reached, or returns an unexpected payload.
    """

    base_url = (settings.APPLICATIONS_BASE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        raise ApplicationsUnavailable("Applications is not configured.")

    url = f"{base_url}/api/internal/offers/{uuid.UUID(str(offer_id))}/capacity/"
    try:
        response = requests.get(
            url,
            headers={
                "X-Service-Token": token,
                "Accept": "application/json",
            },
            timeout=settings.APPLICATIONS_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ApplicationsUnavailable("Capacity lookup failed.") from exc

    if response.status_code != 200:
        raise ApplicationsUnavailable(
            f"Applications returned {response.status_code}."
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise ApplicationsUnavailable("Applications returned invalid JSON.") from exc

    committed = payload.get("committed") if isinstance(payload, dict) else None
    if not isinstance(committed, int) or committed < 0:
        raise ApplicationsUnavailable("Applications returned an invalid snapshot.")
    return payload
