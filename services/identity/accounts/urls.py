from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("health/", views.health, name="health"),
]
