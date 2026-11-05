from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from offers.models import Offer, OfferStatus
from offers.permissions import UserRole
from offers.test_permissions import OTHER_COMPANY_ID, OWNER_ID
from offers.test_serializers import create_offer
from offers.test_views import build_client, result_ids


class MineListingTests(APITestCase):
    def setUp(self):
        self.url = reverse("offer-list")
        self.owner = build_client(OWNER_ID, UserRole.COMPANY)

    def test_company_sees_own_offers_of_every_status_only(self):
        own = [
            create_offer(company_user_id=OWNER_ID, status=s)
            for s in OfferStatus.values
        ]
        for s in OfferStatus.values:
            create_offer(company_user_id=OTHER_COMPANY_ID, status=s)

        response = self.owner.get(self.url, {"mine": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(result_ids(response)), {str(o.id) for o in own})

    def test_status_filter_with_mine(self):
        draft = create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)
        create_offer(company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED)

        response = self.owner.get(self.url, {"mine": "true", "status": "draft"})

        self.assertEqual(result_ids(response), [str(draft.id)])

    def test_mine_requires_authentication(self):
        response = build_client().get(self.url, {"mine": "true"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mine_rejects_non_company_roles(self):
        client = build_client(OWNER_ID, UserRole.STUDENT)
        response = client.get(self.url, {"mine": "true"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mine_rejects_invalid_value(self):
        response = self.owner.get(self.url, {"mine": "maybe"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mine_false_keeps_public_behaviour(self):
        published = create_offer(
            company_user_id=OWNER_ID, status=OfferStatus.PUBLISHED
        )
        create_offer(company_user_id=OWNER_ID, status=OfferStatus.DRAFT)

        response = self.owner.get(self.url, {"mine": "false"})

        self.assertEqual(result_ids(response), [str(published.id)])

    def test_public_list_never_exposes_non_published_via_status(self):
        create_offer(status=OfferStatus.DRAFT)
        response = self.client.get(self.url, {"status": "draft"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(result_ids(response), [])

    def test_invalid_status_is_rejected(self):
        response = self.client.get(self.url, {"status": "archived"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mine_is_paginated(self):
        for i in range(12):
            create_offer(company_user_id=OWNER_ID, title=f"Offer {i}")

        response = self.owner.get(self.url, {"mine": "true"})

        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 10)


class OrderingAndDeadlineTests(APITestCase):
    def setUp(self):
        self.url = reverse("offer-list")
        now = timezone.now()
        self.a = create_offer(
            status=OfferStatus.PUBLISHED, deadline=now + timedelta(days=10)
        )
        self.b = create_offer(
            status=OfferStatus.PUBLISHED, deadline=now + timedelta(days=20)
        )
        self.c = create_offer(
            status=OfferStatus.PUBLISHED, deadline=now + timedelta(days=30)
        )
        for offset, offer in enumerate((self.a, self.b, self.c)):
            Offer.objects.filter(pk=offer.pk).update(
                created_at=now - timedelta(days=3 - offset)
            )

    def ids(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return result_ids(response)

    def test_ordering_by_deadline(self):
        self.assertEqual(
            self.ids(ordering="deadline"),
            [str(self.a.id), str(self.b.id), str(self.c.id)],
        )
        self.assertEqual(
            self.ids(ordering="-deadline"),
            [str(self.c.id), str(self.b.id), str(self.a.id)],
        )

    def test_ordering_by_created_at(self):
        self.assertEqual(
            self.ids(ordering="created_at"),
            [str(self.a.id), str(self.b.id), str(self.c.id)],
        )
        self.assertEqual(
            self.ids(ordering="-created_at"),
            [str(self.c.id), str(self.b.id), str(self.a.id)],
        )

    def test_invalid_ordering_is_rejected(self):
        for value in ("title", "--deadline", "capacity", "deadline,id"):
            with self.subTest(value=value):
                response = self.client.get(self.url, {"ordering": value})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deadline_after_with_datetime_is_strict(self):
        self.assertEqual(
            set(self.ids(deadline_after=self.b.deadline.isoformat())),
            {str(self.c.id)},
        )

    def test_deadline_after_with_date(self):
        cutoff = (self.b.deadline - timedelta(days=1)).date().isoformat()
        self.assertEqual(
            set(self.ids(deadline_after=cutoff)),
            {str(self.b.id), str(self.c.id)},
        )

    def test_invalid_deadline_after_is_rejected(self):
        for value in ("tomorrow", "2026-13-45"):
            with self.subTest(value=value):
                response = self.client.get(self.url, {"deadline_after": value})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)