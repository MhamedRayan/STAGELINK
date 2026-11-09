"""Retry applications stuck in STUDENT_ACCEPTED (P1-5).

A student acceptance commits STUDENT_ACCEPTED before calling Internships. If
that call fails transiently (timeout, connection error, 5xx) the application is
left in STUDENT_ACCEPTED and this command retries it. The Internships endpoint
is idempotent per source application, so a retry never creates a second row.

Run it from a scheduler, for example every five minutes:

    python manage.py reconcile_confirmed_applications --limit 100
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from applications.models import Application, ApplicationStatus
from applications.services import reconcile_accepted_application


class Command(BaseCommand):
    help = "Retry STUDENT_ACCEPTED applications that never reached CONFIRMED."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Maximum number of applications to process in one run.",
        )
        parser.add_argument(
            "--older-than",
            type=int,
            default=0,
            help="Only process applications updated more than N seconds ago.",
        )

    def handle(self, *args, **options):
        limit = max(1, options["limit"])
        cutoff = timezone.now() - timezone.timedelta(seconds=options["older_than"])
        queryset = (
            Application.objects.filter(
                status=ApplicationStatus.STUDENT_ACCEPTED,
                updated_at__lte=cutoff,
            )
            .order_by("updated_at")
            .values_list("pk", flat=True)[:limit]
        )

        counts = {"confirmed": 0, "reverted": 0, "retry": 0, "skipped": 0}
        for application_id in list(queryset):
            outcome = reconcile_accepted_application(application_id)
            counts[outcome] = counts.get(outcome, 0) + 1

        self.stdout.write(
            "Reconciled {total} application(s): "
            "{confirmed} confirmed, {reverted} reverted, "
            "{retry} still retrying, {skipped} skipped.".format(
                total=sum(counts.values()),
                **counts,
            )
        )
