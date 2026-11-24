"""Client for the Identity service's internal user directory.

Applications resolves university administrators from Identity's authoritative
role directory instead of requiring a static UUID list. Calls use the shared
X-Service-Token header and never forward a user's token.

Everything here is best effort: a failure raises ``IdentityUnavailable`` and the
caller falls back to configured recipients. Successful and failed lookups are
cached briefly so a struggling Identity service is not hammered once per
notification.
"""

import hashlib
import logging
import uuid

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

UNIVERSITY_ADMIN_ROLE = "university_admin"
STUDENT_ROLE = "student"


class IdentityUnavailable(Exception):
    """Identity could not answer the directory query."""


def _success_ttl():
    return max(0, int(settings.IDENTITY_DIRECTORY_CACHE_SECONDS))


def _failure_ttl():
    return max(1, int(settings.IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS))


def list_university_admin_ids(university=None):
    """Return active university-administrator UUID strings.

    When ``university`` is supplied the directory is filtered to that
    institution. Callers in the notification path always pass it so an event is
    never broadcast to administrators of another university.

    Raises ``IdentityUnavailable`` when Identity is not configured, cannot be
    reached, or answers with an unexpected payload.
    """

    return _list_ids(
        role=UNIVERSITY_ADMIN_ROLE,
        university=university,
        cache_scope="university-admins",
    )


def list_student_ids_for_university(university):
    """Return active student UUID strings belonging to one institution.

    An empty institution has no scope: the result is empty without calling
    Identity. This keeps a university administrator with a blank scope from
    ever falling back to the global roster.
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
    """Map UUID strings to the institution on their role profile.

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
            raise IdentityUnavailable("Identity batch response is malformed.")
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
    cache_key = f"applications:identity:{cache_scope}:{digest}"
    failure_key = f"{cache_key}:unavailable"

    success_ttl = _success_ttl()
    if success_ttl > 0:
        cached = cache.get(cache_key)
        if cached is not None:
            return list(cached)
        if cache.get(failure_key):
            raise IdentityUnavailable("Identity directory is temporarily unavailable.")

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
        raise IdentityUnavailable("Identity is not configured.")

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

    if not isinstance(payload, dict):
        logger.warning("Identity directory returned an unexpected payload: %r", payload)
        raise IdentityUnavailable("Identity directory response is malformed.")
    return payload


def _fetch_all_pages(initial_params):
    base_url = (settings.IDENTITY_BASE_URL or "").rstrip("/")
    token = settings.INTERNAL_SERVICE_TOKEN
    if not base_url or not token:
        logger.warning("IDENTITY_BASE_URL or INTERNAL_SERVICE_TOKEN is not configured")
        raise IdentityUnavailable("Identity is not configured.")

    url = f"{base_url}/api/internal/users/"
    params = dict(initial_params)
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
