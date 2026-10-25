from django.urls import path

from . import views

app_name = "applications_api"

urlpatterns = [
    path("health/", views.health, name="health"),
]
