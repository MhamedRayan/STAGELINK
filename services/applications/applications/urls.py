from django.urls import path
from .views import (
    ApplicationListCreateView,
    ApplicationDetailView,
    CompanyDecisionView,
    UniversityDecisionView,
    StudentDecisionView
)

urlpatterns = [
    path('applications/', ApplicationListCreateView.as_view(), name='application-list-create'),
    path('applications/<uuid:pk>/', ApplicationDetailView.as_view(), name='application-detail'),
    path('applications/<uuid:pk>/company-decision/', CompanyDecisionView.as_view(), name='company-decision'),
    path('applications/<uuid:pk>/university-decision/', UniversityDecisionView.as_view(), name='university-decision'),
    path('applications/<uuid:pk>/student-decision/', StudentDecisionView.as_view(), name='student-decision'),
]
