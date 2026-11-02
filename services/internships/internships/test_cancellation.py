from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import CancellationRequest, CancellationStatus, Internship, InternshipAudit, InternshipAuditAction, InternshipStatus
from .roles import Role
from .services import create_internship
from .testing_utils import TEST_JWT_KEY, make_internship, make_token, new_id

PAST = date(2000, 1, 1)


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class CancellationTestBase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.student = new_id()
        self.company = new_id()
        self.internship = make_internship(student=self.student, company=self.company, start=PAST)
        self.admin = make_token(new_id(), Role.UNIVERSITY_ADMIN)
        self.student_token = make_token(self.student, Role.STUDENT)
        self.company_token = make_token(self.company, Role.COMPANY)

    def _url(self, *parts):
        return "/api/internships/" + "/".join([str(self.internship.pk), *parts]) + "/"

    def _request(self, token, reason="Found another opportunity"):
        return self.api.post(
            self._url("cancellation-requests"),
            {"reason": reason},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def _decide(self, request_id, action, token, data=None):
        return self.api.post(
            self._url("cancellation-requests", str(request_id), action),
            data or {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def _pending(self):
        return self._request(self.student_token)


class RequestCancellationTests(CancellationTestBase):
    def test_student_can_request_cancellation(self):
        response = self._request(self.student_token)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], CancellationStatus.PENDING)
        self.assertEqual(response.data["requested_by_role"], Role.STUDENT)
        self.assertEqual(response.data["reason"], "Found another opportunity")

    def test_company_can_request_cancellation(self):
        response = self._request(self.company_token)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["requested_by_role"], Role.COMPANY)

    def test_request_is_recorded_in_history(self):
        self._request(self.student_token)

        self.assertTrue(
            InternshipAudit.objects.filter(
                internship=self.internship, action=InternshipAuditAction.CANCELLATION_REQUESTED
            ).exists()
        )

    def test_university_admin_cannot_request_cancellation(self):
        response = self._request(self.admin)

        self.assertEqual(response.status_code, 403)

    def test_supervisor_cannot_request_cancellation(self):
        supervisor = new_id()
        Internship.objects.filter(pk=self.internship.pk).update(supervisor_user_id=supervisor)
        response = self._request(make_token(supervisor, Role.SUPERVISOR))

        self.assertEqual(response.status_code, 403)

    def test_other_student_cannot_see_the_internship(self):
        response = self._request(make_token(new_id(), Role.STUDENT))

        self.assertEqual(response.status_code, 404)

    def test_blank_reason_is_rejected(self):
        response = self._request(self.student_token, reason="   ")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertEqual(CancellationRequest.objects.count(), 0)

    def test_completed_internship_cannot_be_cancelled(self):
        Internship.objects.filter(pk=self.internship.pk).update(status=InternshipStatus.COMPLETED)
        response = self._request(self.student_token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "invalid_internship_state")

    def test_second_request_while_one_is_pending_is_refused(self):
        self._request(self.student_token)
        response = self._request(self.company_token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "cancellation_already_pending")
        self.assertEqual(CancellationRequest.objects.count(), 1)


class DecideCancellationTests(CancellationTestBase):
    def test_approval_cancels_the_internship(self):
        request_id = self._pending().data["id"]

        response = self._decide(request_id, "approve", self.admin, {"reason": "Agreed"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], InternshipStatus.CANCELLED)
        self.internship.refresh_from_db()
        self.assertEqual(self.internship.status, InternshipStatus.CANCELLED)

    def test_approval_is_recorded_with_status_change_and_decision(self):
        request_id = self._pending().data["id"]
        self._decide(request_id, "approve", self.admin)

        actions = list(
            InternshipAudit.objects.filter(internship=self.internship)
            .order_by("at", "pk")
            .values_list("action", flat=True)
        )
        self.assertIn(InternshipAuditAction.STATUS_CHANGED, actions)
        self.assertIn(InternshipAuditAction.CANCELLATION_APPROVED, actions)

        request = CancellationRequest.objects.get(pk=request_id)
        self.assertEqual(request.status, CancellationStatus.APPROVED)
        self.assertIsNotNone(request.decided_at)

    def test_approval_frees_the_student_to_apply_again(self):
        request_id = self._pending().data["id"]
        self._decide(request_id, "approve", self.admin)

        _, created = create_internship(
            source_application_id=new_id(),
            student_user_id=self.student,
            company_user_id=new_id(),
            offer_id=new_id(),
            start_date=date(2027, 9, 1),
            end_date=date(2027, 12, 1),
        )
        self.assertTrue(created)

    def test_rejection_keeps_the_internship_and_status(self):
        request_id = self._pending().data["id"]

        response = self._decide(request_id, "reject", self.admin, {"reason": "Not enough notice"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], InternshipStatus.CONFIRMED)
        request = CancellationRequest.objects.get(pk=request_id)
        self.assertEqual(request.status, CancellationStatus.REJECTED)
        self.assertEqual(request.decision_reason, "Not enough notice")

    def test_rejection_requires_a_reason(self):
        request_id = self._pending().data["id"]

        response = self._decide(request_id, "reject", self.admin, {"reason": ""})

        self.assertEqual(response.status_code, 400)
        request = CancellationRequest.objects.get(pk=request_id)
        self.assertEqual(request.status, CancellationStatus.PENDING)

    def test_rejected_request_allows_a_new_request(self):
        request_id = self._pending().data["id"]
        self._decide(request_id, "reject", self.admin, {"reason": "No"})

        response = self._request(self.company_token)

        self.assertEqual(response.status_code, 201)

    def test_deciding_twice_is_refused(self):
        request_id = self._pending().data["id"]
        self._decide(request_id, "approve", self.admin)

        response = self._decide(request_id, "reject", self.admin, {"reason": "Too late"})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "cancellation_not_pending")

    def test_student_cannot_approve_their_own_request(self):
        request_id = self._pending().data["id"]

        response = self._decide(request_id, "approve", self.student_token)

        self.assertEqual(response.status_code, 403)
        self.internship.refresh_from_db()
        self.assertEqual(self.internship.status, InternshipStatus.CONFIRMED)

    def test_company_cannot_reject(self):
        request_id = self._pending().data["id"]

        response = self._decide(request_id, "reject", self.company_token, {"reason": "No"})

        self.assertEqual(response.status_code, 403)

    def test_cancelled_internship_cannot_be_cancelled_again(self):
        self._pending()
        Internship.objects.filter(pk=self.internship.pk).update(status=InternshipStatus.CANCELLED)
        request = CancellationRequest.objects.get()

        response = self._decide(request.pk, "approve", self.admin)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "invalid_internship_state")


class ListCancellationTests(CancellationTestBase):
    def test_list_shows_requests_to_participants(self):
        self._pending()

        response = self.api.get(
            self._url("cancellation-requests"),
            HTTP_AUTHORIZATION=f"Bearer {self.company_token}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_list_is_hidden_from_unrelated_students(self):
        self._pending()

        response = self.api.get(
            self._url("cancellation-requests"),
            HTTP_AUTHORIZATION=f"Bearer {make_token(new_id(), Role.STUDENT)}",
        )

        self.assertEqual(response.status_code, 404)

    def test_cancellation_appears_in_history_for_participants(self):
        request_id = self._pending().data["id"]
        self._decide(request_id, "approve", self.admin)

        response = self.api.get(
            self._url("history"),
            HTTP_AUTHORIZATION=f"Bearer {self.student_token}",
        )

        actions = [entry["action"] for entry in response.data["results"]]
        self.assertIn("cancellation_requested", actions)
        self.assertIn("cancellation_approved", actions)
