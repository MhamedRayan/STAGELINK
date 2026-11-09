import threading
import unittest
import uuid
from unittest.mock import patch

from django.db import connection, transaction
from django.test import TestCase, TransactionTestCase

from .errors import BusinessError
from .models import OfferReservation
from .services import (
    occupy_place,
    offer_capacity_snapshot,
    release_occupied_place,
    release_reserved_place,
    reserve_place,
)


class ReservationServiceTests(TestCase):
    def setUp(self):
        self.offer_id = uuid.uuid4()

    def test_reserve_creates_the_row_with_the_offer_capacity(self):
        reservation = reserve_place(self.offer_id, 3)
        self.assertEqual(reservation.capacity, 3)
        self.assertEqual(reservation.reserved, 1)
        self.assertEqual(reservation.occupied, 0)

    def test_capacity_is_raised_but_never_lowered(self):
        reserve_place(self.offer_id, 2)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).capacity, 2
        )

        reserve_place(self.offer_id, 5)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).capacity, 5
        )

        reserve_place(self.offer_id, 1)
        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).capacity, 5
        )

    def test_reserve_fails_when_capacity_is_reached(self):
        reserve_place(self.offer_id, 1)

        with self.assertRaises(BusinessError) as caught:
            reserve_place(self.offer_id, 1)

        self.assertEqual(caught.exception.code, 'CAPACITY_FULL')
        self.assertEqual(caught.exception.status_code, 409)

    def test_occupy_moves_one_place_from_reserved_to_occupied(self):
        reserve_place(self.offer_id, 2)

        occupy_place(self.offer_id)

        reservation = OfferReservation.objects.get(offer_id=self.offer_id)
        self.assertEqual(reservation.reserved, 0)
        self.assertEqual(reservation.occupied, 1)

    def test_release_reserved_never_goes_negative(self):
        release_reserved_place(self.offer_id)
        self.assertFalse(
            OfferReservation.objects.filter(offer_id=self.offer_id).exists()
        )

        reserve_place(self.offer_id, 2)
        release_reserved_place(self.offer_id)
        release_reserved_place(self.offer_id)

        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).reserved, 0
        )

    def test_release_occupied_never_goes_negative(self):
        release_occupied_place(self.offer_id)
        reserve_place(self.offer_id, 2)
        occupy_place(self.offer_id)
        release_occupied_place(self.offer_id)
        release_occupied_place(self.offer_id)

        self.assertEqual(
            OfferReservation.objects.get(offer_id=self.offer_id).occupied, 0
        )

    def test_snapshot_returns_available_places(self):
        reserve_place(self.offer_id, 3)
        reserve_place(self.offer_id, 3)
        occupy_place(self.offer_id)

        snapshot = offer_capacity_snapshot(self.offer_id)

        self.assertEqual(snapshot['capacity'], 3)
        self.assertEqual(snapshot['reserved'], 1)
        self.assertEqual(snapshot['occupied'], 1)
        self.assertEqual(snapshot['committed'], 2)
        self.assertEqual(snapshot['available'], 1)


@unittest.skipUnless(
    connection.vendor == 'postgresql',
    'Row-level concurrency is only meaningful on PostgreSQL.',
)
class ReservationConcurrencyTests(TransactionTestCase):
    """Two simultaneous accepts must never oversubscribe an offer."""

    reset_sequences = True

    def test_concurrent_reservations_never_exceed_capacity(self):
        offer_id = uuid.uuid4()
        barrier = threading.Barrier(2)
        outcomes = []
        errors = []

        def worker():
            try:
                barrier.wait(timeout=5)
                with transaction.atomic():
                    reserve_place(offer_id, 1)
                outcomes.append('reserved')
            except BusinessError as exc:
                outcomes.append(exc.code)
            except Exception as exc:  # pragma: no cover - surfaced below
                errors.append(exc)
            finally:
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertEqual(sorted(outcomes), ['CAPACITY_FULL', 'reserved'])
        self.assertEqual(
            OfferReservation.objects.get(offer_id=offer_id).reserved, 1
        )
