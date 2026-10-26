import uuid
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Application, ApplicationStatus

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

        self.student = DummyUser(self.student_id, 'STUDENT')
        self.company = DummyUser(self.company_id, 'COMPANY')
        self.university = DummyUser(self.university_id, 'UNIVERSITY')

        self.app = Application.objects.create(
            offer_id=self.offer_id,
            company_id=self.company_id,
            student_user_id=self.student_id,
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
