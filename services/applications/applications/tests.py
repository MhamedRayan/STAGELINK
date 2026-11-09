import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import ApplicationStatus
from .roles import Role
from .services import (
    InternshipConflict,
    InternshipUnavailable,
    create_official_internship_record,
)
from .testing import DummyUser, make_application


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('application-list-create')

    def make_token(self, **overrides):
        now = datetime.now(timezone.utc)
        payload = {
            'user_id': str(uuid.uuid4()),
            'role': Role.STUDENT,
            'token_type': 'access',
            'iat': now,
            'exp': now + timedelta(minutes=15),
        }
        payload.update(overrides)
        return jwt.encode(payload, settings.JWT_SIGNING_KEY, algorithm='HS256')

    def test_lowercase_role_from_valid_token_is_accepted(self):
        token = self.make_token()
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_uppercase_role_is_rejected(self):
        token = self.make_token(role='STUDENT')
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_uuid_user_id_is_rejected(self):
        token = self.make_token(user_id=10)
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_is_rejected(self):
        token = self.make_token(token_type='refresh')
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(INTERNAL_SERVICE_TOKEN='test-service-token')
class InternshipServicePayloadTests(TestCase):
    def setUp(self):
        self.application = make_application()

    @patch('applications.services.requests.post')
    def test_posts_uuid_payload_with_service_token_header(self, mock_post):
        mock_post.return_value.status_code = 201

        create_official_internship_record(self.application)

        _, kwargs = mock_post.call_args
        self.assertEqual(
            kwargs['headers']['X-Service-Token'], settings.INTERNAL_SERVICE_TOKEN
        )
        self.assertEqual(
            kwargs['headers']['X-Idempotency-Key'], str(self.application.id)
        )
        self.assertEqual(
            kwargs['json'],
            {
                'source_application_id': str(self.application.id),
                'offer_id': str(self.application.offer_id),
                'student_user_id': str(self.application.student_user_id),
                'company_user_id': str(self.application.company_user_id),
                'start_date': '2027-02-01',
                'end_date': '2027-06-30',
            },
        )

    @patch('applications.services.requests.post')
    def test_missing_service_token_raises_unavailable(self, mock_post):
        with self.settings(INTERNAL_SERVICE_TOKEN=''):
            with self.assertRaises(InternshipUnavailable):
                create_official_internship_record(self.application)
        mock_post.assert_not_called()

    @patch('applications.services.requests.post')
    def test_downstream_409_raises_conflict(self, mock_post):
        mock_post.return_value.status_code = 409
        mock_post.return_value.text = 'active internship'

        with self.assertRaises(InternshipConflict):
            create_official_internship_record(self.application)

    @patch('applications.services.requests.post')
    def test_downstream_500_is_retried_then_raises_unavailable(self, mock_post):
        mock_post.return_value.status_code = 500
        mock_post.return_value.text = 'boom'

        with patch('applications.services.time.sleep'):
            with self.assertRaises(InternshipUnavailable):
                create_official_internship_record(self.application)

        self.assertEqual(
            mock_post.call_count, settings.INTERNSHIP_CREATION_ATTEMPTS
        )

    @patch('applications.services.requests.post')
    def test_repeated_idempotent_success_returns_response(self, mock_post):
        mock_post.return_value.status_code = 200
        response = create_official_internship_record(self.application)
        self.assertEqual(response.status_code, 200)
        mock_post.assert_called_once()

    def test_application_is_not_mutated(self):
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.SUBMITTED)
