"""
Domain errors and the error envelope for the internships API.

Every error response uses the envelope from docs/api-conventions.md:

    {"code": "...", "message": "...", "details": {...}}

`code` is stable and machine-readable. `message` is for humans and may change.
Stack traces and internal exception text are never returned.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class DomainError(Exception):
    code = "domain_error"
    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "The request cannot be completed."

    def __init__(self, message=None, details=None):
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)


class ActiveInternshipConflict(DomainError):
    code = "active_internship_conflict"
    status_code = status.HTTP_409_CONFLICT
    default_message = "The student already has an active internship."


class InvalidTransition(DomainError):
    code = "invalid_status_transition"
    status_code = status.HTTP_409_CONFLICT
    default_message = "This status change is not allowed."


class EvaluationRequired(DomainError):
    code = "evaluation_required"
    status_code = status.HTTP_409_CONFLICT
    default_message = "The internship cannot be completed until an approved evaluation exists."


class StartDateNotReached(DomainError):
    code = "start_date_not_reached"
    status_code = status.HTTP_409_CONFLICT
    default_message = "The internship cannot start before its start date."


class InvalidInternshipState(DomainError):
    code = "invalid_internship_state"
    status_code = status.HTTP_409_CONFLICT
    default_message = "This action is not allowed for the internship's current status."


class ReasonRequired(DomainError):
    code = "reason_required"
    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "A reason is required for this change."


class InvalidSupervisor(DomainError):
    code = "invalid_supervisor"
    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "The selected user cannot be assigned as a supervisor."


class IdentityUnavailable(DomainError):
    code = "identity_unavailable"
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "The identity service is unavailable. Try again later."


_DRF_CODES = {
    status.HTTP_400_BAD_REQUEST: "invalid_request",
    status.HTTP_401_UNAUTHORIZED: "unauthenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
}


def service_exception_handler(exc, context):
    """Render every error, our own and DRF's, in the shared envelope."""
    if isinstance(exc, DomainError):
        return Response(
            {"code": exc.code, "message": exc.message, "details": exc.details},
            status=exc.status_code,
        )

    response = exception_handler(exc, context)
    if response is None:
        return None  # unexpected exception: let Django return its 500 page

    data = response.data
    if isinstance(data, dict) and set(data) == {"detail"}:
        code = _DRF_CODES.get(response.status_code, "error")
        message = str(data["detail"])
        details = {}
    else:
        # Field-level validation errors from serializers.
        code = "validation_error"
        message = "The request is invalid."
        details = data if isinstance(data, dict) else {"non_field_errors": data}

    # Keep the response headers (for example WWW-Authenticate on 401).
    response.data = {"code": code, "message": message, "details": details}
    return response
