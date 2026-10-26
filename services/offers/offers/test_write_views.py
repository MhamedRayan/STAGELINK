from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import NON_COMPANY_ROLES, OTHER_COMPANY_ID, OWNER_ID
from offers.test_serializers import build_payload, create_offer
from offers.test_views import build_client


class CreateOfferTests(APITestCase):
    def setUp(self):
        self.list_url = reverse("offer-list")
        self.company_client = build_client(OWNER_ID, UserRole.COMPANY)

    def test_company_creates_draft_offer_bound_to_its_own_id(self):
        response = self.company_client.post(
            self.list_url, build_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["company_user_id"], OWNER_ID)
        self.assertEqual(response.data["status"], OfferStatus.DRAFT)
        offer = Offer.objects.get(pk=response.data["id"])
        self.assertEqual(offer.company_user_id, OWNER_ID)
        self.assertEqual(offer.status, OfferStatus.DRAFT)
        self.assertEqual(offer.title, "Backend Internship")

    def test_client_cannot_spoof_owner_status_or_id(self):
        payload = build_payload(
            id=999999,
            company_user_id=OTHER_COMPANY_ID,
            status=OfferStatus.PUBLISHED,
        )

        response = self.company_client.post(self.list_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        offer = Offer.objects.get()
        self.assertEqual(offer.company_user_id, OWNER_ID)
        self.assertEqual(offer.status, OfferStatus.DRAFT)
        self.assertNotEqual(offer.id, 999999)

    def test_invalid_values_return_400_and_create_nothing(self):
        cases = (
            ("deadline", build_payload(deadline=timezone.now() - timedelta(days=1))),
            ("capacity", build_payload(capacity=0)),
            ("title", build_payload(title="")),
        )
        for field_name, payload in cases:
            with self.subTest(field=field_name):
                response = self.company_client.post(
                    self.list_url, payload, format="json"
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)
        self.assertEqual(Offer.objects.count(), 0)

    def test_missing_required_fields_return_400(self):
        for field_name in build_payload():
            with self.subTest(field=field_name):
                payload = build_payload()
                del payload[field_name]

                response = self.company_client.post(
                    self.list_url, payload, format="json"
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)
        self.assertEqual(Offer.objects.count(), 0)

    def test_non_company_roles_cannot_create(self):
        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                client = build_client(OWNER_ID, role)

                response = client.post(self.list_url, build_payload(), format="json")

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Offer.objects.count(), 0)

    def test_anonymous_cannot_create(self):
        response = self.client.post(self.list_url, build_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Offer.objects.count(), 0)

    def test_invalid_token_cannot_create(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        response = client.post(self.list_url, build_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Offer.objects.count(), 0)

    def test_company_token_with_unusable_user_id_is_rejected(self):
        client = build_client("abc", UserRole.COMPANY)

        response = client.post(self.list_url, build_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Offer.objects.count(), 0)


class UpdateOfferTests(APITestCase):
    def setUp(self):
        self.owner_client = build_client(OWNER_ID, UserRole.COMPANY)

    def detail_url(self, offer_id):
        return reverse("offer-detail", kwargs={"pk": offer_id})

    def test_owner_partially_updates_draft_and_published_offers(self):
        for offer_status in (OfferStatus.DRAFT, OfferStatus.PUBLISHED):
            with self.subTest(status=offer_status):
                offer = create_offer(company_user_id=OWNER_ID, status=offer_status)
                original_description = offer.description

                response = self.owner_client.patch(
                    self.detail_url(offer.id),
                    {"title": "Updated Title", "capacity": 5},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["title"], "Updated Title")
                self.assertEqual(response.data["company_user_id"], OWNER_ID)
                offer.refresh_from_db()
                self.assertEqual(offer.title, "Updated Title")
                self.assertEqual(offer.capacity, 5)
                self.assertEqual(offer.description, original_description)
                self.assertEqual(offer.status, offer_status)

    def test_protected_fields_are_ignored(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        original_id = offer.id

        response = self.owner_client.patch(
            self.detail_url(offer.id),
            {
                "title": "Updated Title",
                "status": OfferStatus.CLOSED,
                "company_user_id": OTHER_COMPANY_ID,
                "id": 999999,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Updated Title")
        self.assertEqual(offer.status, OfferStatus.DRAFT)
        self.assertEqual(offer.company_user_id, OWNER_ID)
        self.assertEqual(offer.id, original_id)
        self.assertFalse(Offer.objects.filter(pk=999999).exists())

    def test_other_company_cannot_modify_published_offer(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)
        client = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)

        response = client.patch(
            self.detail_url(offer.id), {"title": "Hijacked"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")

    def test_other_company_cannot_see_or_modify_draft_offer(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        client = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)

        response = client.patch(
            self.detail_url(offer.id), {"title": "Hijacked"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")

    def test_non_company_roles_cannot_modify_offers(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                client = build_client(OWNER_ID, role)

                response = client.patch(
                    self.detail_url(offer.id), {"title": "Hijacked"}, format="json"
                )

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")

    def test_anonymous_cannot_modify_offers(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        response = self.client.patch(
            self.detail_url(offer.id), {"title": "Hijacked"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")

    def test_invalid_values_return_400_and_change_nothing(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        cases = (
            ("capacity", {"capacity": 0}),
            ("deadline", {"deadline": timezone.now() - timedelta(days=1)}),
            ("title", {"title": ""}),
        )
        for field_name, payload in cases:
            with self.subTest(field=field_name):
                response = self.owner_client.patch(
                    self.detail_url(offer.id), payload, format="json"
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")
        self.assertEqual(offer.capacity, 3)

    def test_updating_non_existent_offer_returns_404(self):
        response = self.owner_client.patch(
            self.detail_url(999999), {"title": "Updated Title"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
