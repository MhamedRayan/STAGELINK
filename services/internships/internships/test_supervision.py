from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .exceptions import IdentityUnavailable
from .models import InternshipAudit, InternshipAuditAction
from .roles import Role
from .testing_utils import TEST_JWT_KEY, identity_user, make_internship, make_token, new_id

SERVICE = "internships.services.fetch_identity_user"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class SupervisorAssignmentTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = make_token(new_id(), Role.UNIVERSITY_ADMIN)
        self.supervisor_id = new_id()
        self.internship = make_internship()
        self.url = f"/api/internships/{self.internship.pk}/assign-supervisor/"

    def _post(self, token, data):
        return self.api.post(
            self.url,
            data,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_university_admin_assigns_a_valid_supervisor(self):
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 200)
        self.internship.refresh_from_db()
        self.assertEqual(self.internship.supervisor_user_id, self.supervisor_id)
        self.assertIsNotNone(self.internship.supervisor_assigned_at)

    def test_assignment_is_recorded_in_history(self):
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        entry = InternshipAudit.objects.get(
            internship=self.internship, action=InternshipAuditAction.SUPERVISOR_ASSIGNED
        )
        self.assertEqual(entry.to_supervisor_user_id, self.supervisor_id)
        self.assertIsNone(entry.from_supervisor_user_id)

    def test_assigned_supervisor_sees_the_internship_immediately(self):
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        token = make_token(self.supervisor_id, Role.SUPERVISOR)
        response = self.api.get(
            "/api/internships/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        ids = [row["id"] for row in response.data["results"]]
        self.assertEqual(ids, [str(self.internship.pk)])

    def test_student_cannot_assign_a_supervisor(self):
        token = make_token(new_id(), Role.STUDENT)
        with patch(SERVICE) as lookup:
            response = self._post(token, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 403)
        lookup.assert_not_called()

    def test_company_and_supervisor_cannot_assign(self):
        for role in (Role.COMPANY, Role.SUPERVISOR):
            token = make_token(new_id(), role)
            response = self._post(token, {"supervisor_user_id": str(self.supervisor_id)})
            self.assertEqual(response.status_code, 403, role)

    def test_user_who_is_not_a_supervisor_is_rejected(self):
        with patch(SERVICE, return_value=identity_user(self.supervisor_id, role="student")):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_supervisor")
        self.internship.refresh_from_db()
        self.assertIsNone(self.internship.supervisor_user_id)

    def test_unknown_user_is_rejected(self):
        with patch(SERVICE, return_value=None):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_supervisor")

    def test_inactive_supervisor_is_rejected(self):
        with patch(SERVICE, return_value=identity_user(self.supervisor_id, is_active=False)):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 400)

    def test_identity_outage_returns_503_and_changes_nothing(self):
        with patch(SERVICE, side_effect=IdentityUnavailable()):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "identity_unavailable")
        self.assertFalse(
            InternshipAudit.objects.filter(internship=self.internship).exclude(
                action=InternshipAuditAction.CREATED
            ).exists()
        )

    def test_reassignment_requires_a_reason(self):
        old = new_id()
        self.internship.supervisor_user_id = old
        self.internship.save()
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "reason_required")
        self.internship.refresh_from_db()
        self.assertEqual(self.internship.supervisor_user_id, old)

    def test_reassignment_with_reason_is_audited_as_reassigned(self):
        old = new_id()
        self.internship.supervisor_user_id = old
        self.internship.save()
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self._post(
                self.admin,
                {"supervisor_user_id": str(self.supervisor_id), "reason": "Workload rebalanced"},
            )

        self.assertEqual(response.status_code, 200)
        entry = InternshipAudit.objects.get(
            internship=self.internship, action=InternshipAuditAction.SUPERVISOR_REASSIGNED
        )
        self.assertEqual(entry.from_supervisor_user_id, old)
        self.assertEqual(entry.to_supervisor_user_id, self.supervisor_id)
        self.assertEqual(entry.reason, "Workload rebalanced")

    def test_assigning_the_same_supervisor_again_changes_nothing(self):
        self.internship.supervisor_user_id = self.supervisor_id
        self.internship.save()
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            InternshipAudit.objects.filter(internship=self.internship).exclude(
                action=InternshipAuditAction.CREATED
            ).exists()
        )

    def test_cannot_assign_supervisor_to_completed_internship(self):
        self.internship.status = "completed"
        self.internship.save()
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self._post(self.admin, {"supervisor_user_id": str(self.supervisor_id)})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "invalid_internship_state")

    def test_unknown_internship_returns_404(self):
        url = f"/api/internships/{new_id()}/assign-supervisor/"
        with patch(SERVICE, return_value=identity_user(self.supervisor_id)):
            response = self.api.post(
                url,
                {"supervisor_user_id": str(self.supervisor_id)},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {self.admin}",
            )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "not_found")

    def test_missing_token_returns_401_in_envelope(self):
        response = self.api.post(
            self.url, {"supervisor_user_id": str(self.supervisor_id)}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "unauthenticated")
