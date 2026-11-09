import uuid

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client

TOKEN = "internal-test-token"
EXPECTED_FIELDS = {
    "id",
    "company_user_id",
    "title",
    "status",
    "deadline",
    "capacity",
    "created_at",
}


@override_settings(INTERNAL_SERVICE_TOKEN=TOKEN)
class InternalOfferDetailTests(APITestCase):
    def url(self, pk):
        return reverse("internal-offer-detail", args=[pk])

    def service_client(self, token=TOKEN):
        client = APIClient()
        client.credentials(HTTP_X_SERVICE_TOKEN=token)
        return client

    def test_route_path(self):
        pk = uuid.uuid4()
        self.assertEqual(self.url(pk), f"/api/internal/offers/{pk}/")

    def test_valid_token_returns_offer_of_any_status(self):
        for offer_status in OfferStatus.values:
            with self.subTest(status=offer_status):
                offer = create_offer(status=offer_status)
                response = self.service_client().get(self.url(offer.pk))

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(set(response.data), EXPECTED_FIELDS)
                self.assertEqual(response.data["id"], str(offer.pk))
                self.assertEqual(response.data["status"], offer_status)
                self.assertEqual(response.data["capacity"], offer.capacity)

    def test_missing_or_wrong_token_is_forbidden(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        clients = {
            "missing": APIClient(),
            "wrong": self.service_client("wrong-token"),
        }
        for name, client in clients.items():
            for pk in (offer.pk, uuid.uuid4()):
                with self.subTest(token=name, pk=str(pk)):
                    response = client.get(self.url(pk))
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_jwt_alone_is_forbidden(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)
        client = build_client(OWNER_ID, UserRole.COMPANY)

        response = client.get(self.url(offer.pk))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_offer_with_valid_token_is_404(self):
        response = self.service_client().get(self.url(uuid.uuid4()))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_write_methods_are_not_allowed(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        client = self.service_client()
        for method in ("post", "patch", "put", "delete"):
            with self.subTest(method=method):
                response = getattr(client, method)(self.url(offer.pk))
                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    def test_empty_configured_token_fails_closed(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        for token in ("", "anything"):
            with self.subTest(token=token):
                response = self.service_client(token).get(self.url(offer.pk))
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)