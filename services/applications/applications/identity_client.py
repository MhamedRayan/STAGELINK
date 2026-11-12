"""Client for the Identity service's internal user directory.

Applications resolves university administrators from Identity's authoritative
role directory instead of requiring a static UUID list. Calls use the shared
X-Service-Token header and never forward a user's token.

Everything here is best effort: a failure raises ``IdentityUnavailable`` and the
caller falls back to configured recipients. Successful and failed lookups are
cached briefly so a struggling Identity service is not hammered once per
notification.
"""

import logging
import uuid

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

DIRECTORY_CACHE_KEY = "applications:identity:university-admins"
DIRECTORY_FAILURE_CACHE_KEY = "applications:identity:university-admins:unavailable"
UNIVERSITY_ADMIN_ROLE = "university_admin"


class IdentityUnavailable(Exception):
    """Identity could not answer the directory query."""


def _success_ttl():
    return max(0, int(settings.IDENTITY_DIRECTORY_CACHE_SECONDS))


def _failure_ttl():
    return max(1, int(settings.IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS))


def list_university_admin_ids():
    """Return sorted, unique UUID strings for active university administrators.

    Raises ``IdentityUnavailable`` when Identity is not configured, cannot be
    reached, or answers with an unexpected payload.
    """

    success_ttl = _success_ttl()
    if success_ttl > 0:
        cached = cache.get(DIRECTORY_CACHE_KEY)
        if cached is not None:
            return list(cached)
        if cache.get(DIRECTORY_FAILURE_CACHE_KEY):
            raise IdentityUnavailable("Identity directory is temporarily unavailable.")

    try:
        user_ids = _fetch_all_pages()
    except IdentityUnavailable:
        cache.set(DIRECTORY_FAILURE_CACHE_KEY, True, _failure_ttl())
        raise

    cache.delete(DIRECTORY_FAILURE_CACHE_KEY)
    if success_ttl > 0:
        cache.set(DIRECTORY_CACHE_KEY, user_ids, success_ttl)
    return list(user_ids)


def _fetch_all_pages():
    base_url = (settings.IDENTITY_BASE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        logger.warning("IDENTITY_BASE_URL or INTERNAL_SERVICE_TOKEN is not configured")
        raise IdentityUnavailable("Identity is not configured.")

    url = f"{base_url}/api/internal/users/"
    params = {"role": UNIVERSITY_ADMIN_ROLE}
    collected = set()
    visited_urls = set()

    while url:
        if url in visited_urls:
            logger.warning("Identity directory pagination looped at %s", url)
            raise IdentityUnavailable("Identity directory pagination looped.")
        visited_urls.add(url)

        try:
            response = requests.get(
                url,
                params=params,
                headers={
                    "X-Service-Token": token,
                    "Accept": "application/json",
                },
                timeout=settings.IDENTITY_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            logger.warning("Identity directory request failed: %s", exc)
            raise IdentityUnavailable("Identity directory request failed.") from exc

        if response.status_code != 200:
            logger.warning(
                "Identity directory returned %s: %s",
                response.status_code,
                response.text,
            )
            raise IdentityUnavailable(
                f"Identity directory returned {response.status_code}."
            )

        try:
            payload = response.json()
        except ValueError as exc:
            logger.warning("Identity directory returned invalid JSON")
            raise IdentityUnavailable("Identity directory returned invalid JSON.") from exc

        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            logger.warning("Identity directory response is missing results: %r", payload)
            raise IdentityUnavailable("Identity directory response is malformed.")

        for item in results:
            raw_id = item.get("id") if isinstance(item, dict) else None
            try:
                collected.add(str(uuid.UUID(str(raw_id))))
            except (AttributeError, TypeError, ValueError):
                logger.warning("Ignoring invalid Identity directory user: %r", item)

        # DRF returns an absolute URL for `next`, including the query string.
        url = payload.get("next")
        params = None

    return sorted(collected)
