from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from api.views import (
    InternalUserLookupView,
    UserLoginView,
    UserProfileView,
    UserRegistrationView,
)


urlpatterns = [
    path("auth/register/", UserRegistrationView.as_view(), name="auth-register"),
    path("auth/login/", UserLoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("users/me/", UserProfileView.as_view(), name="user-profile"),
    path(
        "internal/users/<uuid:user_id>/",
        InternalUserLookupView.as_view(),
        name="internal-user-lookup",
    ),
]
