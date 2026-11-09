import uuid

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import ApplicationStatus, OfferReservation
from .roles import Role
from .testing import (
    COMPANY_ID,
    OTHER_STUDENT_ID,
    STUDENT_ID,
    UNIVERSITY_ID,
    DummyUser,
    make_application,
)


class WithdrawalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.other_student = DummyUser(OTHER_STUDENT_ID, Role.STUDENT)
        self.company = DummyUser(COMPANY_ID, Role.COMPANY)
        self.university = DummyUser(UNIVERSITY_ID, Role.UNIVERSITY_ADMIN)
        self.application = make_application()
        self.url = reverse('application-withdraw', kwargs={'pk': self.application.id})

    def withdraw(self, *, user=None, reason=None):
        self.client.force_authenticate(user=user or self.student)
        payload = {} if reason is None else {'reason': reason}
        return self.client.post(self.url, payload, format='json')

    def test_owner_can_withdraw_a_submitted_application(self):
        response = self.withdraw(reason='Found another placement')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.WITHDRAWN)
        self.assertEqual(self.application.withdrawal_reason, 'Found another placement')
        self.assertIsNotNone(self.application.withdrawn_at)

    def test_withdrawal_reason_is_optional(self):
        response = self.withdraw()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.application.refresh_from_db()
        self.assertEqual(self.application.withdrawal_reason, '')

    def test_withdrawal_from_company_accepted_releases_the_place(self):
        self.application.status = ApplicationStatus.COMPANY_ACCEPTED
        self.application.save()
        OfferReservation.objects.create(
            offer_id=self.application.offer_id, capacity=2, reserved=1
        )

        response = self.withdraw()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.application.offer_id).reserved,
            0,
        )

    def test_withdrawal_from_university_validated_releases_the_place(self):
        self.application.status = ApplicationStatus.UNIVERSITY_VALIDATED
        self.application.save()
        OfferReservation.objects.create(
            offer_id=self.application.offer_id, capacity=2, reserved=1
        )

        response = self.withdraw()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.application.offer_id).reserved,
            0,
        )

    def test_withdrawal_from_a_terminal_state_is_a_conflict(self):
        for terminal in (
            ApplicationStatus.COMPANY_REJECTED,
            ApplicationStatus.UNIVERSITY_REJECTED,
            ApplicationStatus.STUDENT_DECLINED,
            ApplicationStatus.CONFIRMED,
        ):
            with self.subTest(status=terminal):
                self.application.status = terminal
                self.application.save()

                response = self.withdraw()

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertEqual(response.data['code'], 'INVALID_STATE')

    def test_second_withdrawal_is_a_conflict(self):
        self.withdraw()
        response = self.withdraw()
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_another_student_gets_not_found(self):
        response = self.withdraw(user=self.other_student)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.SUBMITTED)

    def test_company_cannot_withdraw(self):
        response = self.withdraw(user=self.company)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_university_cannot_withdraw(self):
        response = self.withdraw(user=self.university)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_history_records_the_withdrawal(self):
        self.withdraw(reason='Personal reasons')

        history = self.application.history.order_by('created_at')
        last = history.last()
        self.assertEqual(last.to_status, ApplicationStatus.WITHDRAWN)
        self.assertEqual(last.actor_user_id, STUDENT_ID)
        self.assertEqual(last.actor_role, 'student')
        self.assertEqual(last.reason, 'Personal reasons')
