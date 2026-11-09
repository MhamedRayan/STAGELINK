from django.contrib import admin

from .models import Application, ApplicationStatusHistory, OfferReservation


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "offer_id",
        "student_user_id",
        "company_user_id",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("id", "offer_id", "student_user_id", "company_user_id")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "withdrawn_at",
        "place_released_at",
    )


@admin.register(OfferReservation)
class OfferReservationAdmin(admin.ModelAdmin):
    list_display = ("offer_id", "capacity", "reserved", "occupied", "updated_at")
    search_fields = ("offer_id",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "from_status",
        "to_status",
        "actor_role",
        "created_at",
    )
    list_filter = ("to_status", "actor_role")
    search_fields = ("application__id", "actor_user_id")
    readonly_fields = (
        "id",
        "application",
        "from_status",
        "to_status",
        "actor_user_id",
        "actor_role",
        "reason",
        "created_at",
    )
