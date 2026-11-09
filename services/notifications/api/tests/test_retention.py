import uuid
from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from api.models import Notification


def _create_notification(*, created_days_ago=0, read_days_ago=None):
    now = timezone.now()
    notification = Notification.objects.create(
        recipient_user_id=uuid.uuid4(),
        type=Notification.Type.GENERIC,
        title="Retention test",
        message="Retention test",
        related_object_type="test",
        related_object_id=str(uuid.uuid4()),
        deduplication_key=f"retention:{uuid.uuid4()}",
    )
    Notification.objects.filter(pk=notification.pk).update(
        created_at=now - timedelta(days=created_days_ago)
    )
    if read_days_ago is not None:
        Notification.objects.filter(pk=notification.pk).update(
            read_at=now - timedelta(days=read_days_ago)
        )
    notification.refresh_from_db()
    return notification


class PurgeNotificationsCommandTests(TestCase):
    def _run(self, *args):
        output = StringIO()
        call_command("purge_notifications", *args, stdout=output)
        return output.getvalue()

    def test_deletes_old_read_notifications(self):
        old_read = _create_notification(created_days_ago=100, read_days_ago=100)
        recent = _create_notification(created_days_ago=1)

        self._run("--older-than-days", "30", "--hard-delete-after-days", "365")

        self.assertFalse(Notification.objects.filter(pk=old_read.pk).exists())
        self.assertTrue(Notification.objects.filter(pk=recent.pk).exists())

    def test_keeps_old_unread_notifications_until_the_hard_limit(self):
        old_unread = _create_notification(created_days_ago=100)

        self._run("--older-than-days", "30", "--hard-delete-after-days", "365")
        self.assertTrue(Notification.objects.filter(pk=old_unread.pk).exists())

        self._run("--older-than-days", "30", "--hard-delete-after-days", "50")
        self.assertFalse(Notification.objects.filter(pk=old_unread.pk).exists())

    def test_dry_run_reports_without_deleting(self):
        old_read = _create_notification(created_days_ago=100, read_days_ago=100)

        output = self._run(
            "--older-than-days",
            "30",
            "--hard-delete-after-days",
            "365",
            "--dry-run",
        )

        self.assertTrue(Notification.objects.filter(pk=old_read.pk).exists())
        self.assertIn("Would delete", output)

    def test_hard_limit_must_not_be_below_the_read_limit(self):
        with self.assertRaises(CommandError):
            self._run("--older-than-days", "30", "--hard-delete-after-days", "10")

    def test_non_positive_windows_are_rejected(self):
        with self.assertRaises(CommandError):
            self._run("--older-than-days", "0")

        with self.assertRaises(CommandError):
            self._run("--hard-delete-after-days", "0")
