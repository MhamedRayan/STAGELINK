"""Delete notifications that have outlived the retention policy.

Usage::

    python manage.py purge_notifications --dry-run
    python manage.py purge_notifications --older-than-days 90
    python manage.py purge_notifications --hard-delete-after-days 730

The command is safe to run from cron or a Kubernetes ``CronJob``: it only
deletes rows, never changes a notification's content, and reports what it did.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from api.models import Notification


class Command(BaseCommand):
    help = "Delete read notifications older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-days",
            type=int,
            default=settings.NOTIFICATION_RETENTION_DAYS,
            help=(
                "Delete read notifications whose read_at is older than this "
                "many days (default: %(default)s)."
            ),
        )
        parser.add_argument(
            "--hard-delete-after-days",
            type=int,
            default=settings.NOTIFICATION_HARD_RETENTION_DAYS,
            help=(
                "Delete every notification created more than this many days "
                "ago, regardless of read state (default: %(default)s)."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many rows would be deleted without deleting them.",
        )

    def handle(self, *args, **options):
        read_days = options["older_than_days"]
        hard_days = options["hard_delete_after_days"]
        dry_run = options["dry_run"]

        if read_days < 1:
            raise CommandError("--older-than-days must be at least 1.")
        if hard_days < 1:
            raise CommandError("--hard-delete-after-days must be at least 1.")
        if hard_days < read_days:
            raise CommandError(
                "--hard-delete-after-days must be greater than or equal to "
                "--older-than-days."
            )

        now = timezone.now()
        hard_cutoff = now - timedelta(days=hard_days)
        read_cutoff = now - timedelta(days=read_days)

        hard_queryset = Notification.objects.filter(created_at__lt=hard_cutoff)
        hard_count = hard_queryset.count()

        if dry_run:
            read_count = (
                Notification.objects.filter(
                    read_at__isnull=False,
                    read_at__lt=read_cutoff,
                )
                .exclude(pk__in=hard_queryset.values("pk"))
                .count()
            )
        else:
            hard_queryset.delete()
            read_count = Notification.objects.filter(
                read_at__isnull=False,
                read_at__lt=read_cutoff,
            ).delete()[0]

        prefix = "Would delete" if dry_run else "Deleted"
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix} {hard_count} notification(s) past the hard "
                f"retention limit ({hard_days} days) and {read_count} read "
                f"notification(s) past {read_days} days."
            )
        )
