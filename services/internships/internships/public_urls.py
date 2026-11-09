from django.urls import path

from .views import (
    CancellationApproveView,
    CancellationRejectView,
    CancellationRequestListCreateView,
    InternshipCompleteView,
    InternshipDetailView,
    InternshipEvaluationView,
    InternshipHistoryView,
    InternshipListView,
    InternshipStartView,
    InternshipSubmissionDownloadView,
    InternshipSubmissionListCreateView,
    InternshipSupervisorView,
    SubmissionApproveView,
    SubmissionRejectView,
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
    path(
        "internships/<uuid:pk>/submissions/",
        InternshipSubmissionListCreateView.as_view(),
        name="internship-submissions",
    ),
    path(
        "internships/<uuid:pk>/submissions/<uuid:submission_id>/download/",
        InternshipSubmissionDownloadView.as_view(),
        name="internship-submission-download",
    ),
    path(
        "internships/<uuid:pk>/submissions/<uuid:submission_id>/approve/",
        SubmissionApproveView.as_view(),
        name="internship-submission-approve",
    ),
    path(
        "internships/<uuid:pk>/submissions/<uuid:submission_id>/reject/",
        SubmissionRejectView.as_view(),
        name="internship-submission-reject",
    ),
    path(
        "internships/<uuid:pk>/evaluation/",
        InternshipEvaluationView.as_view(),
        name="internship-evaluation",
    ),
]
