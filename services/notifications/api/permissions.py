import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

SERVICE_TOKEN_HEADER = "HTTP_X_SERVICE_TOKEN"


class IsInternalService(BasePermission):
    """Allow only trusted services that send the shared X-Service-Token header.

    Fails closed: if no token is configured, or none is sent, access is denied.
    """

    message = "Invalid or missing service token."

    def has_permission(self, request, view):
        expected_token = settings.INTERNAL_SERVICE_TOKEN
        provided_token = request.META.get(SERVICE_TOKEN_HEADER, "")

        if not expected_token or not provided_token:
            return False

        return hmac.compare_digest(provided_token.encode(), expected_token.encode())
