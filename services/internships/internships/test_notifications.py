from datetime import date, timedelta
from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.db import transaction
from django.test import TestCase, override_settings

from .models import InternshipStatus, SubmissionStatus
from .notifications_client import notify
from .exceptions import IdentityUnavailable
from .roles import Role
from .services import (
    assign_supervisor,
    create_evaluation,
    create_internship,
    decide_cancellation,
    request_cancellation,
    review_submission,
)
from .testing_utils import (
    TEST_JWT_KEY,
    TemporaryMediaMixin,
    identity_user,
    make_internship,
    make_submission,
    new_id,
)

PAST = date(2000, 1, 1)
NOTIFY = "internships.notifications_client.notify"
FETCH_IDENTITY = "internships.services.fetch_identity_user"
RELEASE_PLACE = "internships.services.release_place"
DIRECTORY = "internships.notifications.identity_client.list_university_admin_ids"


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class NotificationEventTests(TemporaryMediaMixin, TestCase):
    def _create(self, **overrides):
        data = {
            "source_application_id": new_id(),
            "student_user_id": new_id(),
            "company_user_id": new_id(),
            "offer_id": new_id(),
            "start_date": PAST,
            "end_date": PAST + timedelta(days=120),
        }
        data.update(overrides)
        return create_internship(**data)

    def _recipients(self, notify_mock):
        return [call.kwargs["recipient_user_id"] for call in notify_mock.call_args_list]

    @patch(NOTIFY)
    def test_creation_notifies_student_and_company(self, notify_mock):
        with self.captureOnCommitCallbacks(execute=True):
            internship, created = self._create()

        self.assertTrue(created)
        self.assertEqual(
            self._recipients(notify_mock),
            [internship.student_user_id, internship.company_user_id],
        )
        for call in notify_mock.call_args_list:
            self.assertEqual(call.kwargs["notification_type"], "internship_created")
            self.assertEqual(call.kwargs["related_object_id"], internship.pk)
            self.assertIn(str(internship.pk), call.kwargs["deduplication_key"])
        keys = [call.kwargs["deduplication_key"] for call in notify_mock.call_args_list]
        self.assertEqual(len(keys), len(set(keys)))

    @patch(NOTIFY)
    def test_idempotent_retry_does_not_notify_again(self, notify_mock):
        source_application_id = new_id()
        with self.captureOnCommitCallbacks(execute=True):
            self._create(source_application_id=source_application_id)
        notify_mock.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            _, created = self._create(source_application_id=source_application_id)

        self.assertFalse(created)
        notify_mock.assert_not_called()

    @patch(FETCH_IDENTITY)
    @patch(NOTIFY)
    def test_supervisor_assignment_notifies_student_and_supervisor(
        self, notify_mock, fetch_identity
    ):
        internship = make_internship(start=PAST)
        supervisor = new_id()
        fetch_identity.return_value = identity_user(supervisor)

        with self.captureOnCommitCallbacks(execute=True):
            assign_supervisor(
                internship,
                supervisor_user_id=supervisor,
                actor_user_id=new_id(),
            )

        self.assertEqual(
            self._recipients(notify_mock),
            [internship.student_user_id, supervisor],
        )
        for call in notify_mock.call_args_list:
            self.assertEqual(call.kwargs["notification_type"], "supervisor_assigned")
            self.assertIn(
                f"supervisor_assigned:{supervisor}", call.kwargs["deduplication_key"]
            )

    @patch(FETCH_IDENTITY)
    @patch(NOTIFY)
    def test_reassignment_uses_the_new_supervisor_in_the_key(
        self, notify_mock, fetch_identity
    ):
        internship = make_internship(start=PAST)
        first, second = new_id(), new_id()
        fetch_identity.side_effect = lambda user_id: identity_user(user_id)

        assign_supervisor(
            internship, supervisor_user_id=first, actor_user_id=new_id()
        )
        notify_mock.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            assign_supervisor(
                internship,
                supervisor_user_id=second,
                actor_user_id=new_id(),
                reason="First supervisor left.",
            )

        for call in notify_mock.call_args_list:
            self.assertIn(
                f"supervisor_assigned:{second}", call.kwargs["deduplication_key"]
            )

    @patch(DIRECTORY, return_value=[])
    @patch(NOTIFY)
    def test_cancellation_request_notifies_company_and_directory_admins(
        self, notify_mock, directory
    ):
        internship = make_internship(start=PAST)
        admin = new_id()
        directory.return_value = [str(admin)]

        with self.captureOnCommitCallbacks(execute=True):
            cancellation = request_cancellation(
                internship,
                requested_by_user_id=internship.student_user_id,
                requested_by_role=Role.STUDENT,
                reason="Found another placement.",
            )

        self.assertEqual(
            self._recipients(notify_mock),
            [internship.company_user_id, admin],
        )
        directory.assert_called_once()
        for call in notify_mock.call_args_list:
            self.assertEqual(call.kwargs["notification_type"], "cancellation_requested")
            self.assertIn(
                f"cancellation_requested:{cancellation.pk}",
                call.kwargs["deduplication_key"],
            )

    @patch(DIRECTORY, return_value=[])
    @patch(NOTIFY)
    def test_cancellation_recipients_are_resolved_after_commit(
        self, notify_mock, directory
    ):
        internship = make_internship(start=PAST)

        with self.captureOnCommitCallbacks(execute=False):
            request_cancellation(
                internship,
                requested_by_user_id=internship.student_user_id,
                requested_by_role=Role.STUDENT,
                reason="Found another placement.",
            )

        # Both recipients are queued, but the directory lookup must not run
        # inside the business transaction.
        directory.assert_not_called()
        notify_mock.assert_not_called()

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=[])
    @patch(DIRECTORY, side_effect=IdentityUnavailable())
    @patch(NOTIFY)
    def test_cancellation_falls_back_to_configured_admins_on_outage(
        self, notify_mock, directory
    ):
        internship = make_internship(start=PAST)
        admin = new_id()
        with override_settings(UNIVERSITY_ADMIN_USER_IDS=[str(admin)]):
            with self.captureOnCommitCallbacks(execute=True):
                cancellation = request_cancellation(
                    internship,
                    requested_by_user_id=internship.student_user_id,
                    requested_by_role=Role.STUDENT,
                    reason="Found another placement.",
                )

        self.assertEqual(
            self._recipients(notify_mock),
            [internship.company_user_id, admin],
        )
        for call in notify_mock.call_args_list:
            self.assertEqual(call.kwargs["notification_type"], "cancellation_requested")
            self.assertIn(
                f"cancellation_requested:{cancellation.pk}",
                call.kwargs["deduplication_key"],
            )

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=["not-a-uuid"])
    @patch(DIRECTORY, side_effect=IdentityUnavailable())
    @patch(NOTIFY)
    def test_invalid_configured_admin_ids_are_ignored(self, notify_mock, directory):
        internship = make_internship(start=PAST)

        with self.captureOnCommitCallbacks(execute=True):
            request_cancellation(
                internship,
                requested_by_user_id=internship.student_user_id,
                requested_by_role=Role.STUDENT,
                reason="Found another placement.",
            )

        self.assertEqual(
            self._recipients(notify_mock),
            [internship.company_user_id],
        )

    @patch(RELEASE_PLACE)
    @patch(NOTIFY)
    def test_approved_cancellation_notifies_requester_and_other_participant(
        self, notify_mock, release_place
    ):
        internship = make_internship(start=PAST)
        cancellation = request_cancellation(
            internship,
            requested_by_user_id=internship.student_user_id,
            requested_by_role=Role.STUDENT,
            reason="Found another placement.",
        )
        notify_mock.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            decide_cancellation(
                internship,
                cancellation,
                approve=True,
                actor_user_id=new_id(),
                reason="Agreed.",
            )

        self.assertEqual(
            set(self._recipients(notify_mock)),
            {internship.student_user_id, internship.company_user_id},
        )
        for call in notify_mock.call_args_list:
            self.assertEqual(call.kwargs["notification_type"], "cancellation_decided")
            self.assertIn(
                f"cancellation_approved:{cancellation.pk}",
                call.kwargs["deduplication_key"],
            )
        release_place.assert_called_once_with(internship.source_application_id)

    @patch(RELEASE_PLACE)
    @patch(NOTIFY)
    def test_rejected_cancellation_uses_the_rejected_key(
        self, notify_mock, release_place
    ):
        internship = make_internship(start=PAST)
        cancellation = request_cancellation(
            internship,
            requested_by_user_id=internship.company_user_id,
            requested_by_role=Role.COMPANY,
            reason="Budget cut.",
        )
        notify_mock.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            decide_cancellation(
                internship,
                cancellation,
                approve=False,
                actor_user_id=new_id(),
                reason="Not this time.",
            )

        for call in notify_mock.call_args_list:
            self.assertIn(
                f"cancellation_rejected:{cancellation.pk}",
                call.kwargs["deduplication_key"],
            )
        release_place.assert_not_called()

    @patch(NOTIFY)
    def test_submission_review_notifies_the_student(self, notify_mock):
        internship = make_internship(
            start=PAST, status=InternshipStatus.IN_PROGRESS, supervisor=new_id()
        )
        submission = make_submission(internship)

        with self.captureOnCommitCallbacks(execute=True):
            review_submission(
                internship,
                submission,
                approve=False,
                actor_user_id=internship.supervisor_user_id,
                reason="Add the appendix.",
            )

        notify_mock.assert_called_once()
        call = notify_mock.call_args.kwargs
        self.assertEqual(call["recipient_user_id"], internship.student_user_id)
        self.assertIn(
            f"submission_reviewed:{submission.pk}:rejected",
            call["deduplication_key"],
        )

    @patch(NOTIFY)
    def test_evaluation_notifies_the_student(self, notify_mock):
        internship = make_internship(
            start=PAST, status=InternshipStatus.IN_PROGRESS, supervisor=new_id()
        )
        make_submission(
            internship,
            status=SubmissionStatus.APPROVED,
            reviewed_by=internship.supervisor_user_id,
            reason="Approved.",
        )

        with self.captureOnCommitCallbacks(execute=True):
            evaluation = create_evaluation(
                internship,
                supervisor_user_id=internship.supervisor_user_id,
                grade="14.00",
            )

        notify_mock.assert_called_once()
        call = notify_mock.call_args.kwargs
        self.assertEqual(call["recipient_user_id"], internship.student_user_id)
        self.assertIn(
            f"evaluation_published:{evaluation.pk}", call["deduplication_key"]
        )

    @patch(NOTIFY)
    def test_callbacks_do_not_run_before_commit(self, notify_mock):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            self._create()
            notify_mock.assert_not_called()

        self.assertEqual(len(callbacks), 2)
        for callback in callbacks:
            callback()

        self.assertEqual(notify_mock.call_count, 2)

    @patch(NOTIFY)
    def test_no_notification_when_the_transaction_rolls_back(self, notify_mock):
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    self._create()
                    raise RuntimeError("boom")

        notify_mock.assert_not_called()

    @patch("internships.notifications_client.requests.post")
    def test_delivery_failure_does_not_break_the_business_action(self, post):
        post.side_effect = requests.ConnectionError("notifications down")

        with self.captureOnCommitCallbacks(execute=True):
            internship, created = self._create()

        self.assertTrue(created)
        self.assertTrue(
            internship.__class__.objects.filter(pk=internship.pk).exists()
        )


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class NotificationClientTests(TestCase):
    def test_notify_posts_the_expected_payload(self):
        response = Mock(status_code=201)
        with patch(
            "internships.notifications_client.requests.post", return_value=response
        ) as post:
            sent = notify(
                recipient_user_id=new_id(),
                notification_type="internship_created",
                title="Title",
                message="Message",
                related_object_id=new_id(),
                deduplication_key="key-1",
            )

        self.assertTrue(sent)
        response.raise_for_status.assert_called_once()
        _, kwargs = post.call_args
        self.assertEqual(
            kwargs["headers"]["X-Service-Token"], settings.INTERNAL_SERVICE_TOKEN
        )
        self.assertEqual(kwargs["json"]["type"], "internship_created")
        self.assertEqual(kwargs["json"]["related_object_type"], "internship")
        self.assertEqual(kwargs["json"]["deduplication_key"], "key-1")

    def test_http_failure_returns_false(self):
        with patch(
            "internships.notifications_client.requests.post",
            side_effect=requests.Timeout("slow"),
        ):
            sent = notify(
                recipient_user_id=new_id(),
                notification_type="internship_created",
                title="Title",
                message="Message",
                related_object_id=new_id(),
                deduplication_key="key-1",
            )

        self.assertFalse(sent)

    @override_settings(NOTIFICATIONS_ENABLED=False)
    def test_disabled_notifications_do_not_call_the_service(self):
        with patch("internships.notifications_client.requests.post") as post:
            sent = notify(
                recipient_user_id=new_id(),
                notification_type="internship_created",
                title="Title",
                message="Message",
                related_object_id=new_id(),
                deduplication_key="key-1",
            )

        self.assertFalse(sent)
        post.assert_not_called()
