import uuid

from rest_framework.exceptions import ValidationError
from rest_framework.filters import BaseFilterBackend


def _parse_company_user_id(raw_value):
    try:
        return uuid.UUID(str(raw_value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValidationError(
            {"company_user_id": "A valid UUID is required."}
        ) from exc


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

        return queryset
