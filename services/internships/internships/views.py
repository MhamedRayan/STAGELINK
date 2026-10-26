from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsInternalService
from .selectors import visible_internships_for
from .serializers import InternshipCreateSerializer, InternshipSerializer
from .services import ActiveInternshipConflict, create_internship


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "internships"})


class InternshipCreateView(APIView):
    """
    Internal endpoint called by Offers & Applications after a student accepts.

    201 Created: a new internship was created.
    200 OK: the internship already existed for this application (safe retry).
    409 Conflict: the student already has an active internship.
    """

    # Service-to-service calls use the shared token, not user JWTs.
    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request):
        serializer = InternshipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            internship, created = create_internship(**serializer.validated_data)
        except ActiveInternshipConflict as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(InternshipSerializer(internship).data, status=response_status)


class InternshipListView(generics.ListAPIView):
    serializer_class = InternshipSerializer

    def get_queryset(self):
        return visible_internships_for(self.request.user)


class InternshipDetailView(generics.RetrieveAPIView):
    serializer_class = InternshipSerializer

    def get_queryset(self):
        # Filtering before the lookup means an internship the caller cannot see
        # returns 404, exactly like a missing one. This avoids leaking which IDs exist.
        return visible_internships_for(self.request.user)
