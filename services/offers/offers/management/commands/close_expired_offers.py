from django.core.management.base import BaseCommand

from offers.services import close_expired_offers


class Command(BaseCommand):
    help = "Close published offers whose deadline has passed."

    def handle(self, *args, **options):
        closed = close_expired_offers()
        self.stdout.write(f"Closed {closed} expired offer(s).")