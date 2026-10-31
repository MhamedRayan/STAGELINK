import uuid

from django.conf import settings
from django.db import models
from rest_framework.permissions import BasePermission

from offers.models import OfferStatus


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    COMPANY = "company", "Company"
    UNIVERSITY_ADMIN = "university_admin", "University administration"
    SUPERVISOR = "supervisor", "Supervisor"
    PLATFORM_ADMIN = "platform_admin", "Platform administrator"


def _get_token_claim(request, claim_name):
    token = request.auth
    if token is None:
        return None
    return token.get(claim_name)


def _get_caller_role(request):
    return _get_token_claim(request, settings.JWT_ROLE_CLAIM)


def _get_caller_id(request):
    return _get_token_claim(request, settings.SIMPLE_JWT["USER_ID_CLAIM"])


def _is_company(request):
    is_authenticated = bool(request.user and request.user.is_authenticated)
    return is_authenticated and _get_caller_role(request) == UserRole.COMPANY


def _is_offer_owner(request, offer):
    caller_id = _get_caller_id(request)
    if caller_id is None:
        return False
    return _is_company(request) and str(caller_id) == str(offer.company_user_id)


class IsCompanyUser(BasePermission):
    message = "Only company accounts can perform this action."

    def has_permission(self, request, view):
        return _is_company(request)

def get_authenticated_company_id(request):
    if not _is_company(request):
        return None
    caller_id = _get_caller_id(request)
    try:
        return uuid.UUID(str(caller_id))
    except (TypeError, ValueError, AttributeError):
        return None

class IsOfferOwner(BasePermission):
    message = "You can only manage your own offers."

    def has_object_permission(self, request, view, obj):
        return _is_offer_owner(request, obj)
    


class CanViewOffer(BasePermission):
    message = "You do not have access to this offer."

    def has_object_permission(self, request, view, obj):
        if obj.status == OfferStatus.PUBLISHED:
            return True
        return _is_offer_owner(request, obj)
