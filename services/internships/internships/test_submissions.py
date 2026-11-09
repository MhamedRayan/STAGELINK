from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import InternshipStatus, InternshipSubmission, SubmissionStatus
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


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class SubmissionApiTests(TemporaryMediaMixin, TestCase):
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
        self.student_token = make_token(self.student, Role.STUDENT)
        self.company_token = make_token(self.company, Role.COMPANY)
        self.supervisor_token = make_token(self.supervisor, Role.SUPERVISOR)
        self.admin_token = make_token(self.admin, Role.UNIVERSITY_ADMIN)

    def _url(self, suffix=""):
        return f"/api/internships/{self.internship.pk}/submissions/{suffix}"

    def _upload(self, token, *, name="report.pdf", content=b"%PDF-1.4 hello"):
        upload = SimpleUploadedFile(name, content, content_type="application/pdf")
        return self.api.post(
            self._url(),
            {"file": upload},
            format="multipart",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def _get(self, token, suffix=""):
        return self.api.get(self._url(suffix), HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_student_uploads_first_version(self):
        response = self._upload(self.student_token)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["original_filename"], "report.pdf")
        self.assertEqual(data["status"], SubmissionStatus.SUBMITTED)
        self.assertEqual(data["submitted_by_user_id"], str(self.student))
        self.assertEqual(data["size_bytes"], len(b"%PDF-1.4 hello"))
        self.assertNotIn("file", data)
        self.assertNotIn("path", data)

        submission = InternshipSubmission.objects.get(pk=data["id"])
        self.assertEqual(
            submission.file.name,
            f"submissions/{self.internship.pk}/v1/report.pdf",
        )
        stored = Path(settings.MEDIA_ROOT) / submission.file.name
        self.assertTrue(stored.exists())
        with stored.open("rb") as handle:
            self.assertEqual(handle.read(), b"%PDF-1.4 hello")

    def test_every_allowed_extension_is_accepted(self):
        for extension in settings.ALLOWED_SUBMISSION_EXTENSIONS:
            with self.subTest(extension=extension):
                internship = make_internship(
                    start=PAST, status=InternshipStatus.IN_PROGRESS
                )
                upload = SimpleUploadedFile(
                    f"report{extension}", b"content", content_type="application/octet-stream"
                )
                response = self.api.post(
                    f"/api/internships/{internship.pk}/submissions/",
                    {"file": upload},
                    format="multipart",
                    HTTP_AUTHORIZATION=f"Bearer {make_token(internship.student_user_id, Role.STUDENT)}",
                )
                self.assertEqual(response.status_code, 201, response.content)

    def test_unknown_extension_is_rejected(self):
        response = self._upload(self.student_token, name="malware.exe")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "validation_error")
        self.assertIn("file", response.json()["details"])
        self.assertFalse(InternshipSubmission.objects.exists())

    @override_settings(MAX_SUBMISSION_SIZE_BYTES=5)
    def test_oversized_file_is_rejected(self):
        response = self._upload(self.student_token, content=b"123456")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "validation_error")
        self.assertFalse(InternshipSubmission.objects.exists())

    def test_empty_file_is_rejected(self):
        response = self._upload(self.student_token, content=b"")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "validation_error")
        self.assertFalse(InternshipSubmission.objects.exists())

    def test_company_supervisor_and_admin_cannot_upload(self):
        for token in (
            self.company_token,
            self.supervisor_token,
            self.admin_token,
        ):
            with self.subTest(token=token):
                response = self._upload(token)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "permission_denied")

    def test_other_student_gets_404(self):
        response = self._upload(make_token(new_id(), Role.STUDENT))

        self.assertEqual(response.status_code, 404)

    def test_upload_requires_in_progress_status(self):
        for status in (
            InternshipStatus.CONFIRMED,
            InternshipStatus.COMPLETED,
            InternshipStatus.CANCELLED,
        ):
            with self.subTest(status=status):
                internship = make_internship(
                    start=PAST,
                    status=status,
                )
                upload = SimpleUploadedFile(
                    "report.pdf", b"content", content_type="application/pdf"
                )
                response = self.api.post(
                    f"/api/internships/{internship.pk}/submissions/",
                    {"file": upload},
                    format="multipart",
                    HTTP_AUTHORIZATION=f"Bearer {make_token(internship.student_user_id, Role.STUDENT)}",
                )
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["code"], "invalid_internship_state")

    def test_second_upload_while_pending_is_refused(self):
        self.assertEqual(self._upload(self.student_token).status_code, 201)

        response = self._upload(self.student_token, name="second.pdf")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "submission_already_pending")

    def test_upload_after_approval_is_refused(self):
        make_submission(
            self.internship,
            status=SubmissionStatus.APPROVED,
            reviewed_by=self.supervisor,
            reason="Good.",
        )

        response = self._upload(self.student_token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "submission_already_approved")

    def test_rejection_allows_a_new_version(self):
        make_submission(
            self.internship,
            status=SubmissionStatus.REJECTED,
            reviewed_by=self.supervisor,
            reason="Add the appendix.",
        )

        response = self._upload(self.student_token, name="report-v2.pdf")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["version"], 2)
        self.assertEqual(response.json()["status"], SubmissionStatus.SUBMITTED)

    def test_list_is_newest_first_and_visible_to_reader_roles(self):
        make_submission(
            self.internship,
            version=1,
            status=SubmissionStatus.REJECTED,
            reviewed_by=self.supervisor,
            reason="Redo.",
        )
        make_submission(self.internship, version=2)

        for token in (self.student_token, self.supervisor_token, self.admin_token):
            with self.subTest(token=token):
                response = self._get(token)
                self.assertEqual(response.status_code, 200)
                versions = [item["version"] for item in response.json()["results"]]
                self.assertEqual(versions, [2, 1])

    def test_company_and_other_student_cannot_list(self):
        make_submission(self.internship)

        for token in (
            self.company_token,
            make_token(new_id(), Role.STUDENT),
            make_token(new_id(), Role.PLATFORM_ADMIN),
        ):
            with self.subTest(token=token):
                response = self._get(token)
                self.assertEqual(response.status_code, 404)

    def test_authorised_roles_can_download_the_file(self):
        submission = make_submission(self.internship, content=b"report bytes")

        for token in (self.student_token, self.supervisor_token, self.admin_token):
            with self.subTest(token=token):
                response = self._get(token, f"{submission.pk}/download/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    b"".join(response.streaming_content), b"report bytes"
                )
                self.assertIn("report.pdf", response["Content-Disposition"])
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_company_and_other_student_cannot_download(self):
        submission = make_submission(self.internship)

        for token in (
            self.company_token,
            make_token(new_id(), Role.STUDENT),
            make_token(new_id(), Role.PLATFORM_ADMIN),
        ):
            with self.subTest(token=token):
                response = self._get(token, f"{submission.pk}/download/")
                self.assertEqual(response.status_code, 404)

    def test_download_rejects_a_submission_of_another_internship(self):
        other = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)
        foreign = make_submission(other)

        response = self._get(self.student_token, f"{foreign.pk}/download/")

        self.assertEqual(response.status_code, 404)
