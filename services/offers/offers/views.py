from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from offers.filters import OfferFilterBackend
from offers.models import Offer, OfferStatus
from offers.pagination import OfferPagination
from offers.permissions import (
    CanViewOffer,
    IsCompanyUser,
    IsOfferOwner,
    get_authenticated_company_id,
)
from offers.serializers import OfferCreateUpdateSerializer, OfferSerializer
from offers.services import close_offer, ensure_offer_is_editable, publish_offer


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "offers"})


def _get_caller_company_id(request):
    try:
        return int(get_authenticated_company_id(request))
    except (TypeError, ValueError):
        return None


def _get_visible_offers(request):
    visible_offers = Q(status=OfferStatus.PUBLISHED)
    company_id = _get_caller_company_id(request)
    if company_id is not None:
        visible_offers |= Q(company_user_id=company_id)
    return Offer.objects.filter(visible_offers)


class OfferListView(ListCreateAPIView):
    pagination_class = OfferPagination
    filter_backends = [SearchFilter, OfferFilterBackend]
    search_fields = ["title", "description", "requirements", "location"]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCompanyUser()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return OfferCreateUpdateSerializer
        return OfferSerializer

    def get_queryset(self):
        return Offer.objects.filter(status=OfferStatus.PUBLISHED).order_by(
            "-created_at", "-id"
        )

    def create(self, request, *args, **kwargs):
        company_user_id = _get_caller_company_id(request)
        if company_user_id is None:
            raise PermissionDenied("A valid company identity is required.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        offer = serializer.save(company_user_id=company_user_id)
        return Response(OfferSerializer(offer).data, status=status.HTTP_201_CREATED)


class OfferDetailView(RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsCompanyUser(), IsOfferOwner()]
        return [CanViewOffer()]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return OfferCreateUpdateSerializer
        return OfferSerializer

    def get_queryset(self):
        queryset = _get_visible_offers(self.request)
        if self.request.method == "PATCH":
            queryset = queryset.select_for_update()
        return queryset

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            offer = self.get_object()
            ensure_offer_is_editable(offer)
            serializer = self.get_serializer(offer, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            offer = serializer.save()
        return Response(OfferSerializer(offer).data)


class _OfferTransitionView(GenericAPIView):
    permission_classes = [IsCompanyUser, IsOfferOwner]
    serializer_class = OfferSerializer
    transition = None

    def get_queryset(self):
        return _get_visible_offers(self.request)

    def post(self, request, *args, **kwargs):
        offer = self.get_object()
        updated_offer = self.transition(offer.pk)
        return Response(OfferSerializer(updated_offer).data)


class OfferPublishView(_OfferTransitionView):
    transition = staticmethod(publish_offer)


class OfferCloseView(_OfferTransitionView):
    transition = staticmethod(close_offer)
