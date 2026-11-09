from rest_framework import serializers

from .models import Notification


class UUIDStringField(serializers.UUIDField):
    """Accept only the canonical string form.

    JSON has no UUID type, so callers must send UUIDs as strings. DRF's
    default UUIDField also accepts integers and treats them as UUID integers,
    which would let a bare `42` through as `00000000-0000-0000-0000-00000000002a`.
    """

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid", value=data)
        return super().to_internal_value(data)


class NotificationSerializer(serializers.ModelSerializer):
    """Read-only representation of a notification for its recipient."""

    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "message",
            "related_object_type",
            "related_object_id",
            "is_read",
            "created_at",
            "read_at",
        ]
        read_only_fields = fields

    def get_is_read(self, notification) -> bool:
        return notification.read_at is not None


class InternalNotificationCreateSerializer(serializers.ModelSerializer):
    """Validates the body sent by other services to create a notification."""

    recipient_user_id = UUIDStringField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient_user_id",
            "type",
            "title",
            "message",
            "related_object_type",
            "related_object_id",
            "deduplication_key",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            # The default unique validator would answer 400 on a repeated key.
            # A repeated key is a normal retry and is handled in the view (200).
            "deduplication_key": {"validators": []},
        }
