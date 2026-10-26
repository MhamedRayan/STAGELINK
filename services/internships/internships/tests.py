from datetime import date

from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Internship, InternshipStatus


class InternshipConstraintTests(TestCase):
    def _build_internship(self, **overrides):
        data = {
            "source_application_id": 1,
            "student_user_id": 10,
            "company_user_id": 20,
            "offer_id": 30,
            "start_date": date(2027, 2, 1),
            "end_date": date(2027, 6, 30),
        }
        data.update(overrides)
        return Internship.objects.create(**data)

    def _assert_rejected_by_database(self, **overrides):
        # transaction.atomic() keeps the test transaction usable after the error.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._build_internship(**overrides)

    def test_valid_internship_is_created(self):
        internship = self._build_internship()
        self.assertEqual(internship.status, InternshipStatus.CONFIRMED)

    def test_duplicate_source_application_is_rejected(self):
        self._build_internship(source_application_id=1)
        self._assert_rejected_by_database(source_application_id=1, student_user_id=11)

    def test_student_cannot_have_two_confirmed_internships(self):
        self._build_internship(source_application_id=1, student_user_id=10)
        self._assert_rejected_by_database(source_application_id=2, student_user_id=10)

    def test_student_cannot_have_confirmed_and_in_progress_internships(self):
        self._build_internship(source_application_id=1, student_user_id=10)
        self._assert_rejected_by_database(
            source_application_id=2,
            student_user_id=10,
            status=InternshipStatus.IN_PROGRESS,
        )

    def test_student_can_start_new_internship_after_previous_one_completed(self):
        self._build_internship(
            source_application_id=1,
            student_user_id=10,
            status=InternshipStatus.COMPLETED,
        )
        self._build_internship(source_application_id=2, student_user_id=10)
        self.assertEqual(Internship.objects.filter(student_user_id=10).count(), 2)

    def test_end_date_before_start_date_is_rejected(self):
        self._assert_rejected_by_database(
            start_date=date(2027, 6, 30),
            end_date=date(2027, 2, 1),
        )

    def test_different_students_can_be_active_at_the_same_time(self):
        self._build_internship(source_application_id=1, student_user_id=10)
        self._build_internship(source_application_id=2, student_user_id=11)
        self.assertEqual(Internship.objects.count(), 2)
