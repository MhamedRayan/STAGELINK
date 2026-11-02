from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .exceptions import EvaluationRequired, InvalidTransition, StartDateNotReached
from .lifecycle import ensure_transition_allowed
from .models import InternshipAudit, InternshipAuditAction, InternshipStatus
from .roles import Role
from .services import complete_internship, start_due_internships, start_internship
from .testing_utils import TEST_JWT_KEY, make_internship, make_token, new_id

PAST = date(2000, 1, 1)
FUTURE = date(2999, 1, 1)
TODAY = date(2027, 3, 1)


class AutomaticStartTests(TestCase):
    def test_due_confirmed_internship_becomes_in_progress(self):
        internship = make_internship(start=date(2027, 2, 1))

        self.assertEqual(start_due_internships(today=TODAY), 1)

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.IN_PROGRESS)

    def test_future_start_date_stays_confirmed(self):
        internship = make_internship(start=date(2027, 4, 1))

        self.assertEqual(start_due_internships(today=TODAY), 0)

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.CONFIRMED)

    def test_automatic_start_is_audited_with_no_actor(self):
        internship = make_internship(start=date(2027, 2, 1))

        start_due_internships(today=TODAY)

        entry = InternshipAudit.objects.get(internship=internship, action=InternshipAuditAction.STATUS_CHANGED)
        self.assertEqual(entry.from_status, InternshipStatus.CONFIRMED)
        self.assertEqual(entry.to_status, InternshipStatus.IN_PROGRESS)
        self.assertIsNone(entry.actor_user_id)

    def test_running_twice_changes_nothing_the_second_time(self):
        make_internship(start=date(2027, 2, 1))

        start_due_internships(today=TODAY)
        self.assertEqual(start_due_internships(today=TODAY), 0)

        self.assertEqual(InternshipAudit.objects.filter(action=InternshipAuditAction.STATUS_CHANGED).count(), 1)

    def test_completed_and_cancelled_internships_are_not_touched(self):
        completed = make_internship(start=PAST, status=InternshipStatus.COMPLETED)
        cancelled = make_internship(start=PAST, status=InternshipStatus.CANCELLED)

        start_due_internships(today=TODAY)

        completed.refresh_from_db()
        cancelled.refresh_from_db()
        self.assertEqual(completed.status, InternshipStatus.COMPLETED)
        self.assertEqual(cancelled.status, InternshipStatus.CANCELLED)

    def test_management_command_starts_due_internships(self):
        internship = make_internship(start=PAST)

        output = StringIO()
        call_command("start_due_internships", stdout=output)

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.IN_PROGRESS)
        self.assertIn("Started 1 internship(s).", output.getvalue())


class ManualStartTests(TestCase):
    def test_manual_start_after_start_date_succeeds(self):
        internship = make_internship(start=PAST)

        start_internship(internship, actor_user_id=new_id(), today=TODAY)

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.IN_PROGRESS)

    def test_manual_start_before_start_date_is_refused(self):
        internship = make_internship(start=FUTURE)

        with self.assertRaises(StartDateNotReached):
            start_internship(internship, actor_user_id=new_id(), today=TODAY)

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.CONFIRMED)

    def test_manual_start_of_in_progress_internship_is_refused(self):
        internship = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)

        with self.assertRaises(InvalidTransition):
            start_internship(internship, actor_user_id=new_id(), today=TODAY)


class CompletionTests(TestCase):
    def test_completion_is_refused_until_an_evaluation_exists(self):
        internship = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)

        with self.assertRaises(EvaluationRequired):
            complete_internship(internship, actor_user_id=new_id())

        internship.refresh_from_db()
        self.assertEqual(internship.status, InternshipStatus.IN_PROGRESS)

    def test_confirmed_internship_cannot_skip_to_completed(self):
        internship = make_internship(start=FUTURE)

        with self.assertRaises(InvalidTransition):
            complete_internship(internship, actor_user_id=new_id())

    def test_completed_internship_cannot_go_back_to_confirmed(self):
        internship = make_internship(start=PAST, status=InternshipStatus.COMPLETED)

        with self.assertRaises(InvalidTransition):
            ensure_transition_allowed(internship.status, InternshipStatus.CONFIRMED)

    def test_refused_transition_writes_no_audit_entry(self):
        internship = make_internship(start=FUTURE)
        before = InternshipAudit.objects.count()

        with self.assertRaises(InvalidTransition):
            complete_internship(internship, actor_user_id=new_id())

        self.assertEqual(InternshipAudit.objects.count(), before)


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class LifecycleEndpointTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = make_token(new_id(), Role.UNIVERSITY_ADMIN)

    def _post(self, internship, action, token):
        return self.api.post(
            f"/api/internships/{internship.pk}/{action}/",
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_university_admin_can_start_after_start_date(self):
        internship = make_internship(start=PAST)

        response = self._post(internship, "start", self.admin)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "in_progress")

    def test_student_cannot_start(self):
        internship = make_internship(start=PAST)
        token = make_token(internship.student_user_id, Role.STUDENT)

        response = self._post(internship, "start", token)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "permission_denied")

    def test_start_before_date_returns_409_with_code(self):
        internship = make_internship(start=FUTURE)

        response = self._post(internship, "start", self.admin)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "start_date_not_reached")

    def test_complete_returns_409_evaluation_required(self):
        internship = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)

        response = self._post(internship, "complete", self.admin)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "evaluation_required")

    def test_unassigned_supervisor_cannot_see_the_internship_to_complete_it(self):
        internship = make_internship(start=PAST, status=InternshipStatus.IN_PROGRESS)
        token = make_token(new_id(), Role.SUPERVISOR)

        response = self._post(internship, "complete", token)

        self.assertEqual(response.status_code, 404)

    def test_assigned_supervisor_passes_permission_to_complete(self):
        supervisor_id = new_id()
        internship = make_internship(
            start=PAST, supervisor=supervisor_id, status=InternshipStatus.IN_PROGRESS
        )
        token = make_token(supervisor_id, Role.SUPERVISOR)

        response = self._post(internship, "complete", token)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "evaluation_required")


@override_settings(JWT_SIGNING_KEY=TEST_JWT_KEY)
class HistoryEndpointTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_history_lists_events_in_order_for_authorized_caller(self):
        student_id = new_id()
        internship = make_internship(student=student_id, start=PAST)
        start_internship(internship, actor_user_id=new_id(), today=TODAY)

        token = make_token(student_id, Role.STUDENT)
        response = self.api.get(
            f"/api/internships/{internship.pk}/history/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 200)
        actions = [entry["action"] for entry in response.data["results"]]
        self.assertEqual(actions, ["created", "status_changed"])

    def test_history_of_another_students_internship_is_hidden(self):
        internship = make_internship(start=PAST)
        token = make_token(new_id(), Role.STUDENT)

        response = self.api.get(
            f"/api/internships/{internship.pk}/history/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 404)
