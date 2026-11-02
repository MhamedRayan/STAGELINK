from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import InternshipStatus
from .roles import Role
from .testing_utils import TEST_JWT_KEY, make_internship, make_token, new_id

LIST_URL = "/api/internships/"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class ListingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.university = make_token(new_id(), Role.UNIVERSITY_ADMIN)
        self.student = new_id()
        self.company = new_id()
        self.supervisor = new_id()
        self.mine = make_internship(
            student=self.student, company=self.company, supervisor=self.supervisor,
            start=date(2027, 2, 1),
        )
        self.other = make_internship(start=date(2027, 5, 1), status=InternshipStatus.IN_PROGRESS)

    def _get(self, params="", token=None):
        token = token or self.university
        return self.api.get(f"{LIST_URL}{params}", HTTP_AUTHORIZATION=f"Bearer {token}")

    # Envelope and pagination

    def test_list_uses_results_and_pagination_envelope(self):
        response = self._get()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["pagination"], {"limit": 20, "offset": 0, "total": 2})
        self.assertEqual(len(response.data["results"]), 2)

    def test_limit_and_offset_page_through_results(self):
        first = self._get("?limit=1&offset=0")
        second = self._get("?limit=1&offset=1")

        self.assertEqual(first.data["pagination"]["total"], 2)
        self.assertEqual(len(first.data["results"]), 1)
        self.assertNotEqual(first.data["results"][0]["id"], second.data["results"][0]["id"])

    def test_limit_above_maximum_is_rejected(self):
        response = self._get("?limit=101")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")

    def test_zero_limit_and_negative_offset_are_rejected(self):
        self.assertEqual(self._get("?limit=0").status_code, 400)
        self.assertEqual(self._get("?offset=-1").status_code, 400)

    # Filters

    def test_status_filter_narrows_results(self):
        response = self._get("?status=in_progress")

        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.other.pk)])

    def test_invalid_status_filter_is_rejected(self):
        self.assertEqual(self._get("?status=Intern").status_code, 400)

    def test_date_range_filter(self):
        response = self._get("?start_date_from=2027-04-01&start_date_to=2027-06-01")

        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.other.pk)])

    def test_reversed_date_range_is_rejected(self):
        response = self._get("?start_date_from=2027-06-01&start_date_to=2027-01-01")

        self.assertEqual(response.status_code, 400)

    def test_ordering_by_start_date(self):
        response = self._get("?ordering=start_date")

        self.assertEqual(
            [row["id"] for row in response.data["results"]],
            [str(self.mine.pk), str(self.other.pk)],
        )

    def test_unknown_ordering_is_rejected(self):
        self.assertEqual(self._get("?ordering=id").status_code, 400)

    # Filters never widen visibility

    def test_filter_cannot_reveal_another_companys_internship(self):
        token = make_token(self.company, Role.COMPANY)
        response = self._get(f"?company_user_id={self.other.company_user_id}", token=token)

        self.assertEqual(response.data["results"], [])

    def test_student_filter_cannot_reveal_another_students_internship(self):
        token = make_token(self.student, Role.STUDENT)
        response = self._get(f"?student_user_id={self.other.student_user_id}", token=token)

        self.assertEqual(response.data["results"], [])

    # mine=true

    def test_mine_for_student_returns_own_internships(self):
        token = make_token(self.student, Role.STUDENT)
        response = self._get("?mine=true", token=token)

        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.mine.pk)])

    def test_mine_for_supervisor_returns_only_assigned(self):
        token = make_token(self.supervisor, Role.SUPERVISOR)
        response = self._get("?mine=true", token=token)

        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.mine.pk)])

    def test_mine_for_university_admin_returns_nothing(self):
        response = self._get("?mine=true")

        self.assertEqual(response.data["results"], [])

    def test_mine_for_company_returns_own_offers_internships(self):
        token = make_token(self.company, Role.COMPANY)
        response = self._get("?mine=true", token=token)

        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.mine.pk)])


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class ErrorEnvelopeTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_unauthenticated_list_uses_error_envelope(self):
        response = self.api.get("/api/internships/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "unauthenticated")
        self.assertIn("message", response.data)
        self.assertIn("details", response.data)
        self.assertIn("WWW-Authenticate", response)

    def test_detail_hidden_from_caller_uses_not_found_code(self):
        internship = make_internship()
        token = make_token(new_id(), Role.STUDENT)

        response = self.api.get(
            f"/api/internships/{internship.pk}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "not_found")
