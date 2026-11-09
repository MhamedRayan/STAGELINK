from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-only operations view for support and debugging.

    Notifications are created by other services through the internal API, so
    the admin is intentionally read-only except for marking a notification as
    read/unread (a support action that does not change the event itself).
    """

    list_display = (
        "id",
        "recipient_user_id",
        "type",
        "title",
        "related_object_type",
        "is_read",
        "created_at",
    )
    list_filter = ("type", "related_object_type", "read_at")
    search_fields = (
        "id",
        "recipient_user_id",
        "title",
        "message",
        "related_object_id",
        "deduplication_key",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at", "-id")
    list_select_related = False
    readonly_fields = (
        "id",
        "recipient_user_id",
        "type",
        "title",
        "message",
        "related_object_type",
        "related_object_id",
        "deduplication_key",
        "created_at",
        "read_at",
    )

    @admin.display(boolean=True, description="Read")
    def is_read(self, notification):
        return notification.read_at is not None

    def has_add_permission(self, request):
        # Events must come from trusted services, never from the admin.
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
