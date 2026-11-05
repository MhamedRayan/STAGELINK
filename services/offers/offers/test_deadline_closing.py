from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from offers.models import Offer, OfferStatus
from offers.services import close_expired_offers
from offers.test_serializers import create_offer


def make_expired(offer, hours=1):
    # Bypass serializer validation, which forbids past deadlines.
    Offer.objects.filter(pk=offer.pk).update(
        deadline=timezone.now() - timedelta(hours=hours)
    )


class CloseExpiredOffersTests(TestCase):
    def test_expired_published_offer_is_closed(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        make_expired(offer)

        self.assertEqual(close_expired_offers(), 1)

        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.CLOSED)

    def test_future_published_offer_is_untouched(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)

        self.assertEqual(close_expired_offers(), 0)

        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.PUBLISHED)

    def test_draft_and_closed_offers_are_untouched(self):
        draft = create_offer(status=OfferStatus.DRAFT)
        closed = create_offer(status=OfferStatus.CLOSED)
        make_expired(draft)
        make_expired(closed)

        self.assertEqual(close_expired_offers(), 0)

        draft.refresh_from_db()
        closed.refresh_from_db()
        self.assertEqual(draft.status, OfferStatus.DRAFT)
        self.assertEqual(closed.status, OfferStatus.CLOSED)

    def test_deadline_equal_to_now_is_closed(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        now = timezone.now()
        Offer.objects.filter(pk=offer.pk).update(deadline=now)

        self.assertEqual(close_expired_offers(now=now), 1)

    def test_is_idempotent(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        make_expired(offer)

        self.assertEqual(close_expired_offers(), 1)
        self.assertEqual(close_expired_offers(), 0)

    def test_updated_at_is_refreshed(self):
        offer = create_offer(status=OfferStatus.PUBLISHED)
        make_expired(offer)
        before = Offer.objects.get(pk=offer.pk).updated_at

        close_expired_offers()

        self.assertGreater(Offer.objects.get(pk=offer.pk).updated_at, before)

    def test_management_command_reports_count(self):
        for _ in range(2):
            make_expired(create_offer(status=OfferStatus.PUBLISHED))
        out = StringIO()

        call_command("close_expired_offers", stdout=out)

        self.assertIn("Closed 2 expired offer(s).", out.getvalue())