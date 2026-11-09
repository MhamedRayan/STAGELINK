import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    OfferReservation,
)
from .roles import Role
from .services import InternshipConflict, InternshipUnavailable
from .testing import (
    COMPANY_ID,
    OTHER_STUDENT_ID,
    STUDENT_ID,
    UNIVERSITY_ID,
    DummyUser,
    make_application,
    make_offer,
)


@override_settings(INTERNAL_SERVICE_TOKEN='test-service-token')
class WorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = DummyUser(COMPANY_ID, Role.COMPANY)
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.university = DummyUser(UNIVERSITY_ID, Role.UNIVERSITY_ADMIN)
        self.offer = make_offer(capacity=2)
        self.offer_id = uuid.UUID(self.offer['id'])
        self.application = make_application(offer_id=self.offer_id)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def company_accept(self, application=None):
        application = application or self.application
        self.auth(self.company)
        return self.client.post(
            reverse('company-decision', kwargs={'pk': application.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

    def university_accept(self, application=None):
        application = application or self.application
        self.auth(self.university)
        return self.client.post(
            reverse('university-decision', kwargs={'pk': application.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

    def student_accept(self, application=None):
        application = application or self.application
        self.auth(self.student)
        return self.client.post(
            reverse('student-decision', kwargs={'pk': application.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

    # --- company -----------------------------------------------------------

    @patch('applications.services.get_offer')
    def test_company_rejection_requires_reason(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.auth(self.company)
        url = reverse('company-decision', kwargs={'pk': self.application.id})

        missing = self.client.post(url, {'decision': 'REJECT'}, format='json')
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing.data['code'], 'VALIDATION_ERROR')

        rejected = self.client.post(
            url, {'decision': 'REJECT', 'reason': 'No position open'}, format='json'
        )
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.COMPANY_REJECTED)

    @patch('applications.services.get_offer')
    def test_company_acceptance_reserves_a_place(self, mock_get_offer):
        mock_get_offer.return_value = self.offer

        response = self.company_accept()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.COMPANY_ACCEPTED)
        reservation = OfferReservation.objects.get(offer_id=self.offer_id)
        self.assertEqual(reservation.reserved, 1)
        self.assertEqual(reservation.occupied, 0)

    @patch('applications.services.get_offer')
    def test_capacity_full_blocks_the_second_acceptance(self, mock_get_offer):
        mock_get_offer.return_value = make_offer(
            offer_id=self.offer_id, capacity=1
        )
        self.assertEqual(self.company_accept().status_code, status.HTTP_200_OK)

        second = make_application(
            offer_id=self.offer_id,
            student_user_id=OTHER_STUDENT_ID,
        )
        response = self.company_accept(second)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'CAPACITY_FULL')
        second.refresh_from_db()
        self.assertEqual(second.status, ApplicationStatus.SUBMITTED)

    @patch('applications.services.get_offer')
    def test_second_company_decision_is_a_conflict(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()

        response = self.company_accept()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'INVALID_STATE')

    @patch('applications.services.get_offer')
    def test_company_cannot_decide_on_another_companys_application(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.auth(DummyUser(uuid.uuid4(), Role.COMPANY))

        response = self.client.post(
            reverse('company-decision', kwargs={'pk': self.application.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['code'], 'NOT_FOUND')

    # --- university --------------------------------------------------------

    @patch('applications.services.get_offer')
    def test_university_acceptance_validates(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()

        response = self.university_accept()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.UNIVERSITY_VALIDATED)
        self.assertEqual(self.application.university_user_id, UNIVERSITY_ID)

    @patch('applications.services.get_offer')
    def test_university_rejection_releases_the_place(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()
        self.auth(self.university)

        response = self.client.post(
            reverse('university-decision', kwargs={'pk': self.application.id}),
            {'decision': 'REJECT', 'reason': 'Documents missing'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.UNIVERSITY_REJECTED)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).reserved, 0
        )

    def test_university_decision_before_company_is_a_conflict(self):
        response = self.university_accept()
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'INVALID_STATE')

    # --- student -----------------------------------------------------------

    @patch('applications.services.get_offer')
    def test_student_cannot_decide_before_validation(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()

        response = self.student_accept()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    @patch('applications.services.get_offer')
    def test_student_decline_releases_the_place(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()
        self.university_accept()

        self.auth(self.student)
        response = self.client.post(
            reverse('student-decision', kwargs={'pk': self.application.id}),
            {'decision': 'DECLINE'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.STUDENT_DECLINED)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).reserved, 0
        )

    @patch('applications.services.create_official_internship_record')
    @patch('applications.services.get_offer')
    def test_student_acceptance_confirms_and_occupies(
        self, mock_get_offer, mock_create_internship
    ):
        mock_get_offer.return_value = self.offer
        mock_create_internship.return_value = object()
        self.company_accept()
        self.university_accept()

        response = self.student_accept()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.CONFIRMED)
        reservation = OfferReservation.objects.get(offer_id=self.offer_id)
        self.assertEqual(reservation.occupied, 1)
        self.assertEqual(reservation.reserved, 0)
        mock_create_internship.assert_called_once()

    @patch('applications.services.create_official_internship_record')
    @patch('applications.services.get_offer')
    def test_confirmation_auto_withdraws_other_open_applications(
        self, mock_get_offer, mock_create_internship
    ):
        mock_get_offer.return_value = self.offer
        mock_create_internship.return_value = object()

        other_offer_id = uuid.uuid4()
        other = make_application(
            offer_id=other_offer_id,
            status=ApplicationStatus.UNIVERSITY_VALIDATED,
        )
        OfferReservation.objects.create(
            offer_id=other_offer_id, capacity=2, reserved=1
        )

        self.company_accept()
        self.university_accept()
        self.student_accept()

        other.refresh_from_db()
        self.assertEqual(other.status, ApplicationStatus.WITHDRAWN)
        self.assertIsNotNone(other.withdrawn_at)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=other_offer_id).reserved, 0
        )
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.CONFIRMED)

    @patch('applications.services.create_official_internship_record')
    @patch('applications.services.get_offer')
    def test_downstream_conflict_rolls_the_acceptance_back(
        self, mock_get_offer, mock_create_internship
    ):
        mock_get_offer.return_value = self.offer
        mock_create_internship.side_effect = InternshipConflict()
        self.company_accept()
        self.university_accept()

        response = self.student_accept()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'INTERNSHIP_CONFLICT')
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.UNIVERSITY_VALIDATED)
        self.assertIsNone(self.application.student_decision)

    @patch('applications.services.create_official_internship_record')
    @patch('applications.services.get_offer')
    def test_downstream_failure_leaves_a_retryable_state(
        self, mock_get_offer, mock_create_internship
    ):
        mock_get_offer.return_value = self.offer
        mock_create_internship.side_effect = InternshipUnavailable()
        self.company_accept()
        self.university_accept()

        response = self.student_accept()

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['code'], 'DOWNSTREAM_UNAVAILABLE')
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.STUDENT_ACCEPTED)

    @patch('applications.services.get_offer')
    def test_every_transition_is_recorded_in_history(self, mock_get_offer):
        mock_get_offer.return_value = self.offer
        self.company_accept()
        self.university_accept()

        self.auth(self.student)
        self.client.post(
            reverse('student-decision', kwargs={'pk': self.application.id}),
            {'decision': 'DECLINE'},
            format='json',
        )

        transitions = list(
            ApplicationStatusHistory.objects.filter(
                application=self.application
            ).values_list('from_status', 'to_status')
        )
        self.assertEqual(
            transitions,
            [
                ('SUBMITTED', 'COMPANY_ACCEPTED'),
                ('COMPANY_ACCEPTED', 'UNIVERSITY_VALIDATED'),
                ('UNIVERSITY_VALIDATED', 'STUDENT_DECLINED'),
            ],
        )
