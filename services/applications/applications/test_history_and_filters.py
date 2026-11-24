import uuid
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .identity_client import IdentityUnavailable
from .models import ApplicationStatus
from .roles import Role
from .testing import (
    COMPANY_ID,
    OTHER_STUDENT_ID,
    STUDENT_ID,
    UNIVERSITY_ID,
    DummyUser,
    make_application,
)


class ApplicationListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.other_student = DummyUser(OTHER_STUDENT_ID, Role.STUDENT)
        self.university = DummyUser(
            UNIVERSITY_ID, Role.UNIVERSITY_ADMIN, university="Demo University"
        )
        self.offer_id = uuid.uuid4()
        self.student_scope = patch(
            'applications.views.list_student_ids_for_university',
            return_value=[str(STUDENT_ID), str(OTHER_STUDENT_ID)],
        )
        self.student_scope.start()
        self.addCleanup(self.student_scope.stop)

        self.own = make_application()
        self.submitted = make_application(offer_id=self.offer_id)
        self.other = make_application(student_user_id=OTHER_STUDENT_ID)

    def test_student_only_sees_their_own_applications(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(reverse('application-list-create'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pagination']['total'], 2)
        ids = {item['id'] for item in response.data['results']}
        self.assertEqual(ids, {str(self.own.id), str(self.submitted.id)})

    def test_filter_by_status(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'status': 'SUBMITTED'}
        )

        self.assertEqual(response.data['pagination']['total'], 2)

    def test_filter_by_offer(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'offer_id': str(self.offer_id)}
        )

        self.assertEqual(response.data['pagination']['total'], 1)
        self.assertEqual(response.data['results'][0]['id'], str(self.submitted.id))

    def test_pagination_envelope(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'limit': 1, 'offset': 1}
        )

        self.assertEqual(response.data['pagination'], {'limit': 1, 'offset': 1, 'total': 2})
        self.assertEqual(len(response.data['results']), 1)

    def test_university_admin_sees_every_application(self):
        self.client.force_authenticate(user=self.university)

        response = self.client.get(reverse('application-list-create'))

        self.assertEqual(response.data['pagination']['total'], 3)

    def test_university_validation_queue_filters_by_company_accepted(self):
        self.submitted.status = ApplicationStatus.COMPANY_ACCEPTED
        self.submitted.save()
        self.client.force_authenticate(user=self.university)

        response = self.client.get(
            reverse('application-list-create'), {'status': 'COMPANY_ACCEPTED'}
        )

        self.assertEqual(response.data['pagination']['total'], 1)
        self.assertEqual(response.data['results'][0]['id'], str(self.submitted.id))

    def test_ordering_is_whitelisted(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'ordering': 'created_at'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        bad = self.client.get(
            reverse('application-list-create'), {'ordering': 'student_user_id'}
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_limit_is_bounded(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'limit': 101}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_query_parameter_is_rejected(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(
            reverse('application-list-create'), {'nonsense': 'x'}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ApplicationHistoryEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = DummyUser(STUDENT_ID, Role.STUDENT)
        self.other_student = DummyUser(OTHER_STUDENT_ID, Role.STUDENT)
        self.university = DummyUser(
            UNIVERSITY_ID, Role.UNIVERSITY_ADMIN, university="Demo University"
        )
        self.student_scope = patch(
            'applications.views.list_student_ids_for_university',
            return_value=[str(STUDENT_ID)],
        )
        self.student_scope.start()
        self.addCleanup(self.student_scope.stop)
        self.application = make_application()
        self.application.history.create(
            from_status='',
            to_status='SUBMITTED',
            actor_user_id=STUDENT_ID,
            actor_role='student',
        )
        self.application.history.create(
            from_status='SUBMITTED',
            to_status='WITHDRAWN',
            actor_user_id=STUDENT_ID,
            actor_role='student',
            reason='changed plans',
        )
        self.url = reverse('application-history', kwargs={'pk': self.application.id})

    def test_participant_reads_the_history(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pagination']['total'], 2)
        self.assertEqual(response.data['results'][-1]['to_status'], 'WITHDRAWN')
        self.assertEqual(response.data['results'][-1]['reason'], 'changed plans')

    def test_non_participant_gets_not_found(self):
        self.client.force_authenticate(user=self.other_student)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_university_admin_can_read(self):
        self.client.force_authenticate(user=self.university)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_history_is_paginated(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.get(self.url, {'limit': 1})

        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['pagination']['total'], 2)


class UniversityScopeTests(TestCase):
    """A university administrator only ever sees its own institution."""

    def setUp(self):
        self.client = APIClient()
        self.offer_id = uuid.uuid4()
        self.application = make_application(offer_id=self.offer_id)
        self.other = make_application(student_user_id=OTHER_STUDENT_ID)

    def _admin(self, university='Demo University'):
        return DummyUser(UNIVERSITY_ID, Role.UNIVERSITY_ADMIN, university=university)

    @patch(
        'applications.views.list_student_ids_for_university',
        return_value=[str(STUDENT_ID)],
    )
    def test_list_is_scoped_to_the_institution(self, mock_scope):
        self.client.force_authenticate(user=self._admin())

        response = self.client.get(reverse('application-list-create'))

        self.assertEqual(
            [row['id'] for row in response.data['results']],
            [str(self.application.id)],
        )
        mock_scope.assert_called_once_with('Demo University')

    def test_blank_university_sees_nothing_without_a_lookup(self):
        self.client.force_authenticate(user=self._admin(university=' '))

        with patch('applications.views.list_student_ids_for_university') as scope:
            response = self.client.get(reverse('application-list-create'))

        self.assertEqual(response.data['results'], [])
        scope.assert_not_called()

    @patch(
        'applications.views.list_student_ids_for_university',
        side_effect=IdentityUnavailable('down'),
    )
    def test_identity_outage_fails_closed(self, mock_scope):
        self.client.force_authenticate(user=self._admin())

        response = self.client.get(reverse('application-list-create'))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['code'], 'IDENTITY_UNAVAILABLE')

    @patch(
        'applications.views.list_student_ids_for_university',
        return_value=[str(STUDENT_ID)],
    )
    def test_other_institution_detail_is_not_found(self, mock_scope):
        self.client.force_authenticate(user=self._admin())

        response = self.client.get(
            reverse('application-detail', kwargs={'pk': self.other.id})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch(
        'applications.views.list_student_ids_for_university',
        return_value=[str(STUDENT_ID)],
    )
    def test_other_institution_decision_is_not_found(self, mock_scope):
        self.other.status = ApplicationStatus.COMPANY_ACCEPTED
        self.other.save(update_fields=['status'])
        self.client.force_authenticate(user=self._admin())

        response = self.client.post(
            reverse('university-decision', kwargs={'pk': self.other.id}),
            {'decision': 'ACCEPT'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
