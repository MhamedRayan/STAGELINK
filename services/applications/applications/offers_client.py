"""Client for the Offers service's internal offer lookup.

Applications never trusts a company id or offer state supplied by its caller.
It asks Offers for the canonical record and derives the owning company from it.
"""

import logging
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class OfferNotFound(Exception):
    """The offer does not exist (or was soft deleted)."""


class OffersUnavailable(Exception):
    """Offers could not be reached or answered with an unexpected status."""

    def __init__(self, message="Offers is unavailable.", details=None):
        super().__init__(message)
        self.details = details or {}


def get_offer(offer_id):
    """Return the internal offer payload or raise ``OfferNotFound``/``OffersUnavailable``."""

    base_url = (settings.OFFERS_SERVICE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        logger.error("OFFERS_SERVICE_URL or INTERNAL_SERVICE_TOKEN is not configured")
        raise OffersUnavailable("Offers is not configured.")

    url = f"{base_url}/{uuid.UUID(str(offer_id))}/"
    try:
        response = requests.get(
            url,
            headers={"X-Service-Token": token, "Accept": "application/json"},
            timeout=settings.OFFERS_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.warning("Offers lookup failed for %s: %s", offer_id, exc)
        raise OffersUnavailable() from exc

    if response.status_code == 404:
        raise OfferNotFound()
    if response.status_code != 200:
        logger.warning(
            "Offers lookup for %s returned %s: %s",
            offer_id,
            response.status_code,
            response.text,
        )
        raise OffersUnavailable(details={"status": response.status_code})

    try:
        return response.json()
    except ValueError as exc:
        logger.warning("Offers lookup for %s returned invalid JSON", offer_id)
        raise OffersUnavailable() from exc
