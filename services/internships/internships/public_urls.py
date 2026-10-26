from django.urls import path

from .views import InternshipDetailView, InternshipListView

urlpatterns = [
    path("internships/", InternshipListView.as_view(), name="internship-list"),
    path("internships/<int:pk>/", InternshipDetailView.as_view(), name="internship-detail"),
]
