from rest_framework import serializers

from .models import Notification


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
            "recipient_user_id": {"min_value": 1},
            # The default unique validator would answer 400 on a repeated key.
            # A repeated key is a normal retry and is handled in the view (200).
            "deduplication_key": {"validators": []},
        }
