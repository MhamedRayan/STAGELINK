from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
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
    make_internship,
    make_submission,
    make_token,
    new_id,
)

PAST = date(2000, 1, 1)
NOTIFY = "internships.notifications_client.notify"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class SubmissionReviewApiTests(TemporaryMediaMixin, TestCase):
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
        self.submission = make_submission(self.internship)
        self.student_token = make_token(self.student, Role.STUDENT)
        self.company_token = make_token(self.company, Role.COMPANY)
        self.supervisor_token = make_token(self.supervisor, Role.SUPERVISOR)
        self.admin_token = make_token(self.admin, Role.UNIVERSITY_ADMIN)

    def _url(self, submission=None, action="approve"):
        submission = submission or self.submission
        return (
            f"/api/internships/{self.internship.pk}/submissions/"
            f"{submission.pk}/{action}/"
        )

    def _review(self, token, *, action="approve", reason="Looks good.", submission=None):
        return self.api.post(
            self._url(submission, action),
            {"reason": reason} if reason is not None else {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_assigned_supervisor_approves_with_reason(self):
        response = self._review(self.supervisor_token, reason="Well written.")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], SubmissionStatus.APPROVED)
        self.assertEqual(data["reviewed_by_user_id"], str(self.supervisor))
        self.assertEqual(data["review_reason"], "Well written.")
        self.assertIsNotNone(data["reviewed_at"])

        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, SubmissionStatus.APPROVED)
        self.assertEqual(self.submission.reviewed_by_user_id, self.supervisor)
        self.assertEqual(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.SUBMISSION_APPROVED,
            ).count(),
            1,
        )

    def test_assigned_supervisor_rejects_with_reason(self):
        response = self._review(
            self.supervisor_token, action="reject", reason="Missing appendix."
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], SubmissionStatus.REJECTED)

        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, SubmissionStatus.REJECTED)
        self.assertEqual(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.SUBMISSION_REJECTED,
            ).count(),
            1,
        )

    def test_rejection_allows_a_new_upload(self):
        self._review(self.supervisor_token, action="reject", reason="Redo.")

        upload = SimpleUploadedFile(
            "report-v2.pdf", b"%PDF-1.4 v2", content_type="application/pdf"
        )
        response = self.api.post(
            f"/api/internships/{self.internship.pk}/submissions/",
            {"file": upload},
            format="multipart",
            HTTP_AUTHORIZATION=f"Bearer {self.student_token}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["version"], 2)

    def test_reason_is_required_for_every_decision(self):
        missing = self._review(self.supervisor_token, reason=None)

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.json()["code"], "validation_error")

        empty = self._review(self.supervisor_token, action="reject", reason="   ")

        self.assertEqual(empty.status_code, 400)
        self.assertEqual(empty.json()["code"], "reason_required")

    def test_only_the_supervisor_role_may_review(self):
        for token in (self.student_token, self.company_token, self.admin_token):
            with self.subTest(token=token):
                response = self._review(token)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "permission_denied")

    def test_unassigned_supervisor_gets_404(self):
        response = self._review(make_token(new_id(), Role.SUPERVISOR))

        self.assertEqual(response.status_code, 404)

    def test_a_version_can_only_be_reviewed_once(self):
        self.assertEqual(self._review(self.supervisor_token).status_code, 200)

        response = self._review(self.supervisor_token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "submission_not_pending")

    def test_an_old_rejected_version_cannot_be_reviewed_after_resubmission(self):
        self._review(self.supervisor_token, action="reject", reason="Redo.")
        new_version = make_submission(self.internship, version=2)

        response = self._review(self.supervisor_token, submission=self.submission)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "submission_not_pending")
        self.assertEqual(new_version.status, SubmissionStatus.SUBMITTED)

    def test_cancelled_internship_cannot_be_reviewed(self):
        self.internship.status = InternshipStatus.CANCELLED
        self.internship.save(update_fields=["status"])

        response = self._review(self.supervisor_token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "invalid_internship_state")

    def test_submission_of_another_internship_gets_404(self):
        other = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)
        foreign = make_submission(other)

        response = self._review(self.supervisor_token, submission=foreign)

        self.assertEqual(response.status_code, 404)

    @patch(NOTIFY)
    def test_student_is_notified_once_after_commit(self, notify):
        with self.captureOnCommitCallbacks(execute=True):
            response = self._review(self.supervisor_token, reason="Great work.")

        self.assertEqual(response.status_code, 200)
        notify.assert_called_once()
        call = notify.call_args.kwargs
        self.assertEqual(call["recipient_user_id"], self.student)
        self.assertEqual(call["notification_type"], "submission_reviewed")
        self.assertIn(
            f"submission_reviewed:{self.submission.pk}:approved", call["deduplication_key"]
        )
