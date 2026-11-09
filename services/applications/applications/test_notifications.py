import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

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


@override_settings(
    INTERNAL_SERVICE_TOKEN='test-service-token',
    UNIVERSITY_ADMIN_USER_IDS=[str(ADMIN_ID)],
)
class NotificationEmissionTests(TestCase):
    def setUp(self):
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
