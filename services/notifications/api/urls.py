from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import views

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("notifications/", views.NotificationListView.as_view(), name="notification_list"),
    path(
        "notifications/unread-count/",
        views.UnreadCountView.as_view(),
        name="notification_unread_count",
    ),
    path(
        "notifications/read-all/",
        views.ReadAllView.as_view(),
        name="notification_read_all",
    ),
    path(
        "notifications/<int:pk>/read/",
        views.MarkReadView.as_view(),
        name="notification_mark_read",
    ),
    path(
        "internal/notifications/",
        views.InternalNotificationCreateView.as_view(),
        name="internal_notification_create",
    ),
    # API documentation (OpenAPI schema + Swagger UI).
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
