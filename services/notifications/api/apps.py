from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        # Registers the OpenAPI descriptions of our authentication classes.
        from . import schema  # noqa: F401
