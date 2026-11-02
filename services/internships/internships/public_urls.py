from django.urls import path

from .views import (
    InternshipCompleteView,
    InternshipDetailView,
    InternshipHistoryView,
    InternshipListView,
    InternshipStartView,
    InternshipSupervisorView,
)

urlpatterns = [
    path("internships/", InternshipListView.as_view(), name="internship-list"),
    path("internships/<uuid:pk>/", InternshipDetailView.as_view(), name="internship-detail"),
    path(
        "internships/<uuid:pk>/assign-supervisor/",
        InternshipSupervisorView.as_view(),
        name="internship-assign-supervisor",
    ),
    path("internships/<uuid:pk>/start/", InternshipStartView.as_view(), name="internship-start"),
    path(
        "internships/<uuid:pk>/complete/",
        InternshipCompleteView.as_view(),
        name="internship-complete",
    ),
    path("internships/<uuid:pk>/history/", InternshipHistoryView.as_view(), name="internship-history"),
]
