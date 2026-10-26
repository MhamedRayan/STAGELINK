from django.contrib import admin
from django.urls import include, path

from internships.views import health

urlpatterns = [
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/internal/", include("internships.urls")),
    path("api/", include("internships.public_urls")),
]
