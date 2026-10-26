from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from offers.models import Offer, OfferStatus


def build_offer_data(**overrides):
    data = {
        "company_user_id": 1,
        "title": "Backend Internship",
        "description": "Work on Django microservices.",
        "requirements": "Python, Django, SQL.",
        "location": "Boumerdès",
        "deadline": timezone.now() + timedelta(days=30),
        "capacity": 3,
    }
    data.update(overrides)
    return data


class OfferModelTests(TestCase):
    def test_create_offer_sets_defaults_and_timestamps(self):
        offer = Offer.objects.create(**build_offer_data())

        self.assertIsNotNone(offer.id)
        self.assertEqual(offer.status, OfferStatus.DRAFT)
        self.assertIsNotNone(offer.created_at)
        self.assertIsNotNone(offer.updated_at)

    def test_updated_at_changes_on_save(self):
        offer = Offer.objects.create(**build_offer_data())
        previous_updated_at = offer.updated_at

        offer.title = "Updated Title"
        offer.save()
        offer.refresh_from_db()

        self.assertGreater(offer.updated_at, previous_updated_at)

    def test_company_user_id_is_a_plain_field(self):
        field = Offer._meta.get_field("company_user_id")

        self.assertFalse(field.is_relation)

    def test_database_rejects_zero_capacity(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Offer.objects.create(**build_offer_data(capacity=0))

    def test_database_rejects_invalid_status(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Offer.objects.create(**build_offer_data(status="archived"))

    def test_full_clean_rejects_zero_capacity(self):
        offer = Offer(**build_offer_data(capacity=0))

        with self.assertRaises(ValidationError) as context:
            offer.full_clean()

        self.assertIn("capacity", context.exception.message_dict)

    def test_full_clean_rejects_blank_required_fields(self):
        offer = Offer(
            **build_offer_data(
                title="",
                description="",
                requirements="",
                location="",
            )
        )

        with self.assertRaises(ValidationError) as context:
            offer.full_clean()

        for field_name in ("title", "description", "requirements", "location"):
            self.assertIn(field_name, context.exception.message_dict)
