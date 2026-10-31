from django.db import transaction
from django.http import JsonResponse
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import Application, ApplicationStatus, DecisionChoices, StudentDecisionChoices
from .roles import Role
from .serializers import (
    ApplicationSerializer,
    ApplicationCreateSerializer,
    CompanyDecisionSerializer,
    UniversityDecisionSerializer,
    StudentDecisionSerializer
)
from .permissions import IsStudent, IsCompany, IsUniversity, IsApplicationParticipant
from .services import create_official_internship_record


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "applications"})


class ApplicationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        user_id = str(getattr(user, 'id', ''))
        role = getattr(user, 'role', None)

        if role == Role.STUDENT:
            return Application.objects.filter(student_user_id=user_id)
        elif role == Role.COMPANY:
            return Application.objects.filter(company_user_id=user_id)
        elif role in (Role.UNIVERSITY_ADMIN, Role.PLATFORM_ADMIN):
            return Application.objects.all()
        return Application.objects.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != Role.STUDENT:
            return Response({"detail": "Only students can submit applications."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_id = request.user.id
        offer_id = serializer.validated_data['offer_id']

        with transaction.atomic():
            # Prevent duplicate submissions
            if Application.objects.filter(offer_id=offer_id, student_user_id=student_id).exists():
                return Response({"detail": "You have already applied for this offer."}, status=status.HTTP_400_BAD_REQUEST)

            app = Application.objects.create(
                offer_id=offer_id,
                company_user_id=serializer.validated_data['company_user_id'],
                student_user_id=student_id,
                start_date=serializer.validated_data['start_date'],
                end_date=serializer.validated_data['end_date'],
                status=ApplicationStatus.SUBMITTED
            )

        return Response(ApplicationSerializer(app).data, status=status.HTTP_201_CREATED)


class ApplicationDetailView(generics.RetrieveAPIView):
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsApplicationParticipant]


class CompanyDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsCompany]

    def post(self, request, pk):
        serializer = CompanyDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            app = Application.objects.select_for_update().filter(pk=pk, company_user_id=request.user.id).first()
            if not app:
                return Response({"detail": "Application not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            if app.status != ApplicationStatus.SUBMITTED:
                return Response({"detail": f"Cannot make company decision on application in state '{app.status}'."},
                                status=status.HTTP_400_BAD_REQUEST)

            decision = serializer.validated_data['decision']
            reason = serializer.validated_data.get('reason', '')

            app.company_decision = decision
            app.company_reason = reason

            if decision == DecisionChoices.ACCEPT:
                app.status = ApplicationStatus.COMPANY_ACCEPTED
            else:
                app.status = ApplicationStatus.COMPANY_REJECTED  # Provisional reservation released

            app.save()

        return Response(ApplicationSerializer(app).data, status=status.HTTP_200_OK)


class UniversityDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsUniversity]

    def post(self, request, pk):
        serializer = UniversityDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            app = Application.objects.select_for_update().filter(pk=pk).first()
            if not app:
                return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

            if app.status != ApplicationStatus.COMPANY_ACCEPTED:
                return Response({"detail": "University can only evaluate applications accepted by company."},
                                status=status.HTTP_400_BAD_REQUEST)

            decision = serializer.validated_data['decision']
            reason = serializer.validated_data.get('reason', '')

            app.university_decision = decision
            app.university_reason = reason
            app.university_user_id = request.user.id

            if decision == DecisionChoices.ACCEPT:
                app.status = ApplicationStatus.UNIVERSITY_VALIDATED
            else:
                app.status = ApplicationStatus.UNIVERSITY_REJECTED  # Provisional reservation released

            app.save()

        return Response(ApplicationSerializer(app).data, status=status.HTTP_200_OK)


class StudentDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, pk):
        serializer = StudentDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            app = Application.objects.select_for_update().filter(pk=pk, student_user_id=request.user.id).first()
            if not app:
                return Response({"detail": "Application not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            if app.status != ApplicationStatus.UNIVERSITY_VALIDATED:
                return Response({"detail": "Student can only make decision after University validation."},
                                status=status.HTTP_400_BAD_REQUEST)

            decision = serializer.validated_data['decision']
            app.student_decision = decision

            if decision == StudentDecisionChoices.DECLINE:
                app.status = ApplicationStatus.STUDENT_DECLINED
                app.save()
                return Response(ApplicationSerializer(app).data, status=status.HTTP_200_OK)

            # Student ACCEPT path
            app.status = ApplicationStatus.STUDENT_ACCEPTED
            app.save()

            # Rule: Confirmation occurs strictly AFTER successful internship creation in downstream service
            success = create_official_internship_record(app)
            if success:
                app.status = ApplicationStatus.CONFIRMED
                app.save()
                return Response(ApplicationSerializer(app).data, status=status.HTTP_200_OK)
            else:
                # Rollback/revert status if downstream service fails
                transaction.set_rollback(True)
                return Response(
                    {"detail": "Failed to create official internship record with Internship Management service. Please try again."},
                    status=status.HTTP_502_BAD_GATEWAY
                )
