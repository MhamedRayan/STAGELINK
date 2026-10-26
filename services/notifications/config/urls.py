"""Root URL configuration."""
from django.urls import include, path

from api.views import health_check

urlpatterns = [
    path("health/", health_check, name="health"),
    path("api/", include("api.urls")),
]
