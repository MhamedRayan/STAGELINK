"""URL configuration for the offers service."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("offers_api.urls")),
]
