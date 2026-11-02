import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission

from .roles import Role

SERVICE_TOKEN_HEADER = "X-Service-Token"


class IsInternalService(BasePermission):
    """Allows only callers that present the shared internal service token."""

    message = "Invalid or missing service token."

    def has_permission(self, request, view):
        expected = settings.INTERNAL_SERVICE_TOKEN
        provided = request.headers.get(SERVICE_TOKEN_HEADER, "")

        # Fail closed: no configured token, or no provided token, means deny.
        if not expected or not provided:
            return False

        # Constant-time comparison prevents timing attacks on the token.
        return secrets.compare_digest(provided.encode(), expected.encode())


class IsUniversityAdmin(BasePermission):
    message = "Only university administration can perform this action."

    def has_permission(self, request, view):
        return getattr(request.user, "role", None) == Role.UNIVERSITY_ADMIN


class IsSupervisorOrUniversityAdmin(BasePermission):
    """Supervisors may act on their assigned internships; the visibility rule limits which ones."""

    message = "Only a supervisor or university administration can perform this action."

    def has_permission(self, request, view):
        return getattr(request.user, "role", None) in {Role.SUPERVISOR, Role.UNIVERSITY_ADMIN}
