from django.contrib import admin
from django.test import RequestFactory, SimpleTestCase

from api.admin import NotificationAdmin
from api.models import Notification


class NotificationAdminTests(SimpleTestCase):
    def test_notification_is_registered(self):
        model_admin = admin.site._registry.get(Notification)

        self.assertIsInstance(model_admin, NotificationAdmin)

    def test_admin_is_read_only(self):
        model_admin = NotificationAdmin(Notification, admin.site)
        request = RequestFactory().get("/admin/")

        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request))

    def test_list_display_marks_read_state(self):
        model_admin = NotificationAdmin(Notification, admin.site)

        self.assertIn("is_read", model_admin.list_display)
        self.assertFalse(model_admin.is_read(Notification(read_at=None)))
