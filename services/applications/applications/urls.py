from django.urls import path

from .views import (
    ApplicationDetailView,
    ApplicationHistoryView,
    ApplicationListCreateView,
    CompanyDecisionView,
    InternalOfferApplicationCountsView,
    InternalOfferCapacityView,
    InternalReleasePlaceView,
    StudentDecisionView,
    UniversityDecisionView,
    WithdrawApplicationView,
)

urlpatterns = [
    path('applications/', ApplicationListCreateView.as_view(), name='application-list-create'),
    path('applications/<uuid:pk>/', ApplicationDetailView.as_view(), name='application-detail'),
    path('applications/<uuid:pk>/history/', ApplicationHistoryView.as_view(), name='application-history'),
    path('applications/<uuid:pk>/company-decision/', CompanyDecisionView.as_view(), name='company-decision'),
    path('applications/<uuid:pk>/university-decision/', UniversityDecisionView.as_view(), name='university-decision'),
    path('applications/<uuid:pk>/student-decision/', StudentDecisionView.as_view(), name='student-decision'),
    path('applications/<uuid:pk>/withdraw/', WithdrawApplicationView.as_view(), name='application-withdraw'),
    # Trusted service-to-service endpoints (X-Service-Token, no user JWT).
    path(
        'internal/applications/<uuid:pk>/release-place/',
        InternalReleasePlaceView.as_view(),
        name='internal-release-place',
    ),
    path(
        'internal/offers/<uuid:offer_id>/capacity/',
        InternalOfferCapacityView.as_view(),
        name='internal-offer-capacity',
    ),
    path(
        'internal/offers/<uuid:offer_id>/applications-count/',
        InternalOfferApplicationCountsView.as_view(),
        name='internal-offer-application-counts',
    ),
]
