from rest_framework import status
from rest_framework.exceptions import APIException


class OfferStateConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The offer's current status does not allow this action."
    default_code = "offer_state_conflict"
