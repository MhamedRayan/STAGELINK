from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from api.views import (
    AdminCompanyListView,
    AdminCompanyRejectView,
    AdminCompanyVerifyView,
    AdminUserDetailView,
    AdminUserListCreateView,
    DeactivateAccountView,
    InternalUserDirectoryView,
    InternalUserLookupView,
    LogoutView,
    PasswordChangeView,
    PublicCompanyProfileView,
    UserLoginView,
    UserProfileView,
    UserRegistrationView,
    UserRoleProfileView,
)


urlpatterns = [
    path("auth/register/", UserRegistrationView.as_view(), name="auth-register"),
    path("auth/login/", UserLoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("users/me/", UserProfileView.as_view(), name="user-profile"),
    path(
        "users/me/password/",
        PasswordChangeView.as_view(),
        name="user-password-change",
    ),
    path(
        "users/me/deactivate/",
        DeactivateAccountView.as_view(),
        name="user-deactivate",
    ),
    path(
        "users/me/profile/",
        UserRoleProfileView.as_view(),
        name="user-role-profile",
    ),
    path(
        "companies/<uuid:company_id>/profile/",
        PublicCompanyProfileView.as_view(),
        name="public-company-profile",
    ),
    path(
        "internal/users/",
        InternalUserDirectoryView.as_view(),
        name="internal-user-directory",
    ),
    path(
        "internal/users/<uuid:user_id>/",
        InternalUserLookupView.as_view(),
        name="internal-user-lookup",
    ),
    path(
        "admin/companies/",
        AdminCompanyListView.as_view(),
        name="admin-company-list",
    ),
    path(
        "admin/companies/<uuid:company_id>/verify/",
        AdminCompanyVerifyView.as_view(),
        name="admin-company-verify",
    ),
    path(
        "admin/companies/<uuid:company_id>/reject/",
        AdminCompanyRejectView.as_view(),
        name="admin-company-reject",
    ),
    path(
        "admin/users/",
        AdminUserListCreateView.as_view(),
        name="admin-user-list-create",
    ),
    path(
        "admin/users/<uuid:user_id>/",
        AdminUserDetailView.as_view(),
        name="admin-user-detail",
    ),
]
