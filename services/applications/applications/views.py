from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Application, ApplicationStatusHistory
from .permissions import (
    IsApplicationParticipant,
    IsCompany,
    IsInternalService,
    IsStudent,
    IsUniversity,
)
from .roles import Role
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationQuerySerializer,
    ApplicationSerializer,
    ApplicationStatusHistorySerializer,
    CompanyDecisionSerializer,
    HistoryQuerySerializer,
    StudentDecisionSerializer,
    UniversityDecisionSerializer,
    WithdrawalSerializer,
)
from .services import (
    decide_as_company,
    decide_as_student,
    decide_as_university,
    offer_capacity_snapshot,
    release_place_for_application,
    submit_application,
    withdraw_application,
)


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "applications"})


def visible_applications_for(user):
    """Role-scoped queryset. Filtering before lookup keeps other rows invisible."""

    user_id = str(getattr(user, 'id', ''))
    role = getattr(user, 'role', None)

    if role == Role.STUDENT:
        return Application.objects.filter(student_user_id=user_id)
    if role == Role.COMPANY:
        return Application.objects.filter(company_user_id=user_id)
    if role in (Role.UNIVERSITY_ADMIN, Role.PLATFORM_ADMIN):
        return Application.objects.all()
    return Application.objects.none()


def paginate(queryset, *, limit, offset, serializer_class):
    total = queryset.count()
    page = queryset[offset:offset + limit]
    return {
        "results": serializer_class(page, many=True).data,
        "pagination": {"limit": limit, "offset": offset, "total": total},
    }


def filter_applications(queryset, filters):
    if filters.get('status'):
        queryset = queryset.filter(status=filters['status'])
    for field in ('offer_id', 'student_user_id', 'company_user_id'):
        if filters.get(field):
            queryset = queryset.filter(**{field: filters[field]})
    if filters.get('created_after'):
        queryset = queryset.filter(created_at__gte=filters['created_after'])
    if filters.get('created_before'):
        queryset = queryset.filter(created_at__lte=filters['created_before'])
    return queryset.order_by(filters.get('ordering') or '-created_at')


def reject_unknown_query_params(serializer, request):
    unknown = sorted(set(request.query_params) - set(serializer.fields))
    if unknown:
        raise ValidationError(
            {key: 'Unknown query parameter.' for key in unknown}
        )


class ApplicationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        return visible_applications_for(self.request.user)

    def list(self, request, *args, **kwargs):
        query = ApplicationQuerySerializer(data=request.query_params)
        reject_unknown_query_params(query, request)
        query.is_valid(raise_exception=True)
        filters = query.validated_data

        queryset = filter_applications(self.get_queryset(), filters)
        return Response(
            paginate(
                queryset,
                limit=filters['limit'],
                offset=filters['offset'],
                serializer_class=ApplicationSerializer,
            )
        )

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != Role.STUDENT:
            return Response(
                {"code": "PERMISSION_DENIED", "message": "Only students can submit applications."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = submit_application(
            student_user_id=request.user.id,
            offer_id=serializer.validated_data['offer_id'],
            start_date=serializer.validated_data['start_date'],
            end_date=serializer.validated_data['end_date'],
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class ApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsApplicationParticipant]

    def get_queryset(self):
        return visible_applications_for(self.request.user)


class ApplicationHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsApplicationParticipant]

    def get(self, request, pk):
        application = visible_applications_for(request.user).filter(pk=pk).first()
        if application is None:
            return Response(
                {"code": "NOT_FOUND", "message": "Application not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Object-level permission still applies for platform/university roles.
        self.check_object_permissions(request, application)

        query = HistoryQuerySerializer(data=request.query_params)
        reject_unknown_query_params(query, request)
        query.is_valid(raise_exception=True)

        queryset = ApplicationStatusHistory.objects.filter(application=application)
        return Response(
            paginate(
                queryset,
                limit=query.validated_data['limit'],
                offset=query.validated_data['offset'],
                serializer_class=ApplicationStatusHistorySerializer,
            )
        )


class CompanyDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsCompany]

    def post(self, request, pk):
        serializer = CompanyDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = decide_as_company(
            application_id=pk,
            company_user_id=request.user.id,
            decision=serializer.validated_data['decision'],
            reason=serializer.validated_data.get('reason', ''),
            actor_role=request.user.role,
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_200_OK)


class UniversityDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsUniversity]

    def post(self, request, pk):
        serializer = UniversityDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = decide_as_university(
            application_id=pk,
            university_user_id=request.user.id,
            decision=serializer.validated_data['decision'],
            reason=serializer.validated_data.get('reason', ''),
            actor_role=request.user.role,
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_200_OK)


class StudentDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, pk):
        serializer = StudentDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = decide_as_student(
            application_id=pk,
            student_user_id=request.user.id,
            decision=serializer.validated_data['decision'],
            actor_role=request.user.role,
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_200_OK)


class WithdrawApplicationView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, pk):
        serializer = WithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = withdraw_application(
            application_id=pk,
            student_user_id=request.user.id,
            reason=serializer.validated_data.get('reason', ''),
            actor_role=request.user.role,
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_200_OK)


class InternalReleasePlaceView(APIView):
    """POST /api/internal/applications/<uuid>/release-place/ (service only).

    Idempotent: the ``place_released_at`` marker makes repeated calls free at
    most one place. Returns 200 with ``released`` false when it was already done.
    """

    authentication_classes = []
    permission_classes = [IsInternalService]

    def post(self, request, pk):
        application, released = release_place_for_application(pk)
        return Response(
            {
                "id": str(application.id),
                "offer_id": str(application.offer_id),
                "released": released,
                "place_released_at": application.place_released_at,
            },
            status=status.HTTP_200_OK,
        )


class InternalOfferCapacityView(APIView):
    """GET /api/internal/offers/<uuid>/capacity/ (service only).

    Offers uses this snapshot to decide whether a capacity reduction is safe.
    """

    authentication_classes = []
    permission_classes = [IsInternalService]

    def get(self, request, offer_id):
        return Response(offer_capacity_snapshot(offer_id))
