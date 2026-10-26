from django.urls import path

from .views import InternshipCreateView

urlpatterns = [
    path("internships/", InternshipCreateView.as_view(), name="internal-internship-create"),
]
