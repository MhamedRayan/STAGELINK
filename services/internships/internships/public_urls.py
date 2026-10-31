from django.urls import path

from .views import InternshipDetailView, InternshipListView

urlpatterns = [
    path("internships/", InternshipListView.as_view(), name="internship-list"),
    path("internships/<uuid:pk>/", InternshipDetailView.as_view(), name="internship-detail"),
]
