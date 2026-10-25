from django.urls import path

from . import views

app_name = "internships_api"

urlpatterns = [
    path("health/", views.health, name="health"),
]
