import uuid
from unittest.mock import Mock, patch

import requests
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .exceptions import IdentityUnavailable
from .identity_client import fetch_identity_user, list_university_admin_ids

USER_ID = uuid.uuid4()
ADMIN_ID = uuid.uuid4()
OTHER_ADMIN_ID = uuid.uuid4()
DIRECTORY_URL = "http://identity.test/api/internal/users/"


@override_settings(
    IDENTITY_BASE_URL="http://identity.test",
    INTERNAL_SERVICE_TOKEN="test-service-token",
    IDENTITY_TIMEOUT_SECONDS=2.0,
)
class FetchIdentityUserTests(SimpleTestCase):
    @patch("internships.identity_client.requests.get")
    def test_returns_the_payload_on_200(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {"id": str(USER_ID), "role": "supervisor"},
        )

        payload = fetch_identity_user(USER_ID)

        self.assertEqual(payload["role"], "supervisor")
        args, kwargs = mock_get.call_args
        self.assertEqual(
            args[0],
            f"http://identity.test/api/internal/users/{USER_ID}/",
        )
        self.assertEqual(
            kwargs["headers"]["X-Service-Token"], "test-service-token"
        )
        self.assertEqual(kwargs["timeout"], 2.0)

    @patch("internships.identity_client.requests.get")
    def test_404_returns_none(self, mock_get):
        mock_get.return_value = Mock(status_code=404)

        self.assertIsNone(fetch_identity_user(USER_ID))

    @patch("internships.identity_client.requests.get")
    def test_non_200_raises_unavailable(self, mock_get):
        mock_get.return_value = Mock(status_code=500)

        with self.assertRaises(IdentityUnavailable):
            fetch_identity_user(USER_ID)

    @patch("internships.identity_client.requests.get")
    def test_network_error_raises_unavailable(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("down")

        with self.assertRaises(IdentityUnavailable):
            fetch_identity_user(USER_ID)


@override_settings(
    IDENTITY_BASE_URL="http://identity.test",
    INTERNAL_SERVICE_TOKEN="test-service-token",
    IDENTITY_TIMEOUT_SECONDS=2.0,
    IDENTITY_DIRECTORY_CACHE_SECONDS=60,
    IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS=10,
)
class UniversityAdminDirectoryTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch("internships.identity_client.requests.get")
    def test_returns_ids_from_every_page(self, mock_get):
        mock_get.side_effect = [
            Mock(
                status_code=200,
                json=lambda: {
                    "results": [{"id": str(ADMIN_ID), "role": "university_admin"}],
                    "next": "http://identity.test/api/internal/users/?page=2",
                },
            ),
            Mock(
                status_code=200,
                json=lambda: {
                    "results": [
                        {"id": str(OTHER_ADMIN_ID), "role": "university_admin"}
                    ],
                    "next": None,
                },
            ),
        ]

        user_ids = list_university_admin_ids()

        self.assertEqual(sorted(user_ids), sorted([str(ADMIN_ID), str(OTHER_ADMIN_ID)]))
        first_args, first_kwargs = mock_get.call_args_list[0]
        self.assertEqual(first_args[0], DIRECTORY_URL)
        self.assertEqual(first_kwargs["params"], {"role": "university_admin"})
        self.assertEqual(
            first_kwargs["headers"]["X-Service-Token"], "test-service-token"
        )
        second_args, second_kwargs = mock_get.call_args_list[1]
        self.assertEqual(
            second_args[0], "http://identity.test/api/internal/users/?page=2"
        )
        self.assertIsNone(second_kwargs["params"])

    @patch("internships.identity_client.requests.get")
    def test_success_is_cached(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {"results": [{"id": str(ADMIN_ID)}], "next": None},
        )

        self.assertEqual(list_university_admin_ids(), [str(ADMIN_ID)])
        self.assertEqual(list_university_admin_ids(), [str(ADMIN_ID)])

        mock_get.assert_called_once()

    @patch("internships.identity_client.requests.get")
    def test_failure_is_cached_briefly(self, mock_get):
        mock_get.return_value = Mock(status_code=500)

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()
        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

        mock_get.assert_called_once()

    @patch("internships.identity_client.requests.get")
    def test_network_error_raises_unavailable(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("down")

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

    @patch("internships.identity_client.requests.get")
    def test_malformed_payload_raises_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=lambda: {"unexpected": True}
        )

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

    @patch("internships.identity_client.requests.get")
    def test_invalid_ids_are_ignored(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "results": [{"id": "not-a-uuid"}, {"id": str(ADMIN_ID)}],
                "next": None,
            },
        )

        self.assertEqual(list_university_admin_ids(), [str(ADMIN_ID)])

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    @patch("internships.identity_client.requests.get")
    def test_missing_configuration_raises_without_a_request(self, mock_get):
        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

        mock_get.assert_not_called()
