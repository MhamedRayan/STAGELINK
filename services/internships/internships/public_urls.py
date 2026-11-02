from django.urls import path

from .views import (
    CancellationApproveView,
    CancellationRejectView,
    CancellationRequestListCreateView,
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
    path(
        "internships/<uuid:pk>/cancellation-requests/",
        CancellationRequestListCreateView.as_view(),
        name="internship-cancellation-requests",
    ),
    path(
        "internships/<uuid:pk>/cancellation-requests/<uuid:request_id>/approve/",
        CancellationApproveView.as_view(),
        name="internship-cancellation-approve",
    ),
    path(
        "internships/<uuid:pk>/cancellation-requests/<uuid:request_id>/reject/",
        CancellationRejectView.as_view(),
        name="internship-cancellation-reject",
    ),
]
