from datetime import date, datetime, timedelta, timezone

import jwt
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Internship
from .roles import Role

TEST_KEY = "test-jwt-signing-key-with-enough-length-0123456789"
LIST_URL = "/api/internships/"


def make_token(user_id=1, role=Role.STUDENT, ttl=timedelta(minutes=15), key=TEST_KEY, algorithm="HS256"):
    now = datetime.now(timezone.utc)
    payload = {"user_id": user_id, "role": role, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, key, algorithm=algorithm)


@override_settings(JWT_SIGNING_KEY=TEST_KEY)
class PublicInternshipApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.own = Internship.objects.create(
            source_application_id=1,
            student_user_id=10,
            company_user_id=20,
            supervisor_user_id=40,
            offer_id=30,
            start_date=date(2027, 2, 1),
            end_date=date(2027, 6, 30),
        )
        self.other = Internship.objects.create(
            source_application_id=2,
            student_user_id=11,
            company_user_id=21,
            supervisor_user_id=41,
            offer_id=31,
            start_date=date(2027, 2, 1),
            end_date=date(2027, 6, 30),
        )

    def _get(self, url, token=None):
        headers = {} if token is None else {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        return self.api.get(url, **headers)

    # Authentication

    def test_missing_token_returns_401(self):
        self.assertEqual(self._get(LIST_URL).status_code, 401)

    def test_malformed_header_returns_401(self):
        response = self.api.get(LIST_URL, HTTP_AUTHORIZATION="Bearer")
        self.assertEqual(response.status_code, 401)

    def test_wrong_signature_returns_401(self):
        token = make_token(key="a-different-key-entirely-0123456789abcdef")
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    def test_expired_token_returns_401(self):
        token = make_token(ttl=timedelta(minutes=-1))
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    def test_alg_none_token_is_rejected(self):
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {"user_id": 10, "role": Role.STUDENT, "exp": now + timedelta(minutes=15)},
            None,
            algorithm="none",
        )
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    def test_token_without_user_id_returns_401(self):
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {"role": Role.STUDENT, "exp": now + timedelta(minutes=15)},
            TEST_KEY,
            algorithm="HS256",
        )
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    def test_unknown_role_returns_401(self):
        token = make_token(role="Intern")
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    def test_role_with_wrong_case_is_rejected(self):
        token = make_token(role="STUDENT")
        self.assertEqual(self._get(LIST_URL, token).status_code, 401)

    # Visibility on the list endpoint

    def test_student_sees_only_own_internships(self):
        response = self._get(LIST_URL, make_token(user_id=10, role=Role.STUDENT))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.own.pk])

    def test_company_sees_only_its_internships(self):
        response = self._get(LIST_URL, make_token(user_id=20, role=Role.COMPANY))

        self.assertEqual([row["id"] for row in response.data], [self.own.pk])

    def test_supervisor_sees_only_assigned_internships(self):
        response = self._get(LIST_URL, make_token(user_id=40, role=Role.SUPERVISOR))

        self.assertEqual([row["id"] for row in response.data], [self.own.pk])

    def test_university_administration_sees_all_internships(self):
        response = self._get(
            LIST_URL, make_token(user_id=99, role=Role.UNIVERSITY_ADMINISTRATION)
        )

        self.assertEqual(len(response.data), 2)

    def test_platform_administrator_sees_no_internships(self):
        response = self._get(
            LIST_URL, make_token(user_id=99, role=Role.PLATFORM_ADMINISTRATOR)
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    # Visibility on the detail endpoint

    def test_student_can_open_own_internship(self):
        url = f"{LIST_URL}{self.own.pk}/"
        response = self._get(url, make_token(user_id=10, role=Role.STUDENT))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.own.pk)

    def test_student_cannot_open_another_students_internship(self):
        url = f"{LIST_URL}{self.other.pk}/"
        response = self._get(url, make_token(user_id=10, role=Role.STUDENT))

        self.assertEqual(response.status_code, 404)

    def test_company_cannot_open_unrelated_internship(self):
        url = f"{LIST_URL}{self.other.pk}/"
        response = self._get(url, make_token(user_id=20, role=Role.COMPANY))

        self.assertEqual(response.status_code, 404)

    def test_supervisor_cannot_open_unassigned_internship(self):
        url = f"{LIST_URL}{self.other.pk}/"
        response = self._get(url, make_token(user_id=40, role=Role.SUPERVISOR))

        self.assertEqual(response.status_code, 404)

    def test_university_administration_can_open_any_internship(self):
        url = f"{LIST_URL}{self.other.pk}/"
        response = self._get(
            url, make_token(user_id=99, role=Role.UNIVERSITY_ADMINISTRATION)
        )

        self.assertEqual(response.status_code, 200)

    def test_unauthorized_and_missing_ids_look_identical(self):
        # Same 404 for "exists but not yours" and "does not exist".
        not_yours = self._get(
            f"{LIST_URL}{self.other.pk}/", make_token(user_id=10, role=Role.STUDENT)
        )
        missing = self._get(
            f"{LIST_URL}999999/", make_token(user_id=10, role=Role.STUDENT)
        )

        self.assertEqual(not_yours.status_code, missing.status_code)
