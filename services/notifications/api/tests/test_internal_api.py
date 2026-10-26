from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Notification

INTERNAL_URL = "/api/internal/notifications/"
TEST_TOKEN = "test-service-token"


def _build_payload(**overrides):
    payload = {
        "recipient_user_id": 42,
        "type": "application_validated",
        "title": "Application validated",
        "message": "The university validated your application.",
        "related_object_type": "application",
        "related_object_id": "1234",
        "deduplication_key": "application:1234:validated:recipient:42",
    }
    payload.update(overrides)
    return payload


@override_settings(INTERNAL_SERVICE_TOKEN=TEST_TOKEN, DEV_AUTH_ENABLED=True)
class InternalNotificationCreateTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()

    def _post(self, payload=None, token=TEST_TOKEN):
        extra = {} if token is None else {"HTTP_X_SERVICE_TOKEN": token}
        return self.api_client.post(
            INTERNAL_URL,
            _build_payload() if payload is None else payload,
            format="json",
            **extra,
        )

    # --- creation -------------------------------------------------------
    def test_creates_a_notification(self):
        response = self._post()

        self.assertEqual(response.status_code, 201)
        body = response.json()
        notification = Notification.objects.get(pk=body["id"])
        self.assertEqual(notification.recipient_user_id, 42)
        self.assertEqual(notification.type, "application_validated")
        self.assertIsNone(notification.read_at)

    def test_created_notification_is_visible_to_its_recipient_only(self):
        self._post()

        recipient_client = APIClient()
        recipient_client.credentials(HTTP_X_USER_ID="42")
        other_client = APIClient()
        other_client.credentials(HTTP_X_USER_ID="77")

        self.assertEqual(recipient_client.get("/api/notifications/").json()["count"], 1)
        self.assertEqual(other_client.get("/api/notifications/").json()["count"], 0)

    # --- deduplication / retries ---------------------------------------
    def test_same_deduplication_key_returns_existing_notification(self):
        first = self._post()
        second = self._post()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(Notification.objects.count(), 1)

    def test_retry_with_changed_content_keeps_the_original(self):
        self._post()

        response = self._post(_build_payload(message="Different text"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "The university validated your application.")
        self.assertEqual(Notification.objects.count(), 1)

    def test_same_event_for_different_recipients_creates_two_notifications(self):
        self._post(_build_payload(recipient_user_id=42, deduplication_key="application:9:rejected:recipient:42"))
        self._post(_build_payload(recipient_user_id=77, deduplication_key="application:9:rejected:recipient:77"))

        self.assertEqual(Notification.objects.count(), 2)

    # --- service authentication ----------------------------------------
    def test_missing_service_token_is_rejected(self):
        response = self._post(token=None)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Notification.objects.count(), 0)

    def test_wrong_service_token_is_rejected(self):
        response = self._post(token="wrong-token")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Notification.objects.count(), 0)

    def test_user_credentials_do_not_grant_access(self):
        self.api_client.credentials(HTTP_X_USER_ID="42")

        response = self._post(token=None)

        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    def test_endpoint_is_closed_when_no_token_is_configured(self):
        for token in [None, ""]:
            response = self._post(token=token)
            self.assertEqual(response.status_code, 403)
        self.assertEqual(Notification.objects.count(), 0)

    # --- validation -----------------------------------------------------
    def test_invalid_type_is_rejected(self):
        response = self._post(_build_payload(type="not_a_real_type"))

        self.assertEqual(response.status_code, 400)

    def test_missing_required_fields_are_rejected(self):
        for field in ["recipient_user_id", "type", "title", "message", "deduplication_key"]:
            payload = _build_payload()
            del payload[field]

            self.assertEqual(self._post(payload).status_code, 400, field)

    def test_recipient_user_id_must_be_positive(self):
        self.assertEqual(self._post(_build_payload(recipient_user_id=0)).status_code, 400)

    def test_too_long_title_is_rejected(self):
        self.assertEqual(self._post(_build_payload(title="x" * 256)).status_code, 400)

    def test_nothing_is_created_when_validation_fails(self):
        self._post(_build_payload(type="not_a_real_type"))

        self.assertEqual(Notification.objects.count(), 0)
