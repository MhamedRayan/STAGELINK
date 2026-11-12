import uuid
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .identity_client import IdentityUnavailable
from .models import ApplicationStatus
from .notifications_client import build_deduplication_key
from .roles import Role
from .testing import (
    COMPANY_ID,
    STUDENT_ID,
    UNIVERSITY_ID,
    DummyUser,
    make_application,
    make_offer,
)

ADMIN_ID = uuid.uuid4()
DIRECTORY_ADMIN_ID = uuid.uuid4()


@override_settings(
    INTERNAL_SERVICE_TOKEN='test-service-token',
    UNIVERSITY_ADMIN_USER_IDS=[str(ADMIN_ID)],
    # Unit tests must never reach a real Identity instance. Existing tests use
    # the configured fallback; directory-specific tests patch the client.
    IDENTITY_BASE_URL='',
    IDENTITY_DIRECTORY_CACHE_SECONDS=0,
)
class NotificationEmissionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.company = DummyUser(COMPANY_ID, Role.COMPANY)
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.university = DummyUser(UNIVERSITY_ID, Role.UNIVERSITY_ADMIN)
        self.offer = make_offer(capacity=2)
        self.offer_id = uuid.UUID(self.offer['id'])
        self.application = make_application(offer_id=self.offer_id)

    def test_deduplication_key_is_stable(self):
        key = build_deduplication_key(self.application.id, 'confirmed', STUDENT_ID)
        self.assertEqual(
            key,
            f"application:{self.application.id}:confirmed:recipient:{STUDENT_ID}",
        )

    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    def test_company_acceptance_notifies_university_admins(self, mock_get_offer, mock_send):
        mock_get_offer.return_value = self.offer

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.company)
            self.client.post(
                reverse('company-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        mock_send.assert_called_once()
        payload = mock_send.call_args.args[0]
        self.assertEqual(payload['recipient_user_id'], str(ADMIN_ID))
        self.assertEqual(payload['type'], 'application_pending_validation')
        self.assertEqual(payload['related_object_id'], str(self.application.id))
        self.assertIn(':pending_validation:recipient:', payload['deduplication_key'])

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=[])
    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    @patch('applications.identity_client.list_university_admin_ids')
    def test_directory_admin_is_notified_without_env_fallback(
        self, mock_directory, mock_get_offer, mock_send
    ):
        mock_directory.return_value = [str(DIRECTORY_ADMIN_ID)]
        mock_get_offer.return_value = self.offer

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.company)
            self.client.post(
                reverse('company-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        mock_send.assert_called_once()
        payload = mock_send.call_args.args[0]
        self.assertEqual(payload['recipient_user_id'], str(DIRECTORY_ADMIN_ID))
        self.assertEqual(payload['type'], 'application_pending_validation')

    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    @patch(
        'applications.identity_client.list_university_admin_ids',
        side_effect=IdentityUnavailable('down'),
    )
    def test_identity_outage_falls_back_to_configured_admin(
        self, mock_directory, mock_get_offer, mock_send
    ):
        mock_get_offer.return_value = self.offer

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.company)
            response = self.client.post(
                reverse('company-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        mock_send.assert_called_once()
        self.assertEqual(
            mock_send.call_args.args[0]['recipient_user_id'], str(ADMIN_ID)
        )

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=[])
    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    @patch('applications.identity_client.list_university_admin_ids')
    def test_directory_and_recorded_admin_are_deduplicated(
        self, mock_directory, mock_get_offer, mock_send
    ):
        mock_directory.return_value = [str(DIRECTORY_ADMIN_ID)]
        mock_get_offer.return_value = self.offer
        self.application.university_user_id = DIRECTORY_ADMIN_ID
        self.application.save(update_fields=['university_user_id'])

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.company)
            self.client.post(
                reverse('company-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        mock_send.assert_called_once()
        self.assertEqual(
            mock_send.call_args.args[0]['recipient_user_id'],
            str(DIRECTORY_ADMIN_ID),
        )

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=[])
    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    @patch('applications.identity_client.list_university_admin_ids', return_value=[])
    def test_directory_lookup_runs_only_after_commit(
        self, mock_directory, mock_get_offer, mock_send
    ):
        mock_get_offer.return_value = self.offer

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            self.client.force_authenticate(user=self.company)
            response = self.client.post(
                reverse('company-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        mock_directory.assert_not_called()

        for callback in callbacks:
            callback()

        mock_directory.assert_called_once()
        mock_send.assert_not_called()

    @override_settings(UNIVERSITY_ADMIN_USER_IDS=[])
    @patch('applications.services.create_official_internship_record')
    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    @patch('applications.identity_client.list_university_admin_ids')
    def test_confirmation_notifies_directory_admin_without_env_fallback(
        self, mock_directory, mock_get_offer, mock_send, mock_create
    ):
        mock_directory.return_value = [str(DIRECTORY_ADMIN_ID)]
        mock_get_offer.return_value = self.offer
        mock_create.return_value = object()
        self.application.status = ApplicationStatus.UNIVERSITY_VALIDATED
        self.application.save(update_fields=['status'])

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.student)
            self.client.post(
                reverse('student-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        confirmed = sorted(
            call.args[0]['recipient_user_id']
            for call in mock_send.call_args_list
            if call.args[0]['type'] == 'application_confirmed'
        )
        self.assertEqual(
            confirmed, sorted([str(COMPANY_ID), str(DIRECTORY_ADMIN_ID)])
        )

    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    def test_university_validation_notifies_the_student(self, mock_get_offer, mock_send):
        mock_get_offer.return_value = self.offer
        self.application.status = ApplicationStatus.COMPANY_ACCEPTED
        self.application.save()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.university)
            self.client.post(
                reverse('university-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        mock_send.assert_called_once()
        payload = mock_send.call_args.args[0]
        self.assertEqual(payload['recipient_user_id'], str(STUDENT_ID))
        self.assertEqual(payload['type'], 'application_validated')

    @patch('applications.services.create_official_internship_record')
    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    def test_confirmation_notifies_company_and_university_once(
        self, mock_get_offer, mock_send, mock_create
    ):
        mock_get_offer.return_value = self.offer
        mock_create.return_value = object()
        self.application.status = ApplicationStatus.UNIVERSITY_VALIDATED
        self.application.save()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.student)
            self.client.post(
                reverse('student-decision', kwargs={'pk': self.application.id}),
                {'decision': 'ACCEPT'},
                format='json',
            )

        by_type = {}
        for call in mock_send.call_args_list:
            payload = call.args[0]
            by_type.setdefault(payload['type'], []).append(payload['recipient_user_id'])

        self.assertEqual(sorted(by_type['application_confirmed']), sorted([str(COMPANY_ID), str(ADMIN_ID)]))
        self.assertEqual(by_type['student_decision'], [str(COMPANY_ID)])

        # Replaying the same events with the same keys would be deduplicated by
        # Notifications; the producer key must not change between attempts.
        keys = [call.args[0]['deduplication_key'] for call in mock_send.call_args_list]
        self.assertEqual(len(keys), len(set(keys)))

    @patch('applications.notifications_client.send')
    @patch('applications.services.get_offer')
    def test_withdrawal_notifies_the_company(self, mock_get_offer, mock_send):
        mock_get_offer.return_value = self.offer

        with self.captureOnCommitCallbacks(execute=True):
            self.client.force_authenticate(user=self.student)
            self.client.post(
                reverse('application-withdraw', kwargs={'pk': self.application.id}),
                {'reason': 'changed plans'},
                format='json',
            )

        mock_send.assert_called_once()
        payload = mock_send.call_args.args[0]
        self.assertEqual(payload['recipient_user_id'], str(COMPANY_ID))
        self.assertEqual(payload['type'], 'application_withdrawn')

    @override_settings(NOTIFICATIONS_ENABLED=False)
    @patch('applications.notifications_client.requests.post')
    def test_disabled_notifications_skip_the_http_call(self, mock_post):
        from .notifications_client import send

        self.assertFalse(
            send(
                {
                    'recipient_user_id': str(STUDENT_ID),
                    'type': 'generic',
                    'title': 'x',
                    'message': 'y',
                    'related_object_type': 'application',
                    'related_object_id': str(self.application.id),
                    'deduplication_key': 'k',
                }
            )
        )
        mock_post.assert_not_called()
