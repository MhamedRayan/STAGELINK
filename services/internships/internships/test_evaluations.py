from datetime import date
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    InternshipAudit,
    InternshipAuditAction,
    InternshipStatus,
    SubmissionStatus,
)
from .roles import Role
from .testing_utils import (
    TEST_JWT_KEY,
    TemporaryMediaMixin,
    make_evaluation,
    make_internship,
    make_submission,
    make_token,
    new_id,
)

PAST = date(2000, 1, 1)
NOTIFY = "internships.notifications_client.notify"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class EvaluationApiTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.api = APIClient()
        self.student = new_id()
        self.company = new_id()
        self.supervisor = new_id()
        self.admin = new_id()
        self.internship = make_internship(
            student=self.student,
            company=self.company,
            supervisor=self.supervisor,
            start=PAST,
            status=InternshipStatus.IN_PROGRESS,
        )
        make_submission(
            self.internship,
            version=1,
            status=SubmissionStatus.APPROVED,
            reviewed_by=self.supervisor,
            reason="Approved.",
        )
        self.student_token = make_token(self.student, Role.STUDENT)
        self.company_token = make_token(self.company, Role.COMPANY)
        self.supervisor_token = make_token(self.supervisor, Role.SUPERVISOR)
        self.admin_token = make_token(self.admin, Role.UNIVERSITY_ADMIN)

    def _url(self, internship=None):
        internship = internship or self.internship
        return f"/api/internships/{internship.pk}/evaluation/"

    def _post(self, token, *, grade="17.50", comment="Good work.", internship=None):
        return self.api.post(
            self._url(internship),
            {"grade": grade, "comment": comment},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def _get(self, token, *, internship=None):
        return self.api.get(
            self._url(internship), HTTP_AUTHORIZATION=f"Bearer {token}"
        )

    def test_supervisor_records_the_grade_and_completes_the_internship(self):
        response = self._post(
            self.supervisor_token, grade="17.50", comment="Excellent report."
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["grade"], "17.50")
        self.assertEqual(data["comment"], "Excellent report.")
        self.assertEqual(data["supervisor_user_id"], str(self.supervisor))

        self.internship.refresh_from_db()
        self.assertEqual(self.internship.status, InternshipStatus.COMPLETED)
        self.assertEqual(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.EVALUATION_PUBLISHED,
            ).count(),
            1,
        )
        completed = InternshipAudit.objects.get(
            internship=self.internship,
            action=InternshipAuditAction.STATUS_CHANGED,
            to_status=InternshipStatus.COMPLETED,
        )
        self.assertEqual(completed.actor_user_id, self.supervisor)

    def test_boundary_and_decimal_grades_are_accepted(self):
        for grade in ("0.00", "10.50", "20.00", 20, 7.25):
            with self.subTest(grade=grade):
                internship = make_internship(
                    start=PAST, status=InternshipStatus.IN_PROGRESS, supervisor=self.supervisor
                )
                make_submission(
                    internship,
                    status=SubmissionStatus.APPROVED,
                    reviewed_by=self.supervisor,
                    reason="Approved.",
                )

                response = self._post(
                    self.supervisor_token, grade=grade, internship=internship
                )

                self.assertEqual(response.status_code, 201, response.content)

    def test_invalid_grades_are_rejected(self):
        for grade in ("-0.01", "20.01", "abc", "10.555"):
            with self.subTest(grade=grade):
                response = self._post(self.supervisor_token, grade=grade)
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(response.json()["code"], "validation_error")

        self.internship.refresh_from_db()
        self.assertEqual(self.internship.status, InternshipStatus.IN_PROGRESS)

    def test_an_approved_submission_is_required(self):
        for submissions in ("none", "pending", "rejected"):
            with self.subTest(submissions=submissions):
                internship = make_internship(
                    start=PAST, status=InternshipStatus.IN_PROGRESS, supervisor=self.supervisor
                )
                if submissions == "pending":
                    make_submission(internship)
                elif submissions == "rejected":
                    make_submission(
                        internship,
                        status=SubmissionStatus.REJECTED,
                        reviewed_by=self.supervisor,
                        reason="Redo.",
                    )

                response = self._post(self.supervisor_token, internship=internship)

                self.assertEqual(response.status_code, 409)
                self.assertEqual(
                    response.json()["code"], "approved_submission_required"
                )

    def test_only_the_assigned_supervisor_can_grade(self):
        for token in (self.student_token, self.company_token, self.admin_token):
            with self.subTest(token=token):
                response = self._post(token)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "permission_denied")

    def test_unassigned_supervisor_gets_404(self):
        response = self._post(make_token(new_id(), Role.SUPERVISOR))

        self.assertEqual(response.status_code, 404)

    def test_only_one_evaluation_is_possible(self):
        self.assertEqual(self._post(self.supervisor_token).status_code, 201)

        response = self._post(self.supervisor_token, grade="12.00")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "evaluation_already_exists")

    def test_internship_must_be_in_progress(self):
        for status in (
            InternshipStatus.CONFIRMED,
            InternshipStatus.COMPLETED,
            InternshipStatus.CANCELLED,
        ):
            with self.subTest(status=status):
                internship = make_internship(
                    start=PAST, status=status, supervisor=self.supervisor
                )
                make_submission(
                    internship,
                    status=SubmissionStatus.APPROVED,
                    reviewed_by=self.supervisor,
                    reason="Approved.",
                )

                response = self._post(self.supervisor_token, internship=internship)

                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["code"], "invalid_internship_state")

    def test_get_is_hidden_until_an_evaluation_exists(self):
        response = self._get(self.student_token)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "not_found")

    def test_evaluation_is_visible_to_involved_roles(self):
        make_evaluation(self.internship, supervisor=self.supervisor, grade="16.00")

        for token in (
            self.student_token,
            self.company_token,
            self.supervisor_token,
            self.admin_token,
        ):
            with self.subTest(token=token):
                response = self._get(token)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["grade"], "16.00")

    def test_evaluation_is_hidden_from_unrelated_users(self):
        make_evaluation(self.internship, supervisor=self.supervisor)

        for token in (
            make_token(new_id(), Role.STUDENT),
            make_token(new_id(), Role.COMPANY),
            make_token(new_id(), Role.SUPERVISOR),
            make_token(new_id(), Role.PLATFORM_ADMIN),
        ):
            with self.subTest(token=token):
                response = self._get(token)
                self.assertEqual(response.status_code, 404)

    @patch(NOTIFY)
    def test_student_is_notified_once_after_commit(self, notify):
        with self.captureOnCommitCallbacks(execute=True):
            response = self._post(self.supervisor_token)

        self.assertEqual(response.status_code, 201)
        notify.assert_called_once()
        call = notify.call_args.kwargs
        self.assertEqual(call["recipient_user_id"], self.student)
        self.assertEqual(call["notification_type"], "evaluation_published")
        self.assertIn("evaluation_published", call["deduplication_key"])

    def test_completed_internship_cannot_be_completed_again(self):
        self.assertEqual(self._post(self.supervisor_token).status_code, 201)

        response = self.api.post(
            f"/api/internships/{self.internship.pk}/complete/",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "invalid_status_transition")
