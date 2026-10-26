from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Notification

READ_ALL_URL = "/api/notifications/read-all/"


def _create_notification(recipient_user_id, deduplication_key, read_at=None):
    return Notification.objects.create(
        recipient_user_id=recipient_user_id,
        type=Notification.Type.GENERIC,
        title="Title",
        message="Message",
        deduplication_key=deduplication_key,
        read_at=read_at,
    )


@override_settings(DEV_AUTH_ENABLED=True)
class ReadAllTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.api_client.credentials(HTTP_X_USER_ID="42")

    def test_requires_authentication(self):
        response = APIClient().post(READ_ALL_URL)

        self.assertEqual(response.status_code, 401)

    def test_marks_only_the_callers_unread_notifications(self):
        _create_notification(42, "own-1")
        _create_notification(42, "own-2")
        other = _create_notification(77, "other-1")

        response = self.api_client.post(READ_ALL_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"marked_read": 2})
        self.assertEqual(Notification.objects.filter(recipient_user_id=42, read_at__isnull=True).count(), 0)
        other.refresh_from_db()
        self.assertIsNone(other.read_at)

    def test_second_call_changes_nothing(self):
        _create_notification(42, "own-1")
        self.api_client.post(READ_ALL_URL)

        response = self.api_client.post(READ_ALL_URL)

        self.assertEqual(response.json(), {"marked_read": 0})

    def test_keeps_the_original_read_at_of_already_read_notifications(self):
        earlier = timezone.now() - timezone.timedelta(days=1)
        already_read = _create_notification(42, "own-read", read_at=earlier)
        _create_notification(42, "own-unread")

        self.api_client.post(READ_ALL_URL)

        already_read.refresh_from_db()
        self.assertEqual(already_read.read_at, earlier)
