import io
import uuid
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from .models import ApplicationStatus, OfferReservation
from .services import InternshipConflict, InternshipUnavailable
from .testing import make_application


@override_settings(INTERNAL_SERVICE_TOKEN='test-service-token')
class ReconciliationCommandTests(TestCase):
    def setUp(self):
        self.application = make_application(status=ApplicationStatus.STUDENT_ACCEPTED)
        OfferReservation.objects.create(
            offer_id=self.application.offer_id, capacity=2, reserved=1
        )

    def run_command(self):
        out = io.StringIO()
        call_command('reconcile_confirmed_applications', stdout=out)
        return out.getvalue()

    @patch('applications.services.create_official_internship_record')
    def test_confirms_a_stuck_application(self, mock_create):
        mock_create.return_value = object()

        self.run_command()

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.CONFIRMED)
        reservation = OfferReservation.objects.get(offer_id=self.application.offer_id)
        self.assertEqual(reservation.occupied, 1)
        self.assertEqual(reservation.reserved, 0)

    @patch('applications.services.create_official_internship_record')
    def test_transient_failure_leaves_the_application_retryable(self, mock_create):
        mock_create.side_effect = InternshipUnavailable()

        self.run_command()

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.STUDENT_ACCEPTED)

    @patch('applications.services.create_official_internship_record')
    def test_permanent_conflict_reverts_the_acceptance(self, mock_create):
        mock_create.side_effect = InternshipConflict()

        self.run_command()

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.UNIVERSITY_VALIDATED)
        self.assertIsNone(self.application.student_decision)

    @patch('applications.services.create_official_internship_record')
    def test_command_is_idempotent(self, mock_create):
        mock_create.return_value = object()

        self.run_command()
        self.run_command()

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, ApplicationStatus.CONFIRMED)

    @patch('applications.services.create_official_internship_record')
    def test_respects_the_limit(self, mock_create):
        mock_create.return_value = object()
        for _ in range(3):
            make_application(
                status=ApplicationStatus.STUDENT_ACCEPTED,
                student_user_id=uuid.uuid4(),
            )

        call_command(
            'reconcile_confirmed_applications',
            limit=2,
            stdout=io.StringIO(),
        )

        self.assertEqual(
            self.application.__class__.objects.filter(
                status=ApplicationStatus.CONFIRMED
            ).count(),
            2,
        )
