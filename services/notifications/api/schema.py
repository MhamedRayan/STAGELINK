"""OpenAPI descriptions of our custom authentication classes (for /api/docs/)."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "api.authentication.JWTAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Access token issued by Identity & Profiles.",
        }


class DevHeaderAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "api.authentication.DevHeaderAuthentication"
    name = "devUserIdHeader"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "X-User-Id",
            "description": "DEVELOPMENT ONLY: trusted user id, disabled when DEV_AUTH_ENABLED is false.",
        }
