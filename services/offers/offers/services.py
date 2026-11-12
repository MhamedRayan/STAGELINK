from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from offers.applications_client import ApplicationsUnavailable, get_offer_capacity
from offers.exceptions import CapacityLookupUnavailable, OfferStateConflict
from offers.models import Offer, OfferStatus

REQUIRED_TEXT_FIELDS = ("title", "description", "requirements", "location")

# Fields that identify the offer to applicants and cannot change once published.
PUBLISHED_LOCKED_FIELDS = ("title", "location")


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


def ensure_capacity_change_allowed(offer, new_capacity):
    """Allow increases and safe reductions; never drop below committed places.

    Applications owns reservations and exposes the committed-places snapshot.
    If that snapshot cannot be read, the reduction fails closed with 503 instead
    of risking overbooking.
    """
    if new_capacity is None or offer.status != OfferStatus.PUBLISHED:
        return
    if new_capacity >= offer.capacity:
        return

    try:
        snapshot = get_offer_capacity(offer.pk)
    except ApplicationsUnavailable as exc:
        raise CapacityLookupUnavailable() from exc

    committed = snapshot["committed"]
    if new_capacity < committed:
        raise OfferStateConflict(
            f"Capacity cannot be reduced below {committed} committed place(s).",
            code="capacity_below_committed",
        )


def ensure_published_edit_allowed(offer, validated_data):
    """Reject changes to locked fields while an offer is published.

    Sending the current value again is accepted, so clients may resend a form.
    """
    if offer.status != OfferStatus.PUBLISHED:
        return
    locked = [
        field_name
        for field_name in PUBLISHED_LOCKED_FIELDS
        if field_name in validated_data
        and validated_data[field_name] != getattr(offer, field_name)
    ]
    if locked:
        raise OfferStateConflict(
            f"These fields cannot be changed while the offer is published: "
            f"{', '.join(locked)}.",
            code="field_locked_while_published",
        )


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


@transaction.atomic
def close_expired_offers(now=None):
    """Close every published offer whose deadline has passed.

    Idempotent: only published offers are touched, so running it repeatedly
    (for example from a scheduler) is safe. Returns the number of closed offers.
    """
    now = now or timezone.now()
    return Offer.objects.filter(
        status=OfferStatus.PUBLISHED, deadline__lte=now
    ).update(status=OfferStatus.CLOSED, updated_at=now)


@transaction.atomic
def delete_draft_offer(offer_id):
    """Soft delete a draft offer. Published and closed offers are kept."""
    offer = Offer.objects.select_for_update().get(
        pk=offer_id, deleted_at__isnull=True
    )

    if offer.status != OfferStatus.DRAFT:
        raise OfferStateConflict("Only draft offers can be deleted.")

    offer.deleted_at = timezone.now()
    offer.save(update_fields=["deleted_at", "updated_at"])
    return offer