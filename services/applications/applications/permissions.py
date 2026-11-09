import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission

from .roles import Role

SERVICE_TOKEN_HEADER = "X-Service-Token"


class IsInternalService(BasePermission):
    """Allows only callers that present the shared internal service token.

    Internal endpoints never accept a user JWT. The check fails closed when
    either side of the comparison is missing.
    """

    message = "Invalid or missing service token."

    def has_permission(self, request, view):
        expected = settings.INTERNAL_SERVICE_TOKEN
        provided = request.headers.get(SERVICE_TOKEN_HEADER, "")

        if not expected or not provided:
            return False

        return secrets.compare_digest(provided.encode(), expected.encode())


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, "role", None) == Role.STUDENT
        )


class IsCompany(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, "role", None) == Role.COMPANY
        )


class IsUniversity(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, "role", None) == Role.UNIVERSITY_ADMIN
        )


class IsApplicationParticipant(BasePermission):
    """
    Object-level permission: Ensures callers can only view/access applications relevant to them.
    """

    def has_object_permission(self, request, view, obj):
        user_id = str(getattr(request.user, "id", ""))
        user_role = getattr(request.user, "role", None)

        if user_role == Role.STUDENT:
            return str(obj.student_user_id) == user_id
        if user_role == Role.COMPANY:
            return str(obj.company_user_id) == user_id
        if user_role in (Role.UNIVERSITY_ADMIN, Role.PLATFORM_ADMIN):
            return True
        return False
