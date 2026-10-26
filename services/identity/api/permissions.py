from rest_framework.permissions import BasePermission


class IsTrustedService(BasePermission):
    message = "A trusted service token with identity:users:read scope is required."

    def has_permission(self, request, view):
        return bool(
            getattr(request.user, "service_id", None)
            and isinstance(request.auth, dict)
            and request.auth.get("scope") == "identity:users:read"
        )
