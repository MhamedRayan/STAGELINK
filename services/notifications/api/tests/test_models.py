from django.db import IntegrityError, transaction
from django.test import TestCase

from api.models import Notification


def _build_notification(deduplication_key="application:1:validated:recipient:42", **overrides):
    data = {
        "recipient_user_id": 42,
        "type": Notification.Type.APPLICATION_VALIDATED,
        "title": "Application validated",
        "message": "You can now accept or decline.",
        "related_object_type": "application",
        "related_object_id": "1",
        "deduplication_key": deduplication_key,
    }
    data.update(overrides)
    return Notification.objects.create(**data)


class NotificationModelTests(TestCase):
    def test_new_notification_is_unread(self):
        notification = _build_notification()

        self.assertIsNone(notification.read_at)
        self.assertIsNotNone(notification.created_at)

    def test_deduplication_key_must_be_unique(self):
        _build_notification()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _build_notification()

    def test_same_event_for_different_recipients_is_allowed(self):
        _build_notification("application:1:rejected:recipient:42", recipient_user_id=42)
        _build_notification("application:1:rejected:recipient:77", recipient_user_id=77)

        self.assertEqual(Notification.objects.count(), 2)
