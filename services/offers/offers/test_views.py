import uuid

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from offers.models import OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OTHER_COMPANY_ID, OWNER_ID, make_access_token
from offers.test_serializers import create_offer


def build_client(user_id=None, role=None):
    client = APIClient()
    if user_id is not None:
        token = make_access_token(user_id, role)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def build_callers():
    return {
        "owner": build_client(OWNER_ID, UserRole.COMPANY),
        "other_company": build_client(OTHER_COMPANY_ID, UserRole.COMPANY),
        "student": build_client(OWNER_ID, UserRole.STUDENT),
        "university_admin": build_client(OWNER_ID, UserRole.UNIVERSITY_ADMIN),
        "anonymous": build_client(),
    }


def result_ids(response):
    return [item["id"] for item in response.data["results"]]


class OfferListTests(APITestCase):
    def setUp(self):
        self.list_url = reverse("offer-list")

    def test_list_returns_only_published_offers_for_every_caller(self):
        published = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED
        )
        create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        create_offer(company_user_id=OWNER_ID, status=OfferStatus.CLOSED)

        for name, client in build_callers().items():
            with self.subTest(caller=name):
                response = client.get(self.list_url)

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(result_ids(response), [str(published.id)])

    def test_list_is_paginated_and_newest_first(self):
        for index in range(12):
            create_offer(status=OfferStatus.PUBLISHED, title=f"Offer {index}")

        first_page = self.client.get(self.list_url)
        second_page = self.client.get(self.list_url, {"page": 2})
        small_page = self.client.get(self.list_url, {"page_size": 5})

        self.assertEqual(first_page.data["count"], 12)
        self.assertEqual(len(first_page.data["results"]), 10)
        self.assertIsNotNone(first_page.data["next"])
        self.assertEqual(len(second_page.data["results"]), 2)
        self.assertEqual(len(small_page.data["results"]), 5)
        first_titles = [item["title"] for item in first_page.data["results"]]
        second_titles = [item["title"] for item in second_page.data["results"]]
        self.assertEqual(
            first_titles,
            [f"Offer {index}" for index in range(11, 1, -1)],
        )
        self.assertEqual(second_titles, ["Offer 1", "Offer 0"])

    def test_search_matches_text_fields_case_insensitively(self):
        python_offer = create_offer(
            status=OfferStatus.PUBLISHED,
            title="Python Backend Internship",
            requirements="Django, SQL",
            location="Boumerdes",
        )
        java_offer = create_offer(
            status=OfferStatus.PUBLISHED,
            title="Java Developer",
            requirements="Spring Boot",
            location="Algiers",
        )

        cases = (
            ("PYTHON", [str(python_offer.id)]),
            ("spring", [str(java_offer.id)]),
            ("boumerdes", [str(python_offer.id)]),
            ("nomatchterm", []),
        )
        for term, expected_ids in cases:
            with self.subTest(term=term):
                response = self.client.get(self.list_url, {"search": term})

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(result_ids(response), expected_ids)

    def test_search_never_returns_non_published_offers(self):
        create_offer(status=OfferStatus.DRAFT, title="Python Draft")
        create_offer(status=OfferStatus.CLOSED, title="Python Closed")

        response = self.client.get(self.list_url, {"search": "python"})

        self.assertEqual(response.data["results"], [])

    def test_filters_by_location_requirements_and_company(self):
        python_offer = create_offer(
            status=OfferStatus.PUBLISHED,
            company_user_id=OWNER_ID,
            requirements="Django, SQL",
            location="Boumerdes",
        )
        java_offer = create_offer(
            status=OfferStatus.PUBLISHED,
            company_user_id=OTHER_COMPANY_ID,
            requirements="Spring Boot",
            location="Algiers",
        )

        cases = (
            ({"location": "BOUM"}, [str(python_offer.id)]),
            ({"requirements": "spring"}, [str(java_offer.id)]),
            ({"company_user_id": OTHER_COMPANY_ID}, [str(java_offer.id)]),
            ({"location": "algiers", "requirements": "django"}, []),
            ({"location": "algiers", "company_user_id": OTHER_COMPANY_ID}, [str(java_offer.id)]),
        )
        for params, expected_ids in cases:
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(result_ids(response), expected_ids)

    def test_invalid_company_user_id_returns_400(self):
        for value in ("abc", "-1", "99999999999999999999"):
            with self.subTest(value=value):
                response = self.client.get(
                    self.list_url, {"company_user_id": value}
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("company_user_id", response.data)

    def test_invalid_token_returns_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        response = client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unsupported_methods_are_not_allowed_on_list(self):
        client = build_client(OWNER_ID, UserRole.COMPANY)

        for method in (client.put, client.patch, client.delete):
            with self.subTest(method=method.__name__):
                response = method(self.list_url, {}, format="json")

                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )


class OfferDetailTests(APITestCase):
    def detail_url(self, offer_id):
        return reverse("offer-detail", kwargs={"pk": offer_id})

    def test_published_offer_is_visible_to_every_caller(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        for name, client in build_callers().items():
            with self.subTest(caller=name):
                response = client.get(self.detail_url(offer.id))

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["id"], str(offer.id))

    def test_draft_and_closed_offers_are_visible_only_to_owner(self):
        for offer_status in (OfferStatus.DRAFT, OfferStatus.CLOSED):
            offer = create_offer(company_user_id=OWNER_ID, status=offer_status)

            for name, client in build_callers().items():
                with self.subTest(status=offer_status, caller=name):
                    response = client.get(self.detail_url(offer.id))

                    expected_status = (
                        status.HTTP_200_OK
                        if name == "owner"
                        else status.HTTP_404_NOT_FOUND
                    )
                    self.assertEqual(response.status_code, expected_status)

    def test_non_existent_offer_returns_404(self):
        for name, client in build_callers().items():
            with self.subTest(caller=name):
                response = client.get(self.detail_url(uuid.uuid4()))

                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_token_returns_401(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

        response = client.get(self.detail_url(offer.id))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unsupported_methods_are_not_allowed_on_detail(self):
        offer = create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)
        client = build_client(OWNER_ID, UserRole.COMPANY)

        for method in (client.put, client.delete):
            with self.subTest(method=method.__name__):
                response = method(self.detail_url(offer.id))

                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )
