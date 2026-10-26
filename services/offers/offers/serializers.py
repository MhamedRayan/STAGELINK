from django.utils import timezone
from rest_framework import serializers

from offers.models import Offer

OFFER_READ_FIELDS = (
    "id",
    "company_user_id",
    "title",
    "description",
    "requirements",
    "location",
    "deadline",
    "capacity",
    "status",
    "created_at",
    "updated_at",
)

OFFER_WRITE_FIELDS = (
    "title",
    "description",
    "requirements",
    "location",
    "deadline",
    "capacity",
)


class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = OFFER_READ_FIELDS
        read_only_fields = OFFER_READ_FIELDS


class OfferCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = OFFER_WRITE_FIELDS

    def validate_deadline(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value
