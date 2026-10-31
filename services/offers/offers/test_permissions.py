from datetime import timedelta
import uuid

from django.conf import settings
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.settings import api_settings
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.authentication import JWTStatelessUserAuthentication
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from offers.models import Offer, OfferStatus
from offers.permissions import (
    CanViewOffer,
    IsCompanyUser,
    IsOfferOwner,
    UserRole,
)

OWNER_ID = uuid.uuid4()
OTHER_COMPANY_ID = uuid.uuid4()

NON_COMPANY_ROLES = (
    UserRole.STUDENT,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERVISOR,
    UserRole.PLATFORM_ADMIN,
)


def make_access_token(user_id, role=None):
    token = AccessToken()
    token[settings.SIMPLE_JWT["USER_ID_CLAIM"]] = str(user_id)
    if role is not None:
        token[settings.JWT_ROLE_CLAIM] = str(role)
    return token


def build_request(token=None):
    headers = {}
    if token is not None:
        headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    wsgi_request = APIRequestFactory().get("/", **headers)
    return Request(wsgi_request, authenticators=[JWTStatelessUserAuthentication()])


def build_request_for(user_id, role=None):
    return build_request(make_access_token(user_id, role))


def build_offer(status=OfferStatus.DRAFT, company_user_id=OWNER_ID):
    return Offer(company_user_id=company_user_id, status=status)


class TokenAuthenticationTests(SimpleTestCase):
    def test_default_authentication_class_is_stateless_jwt(self):
        self.assertEqual(
            api_settings.DEFAULT_AUTHENTICATION_CLASSES,
            [JWTStatelessUserAuthentication],
        )

    def test_valid_token_authenticates_without_database(self):
        request = build_request_for(OWNER_ID, UserRole.COMPANY)

        user, validated_token = JWTStatelessUserAuthentication().authenticate(request)

        self.assertEqual(str(user.id), str(OWNER_ID))
        self.assertEqual(validated_token[settings.JWT_ROLE_CLAIM], "company")

    def test_missing_authorization_header_returns_none(self):
        request = build_request()

        self.assertIsNone(JWTStatelessUserAuthentication().authenticate(request))

    def test_tampered_signature_is_rejected(self):
        token = make_access_token(OWNER_ID, UserRole.COMPANY)
        header, payload, _signature = str(token).split(".")
        tampered_token = ".".join([header, payload, "invalidsignature"])
        request = build_request(tampered_token)

        with self.assertRaises(AuthenticationFailed):
            JWTStatelessUserAuthentication().authenticate(request)

    def test_expired_token_is_rejected(self):
        token = make_access_token(OWNER_ID, UserRole.COMPANY)
        token.set_exp(
            from_time=timezone.now() - timedelta(hours=1),
            lifetime=timedelta(minutes=15),
        )
        request = build_request(token)

        with self.assertRaises(AuthenticationFailed):
            JWTStatelessUserAuthentication().authenticate(request)

    def test_refresh_token_is_rejected_as_access_token(self):
        refresh_token = RefreshToken()
        refresh_token[settings.SIMPLE_JWT["USER_ID_CLAIM"]] = str(OWNER_ID)
        refresh_token[settings.JWT_ROLE_CLAIM] = str(UserRole.COMPANY)
        request = build_request(refresh_token)

        with self.assertRaises(AuthenticationFailed):
            JWTStatelessUserAuthentication().authenticate(request)


class IsCompanyUserTests(SimpleTestCase):
    def test_company_is_allowed(self):
        request = build_request_for(OWNER_ID, UserRole.COMPANY)

        self.assertTrue(IsCompanyUser().has_permission(request, None))

    def test_other_roles_are_denied(self):
        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                request = build_request_for(OWNER_ID, role)

                self.assertFalse(IsCompanyUser().has_permission(request, None))

    def test_anonymous_is_denied(self):
        request = build_request()

        self.assertFalse(IsCompanyUser().has_permission(request, None))

    def test_token_without_role_claim_is_denied(self):
        request = build_request_for(OWNER_ID)

        self.assertFalse(IsCompanyUser().has_permission(request, None))

    def test_unknown_role_is_denied(self):
        request = build_request_for(OWNER_ID, "intruder")

        self.assertFalse(IsCompanyUser().has_permission(request, None))


class IsOfferOwnerTests(SimpleTestCase):
    def test_owner_company_is_allowed(self):
        request = build_request_for(OWNER_ID, UserRole.COMPANY)

        self.assertTrue(
            IsOfferOwner().has_object_permission(request, None, build_offer())
        )

    def test_other_company_is_denied(self):
        request = build_request_for(OTHER_COMPANY_ID, UserRole.COMPANY)

        self.assertFalse(
            IsOfferOwner().has_object_permission(request, None, build_offer())
        )

    def test_non_company_roles_with_owner_id_are_denied(self):
        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                request = build_request_for(OWNER_ID, role)

                self.assertFalse(
                    IsOfferOwner().has_object_permission(request, None, build_offer())
                )

    def test_anonymous_is_denied(self):
        request = build_request()

        self.assertFalse(
            IsOfferOwner().has_object_permission(request, None, build_offer())
        )

    def test_string_caller_id_matches_company_user_id(self):
        request = build_request_for(str(OWNER_ID), UserRole.COMPANY)

        self.assertTrue(
            IsOfferOwner().has_object_permission(request, None, build_offer())
        )


class CanViewOfferTests(SimpleTestCase):
    def build_all_requests(self):
        requests = {
            "owner": build_request_for(OWNER_ID, UserRole.COMPANY),
            "other_company": build_request_for(OTHER_COMPANY_ID, UserRole.COMPANY),
            "anonymous": build_request(),
        }
        for role in NON_COMPANY_ROLES:
            requests[str(role)] = build_request_for(OTHER_COMPANY_ID, role)
        return requests

    def test_published_offer_is_visible_to_everyone(self):
        offer = build_offer(status=OfferStatus.PUBLISHED)

        for name, request in self.build_all_requests().items():
            with self.subTest(caller=name):
                self.assertTrue(
                    CanViewOffer().has_object_permission(request, None, offer)
                )

    def test_draft_and_closed_offers_are_visible_only_to_owner(self):
        for status in (OfferStatus.DRAFT, OfferStatus.CLOSED):
            offer = build_offer(status=status)

            for name, request in self.build_all_requests().items():
                with self.subTest(status=status, caller=name):
                    allowed = CanViewOffer().has_object_permission(
                        request, None, offer
                    )

                    self.assertEqual(allowed, name == "owner")
