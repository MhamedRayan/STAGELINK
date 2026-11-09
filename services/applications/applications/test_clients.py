import uuid
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase, override_settings

from .offers_client import OfferNotFound, OffersUnavailable, get_offer

OFFER_ID = uuid.uuid4()


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
