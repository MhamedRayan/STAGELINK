import uuid
from unittest.mock import Mock, patch

import requests
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .identity_client import IdentityUnavailable, list_university_admin_ids
from .offers_client import OfferNotFound, OffersUnavailable, get_offer

OFFER_ID = uuid.uuid4()
DIRECTORY_URL = 'http://identity.test/api/internal/users/'
ADMIN_ID = uuid.uuid4()
OTHER_ADMIN_ID = uuid.uuid4()


@override_settings(
    OFFERS_SERVICE_URL='http://offers.test/api/internal/offers/',
    INTERNAL_SERVICE_TOKEN='test-service-token',
    OFFERS_TIMEOUT_SECONDS=2.0,
)
class OffersClientTests(SimpleTestCase):
    @patch('applications.offers_client.requests.get')
    def test_returns_the_payload_on_200(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: {'id': str(OFFER_ID)})

        payload = get_offer(OFFER_ID)

        self.assertEqual(payload['id'], str(OFFER_ID))
        _, kwargs = mock_get.call_args
        self.assertEqual(
            kwargs['headers']['X-Service-Token'], 'test-service-token'
        )
        self.assertEqual(kwargs['timeout'], 2.0)

    @patch('applications.offers_client.requests.get')
    def test_404_raises_offer_not_found(self, mock_get):
        mock_get.return_value = Mock(status_code=404)

        with self.assertRaises(OfferNotFound):
            get_offer(OFFER_ID)

    @patch('applications.offers_client.requests.get')
    def test_500_raises_offers_unavailable(self, mock_get):
        mock_get.return_value = Mock(status_code=500, text='boom')

        with self.assertRaises(OffersUnavailable):
            get_offer(OFFER_ID)

    @patch('applications.offers_client.requests.get')
    def test_network_error_raises_offers_unavailable(self, mock_get):
        mock_get.side_effect = requests.ConnectionError('down')

        with self.assertRaises(OffersUnavailable):
            get_offer(OFFER_ID)

    @patch('applications.offers_client.requests.get')
    def test_invalid_json_raises_offers_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=Mock(side_effect=ValueError('bad'))
        )

        with self.assertRaises(OffersUnavailable):
            get_offer(OFFER_ID)

    @override_settings(INTERNAL_SERVICE_TOKEN='')
    @patch('applications.offers_client.requests.get')
    def test_missing_token_fails_closed(self, mock_get):
        with self.assertRaises(OffersUnavailable):
            get_offer(OFFER_ID)
        mock_get.assert_not_called()


@override_settings(
    IDENTITY_BASE_URL='http://identity.test',
    INTERNAL_SERVICE_TOKEN='test-service-token',
    IDENTITY_TIMEOUT_SECONDS=2.0,
    IDENTITY_DIRECTORY_CACHE_SECONDS=0,
    IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS=0,
)
class IdentityClientTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @staticmethod
    def _page(*user_ids, next_url=None):
        return {
            'count': len(user_ids),
            'next': next_url,
            'previous': None,
            'results': [{'id': str(user_id), 'name': 'Admin'} for user_id in user_ids],
        }

    @patch('applications.identity_client.requests.get')
    def test_paginates_and_returns_sorted_unique_ids(self, mock_get):
        next_url = f'{DIRECTORY_URL}?role=university_admin&page=2'
        mock_get.side_effect = [
            Mock(
                status_code=200,
                json=lambda: self._page(
                    OTHER_ADMIN_ID, ADMIN_ID, next_url=next_url
                ),
            ),
            Mock(
                status_code=200,
                json=lambda: self._page(ADMIN_ID, OTHER_ADMIN_ID),
            ),
        ]

        user_ids = list_university_admin_ids()

        self.assertEqual(user_ids, sorted({str(ADMIN_ID), str(OTHER_ADMIN_ID)}))
        first_call, second_call = mock_get.call_args_list
        self.assertEqual(first_call.args[0], DIRECTORY_URL)
        self.assertEqual(
            first_call.kwargs['params'], {'role': 'university_admin'}
        )
        self.assertEqual(
            first_call.kwargs['headers']['X-Service-Token'], 'test-service-token'
        )
        self.assertEqual(first_call.kwargs['timeout'], 2.0)
        self.assertEqual(second_call.args[0], next_url)
        self.assertIsNone(second_call.kwargs['params'])

    @override_settings(IDENTITY_DIRECTORY_CACHE_SECONDS=60)
    @patch('applications.identity_client.requests.get')
    def test_caches_successful_directory_results(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=lambda: self._page(ADMIN_ID)
        )

        first = list_university_admin_ids()
        second = list_university_admin_ids()

        self.assertEqual(first, [str(ADMIN_ID)])
        self.assertEqual(second, first)
        mock_get.assert_called_once()

    @override_settings(
        IDENTITY_DIRECTORY_CACHE_SECONDS=60,
        IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS=60,
    )
    @patch('applications.identity_client.requests.get')
    def test_caches_failures_briefly(self, mock_get):
        mock_get.return_value = Mock(status_code=500, text='boom')

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()
        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

        mock_get.assert_called_once()

    @patch('applications.identity_client.requests.get')
    def test_network_error_raises_identity_unavailable(self, mock_get):
        mock_get.side_effect = requests.ConnectionError('down')

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

    @patch('applications.identity_client.requests.get')
    def test_invalid_json_raises_identity_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=Mock(side_effect=ValueError('bad'))
        )

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

    @patch('applications.identity_client.requests.get')
    def test_malformed_payload_raises_identity_unavailable(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200, json=lambda: {'count': 0}
        )

        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()

    @patch('applications.identity_client.requests.get')
    def test_ignores_invalid_directory_entries(self, mock_get):
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {
                'results': [
                    {'id': str(ADMIN_ID)},
                    {'id': 'not-a-uuid'},
                    {},
                ],
                'next': None,
            },
        )

        self.assertEqual(list_university_admin_ids(), [str(ADMIN_ID)])

    @override_settings(IDENTITY_BASE_URL='')
    @patch('applications.identity_client.requests.get')
    def test_missing_configuration_fails_closed(self, mock_get):
        with self.assertRaises(IdentityUnavailable):
            list_university_admin_ids()
        mock_get.assert_not_called()
