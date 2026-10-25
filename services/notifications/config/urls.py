"""URL configuration for the notifications service."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("notifications_api.urls")),
]
