from django.urls import path

from . import views

app_name = "offers_api"

urlpatterns = [
    path("health/", views.health, name="health"),
]
