import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Application, ApplicationStatus
from .roles import Role


class DummyUser:
    def __init__(self, user_id, role):
        self.id = user_id
        self.role = role
        self.is_authenticated = True


class ApplicationWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_id = uuid.uuid4()
        self.company_id = uuid.uuid4()
        self.university_id = uuid.uuid4()
        self.offer_id = uuid.uuid4()

        self.student = DummyUser(self.student_id, Role.STUDENT)
        self.company = DummyUser(self.company_id, Role.COMPANY)
        self.university = DummyUser(self.university_id, Role.UNIVERSITY_ADMIN)

        self.app = Application.objects.create(
            offer_id=self.offer_id,
            company_user_id=self.company_id,
            student_user_id=self.student_id,
            start_date=date(2027, 2, 1),
            end_date=date(2027, 6, 30),
            status=ApplicationStatus.SUBMITTED
        )

    def test_company_rejection_requires_reason(self):
        self.client.force_authenticate(user=self.company)
        url = reverse('company-decision', kwargs={'pk': self.app.id})

        # Missing reason
        res = self.client.post(url, {'decision': 'REJECT'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # With reason
        res = self.client.post(url, {'decision': 'REJECT', 'reason': 'No position open'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.app.refresh_from_db()
        self.assertEqual(self.app.status, ApplicationStatus.COMPANY_REJECTED)

    def test_invalid_state_transition(self):
        # Student cannot accept before company and university approval
        self.client.force_authenticate(user=self.student)
        url = reverse('student-decision', kwargs={'pk': self.app.id})
        res = self.client.post(url, {'decision': 'ACCEPT'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('applications.views.create_official_internship_record')
    def test_full_successful_workflow(self, mock_create_internship):
        mock_create_internship.return_value = True

        # 1. Company Accepts
        self.client.force_authenticate(user=self.company)
        self.client.post(reverse('company-decision', kwargs={'pk': self.app.id}), {'decision': 'ACCEPT'}, format='json')

        # 2. University Validates
        self.client.force_authenticate(user=self.university)
        self.client.post(reverse('university-decision', kwargs={'pk': self.app.id}), {'decision': 'ACCEPT'}, format='json')

        # 3. Student Accepts
        self.client.force_authenticate(user=self.student)
        res = self.client.post(reverse('student-decision', kwargs={'pk': self.app.id}), {'decision': 'ACCEPT'}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.app.refresh_from_db()
        self.assertEqual(self.app.status, ApplicationStatus.CONFIRMED)
        mock_create_internship.assert_called_once()

    def test_company_can_only_decide_on_its_own_applications(self):
        other_company = DummyUser(uuid.uuid4(), Role.COMPANY)
        self.client.force_authenticate(user=other_company)

        response = self.client.post(
            reverse('company-decision', kwargs={'pk': self.app.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ApplicationCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_id = uuid.uuid4()
        self.student = DummyUser(self.student_id, Role.STUDENT)
        self.payload = {
            'offer_id': str(uuid.uuid4()),
            'company_user_id': str(uuid.uuid4()),
            'start_date': '2027-02-01',
            'end_date': '2027-06-30',
        }

    def test_student_creates_application_with_period(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.post(
            reverse('application-list-create'), self.payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['student_user_id'], str(self.student_id))
        self.assertEqual(response.data['company_user_id'], self.payload['company_user_id'])
        self.assertEqual(response.data['start_date'], self.payload['start_date'])
        self.assertEqual(response.data['end_date'], self.payload['end_date'])

        application = Application.objects.get(pk=response.data['id'])
        self.assertEqual(application.student_user_id, self.student_id)
        self.assertEqual(application.company_user_id, uuid.UUID(self.payload['company_user_id']))

    def test_missing_dates_are_rejected(self):
        self.client.force_authenticate(user=self.student)
        payload = {
            key: value
            for key, value in self.payload.items()
            if key not in ('start_date', 'end_date')
        }

        response = self.client.post(
            reverse('application-list-create'), payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('start_date', response.data)
        self.assertIn('end_date', response.data)

    def test_end_date_before_start_date_is_rejected(self):
        self.client.force_authenticate(user=self.student)
        payload = {**self.payload, 'end_date': '2027-01-01'}

        response = self.client.post(
            reverse('application-list-create'), payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', response.data)

    def test_non_student_cannot_create_application(self):
        self.client.force_authenticate(user=DummyUser(uuid.uuid4(), Role.COMPANY))

        response = self.client.post(
            reverse('application-list-create'), self.payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class InternshipServicePayloadTests(TestCase):
    def setUp(self):
        self.application = Application.objects.create(
            offer_id=uuid.uuid4(),
            company_user_id=uuid.uuid4(),
            student_user_id=uuid.uuid4(),
            start_date=date(2027, 2, 1),
            end_date=date(2027, 6, 30),
        )

    @patch('applications.services.requests.post')
    def test_posts_uuid_payload_with_service_token_header(self, mock_post):
        from .services import create_official_internship_record

        mock_post.return_value.status_code = 201

        result = create_official_internship_record(self.application)

        self.assertTrue(result)
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
    def test_missing_service_token_skips_the_call(self, mock_post):
        from .services import create_official_internship_record

        with self.settings(INTERNAL_SERVICE_TOKEN=''):
            result = create_official_internship_record(self.application)

        self.assertFalse(result)
        mock_post.assert_not_called()

    @patch('applications.services.requests.post')
    def test_downstream_error_returns_false(self, mock_post):
        from .services import create_official_internship_record

        mock_post.return_value.status_code = 500

        self.assertFalse(create_official_internship_record(self.application))


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
