from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from offers.applications_client import ApplicationsUnavailable
from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client

CAPACITY_LOOKUP = "offers.services.get_offer_capacity"


class CapacityReductionRuleTests(APITestCase):
    def patch_capacity(self, offer, capacity):
        client = build_client(OWNER_ID, UserRole.COMPANY)
        url = reverse("offer-detail", args=[offer.pk])
        return client.patch(url, {"capacity": capacity}, format="json")

    @patch(CAPACITY_LOOKUP, return_value={"committed": 2})
    def test_reduction_above_committed_is_allowed(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )

        response = self.patch_capacity(offer, 3)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Offer.objects.get(pk=offer.pk).capacity, 3)
        lookup.assert_called_once_with(offer.pk)

    @patch(CAPACITY_LOOKUP, return_value={"committed": 3})
    def test_reduction_to_committed_is_allowed(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )

        self.assertEqual(self.patch_capacity(offer, 3).status_code, status.HTTP_200_OK)
        self.assertEqual(Offer.objects.get(pk=offer.pk).capacity, 3)

    @patch(CAPACITY_LOOKUP, return_value={"committed": 4})
    def test_reduction_below_committed_is_blocked(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )

        response = self.patch_capacity(offer, 3)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("committed", response.json()["detail"])
        offer.refresh_from_db()
        self.assertEqual(offer.capacity, 5)

    @patch(CAPACITY_LOOKUP, side_effect=ApplicationsUnavailable("down"))
    def test_reduction_fails_closed_when_applications_is_unavailable(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )

        response = self.patch_capacity(offer, 3)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        offer.refresh_from_db()
        self.assertEqual(offer.capacity, 5)

    @patch(CAPACITY_LOOKUP)
    def test_increase_and_same_value_do_not_call_applications(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )
        self.assertEqual(self.patch_capacity(offer, 5).status_code, status.HTTP_200_OK)
        self.assertEqual(self.patch_capacity(offer, 8).status_code, status.HTTP_200_OK)
        self.assertEqual(Offer.objects.get(pk=offer.pk).capacity, 8)
        lookup.assert_not_called()

    @patch(CAPACITY_LOOKUP)
    def test_reduction_on_draft_offer_does_not_call_applications(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.DRAFT, capacity=5
        )

        self.assertEqual(self.patch_capacity(offer, 2).status_code, status.HTTP_200_OK)
        self.assertEqual(Offer.objects.get(pk=offer.pk).capacity, 2)
        lookup.assert_not_called()

    @patch(CAPACITY_LOOKUP)
    def test_zero_capacity_on_published_offer_is_a_validation_error(self, lookup):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )

        self.assertEqual(self.patch_capacity(offer, 0).status_code, status.HTTP_400_BAD_REQUEST)
        lookup.assert_not_called()
