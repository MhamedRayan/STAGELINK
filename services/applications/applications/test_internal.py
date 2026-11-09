import uuid

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import ApplicationStatus, OfferReservation
from .roles import Role
from .testing import DummyUser, make_application

TOKEN = 'internal-test-token'


@override_settings(INTERNAL_SERVICE_TOKEN=TOKEN)
class InternalEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.application = make_application(status=ApplicationStatus.CONFIRMED)
        self.offer_id = self.application.offer_id

    def service_client(self, token=TOKEN):
        client = APIClient()
        if token is not None:
            client.credentials(HTTP_X_SERVICE_TOKEN=token)
        return client

    # --- release-place -----------------------------------------------------

    def test_release_place_requires_the_service_token(self):
        url = reverse('internal-release-place', kwargs={'pk': self.application.id})

        self.assertEqual(self.service_client(None).post(url).status_code, 403)
        self.assertEqual(self.service_client('wrong').post(url).status_code, 403)

    def test_user_jwt_cannot_call_release_place(self):
        self.client.force_authenticate(user=DummyUser(uuid.uuid4(), Role.STUDENT))
        url = reverse('internal-release-place', kwargs={'pk': self.application.id})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_release_place_frees_one_occupied_place(self):
        OfferReservation.objects.create(offer_id=self.offer_id, capacity=2, occupied=1)
        url = reverse('internal-release-place', kwargs={'pk': self.application.id})

        response = self.service_client().post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['released'])
        self.assertIsNotNone(response.data['place_released_at'])
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).occupied, 0
        )

    def test_release_place_is_idempotent(self):
        OfferReservation.objects.create(offer_id=self.offer_id, capacity=2, occupied=1)
        url = reverse('internal-release-place', kwargs={'pk': self.application.id})

        self.service_client().post(url)
        second = self.service_client().post(url)

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['released'])
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).occupied, 0
        )

    def test_release_place_releases_a_provisional_reservation(self):
        application = make_application(status=ApplicationStatus.UNIVERSITY_VALIDATED)
        OfferReservation.objects.create(
            offer_id=application.offer_id, capacity=2, reserved=1
        )
        url = reverse('internal-release-place', kwargs={'pk': application.id})

        response = self.service_client().post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=application.offer_id).reserved, 0
        )

    def test_release_place_unknown_application_is_404(self):
        url = reverse('internal-release-place', kwargs={'pk': uuid.uuid4()})
        response = self.service_client().post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # --- capacity snapshot -------------------------------------------------

    def test_capacity_snapshot_requires_the_service_token(self):
        url = reverse('internal-offer-capacity', kwargs={'offer_id': self.offer_id})
        self.assertEqual(self.service_client(None).get(url).status_code, 403)

    def test_capacity_snapshot_without_a_reservation(self):
        url = reverse('internal-offer-capacity', kwargs={'offer_id': self.offer_id})

        response = self.service_client().get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['committed'], 0)
        self.assertIsNone(response.data['capacity'])
        self.assertIsNone(response.data['available'])

    def test_capacity_snapshot_reports_committed_places(self):
        OfferReservation.objects.create(
            offer_id=self.offer_id, capacity=4, reserved=1, occupied=1
        )
        url = reverse('internal-offer-capacity', kwargs={'offer_id': self.offer_id})

        response = self.service_client().get(url)

        self.assertEqual(response.data['capacity'], 4)
        self.assertEqual(response.data['reserved'], 1)
        self.assertEqual(response.data['occupied'], 1)
        self.assertEqual(response.data['committed'], 2)
        self.assertEqual(response.data['available'], 2)
