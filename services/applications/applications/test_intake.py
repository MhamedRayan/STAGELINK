import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Application
from .offers_client import OfferNotFound, OffersUnavailable
from .roles import Role
from .testing import COMPANY_ID, STUDENT_ID, DummyUser, make_offer


class ApplicationIntakeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.client.force_authenticate(user=self.student)
        self.url = reverse('application-list-create')
        self.offer = make_offer(capacity=3)
        self.payload = {
            'offer_id': self.offer['id'],
            'start_date': '2027-02-01',
            'end_date': '2027-06-30',
        }

    @patch('applications.services.get_offer')
    def test_creates_application_and_derives_company_from_offer(self, mock_get_offer):
        mock_get_offer.return_value = self.offer

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['company_user_id'], str(COMPANY_ID))
        self.assertEqual(response.data['student_user_id'], str(STUDENT_ID))
        self.assertEqual(response.data['status'], 'SUBMITTED')
        mock_get_offer.assert_called_once()

    @patch('applications.services.get_offer')
    def test_body_company_id_is_ignored(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        payload = {**self.payload, 'company_user_id': str(uuid.uuid4())}

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['company_user_id'], str(COMPANY_ID))
        application = Application.objects.get(pk=response.data['id'])
        self.assertEqual(str(application.company_user_id), str(COMPANY_ID))

    @patch('applications.services.get_offer')
    def test_unknown_offer_returns_400_offer_not_found(self, mock_get_offer):
        mock_get_offer.side_effect = OfferNotFound()

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'OFFER_NOT_FOUND')
        self.assertEqual(response.data['details']['offer_id'], self.offer['id'])
        self.assertFalse(Application.objects.exists())

    @patch('applications.services.get_offer')
    def test_offers_unavailable_returns_503_retryable(self, mock_get_offer):
        mock_get_offer.side_effect = OffersUnavailable()

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['code'], 'OFFERS_UNAVAILABLE')
        self.assertFalse(Application.objects.exists())

    @patch('applications.services.get_offer')
    def test_draft_offer_is_rejected(self, mock_get_offer):
        mock_get_offer.return_value = make_offer(status='draft')

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'OFFER_UNAVAILABLE')
        self.assertFalse(Application.objects.exists())

    @patch('applications.services.get_offer')
    def test_closed_offer_is_rejected(self, mock_get_offer):
        mock_get_offer.return_value = make_offer(status='closed')

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'OFFER_UNAVAILABLE')

    @patch('applications.services.get_offer')
    def test_expired_deadline_is_rejected(self, mock_get_offer):
        mock_get_offer.return_value = make_offer(
            deadline=datetime.now(timezone.utc) - timedelta(days=1)
        )

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'OFFER_UNAVAILABLE')

    @patch('applications.services.get_offer')
    def test_duplicate_application_is_rejected(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.client.post(self.url, self.payload, format='json')

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'DUPLICATE_APPLICATION')
        self.assertEqual(Application.objects.count(), 1)

    @patch('applications.services.get_offer')
    def test_end_date_before_start_date_has_field_details(self, mock_get_offer):
        mock_get_offer.return_value = self.offer

        response = self.client.post(
            self.url, {**self.payload, 'end_date': '2027-01-01'}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'VALIDATION_ERROR')
        self.assertIn('end_date', response.data['details'])

    @patch('applications.services.get_offer')
    def test_missing_dates_are_rejected(self, mock_get_offer):
        mock_get_offer.return_value = self.offer

        response = self.client.post(
            self.url, {'offer_id': self.payload['offer_id']}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('start_date', response.data['details'])
        self.assertIn('end_date', response.data['details'])

    @patch('applications.services.get_offer')
    def test_non_student_cannot_create(self, mock_get_offer):
        self.client.force_authenticate(user=DummyUser(uuid.uuid4(), Role.COMPANY))

        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'PERMISSION_DENIED')
        mock_get_offer.assert_not_called()
