from django.core.management.base import BaseCommand

from internships.services import start_due_internships


class Command(BaseCommand):
    help = "Move Confirmed internships to In progress once their start date has been reached."

    def handle(self, *args, **options):
        started = start_due_internships()
        self.stdout.write(self.style.SUCCESS(f"Started {started} internship(s)."))
