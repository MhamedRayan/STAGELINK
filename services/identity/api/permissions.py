import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission

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
