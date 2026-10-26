from django.test import SimpleTestCase


class HealthTests(SimpleTestCase):
    def test_health_endpoint_is_public(self):
        response = self.client.get("/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "identity"})
