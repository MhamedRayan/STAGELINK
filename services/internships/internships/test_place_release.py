from datetime import date, timedelta
from io import StringIO
from unittest.mock import patch

import requests
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from .applications_client import release_place
from .exceptions import ApplicationsUnavailable
from .models import InternshipAudit, InternshipAuditAction, InternshipStatus
from .roles import Role
from .services import (
    decide_cancellation,
    deliver_place_release,
    request_cancellation,
)
from .testing_utils import TEST_JWT_KEY, make_internship, new_id

PAST = date(2000, 1, 1)
RELEASE_PLACE = "internships.services.release_place"
NOTIFY = "internships.notifications_client.notify"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class PlaceReleaseTests(TestCase):
    def setUp(self):
        self.internship = make_internship(start=PAST)
        self.internship.status = InternshipStatus.CANCELLED
        self.internship.save(update_fields=["status"])

    @patch(RELEASE_PLACE)
    def test_successful_delivery_marks_the_place_released(self, release):
        delivered = deliver_place_release(self.internship.pk)

        self.assertTrue(delivered)
        release.assert_called_once_with(self.internship.source_application_id)
        self.internship.refresh_from_db()
        self.assertIsNotNone(self.internship.place_released_at)
        self.assertEqual(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.PLACE_RELEASED,
            ).count(),
            1,
        )

    @patch(RELEASE_PLACE)
    def test_an_already_released_place_is_not_released_again(self, release):
        self.internship.place_released_at = timezone.now()
        self.internship.save(update_fields=["place_released_at"])

        delivered = deliver_place_release(self.internship.pk)

        self.assertTrue(delivered)
        release.assert_not_called()
        self.assertFalse(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.PLACE_RELEASED,
            ).exists()
        )

    @patch(RELEASE_PLACE)
    def test_failed_delivery_leaves_the_marker_unset(self, release):
        release.side_effect = ApplicationsUnavailable()

        delivered = deliver_place_release(self.internship.pk)

        self.assertFalse(delivered)
        self.internship.refresh_from_db()
        self.assertIsNone(self.internship.place_released_at)
        self.assertFalse(
            InternshipAudit.objects.filter(
                internship=self.internship,
                action=InternshipAuditAction.PLACE_RELEASED,
            ).exists()
        )

    @patch(RELEASE_PLACE)
    def test_missing_internship_is_a_no_op(self, release):
        self.assertFalse(deliver_place_release(new_id()))
        release.assert_not_called()

    @patch(NOTIFY)
    @patch(RELEASE_PLACE)
    def test_approval_schedules_the_release_for_after_commit(self, release, notify):
        internship = make_internship(start=PAST)
        cancellation = request_cancellation(
            internship,
            requested_by_user_id=internship.student_user_id,
            requested_by_role=Role.STUDENT,
            reason="Found another placement.",
        )

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            decide_cancellation(
                internship,
                cancellation,
                approve=True,
                actor_user_id=new_id(),
                reason="Agreed.",
            )
            release.assert_not_called()

        for callback in callbacks:
            callback()

        release.assert_called_once_with(internship.source_application_id)
        internship.refresh_from_db()
        self.assertIsNotNone(internship.place_released_at)

    @patch(NOTIFY)
    @patch(RELEASE_PLACE)
    def test_rejection_does_not_schedule_a_release(self, release, notify):
        internship = make_internship(start=PAST)
        cancellation = request_cancellation(
            internship,
            requested_by_user_id=internship.student_user_id,
            requested_by_role=Role.STUDENT,
            reason="Found another placement.",
        )

        with self.captureOnCommitCallbacks(execute=True):
            decide_cancellation(
                internship,
                cancellation,
                approve=False,
                actor_user_id=new_id(),
                reason="Not this time.",
            )

        release.assert_not_called()
        internship.refresh_from_db()
        self.assertIsNone(internship.place_released_at)


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class ReleaseCommandTests(TestCase):
    def _cancelled(self):
        internship = make_internship(start=PAST)
        internship.status = InternshipStatus.CANCELLED
        internship.save(update_fields=["status"])
        return internship

    @patch(RELEASE_PLACE)
    def test_command_releases_pending_places_and_skips_done_ones(self, release):
        first = self._cancelled()
        second = self._cancelled()
        done = self._cancelled()
        done.place_released_at = timezone.now()
        done.save(update_fields=["place_released_at"])

        output = StringIO()
        call_command("release_cancelled_places", stdout=output)

        self.assertIn("2 released, 0 failed", output.getvalue())
        self.assertEqual(release.call_count, 2)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertIsNotNone(first.place_released_at)
        self.assertIsNotNone(second.place_released_at)

        # Running again has nothing left to do.
        call_command("release_cancelled_places", stdout=StringIO())
        self.assertEqual(release.call_count, 2)

    @patch(RELEASE_PLACE)
    def test_command_continues_after_a_failure(self, release):
        first = self._cancelled()
        second = self._cancelled()

        def release_or_fail(source_application_id):
            if source_application_id == first.source_application_id:
                raise ApplicationsUnavailable()

        release.side_effect = release_or_fail

        output = StringIO()
        call_command("release_cancelled_places", stdout=output)

        self.assertIn("1 released, 1 failed", output.getvalue())
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertIsNone(first.place_released_at)
        self.assertIsNotNone(second.place_released_at)

    @patch(RELEASE_PLACE)
    def test_limit_bounds_a_single_run(self, release):
        self._cancelled()
        self._cancelled()

        call_command("release_cancelled_places", "--limit", "1", stdout=StringIO())

        self.assertEqual(release.call_count, 1)


class ApplicationsClientTests(TestCase):
    @override_settings(
        APPLICATIONS_BASE_URL="http://applications:8000",
        INTERNAL_SERVICE_TOKEN="shared-token",
        APPLICATIONS_TIMEOUT_SECONDS=3.5,
    )
    @patch("internships.applications_client.requests.post")
    def test_client_posts_the_expected_request(self, post):
        application_id = new_id()
        post.return_value.status_code = 204

        release_place(application_id)

        args, kwargs = post.call_args
        self.assertEqual(
            args[0],
            f"http://applications:8000/api/internal/applications/{application_id}/release-place/",
        )
        self.assertEqual(kwargs["headers"]["X-Service-Token"], "shared-token")
        self.assertEqual(kwargs["timeout"], 3.5)

    @patch("internships.applications_client.requests.post")
    def test_client_accepts_200_as_success(self, post):
        post.return_value.status_code = 200

        release_place(new_id())

    @patch("internships.applications_client.requests.post")
    def test_client_raises_on_non_success(self, post):
        post.return_value.status_code = 409

        with self.assertRaises(ApplicationsUnavailable):
            release_place(new_id())

    @patch("internships.applications_client.requests.post")
    def test_client_raises_on_network_error(self, post):
        post.side_effect = requests.ConnectionError("down")

        with self.assertRaises(ApplicationsUnavailable):
            release_place(new_id())
