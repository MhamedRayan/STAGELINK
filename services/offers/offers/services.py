from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from offers.exceptions import OfferStateConflict
from offers.models import Offer, OfferStatus

REQUIRED_TEXT_FIELDS = ("title", "description", "requirements", "location")


def _get_publish_errors(offer):
    errors = {}

    for field_name in REQUIRED_TEXT_FIELDS:
        if not str(getattr(offer, field_name) or "").strip():
            errors[field_name] = "This field is required to publish an offer."

    if offer.capacity is None or offer.capacity < 1:
        errors["capacity"] = "Capacity must be at least 1 to publish an offer."

    if offer.deadline is None:
        errors["deadline"] = "This field is required to publish an offer."
    elif offer.deadline <= timezone.now():
        errors["deadline"] = "Deadline must be in the future to publish an offer."

    return errors


def ensure_offer_is_editable(offer):
    if offer.status == OfferStatus.CLOSED:
        raise OfferStateConflict("Closed offers cannot be edited.")


@transaction.atomic
def publish_offer(offer_id):
    offer = Offer.objects.select_for_update().get(pk=offer_id)

    if offer.status != OfferStatus.DRAFT:
        raise OfferStateConflict("Only draft offers can be published.")

    errors = _get_publish_errors(offer)
    if errors:
        raise ValidationError(errors)

    offer.status = OfferStatus.PUBLISHED
    offer.save(update_fields=["status", "updated_at"])
    return offer


@transaction.atomic
def close_offer(offer_id):
    offer = Offer.objects.select_for_update().get(pk=offer_id)

    if offer.status != OfferStatus.PUBLISHED:
        raise OfferStateConflict("Only published offers can be closed.")

    offer.status = OfferStatus.CLOSED
    offer.save(update_fields=["status", "updated_at"])
    return offer
