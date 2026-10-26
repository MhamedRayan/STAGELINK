import json

from django.test import SimpleTestCase
from rest_framework.test import APIClient


class OpenApiDocumentationTests(SimpleTestCase):
    def _get_schema(self):
        response = APIClient().get("/api/schema/", HTTP_ACCEPT="application/vnd.oai.openapi+json")
        self.assertEqual(response.status_code, 200)
        return json.loads(response.content)

    def test_schema_lists_every_endpoint(self):
        paths = self._get_schema()["paths"]

        for expected_path in [
            "/api/health/",
            "/api/notifications/",
            "/api/notifications/unread-count/",
            "/api/notifications/read-all/",
            "/api/notifications/{id}/read/",
            "/api/internal/notifications/",
        ]:
            self.assertIn(expected_path, paths)

    def test_schema_declares_the_security_schemes(self):
        schemes = self._get_schema()["components"]["securitySchemes"]

        self.assertIn("serviceToken", schemes)
        self.assertIn("bearerAuth", schemes)

    def test_swagger_ui_page_is_served(self):
        response = APIClient().get("/api/docs/")

        self.assertEqual(response.status_code, 200)
