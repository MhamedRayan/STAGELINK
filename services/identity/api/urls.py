from django.urls import path

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
    PublicCompanyVerificationView,
    UserDirectoryDetailView,
    UserDirectoryListView,
    UserLoginView,
    UserLookupView,
    UserProfileView,
    UserRegistrationView,
    UserRoleProfileView,
    UniversityTokenRefreshView,
)


urlpatterns = [
    path("auth/register/", UserRegistrationView.as_view(), name="auth-register"),
    path("auth/login/", UserLoginView.as_view(), name="auth-login"),
    path("auth/refresh/", UniversityTokenRefreshView.as_view(), name="auth-refresh"),
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
        "users/",
        UserDirectoryListView.as_view(),
        name="user-directory-list",
    ),
    path(
        "users/lookup/",
        UserLookupView.as_view(),
        name="user-lookup",
    ),
    path(
        "users/<uuid:user_id>/",
        UserDirectoryDetailView.as_view(),
        name="user-directory-detail",
    ),
    path(
        "companies/<uuid:company_id>/verification/",
        PublicCompanyVerificationView.as_view(),
        name="public-company-verification",
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
