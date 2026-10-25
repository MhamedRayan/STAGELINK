"""URL configuration for the applications service."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("applications_api.urls")),
]
