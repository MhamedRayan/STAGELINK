import threading

from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from api.models import Notification

INTERNAL_URL = "/api/internal/notifications/"
TEST_SERVICE_TOKEN = "test-service-token"


@override_settings(DEV_AUTH_ENABLED=True)
class PaginationTests(TestCase):
    def setUp(self):
        Notification.objects.bulk_create(
            [
                Notification(
                    recipient_user_id=42,
                    type=Notification.Type.GENERIC,
                    title=f"Title {index}",
                    message="Message",
                    deduplication_key=f"key-{index}",
                )
                for index in range(25)
            ]
        )
        self.api_client = APIClient()
        self.api_client.credentials(HTTP_X_USER_ID="42")

    def test_first_page_has_twenty_items_and_a_next_link(self):
        body = self.api_client.get("/api/notifications/").json()

        self.assertEqual(body["count"], 25)
        self.assertEqual(len(body["results"]), 20)
        self.assertIsNotNone(body["next"])

    def test_second_page_has_the_remaining_five_items(self):
        body = self.api_client.get("/api/notifications/?page=2").json()

        self.assertEqual(len(body["results"]), 5)
        self.assertIsNone(body["next"])


@override_settings(INTERNAL_SERVICE_TOKEN=TEST_SERVICE_TOKEN)
class ConcurrentDeduplicationTests(TransactionTestCase):
    """Real threads and real database connections (needs PostgreSQL)."""

    def test_simultaneous_requests_with_the_same_key_create_one_notification(self):
        thread_count = 8
        barrier = threading.Barrier(thread_count)
        status_codes = []
        errors = []
        payload = {
            "recipient_user_id": 42,
            "type": "generic",
            "title": "Concurrent",
            "message": "Same event sent many times at once",
            "deduplication_key": "concurrent:event:recipient:42",
        }

        def send_request():
            try:
                barrier.wait(timeout=10)  # release all threads together
                response = APIClient().post(
                    INTERNAL_URL,
                    payload,
                    format="json",
                    HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN,
                )
                status_codes.append(response.status_code)
            except Exception as exc:  # reported by the assertions below
                errors.append(repr(exc))
            finally:
                connection.close()

        threads = [threading.Thread(target=send_request) for _ in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        self.assertEqual(errors, [])
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(sorted(status_codes), [200] * (thread_count - 1) + [201])
