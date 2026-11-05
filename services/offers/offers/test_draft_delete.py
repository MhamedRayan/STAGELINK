import uuid

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OTHER_COMPANY_ID, OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client, result_ids


class DraftSoftDeleteTests(APITestCase):
    def setUp(self):
        self.owner = build_client(OWNER_ID, UserRole.COMPANY)

    def url(self, offer):
        return reverse("offer-detail", args=[offer.pk])

    def test_owner_deletes_draft_and_it_becomes_404(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)

        response = self.owner.delete(self.url(offer))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(
            self.owner.get(self.url(offer)).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.owner.delete(self.url(offer)).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.owner.patch(self.url(offer), {"capacity": 2}, format="json")
            .status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_row_is_kept_with_deleted_at(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)

        self.owner.delete(self.url(offer))

        self.assertIsNotNone(Offer.objects.get(pk=offer.pk).deleted_at)

    def test_deleted_draft_is_absent_from_my_offers(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        self.owner.delete(self.url(offer))

        response = self.owner.get(reverse("offer-list"), {"mine": "true"})

        self.assertEqual(result_ids(response), [])

    def test_published_and_closed_offers_cannot_be_deleted(self):
        for offer_status in (OfferStatus.PUBLISHED, OfferStatus.CLOSED):
            with self.subTest(status=offer_status):
                offer = create_offer(company_user_id=OWNER_ID, status=offer_status)

                response = self.owner.delete(self.url(offer))

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertIsNone(Offer.objects.get(pk=offer.pk).deleted_at)

    def test_other_company_and_non_company_cannot_delete(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        callers = {
            "other_company": build_client(OTHER_COMPANY_ID, UserRole.COMPANY),
            "student": build_client(OWNER_ID, UserRole.STUDENT),
        }
        for name, client in callers.items():
            with self.subTest(caller=name):
                response = client.delete(self.url(offer))
                self.assertIn(
                    response.status_code,
                    (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
                )
        self.assertIsNone(Offer.objects.get(pk=offer.pk).deleted_at)

    def test_anonymous_cannot_delete(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        response = APIClient().delete(self.url(offer))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_unknown_offer_is_404(self):
        response = self.owner.delete(
            reverse("offer-detail", args=[uuid.uuid4()])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(INTERNAL_SERVICE_TOKEN="tok")
    def test_deleted_draft_is_404_on_internal_lookup(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        self.owner.delete(self.url(offer))
        client = APIClient()
        client.credentials(HTTP_X_SERVICE_TOKEN="tok")

        response = client.get(reverse("internal-offer-detail", args=[offer.pk]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)