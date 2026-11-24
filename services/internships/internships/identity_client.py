"""
Client for the Identity service's internal user directory.

Used to verify that a user chosen as supervisor really exists, is active and
has the supervisor role, and to resolve university-administrator notification
recipients. Calls use the shared X-Service-Token header and never forward a
user's token.

Directory lookups are cached briefly so a struggling Identity service is not
hammered once per notification. A failed lookup raises ``IdentityUnavailable``
and the caller falls back to configured recipients.
"""

import hashlib
import logging
import uuid

import requests
from django.conf import settings
from django.core.cache import cache

from .exceptions import IdentityUnavailable

logger = logging.getLogger(__name__)

UNIVERSITY_ADMIN_ROLE = "university_admin"
STUDENT_ROLE = "student"


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


def _success_ttl():
    return max(0, int(settings.IDENTITY_DIRECTORY_CACHE_SECONDS))


def _failure_ttl():
    return max(1, int(settings.IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS))


def list_university_admin_ids(university=None):
    """Return active university-administrator UUID strings.

    When ``university`` is supplied the directory is filtered to that
    institution. Notification callers always pass it so an event is never
    broadcast to administrators of another university.
    """

    return _list_ids(
        role=UNIVERSITY_ADMIN_ROLE,
        university=university,
        cache_scope="university-admins",
    )


def list_student_ids_for_university(university):
    """Return active student UUID strings belonging to one institution.

    A blank institution has no scope and never falls back to a global roster.
    """

    normalised = (university or "").strip()
    if not normalised:
        return []
    return _list_ids(
        role=STUDENT_ROLE,
        university=normalised,
        cache_scope="students",
    )


def user_universities(user_ids):
    """Map UUID strings to their role-profile institution.

    Missing or invalid IDs are omitted. Raises ``IdentityUnavailable`` when the
    directory cannot answer.
    """

    requested = []
    for raw_id in user_ids:
        try:
            normalised = str(uuid.UUID(str(raw_id)))
        except (AttributeError, TypeError, ValueError):
            logger.warning("Ignoring invalid user id for university lookup: %r", raw_id)
            continue
        if normalised not in requested:
            requested.append(normalised)

    if not requested:
        return {}

    universities = {}
    for start in range(0, len(requested), 100):
        payload = _directory_request({"ids": ",".join(requested[start:start + 100])})
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            logger.warning("Identity batch response is missing results: %r", payload)
            raise IdentityUnavailable()
        for item in results:
            if not isinstance(item, dict):
                continue
            raw_id = item.get("id")
            try:
                user_id = str(uuid.UUID(str(raw_id)))
            except (AttributeError, TypeError, ValueError):
                logger.warning("Ignoring invalid Identity batch user: %r", item)
                continue
            universities[user_id] = str(item.get("university") or "").strip()
    return universities


def _list_ids(*, role, university, cache_scope):
    normalised = (university or "").strip()
    if university is not None and not normalised:
        return []

    suffix = "all" if university is None else normalised.casefold()
    digest = hashlib.sha256(suffix.encode("utf-8")).hexdigest()
    cache_key = f"internships:identity:{cache_scope}:{digest}"
    failure_key = f"{cache_key}:unavailable"

    success_ttl = _success_ttl()
    if success_ttl > 0:
        cached = cache.get(cache_key)
        if cached is not None:
            return list(cached)
        if cache.get(failure_key):
            raise IdentityUnavailable()

    params = {"role": role}
    if university is not None:
        params["university"] = normalised

    try:
        user_ids = _fetch_all_pages(params)
    except IdentityUnavailable:
        cache.set(failure_key, True, _failure_ttl())
        raise

    cache.delete(failure_key)
    if success_ttl > 0:
        cache.set(cache_key, user_ids, success_ttl)
    return list(user_ids)


def _directory_request(params):
    base_url = (settings.IDENTITY_BASE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        logger.warning("IDENTITY_BASE_URL or INTERNAL_SERVICE_TOKEN is not configured")
        raise IdentityUnavailable()

    try:
        response = requests.get(
            f"{base_url}/api/internal/users/",
            params=params,
            headers={
                "X-Service-Token": token,
                "Accept": "application/json",
            },
            timeout=settings.IDENTITY_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.warning("Identity directory request failed: %s", exc)
        raise IdentityUnavailable() from exc

    if response.status_code != 200:
        logger.warning(
            "Identity directory returned %s: %s",
            response.status_code,
            response.text,
        )
        raise IdentityUnavailable()

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning("Identity directory returned invalid JSON")
        raise IdentityUnavailable() from exc

    if not isinstance(payload, dict):
        logger.warning("Identity directory returned an unexpected payload: %r", payload)
        raise IdentityUnavailable()
    return payload


def _fetch_all_pages(initial_params):
    base_url = (settings.IDENTITY_BASE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        logger.warning("IDENTITY_BASE_URL or INTERNAL_SERVICE_TOKEN is not configured")
        raise IdentityUnavailable()

    url = f"{base_url}/api/internal/users/"
    params = dict(initial_params)
    collected = set()
    visited_urls = set()

    while url:
        if url in visited_urls:
            logger.warning("Identity directory pagination looped at %s", url)
            raise IdentityUnavailable()
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
            raise IdentityUnavailable() from exc

        if response.status_code != 200:
            logger.warning(
                "Identity directory returned %s: %s",
                response.status_code,
                response.text,
            )
            raise IdentityUnavailable()

        try:
            payload = response.json()
        except ValueError as exc:
            logger.warning("Identity directory returned invalid JSON")
            raise IdentityUnavailable() from exc

        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            logger.warning("Identity directory response is missing results: %r", payload)
            raise IdentityUnavailable()

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
