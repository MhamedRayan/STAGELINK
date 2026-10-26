from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Notification


def _create_notification(recipient_user_id, deduplication_key, **overrides):
    data = {
        "recipient_user_id": recipient_user_id,
        "type": Notification.Type.APPLICATION_VALIDATED,
        "title": "Application validated",
        "message": "You can now accept or decline.",
        "related_object_type": "application",
        "related_object_id": "1",
        "deduplication_key": deduplication_key,
    }
    data.update(overrides)
    return Notification.objects.create(**data)


@override_settings(DEV_AUTH_ENABLED=True)
class NotificationApiTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.first_own = _create_notification(42, "key-1")
        self.second_own = _create_notification(42, "key-2")
        self.other_users = _create_notification(77, "key-3")

    def _login_as(self, user_id):
        self.api_client.credentials(HTTP_X_USER_ID=str(user_id))

    # --- authentication -------------------------------------------------
    def test_endpoints_require_authentication(self):
        for url in ["/api/notifications/", "/api/notifications/unread-count/"]:
            self.assertEqual(self.api_client.get(url).status_code, 401)
        response = self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")
        self.assertEqual(response.status_code, 401)

    @override_settings(DEV_AUTH_ENABLED=False)
    def test_dev_header_is_ignored_when_dev_auth_is_disabled(self):
        self._login_as(42)

        self.assertEqual(self.api_client.get("/api/notifications/").status_code, 401)

    def test_invalid_user_id_header_is_rejected(self):
        self.api_client.credentials(HTTP_X_USER_ID="abc")

        self.assertEqual(self.api_client.get("/api/notifications/").status_code, 401)

    # --- list -----------------------------------------------------------
    def test_list_returns_only_own_notifications_newest_first(self):
        self._login_as(42)

        response = self.api_client.get("/api/notifications/")

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()["results"]]
        self.assertEqual(ids, [self.second_own.id, self.first_own.id])

    def test_list_is_paginated(self):
        self._login_as(42)

        body = self.api_client.get("/api/notifications/").json()

        self.assertEqual(body["count"], 2)
        self.assertIn("results", body)

    def test_list_hides_internal_fields(self):
        self._login_as(42)

        item = self.api_client.get("/api/notifications/").json()["results"][0]

        self.assertNotIn("deduplication_key", item)
        self.assertNotIn("recipient_user_id", item)
        self.assertFalse(item["is_read"])

    def test_list_can_filter_unread_only(self):
        self._login_as(42)
        self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")

        body = self.api_client.get("/api/notifications/?unread=true").json()

        self.assertEqual([item["id"] for item in body["results"]], [self.second_own.id])

    # --- unread count ---------------------------------------------------
    def test_unread_count_counts_only_own_unread_notifications(self):
        self._login_as(42)

        self.assertEqual(self.api_client.get("/api/notifications/unread-count/").json(), {"unread_count": 2})

        self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")

        self.assertEqual(self.api_client.get("/api/notifications/unread-count/").json(), {"unread_count": 1})

    # --- mark read ------------------------------------------------------
    def test_mark_read_sets_read_at_and_leaves_other_notifications_unread(self):
        self._login_as(42)

        response = self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_read"])
        self.first_own.refresh_from_db()
        self.second_own.refresh_from_db()
        self.assertIsNotNone(self.first_own.read_at)
        self.assertIsNone(self.second_own.read_at)

    def test_mark_read_twice_keeps_the_first_read_at(self):
        self._login_as(42)
        self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")
        self.first_own.refresh_from_db()
        first_read_at = self.first_own.read_at

        response = self.api_client.patch(f"/api/notifications/{self.first_own.id}/read/")

        self.assertEqual(response.status_code, 200)
        self.first_own.refresh_from_db()
        self.assertEqual(self.first_own.read_at, first_read_at)

    def test_cannot_mark_another_users_notification_as_read(self):
        self._login_as(42)

        response = self.api_client.patch(f"/api/notifications/{self.other_users.id}/read/")

        self.assertEqual(response.status_code, 404)
        self.other_users.refresh_from_db()
        self.assertIsNone(self.other_users.read_at)
