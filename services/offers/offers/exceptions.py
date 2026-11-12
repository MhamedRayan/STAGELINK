from rest_framework import status
from rest_framework.exceptions import APIException


class OfferStateConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The offer's current status does not allow this action."
    default_code = "offer_state_conflict"


class CapacityLookupUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = (
        "The committed-places service is unavailable; capacity cannot be reduced "
        "right now."
    )
    default_code = "capacity_lookup_unavailable"
