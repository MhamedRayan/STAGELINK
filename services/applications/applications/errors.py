"""Stable error envelopes for the Applications API.

Every error response follows the shared convention in ``docs/api-conventions.md``:

    {"code": "invalid_state", "message": "...", "details": {...}}

``code`` is machine-readable and must not change for an existing condition.
``message`` is human-readable and may change.
"""

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

# Stable business error codes. Keep these in sync with contracts/applications.yaml.
OFFER_NOT_FOUND = "OFFER_NOT_FOUND"
OFFER_UNAVAILABLE = "OFFER_UNAVAILABLE"
OFFERS_UNAVAILABLE = "OFFERS_UNAVAILABLE"
CAPACITY_FULL = "CAPACITY_FULL"
INVALID_STATE = "INVALID_STATE"
DUPLICATE_APPLICATION = "DUPLICATE_APPLICATION"
INTERNSHIP_CONFLICT = "INTERNSHIP_CONFLICT"
DOWNSTREAM_UNAVAILABLE = "DOWNSTREAM_UNAVAILABLE"
NOT_FOUND = "NOT_FOUND"


class BusinessError(APIException):
    """A domain error carrying a stable code and a safe message."""

    def __init__(self, code, message, status_code=status.HTTP_400_BAD_REQUEST, details=None):
        self.code = code
        self.message = message
        self.details = details
        self.status_code = status_code
        # ``APIException`` wants a detail for rendering and for default messages.
        self.detail = message
        super().__init__(detail=message)


def _status_code_for(exc, response):
    return getattr(exc, "status_code", None) or response.status_code


def _code_for(exc, response):
    if isinstance(exc, ValidationError):
        return "VALIDATION_ERROR"
    default_code = getattr(exc, "default_code", None)
    if default_code and str(default_code) not in {"error", "invalid"}:
        return str(default_code).upper()
    return {
        status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
        status.HTTP_401_UNAUTHORIZED: "NOT_AUTHENTICATED",
        status.HTTP_403_FORBIDDEN: "PERMISSION_DENIED",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
        status.HTTP_409_CONFLICT: "CONFLICT",
        status.HTTP_429_TOO_MANY_REQUESTS: "THROTTLED",
    }.get(response.status_code, "ERROR")


def _message_for(exc, response):
    if isinstance(exc, ValidationError):
        return "The request is invalid."
    detail = getattr(exc, "detail", None)
    if detail is not None:
        if isinstance(detail, (list, tuple)) and detail:
            return str(detail[0])
        return str(detail)
    if isinstance(response.data, dict) and "detail" in response.data:
        return str(response.data["detail"])
    return "The request could not be completed."


def api_exception_handler(exc, context):
    """Normalise every DRF error into the shared ``code``/``message`` envelope."""

    if isinstance(exc, BusinessError):
        payload = {"code": exc.code, "message": exc.message}
        if exc.details:
            payload["details"] = exc.details
        return Response(payload, status=exc.status_code)

    response = exception_handler(exc, context)
    if response is None:
        return None

    payload = {
        "code": _code_for(exc, response),
        "message": _message_for(exc, response),
    }
    if isinstance(exc, ValidationError):
        payload["details"] = response.data
    elif isinstance(response.data, dict):
        extra = {
            key: value
            for key, value in response.data.items()
            if key not in {"detail", "code", "message"}
        }
        if extra:
            payload["details"] = extra

    return Response(payload, status=_status_code_for(exc, response))
