from django.core.management.base import BaseCommand

from internships.models import Internship, InternshipStatus
from internships.services import deliver_place_release


class Command(BaseCommand):
    help = (
        "Retry place release for cancelled internships whose place has not been "
        "released yet. Safe to run repeatedly; the Applications endpoint is idempotent."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Maximum number of internships to process in this run (default: 100).",
        )

    def handle(self, *args, **options):
        limit = max(0, options["limit"])
        pending = Internship.objects.filter(
            status=InternshipStatus.CANCELLED,
            place_released_at__isnull=True,
        ).order_by("pk")[:limit]

        released = 0
        failed = 0
        for internship in pending:
            if deliver_place_release(internship.pk):
                released += 1
            else:
                failed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Place release: {released} released, {failed} failed."
            )
        )
