from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import NON_COMPANY_ROLES, OTHER_COMPANY_ID, OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client


def publish_url(offer_id):
    return reverse("offer-publish", kwargs={"pk": offer_id})


def close_url(offer_id):
    return reverse("offer-close", kwargs={"pk": offer_id})


def detail_url(offer_id):
    return reverse("offer-detail", kwargs={"pk": offer_id})


def create_owned_offer(offer_status, **overrides):
    return create_offer(company_user_id=OWNER_ID, status=offer_status, **overrides)


class PublishOfferTests(APITestCase):
    def setUp(self):
        self.owner_client = build_client(OWNER_ID, UserRole.COMPANY)

    def test_owner_publishes_draft_offer(self):
        offer = create_owned_offer(OfferStatus.DRAFT)

        response = self.owner_client.post(publish_url(offer.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], OfferStatus.PUBLISHED)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.PUBLISHED)

        list_response = self.client.get(reverse("offer-list"))
        listed_ids = [item["id"] for item in list_response.data["results"]]
        self.assertIn(offer.id, listed_ids)

    def test_publishing_requires_all_text_fields(self):
        for field_name in ("title", "description", "requirements", "location"):
            with self.subTest(field=field_name):
                offer = create_owned_offer(OfferStatus.DRAFT, **{field_name: ""})

                response = self.owner_client.post(publish_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)
                offer.refresh_from_db()
                self.assertEqual(offer.status, OfferStatus.DRAFT)

    def test_publishing_expired_offer_is_rejected(self):
        offer = create_owned_offer(
            OfferStatus.DRAFT, deadline=timezone.now() - timedelta(days=1)
        )

        response = self.owner_client.post(publish_url(offer.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("deadline", response.data)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.DRAFT)

    def test_only_draft_offers_can_be_published(self):
        for offer_status in (OfferStatus.PUBLISHED, OfferStatus.CLOSED):
            with self.subTest(status=offer_status):
                offer = create_owned_offer(offer_status)

                response = self.owner_client.post(publish_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                offer.refresh_from_db()
                self.assertEqual(offer.status, offer_status)

    def test_other_company_cannot_publish_offers_it_does_not_own(self):
        client = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)
        cases = (
            (OfferStatus.DRAFT, status.HTTP_404_NOT_FOUND),
            (OfferStatus.PUBLISHED, status.HTTP_403_FORBIDDEN),
        )
        for offer_status, expected_status in cases:
            with self.subTest(status=offer_status):
                offer = create_owned_offer(offer_status)

                response = client.post(publish_url(offer.id))

                self.assertEqual(response.status_code, expected_status)
                offer.refresh_from_db()
                self.assertEqual(offer.status, offer_status)

    def test_non_company_roles_cannot_publish(self):
        offer = create_owned_offer(OfferStatus.DRAFT)

        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                client = build_client(OWNER_ID, role)

                response = client.post(publish_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.DRAFT)

    def test_anonymous_and_invalid_token_cannot_publish(self):
        offer = create_owned_offer(OfferStatus.DRAFT)
        invalid_token_client = APIClient()
        invalid_token_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        for client in (self.client, invalid_token_client):
            response = client.post(publish_url(offer.id))

            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.DRAFT)

    def test_publishing_non_existent_offer_returns_404(self):
        response = self.owner_client.post(publish_url(999999))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_methods_are_not_allowed_on_publish(self):
        offer = create_owned_offer(OfferStatus.DRAFT)

        for method in (
            self.owner_client.get,
            self.owner_client.put,
            self.owner_client.patch,
            self.owner_client.delete,
        ):
            with self.subTest(method=method.__name__):
                response = method(publish_url(offer.id))

                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )


class CloseOfferTests(APITestCase):
    def setUp(self):
        self.owner_client = build_client(OWNER_ID, UserRole.COMPANY)

    def test_owner_closes_published_offer(self):
        offer = create_owned_offer(OfferStatus.PUBLISHED)

        response = self.owner_client.post(close_url(offer.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], OfferStatus.CLOSED)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.CLOSED)

        list_response = self.client.get(reverse("offer-list"))
        listed_ids = [item["id"] for item in list_response.data["results"]]
        self.assertNotIn(offer.id, listed_ids)

    def test_owner_can_close_published_offer_after_deadline(self):
        offer = create_owned_offer(
            OfferStatus.PUBLISHED, deadline=timezone.now() - timedelta(days=1)
        )

        response = self.owner_client.post(close_url(offer.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.CLOSED)

    def test_only_published_offers_can_be_closed(self):
        for offer_status in (OfferStatus.DRAFT, OfferStatus.CLOSED):
            with self.subTest(status=offer_status):
                offer = create_owned_offer(offer_status)

                response = self.owner_client.post(close_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                offer.refresh_from_db()
                self.assertEqual(offer.status, offer_status)

    def test_other_company_cannot_close_offers_it_does_not_own(self):
        client = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)
        cases = (
            (OfferStatus.DRAFT, status.HTTP_404_NOT_FOUND),
            (OfferStatus.PUBLISHED, status.HTTP_403_FORBIDDEN),
        )
        for offer_status, expected_status in cases:
            with self.subTest(status=offer_status):
                offer = create_owned_offer(offer_status)

                response = client.post(close_url(offer.id))

                self.assertEqual(response.status_code, expected_status)
                offer.refresh_from_db()
                self.assertEqual(offer.status, offer_status)

    def test_non_company_roles_cannot_close(self):
        offer = create_owned_offer(OfferStatus.PUBLISHED)

        for role in NON_COMPANY_ROLES:
            with self.subTest(role=role):
                client = build_client(OWNER_ID, role)

                response = client.post(close_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.PUBLISHED)

    def test_anonymous_and_invalid_token_cannot_close(self):
        offer = create_owned_offer(OfferStatus.PUBLISHED)
        invalid_token_client = APIClient()
        invalid_token_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        for client in (self.client, invalid_token_client):
            response = client.post(close_url(offer.id))

            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.PUBLISHED)

    def test_closing_non_existent_offer_returns_404(self):
        response = self.owner_client.post(close_url(999999))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class EditClosedOfferTests(APITestCase):
    def setUp(self):
        self.owner_client = build_client(OWNER_ID, UserRole.COMPANY)

    def test_owner_cannot_edit_closed_offer(self):
        offer = create_owned_offer(OfferStatus.CLOSED)

        response = self.owner_client.patch(
            detail_url(offer.id), {"title": "Changed"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        offer.refresh_from_db()
        self.assertEqual(offer.title, "Backend Internship")

    def test_offer_closed_through_api_cannot_be_edited_afterwards(self):
        offer = create_owned_offer(OfferStatus.PUBLISHED)
        self.owner_client.post(close_url(offer.id))

        response = self.owner_client.patch(
            detail_url(offer.id), {"title": "Changed"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.CLOSED)
        self.assertEqual(offer.title, "Backend Internship")

    def test_other_company_gets_404_when_editing_closed_offer(self):
        offer = create_owned_offer(OfferStatus.CLOSED)
        client = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)

        response = client.patch(
            detail_url(offer.id), {"title": "Changed"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
