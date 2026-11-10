import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission

from api.models import UserRole

SERVICE_TOKEN_HEADER = "X-Service-Token"


class IsTrustedService(BasePermission):
    """Allow only callers that present the shared internal service token."""

    message = "A valid X-Service-Token header is required."

    def has_permission(self, request, view):
        expected = settings.INTERNAL_SERVICE_TOKEN
        provided = request.headers.get(SERVICE_TOKEN_HEADER, "")

        # Fail closed: no configured token, or no provided token, means deny.
        if not expected or not provided:
            return False

        # Constant-time comparison prevents timing attacks on the token.
        return secrets.compare_digest(provided.encode(), expected.encode())


class IsPlatformAdmin(BasePermission):
    """Allow only authenticated accounts with the platform_admin role."""

    message = "Only platform administrators may perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == UserRole.PLATFORM_ADMIN
        )
