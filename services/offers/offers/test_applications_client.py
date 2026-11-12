import uuid
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, override_settings

from offers.applications_client import ApplicationsUnavailable, get_offer_capacity

OFFER_ID = uuid.uuid4()
CAPACITY_URL = (
    f"http://applications.test/api/internal/offers/{OFFER_ID}/capacity/"
)


@override_settings(
    APPLICATIONS_BASE_URL="http://applications.test",
    INTERNAL_SERVICE_TOKEN="test-service-token",
    APPLICATIONS_TIMEOUT_SECONDS=2.0,
)
class ApplicationsClientTests(SimpleTestCase):
    @patch("offers.applications_client.requests.get")
    def test_returns_the_snapshot_on_200(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "offer_id": str(OFFER_ID),
                "capacity": 5,
                "reserved": 1,
                "occupied": 1,
                "committed": 2,
                "available": 3,
            },
        )

        payload = get_offer_capacity(OFFER_ID)

        self.assertEqual(payload["committed"], 2)
        args, kwargs = mock_get.call_args
        self.assertEqual(args[0], CAPACITY_URL)
        self.assertEqual(
            kwargs["headers"]["X-Service-Token"], "test-service-token"
        )
        self.assertEqual(kwargs["timeout"], 2.0)

    @patch("offers.applications_client.requests.get")
    def test_non_200_raises_unavailable(self, mock_get):
        mock_get.return_value = Mock(status_code=403, text="forbidden")

        with self.assertRaises(ApplicationsUnavailable):
            get_offer_capacity(OFFER_ID)

    @patch("offers.applications_client.requests.get")
    def test_network_error_raises_unavailable(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("down")

        with self.assertRaises(ApplicationsUnavailable):
            get_offer_capacity(OFFER_ID)

    @patch("offers.applications_client.requests.get")
    def test_invalid_json_raises_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=Mock(side_effect=ValueError("bad"))
        )

        with self.assertRaises(ApplicationsUnavailable):
            get_offer_capacity(OFFER_ID)

    @patch("offers.applications_client.requests.get")
    def test_invalid_committed_value_raises_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=lambda: {"committed": "many"}
        )

        with self.assertRaises(ApplicationsUnavailable):
            get_offer_capacity(OFFER_ID)

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    @patch("offers.applications_client.requests.get")
    def test_missing_configuration_fails_closed(self, mock_get):
        with self.assertRaises(ApplicationsUnavailable):
            get_offer_capacity(OFFER_ID)
        mock_get.assert_not_called()
