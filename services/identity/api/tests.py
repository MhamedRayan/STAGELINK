from datetime import timedelta

import jwt
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from api.models import User, UserRole


class IdentityApiTests(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            email="student@example.edu",
            password="StudentStrongPassword!2026",
            name="Sample Student",
            role=UserRole.STUDENT,
        )
        self.other_student = User.objects.create_user(
            email="other@example.edu",
            password="OtherStrongPassword!2026",
            name="Other Student",
            role=UserRole.STUDENT,
        )

    def test_registration_hashes_password_and_normalizes_email(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "NEW.STUDENT@EXAMPLE.EDU",
                "password": "RegistrationStrongPassword!2026",
                "name": "New Student",
                "role": UserRole.STUDENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new.student@example.edu")
        self.assertNotEqual(user.password_hash, "RegistrationStrongPassword!2026")
        self.assertTrue(user.check_password("RegistrationStrongPassword!2026"))

    def test_company_registration_creates_inactive_account(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "company@example.com",
                "password": "SecureIndustryPhrase!2026",
                "name": "Example Company",
                "role": UserRole.COMPANY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        company = User.objects.get(email="company@example.com")
        self.assertFalse(company.is_active)

    def test_registration_rejects_privileged_roles(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "admin@example.edu",
                "password": "AdministratorPassword!2026",
                "name": "Attempted Administrator",
                "role": UserRole.PLATFORM_ADMINISTRATOR,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="admin@example.edu").exists())

    def test_registration_rejects_case_insensitive_duplicate_email(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "STUDENT@EXAMPLE.EDU",
                "password": "DuplicateStrongPassword!2026",
                "name": "Duplicate Student",
                "role": UserRole.STUDENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_issues_access_and_refresh_tokens_with_user_claims(self):
        response = self.client.post(
            reverse("auth-login"),
            {
                "email": "STUDENT@EXAMPLE.EDU",
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["token_type"], "Bearer")
        access_token = AccessToken(response.data["access"])
        self.assertEqual(access_token["role"], UserRole.STUDENT)
        self.assertEqual(access_token["email"], self.student.email)

    def test_login_rejects_inactive_company(self):
        User.objects.create_user(
            email="inactive@example.com",
            password="SecureInactiveCompanyPhrase!2026",
            name="Inactive Company",
            role=UserRole.COMPANY,
        )

        response = self.client.post(
            reverse("auth-login"),
            {
                "email": "inactive@example.com",
                "password": "SecureInactiveCompanyPhrase!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_requires_authentication(self):
        response = self.client.get(reverse("user-profile"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_patch_updates_only_the_authenticated_user(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"name": "Updated Student"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.other_student.refresh_from_db()
        self.assertEqual(self.student.name, "Updated Student")
        self.assertEqual(self.other_student.name, "Other Student")

    def test_profile_patch_rejects_protected_role_change(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"role": UserRole.PLATFORM_ADMINISTRATOR},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, UserRole.STUDENT)

    def test_profile_patch_rejects_email_owned_by_another_user(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"email": "OTHER@example.edu"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_lookup_rejects_user_access_token(self):
        self.client.force_authenticate(user=None)
        login_response = self.client.post(
            reverse("auth-login"),
            {
                "email": self.student.email,
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_internal_lookup_accepts_scoped_service_token_and_returns_minimal_data(self):
        now = timezone.now()
        service_token = jwt.encode(
            {
                "aud": settings.SERVICE_JWT_AUDIENCE,
                "exp": int((now + timedelta(minutes=2)).timestamp()),
                "iat": int(now.timestamp()),
                "iss": settings.SERVICE_JWT_ISSUER,
                "scope": "identity:users:read",
                "sub": "offers-applications",
            },
            settings.SERVICE_JWT_SIGNING_KEY,
            algorithm=settings.SERVICE_JWT_ALGORITHM,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {service_token}")

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.student.id))
        self.assertEqual(response.data["role"], UserRole.STUDENT)
        self.assertNotIn("password_hash", response.data)

    def test_internal_lookup_rejects_insufficient_service_scope(self):
        now = timezone.now()
        service_token = jwt.encode(
            {
                "aud": settings.SERVICE_JWT_AUDIENCE,
                "exp": int((now + timedelta(minutes=2)).timestamp()),
                "iat": int(now.timestamp()),
                "iss": settings.SERVICE_JWT_ISSUER,
                "scope": "identity:users:write",
                "sub": "offers-applications",
            },
            settings.SERVICE_JWT_SIGNING_KEY,
            algorithm=settings.SERVICE_JWT_ALGORITHM,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {service_token}")

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
