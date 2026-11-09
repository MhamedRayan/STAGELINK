import uuid
from datetime import datetime, time
from datetime import timezone as dt_timezone

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.filters import BaseFilterBackend

from offers.models import OfferStatus

ORDERING_VALUES = ("deadline", "-deadline", "created_at", "-created_at")


def _parse_company_user_id(raw_value):
    try:
        return uuid.UUID(str(raw_value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValidationError(
            {"company_user_id": "A valid UUID is required."}
        ) from exc


def _parse_status(raw_value):
    if raw_value not in OfferStatus.values:
        allowed_values = ", ".join(OfferStatus.values)
        raise ValidationError({"status": f"Must be one of: {allowed_values}."})
    return raw_value


def _parse_deadline_after(raw_value):
    try:
        parsed = parse_datetime(raw_value)
        if parsed is None:
            parsed_date = parse_date(raw_value)
            if parsed_date is not None:
                parsed = datetime.combine(parsed_date, time.min)
    except ValueError:
        parsed = None

    if parsed is None:
        raise ValidationError(
            {"deadline_after": "A valid ISO 8601 date or datetime is required."}
        )
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def is_mine_requested(request):
    raw_value = request.query_params.get("mine", "").strip().lower()
    if raw_value in ("", "false"):
        return False
    if raw_value == "true":
        return True
    raise ValidationError({"mine": "Must be true or false."})


class OfferFilterBackend(BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        params = request.query_params

        location = params.get("location", "").strip()
        if location:
            queryset = queryset.filter(location__icontains=location)

        requirements = params.get("requirements", "").strip()
        if requirements:
            queryset = queryset.filter(requirements__icontains=requirements)

        company_user_id = params.get("company_user_id", "").strip()
        if company_user_id:
            queryset = queryset.filter(
                company_user_id=_parse_company_user_id(company_user_id)
            )

        offer_status = params.get("status", "").strip()
        if offer_status:
            queryset = queryset.filter(status=_parse_status(offer_status))

        deadline_after = params.get("deadline_after", "").strip()
        if deadline_after:
            queryset = queryset.filter(
                deadline__gt=_parse_deadline_after(deadline_after)
            )

        return queryset


class OfferOrderingBackend(BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        ordering = request.query_params.get("ordering", "").strip()
        if not ordering:
            return queryset

        if ordering not in ORDERING_VALUES:
            allowed_values = ", ".join(ORDERING_VALUES)
            raise ValidationError({"ordering": f"Must be one of: {allowed_values}."})

        return queryset.order_by(ordering, "id")
