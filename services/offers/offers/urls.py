from django.urls import path

from offers.views import (
    OfferCloseView,
    OfferDetailView,
    OfferListView,
    OfferPublishView,
)

urlpatterns = [
    path("offers/", OfferListView.as_view(), name="offer-list"),
    path("offers/<uuid:pk>/", OfferDetailView.as_view(), name="offer-detail"),
    path("offers/<uuid:pk>/publish/", OfferPublishView.as_view(), name="offer-publish"),
    path("offers/<uuid:pk>/close/", OfferCloseView.as_view(), name="offer-close"),
]
