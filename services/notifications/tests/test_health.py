from django.test import SimpleTestCase


class HealthTests(SimpleTestCase):
    def test_root_health_endpoint_is_public(self):
        response = self.client.get("/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "notifications"})

    def test_api_health_endpoint_is_public(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "notifications"})
