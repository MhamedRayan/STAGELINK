from datetime import timedelta
import uuid

from django.test import TestCase
from django.utils import timezone

from offers.models import Offer, OfferStatus
from offers.serializers import (
    OFFER_READ_FIELDS,
    OfferCreateUpdateSerializer,
    OfferSerializer,
)


def build_payload(**overrides):
    payload = {
        "title": "Backend Internship",
        "description": "Work on Django microservices.",
        "requirements": "Python, Django, SQL.",
        "location": "Boumerdès",
        "deadline": timezone.now() + timedelta(days=30),
        "capacity": 3,
    }
    payload.update(overrides)
    return payload


def create_offer(**overrides):
    data = build_payload(**overrides)
    data.setdefault("company_user_id", uuid.uuid4())
    return Offer.objects.create(**data)


class OfferCreateUpdateSerializerValidationTests(TestCase):
    def test_valid_payload_is_accepted(self):
        serializer = OfferCreateUpdateSerializer(data=build_payload())

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_missing_required_fields_are_rejected(self):
        for field_name in build_payload():
            with self.subTest(field=field_name):
                payload = build_payload()
                del payload[field_name]
                serializer = OfferCreateUpdateSerializer(data=payload)

                self.assertFalse(serializer.is_valid())
                self.assertIn(field_name, serializer.errors)

    def test_blank_and_whitespace_text_fields_are_rejected(self):
        for field_name in ("title", "description", "requirements", "location"):
            for blank_value in ("", "   "):
                with self.subTest(field=field_name, value=blank_value):
                    serializer = OfferCreateUpdateSerializer(
                        data=build_payload(**{field_name: blank_value})
                    )

                    self.assertFalse(serializer.is_valid())
                    self.assertIn(field_name, serializer.errors)

    def test_title_longer_than_max_length_is_rejected(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(title="a" * 201)
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_location_longer_than_max_length_is_rejected(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(location="a" * 256)
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("location", serializer.errors)

    def test_past_deadline_is_rejected(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(deadline=timezone.now() - timedelta(minutes=1))
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("deadline", serializer.errors)

    def test_future_deadline_is_accepted(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(deadline=timezone.now() + timedelta(minutes=5))
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_deadline_format_is_rejected(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(deadline="not-a-date")
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("deadline", serializer.errors)

    def test_non_positive_capacity_is_rejected(self):
        for capacity in (0, -1):
            with self.subTest(capacity=capacity):
                serializer = OfferCreateUpdateSerializer(
                    data=build_payload(capacity=capacity)
                )

                self.assertFalse(serializer.is_valid())
                self.assertIn("capacity", serializer.errors)

    def test_non_integer_capacity_is_rejected(self):
        for capacity in ("abc", 2.5):
            with self.subTest(capacity=capacity):
                serializer = OfferCreateUpdateSerializer(
                    data=build_payload(capacity=capacity)
                )

                self.assertFalse(serializer.is_valid())
                self.assertIn("capacity", serializer.errors)

    def test_minimum_capacity_is_accepted(self):
        serializer = OfferCreateUpdateSerializer(data=build_payload(capacity=1))

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_system_fields_in_payload_are_ignored(self):
        serializer = OfferCreateUpdateSerializer(
            data=build_payload(
                id=uuid.uuid4(),
                company_user_id=uuid.uuid4(),
                status=OfferStatus.PUBLISHED,
            )
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        for field_name in ("id", "company_user_id", "status"):
            self.assertNotIn(field_name, serializer.validated_data)


class OfferCreateUpdateSerializerPartialUpdateTests(TestCase):
    def test_partial_update_without_deadline_is_accepted_for_expired_offer(self):
        offer = create_offer(deadline=timezone.now() - timedelta(days=1))
        serializer = OfferCreateUpdateSerializer(
            offer, data={"title": "New Title"}, partial=True
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_partial_update_with_past_deadline_is_rejected(self):
        offer = create_offer()
        serializer = OfferCreateUpdateSerializer(
            offer,
            data={"deadline": timezone.now() - timedelta(days=1)},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("deadline", serializer.errors)

    def test_partial_update_with_invalid_capacity_is_rejected(self):
        offer = create_offer()
        serializer = OfferCreateUpdateSerializer(
            offer, data={"capacity": 0}, partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("capacity", serializer.errors)

    def test_update_does_not_change_status_or_owner(self):
        owner_id = uuid.uuid4()
        offer = create_offer(company_user_id=owner_id)
        serializer = OfferCreateUpdateSerializer(
            offer,
            data={
                "title": "Changed Title",
                "status": OfferStatus.CLOSED,
                "company_user_id": uuid.uuid4(),
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        offer.refresh_from_db()

        self.assertEqual(offer.title, "Changed Title")
        self.assertEqual(offer.status, OfferStatus.DRAFT)
        self.assertEqual(offer.company_user_id, owner_id)


class OfferSerializerTests(TestCase):
    def test_output_contains_all_offer_fields(self):
        offer = create_offer()

        data = OfferSerializer(offer).data

        self.assertEqual(set(data.keys()), set(OFFER_READ_FIELDS))

    def test_all_fields_are_read_only(self):
        serializer = OfferSerializer()

        for field_name, field in serializer.fields.items():
            with self.subTest(field=field_name):
                self.assertTrue(field.read_only)
