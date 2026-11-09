from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from offers.models import OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client


class PublishedEditRulesTests(APITestCase):
    def setUp(self):
        self.client_owner = build_client(OWNER_ID, UserRole.COMPANY)

    def patch(self, offer, data):
        url = reverse("offer-detail", args=[offer.pk])
        return self.client_owner.patch(url, data, format="json")

    def test_locked_fields_cannot_change_while_published(self):
        for field_name in ("title", "location"):
            with self.subTest(field=field_name):
                offer = create_offer(
                    company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED
                )
                original = getattr(offer, field_name)

                response = self.patch(offer, {field_name: "Changed"})

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                offer.refresh_from_db()
                self.assertEqual(getattr(offer, field_name), original)

    def test_resending_current_locked_values_is_accepted(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        response = self.patch(
            offer,
            {
                "title": offer.title,
                "location": offer.location,
                "description": "New description",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_free_fields_can_change_while_published(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        response = self.patch(
            offer, {"description": "New", "requirements": "New", "capacity": 9}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_locked_fields_can_change_on_draft(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)

        response = self.patch(offer, {"title": "New title", "location": "Alger"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "New title")