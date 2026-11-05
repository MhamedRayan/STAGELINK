from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OWNER_ID
from offers.test_views import build_client
from offers.test_serializers import create_offer


class CapacityReductionRuleTests(APITestCase):
    def patch(self, offer, capacity):
        client = build_client(OWNER_ID, UserRole.COMPANY)
        url = reverse("offer-detail", args=[offer.pk])
        return client.patch(url, {"capacity": capacity}, format="json")

    def test_reduction_on_published_offer_is_blocked(self):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )
        response = self.patch(offer, 3)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        offer.refresh_from_db()
        self.assertEqual(offer.capacity, 5)

    def test_increase_and_same_value_on_published_offer_are_allowed(self):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )
        self.assertEqual(self.patch(offer, 5).status_code, status.HTTP_200_OK)
        self.assertEqual(self.patch(offer, 8).status_code, status.HTTP_200_OK)
        self.assertEqual(Offer.objects.get(pk=offer.pk).capacity, 8)

    def test_reduction_on_draft_offer_is_allowed(self):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.DRAFT, capacity=5
        )
        self.assertEqual(self.patch(offer, 2).status_code, status.HTTP_200_OK)

    def test_zero_capacity_on_published_offer_is_a_validation_error(self):
        offer = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, capacity=5
        )
        self.assertEqual(self.patch(offer, 0).status_code, status.HTTP_400_BAD_REQUEST)