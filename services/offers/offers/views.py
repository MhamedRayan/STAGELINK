from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from offers.filters import OfferFilterBackend, OfferOrderingBackend, is_mine_requested
from offers.models import Offer, OfferStatus
from offers.pagination import OfferPagination
from offers.permissions import (
    CanViewOffer,
    IsCompanyUser,
    IsInternalService,
    IsOfferOwner,
    get_authenticated_company_id,
)
from offers.serializers import (
    OfferCreateUpdateSerializer,
    OfferInternalSerializer,
    OfferSerializer,
)
from offers.services import (
    close_offer,
    delete_draft_offer,
    ensure_capacity_change_allowed,
    ensure_offer_is_editable,
    ensure_published_edit_allowed,
    publish_offer,
)


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "offers"})


def _get_caller_company_id(request):
    return get_authenticated_company_id(request)


def _get_visible_offers(request):
    visible_offers = Q(status=OfferStatus.PUBLISHED)
    company_id = _get_caller_company_id(request)
    if company_id is not None:
        visible_offers |= Q(company_user_id=company_id)
    return Offer.objects.filter(visible_offers, deleted_at__isnull=True)


def _get_own_offers(request):
    if not (request.user and request.user.is_authenticated):
        raise NotAuthenticated()

    company_id = _get_caller_company_id(request)
    if company_id is None:
        raise PermissionDenied("Only company accounts can list their own offers.")
    return Offer.objects.filter(company_user_id=company_id, deleted_at__isnull=True)


class OfferListView(ListCreateAPIView):
    pagination_class = OfferPagination
    filter_backends = [SearchFilter, OfferFilterBackend, OfferOrderingBackend]
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
        if is_mine_requested(self.request):
            offers = _get_own_offers(self.request)
        else:
            offers = Offer.objects.filter(
                status=OfferStatus.PUBLISHED, deleted_at__isnull=True
            )
        return offers.order_by("-created_at", "-id")

    def create(self, request, *args, **kwargs):
        company_user_id = _get_caller_company_id(request)
        if company_user_id is None:
            raise PermissionDenied("A valid company identity is required.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        offer = serializer.save(company_user_id=company_user_id)
        return Response(OfferSerializer(offer).data, status=status.HTTP_201_CREATED)


class OfferDetailView(RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.request.method in ("PATCH", "DELETE"):
            return [IsCompanyUser(), IsOfferOwner()]
        return [CanViewOffer()]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return OfferCreateUpdateSerializer
        return OfferSerializer

    def get_queryset(self):
        queryset = _get_visible_offers(self.request)
        if self.request.method in ("PATCH", "DELETE"):
            queryset = queryset.select_for_update()
        return queryset

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            offer = self.get_object()
            ensure_offer_is_editable(offer)
            serializer = self.get_serializer(offer, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            ensure_published_edit_allowed(offer, serializer.validated_data)
            ensure_capacity_change_allowed(
                offer, serializer.validated_data.get("capacity")
            )
            offer = serializer.save()
        return Response(OfferSerializer(offer).data)

    def destroy(self, request, *args, **kwargs):
        with transaction.atomic():
            offer = self.get_object()
            delete_draft_offer(offer.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InternalOfferDetailView(RetrieveAPIView):
    """Offer lookup for trusted services. User JWTs are not accepted here."""

    authentication_classes = []
    permission_classes = [IsInternalService]
    serializer_class = OfferInternalSerializer
    queryset = Offer.objects.filter(deleted_at__isnull=True)


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
