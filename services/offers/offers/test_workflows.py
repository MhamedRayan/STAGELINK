from datetime import timedelta

import uuid

import jwt
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OTHER_COMPANY_ID, OWNER_ID, make_access_token
from offers.test_serializers import build_payload, create_offer
from offers.test_views import build_client

STUDENT_ID = uuid.uuid4()


def list_url():
    return reverse("offer-list")


def detail_url(offer_id):
    return reverse("offer-detail", kwargs={"pk": offer_id})


def publish_url(offer_id):
    return reverse("offer-publish", kwargs={"pk": offer_id})


def close_url(offer_id):
    return reverse("offer-close", kwargs={"pk": offer_id})


def listed_ids(client):
    response = client.get(list_url(), {"page_size": 100})
    return [item["id"] for item in response.data["results"]]


class OfferLifecycleTests(APITestCase):
    def assert_outsider_visibility(self, outsiders, offer_id, visible):
        expected_status = (
            status.HTTP_200_OK if visible else status.HTTP_404_NOT_FOUND
        )
        for name, client in outsiders.items():
            with self.subTest(caller=name, offer_id=offer_id, visible=visible):
                response = client.get(detail_url(offer_id))

                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(offer_id in listed_ids(client), visible)

    def test_offer_goes_from_draft_to_closed_with_correct_visibility(self):
        company = build_client(OWNER_ID, UserRole.COMPANY)
        outsiders = {
            "guest": APIClient(),
            "student": build_client(STUDENT_ID, UserRole.STUDENT),
            "other_company": build_client(OTHER_COMPANY_ID, UserRole.COMPANY),
        }

        created = company.post(list_url(), build_payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["status"], OfferStatus.DRAFT)
        offer_id = created.data["id"]

        self.assert_outsider_visibility(outsiders, offer_id, visible=False)
        self.assertEqual(
            company.get(detail_url(offer_id)).status_code, status.HTTP_200_OK
        )

        edited = company.patch(
            detail_url(offer_id), {"title": "Final Title"}, format="json"
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)

        published = company.post(publish_url(offer_id))
        self.assertEqual(published.status_code, status.HTTP_200_OK)
        self.assertEqual(published.data["status"], OfferStatus.PUBLISHED)
        self.assert_outsider_visibility(outsiders, offer_id, visible=True)
        guest_view = outsiders["guest"].get(detail_url(offer_id))
        self.assertEqual(guest_view.data["title"], "Final Title")

        closed = company.post(close_url(offer_id))
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertEqual(closed.data["status"], OfferStatus.CLOSED)
        self.assert_outsider_visibility(outsiders, offer_id, visible=False)
        owner_view = company.get(detail_url(offer_id))
        self.assertEqual(owner_view.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_view.data["status"], OfferStatus.CLOSED)

        late_edit = company.patch(
            detail_url(offer_id), {"title": "Too Late"}, format="json"
        )
        self.assertEqual(late_edit.status_code, status.HTTP_409_CONFLICT)


class CompanyIsolationTests(APITestCase):
    def test_company_cannot_patch_publish_or_close_foreign_offers(self):
        company_a = build_client(OWNER_ID, UserRole.COMPANY)
        company_b = build_client(OTHER_COMPANY_ID, UserRole.COMPANY)
        offer_a = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED, title="Offer A"
        )
        offer_b = create_offer(
            company_user_id=OTHER_COMPANY_ID, status=OfferStatus.DRAFT, title="Offer B"
        )
        cases = (
            ("a_on_b_draft", company_a, offer_b, status.HTTP_404_NOT_FOUND),
            ("b_on_a_published", company_b, offer_a, status.HTTP_403_FORBIDDEN),
        )

        for name, client, foreign_offer, expected_status in cases:
            with self.subTest(case=name):
                responses = (
                    client.patch(
                        detail_url(foreign_offer.id),
                        {"title": "Hijacked"},
                        format="json",
                    ),
                    client.post(publish_url(foreign_offer.id)),
                    client.post(close_url(foreign_offer.id)),
                )

                for response in responses:
                    self.assertEqual(response.status_code, expected_status)

        offer_a.refresh_from_db()
        offer_b.refresh_from_db()
        self.assertEqual((offer_a.title, offer_a.status), ("Offer A", OfferStatus.PUBLISHED))
        self.assertEqual((offer_b.title, offer_b.status), ("Offer B", OfferStatus.DRAFT))

    def test_company_with_string_user_id_manages_its_own_offers(self):
        client = build_client(str(OWNER_ID), UserRole.COMPANY)

        created = client.post(list_url(), build_payload(), format="json")

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["company_user_id"], str(OWNER_ID))
        offer_id = created.data["id"]
        steps = (
            client.patch(detail_url(offer_id), {"title": "Edited"}, format="json"),
            client.post(publish_url(offer_id)),
            client.post(close_url(offer_id)),
        )
        for response in steps:
            self.assertEqual(response.status_code, status.HTTP_200_OK)


class ApiAuthenticationTests(APITestCase):
    def build_client_with_raw_token(self, raw_token):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        return client

    def assert_every_endpoint_returns_401(self, client, offer):
        calls = (
            (client.get, list_url()),
            (client.get, detail_url(offer.id)),
            (client.post, list_url()),
            (client.patch, detail_url(offer.id)),
            (client.post, publish_url(offer.id)),
            (client.post, close_url(offer.id)),
        )
        for method, url in calls:
            with self.subTest(method=method.__name__, url=url):
                response = method(url)

                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_token_is_rejected_by_every_endpoint(self):
        token = make_access_token(OWNER_ID, UserRole.COMPANY)
        token.set_exp(
            from_time=timezone.now() - timedelta(hours=1),
            lifetime=timedelta(minutes=15),
        )
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        self.assert_every_endpoint_returns_401(
            self.build_client_with_raw_token(token), offer
        )

    def test_token_signed_with_another_key_is_rejected_by_every_endpoint(self):
        token = make_access_token(OWNER_ID, UserRole.COMPANY)
        forged_token = jwt.encode(
            token.payload,
            "another-secret-key-which-is-long-enough-123",
            algorithm="HS256",
        )
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        self.assert_every_endpoint_returns_401(
            self.build_client_with_raw_token(forged_token), offer
        )


class PublishEdgeCaseTests(APITestCase):
    def test_whitespace_only_text_fields_cannot_be_published(self):
        company = build_client(OWNER_ID, UserRole.COMPANY)

        for field_name in ("title", "description", "requirements", "location"):
            with self.subTest(field=field_name):
                offer = create_offer(
                    company_user_id=OWNER_ID,
                    status=OfferStatus.DRAFT,
                    **{field_name: "   "},
                )

                response = company.post(publish_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)
                offer.refresh_from_db()
                self.assertEqual(offer.status, OfferStatus.DRAFT)


class ListQueryEdgeCaseTests(APITestCase):
    def test_page_size_is_capped_at_100(self):
        Offer.objects.bulk_create(
            [
                Offer(
                    company_user_id=OWNER_ID,
                    title=f"Offer {index}",
                    description="Description",
                    requirements="Requirements",
                    location="Location",
                    deadline=timezone.now() + timedelta(days=1),
                    capacity=1,
                    status=OfferStatus.PUBLISHED,
                )
                for index in range(101)
            ]
        )

        response = APIClient().get(list_url(), {"page_size": 1000})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 101)
        self.assertEqual(len(response.data["results"]), 100)
        self.assertIsNotNone(response.data["next"])

    def test_unknown_and_blank_query_parameters_are_ignored(self):
        create_offer(status=OfferStatus.PUBLISHED)
        create_offer(status=OfferStatus.PUBLISHED)

        response = APIClient().get(
            list_url(),
            {
                "unknown": "value",
                "search": "",
                "location": "  ",
                "requirements": "",
                "company_user_id": "",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
