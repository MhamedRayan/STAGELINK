from django.http import FileResponse, JsonResponse
from rest_framework import generics, status as http_status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import EvaluationNotFound, SubmissionNotFound
from .permissions import (
    IsInternalService,
    IsStudent,
    IsStudentOrCompany,
    IsSupervisor,
    IsSupervisorOrUniversityAdmin,
    IsUniversityAdmin,
)
from .selectors import (
    filter_internships,
    visible_internships_for,
    visible_internships_for_submissions,
)
from .models import CancellationRequest
from .serializers import (
    CancellationDecisionSerializer,
    CancellationRequestCreateSerializer,
    CancellationRequestSerializer,
    EvaluationCreateSerializer,
    InternshipAuditSerializer,
    InternshipCreateSerializer,
    InternshipEvaluationSerializer,
    InternshipQuerySerializer,
    InternshipSerializer,
    InternshipSubmissionSerializer,
    SubmissionFileSerializer,
    SubmissionReviewSerializer,
    SupervisorAssignSerializer,
)
from .services import (
    assign_supervisor,
    complete_internship,
    create_evaluation,
    create_internship,
    create_submission,
    decide_cancellation,
    get_evaluation,
    get_history,
    list_submissions,
    request_cancellation,
    review_submission,
    start_internship,
)


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

        internship, created = create_internship(**serializer.validated_data)

        response_status = http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK
        return Response(InternshipSerializer(internship).data, status=response_status)


class InternshipListView(APIView):
    """
    Paginated, filtered list of the internships the caller may see.
    Response: {"results": [...], "pagination": {"limit", "offset", "total"}}
    """

    def get(self, request):
        query = InternshipQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data

        queryset = filter_internships(
            visible_internships_for(request.user), request.user, filters
        )
        total = queryset.count()
        offset, limit = filters["offset"], filters["limit"]
        page = queryset[offset : offset + limit]

        return Response(
            {
                "results": InternshipSerializer(page, many=True).data,
                "pagination": {"limit": limit, "offset": offset, "total": total},
            }
        )


class InternshipDetailView(generics.RetrieveAPIView):
    serializer_class = InternshipSerializer

    def get_queryset(self):
        # Filtering before the lookup means an internship the caller cannot see
        # returns 404, exactly like a missing one. This avoids leaking which IDs exist.
        return visible_internships_for(self.request.user)


class InternshipSupervisorView(APIView):
    """POST /api/internships/{id}/assign-supervisor/ (university administration only)."""

    permission_classes = [IsAuthenticated, IsUniversityAdmin]

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        serializer = SupervisorAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = assign_supervisor(
            internship,
            supervisor_user_id=serializer.validated_data["supervisor_user_id"],
            actor_user_id=request.user.user_id,
            reason=serializer.validated_data["reason"],
        )
        return Response(InternshipSerializer(updated).data)


class InternshipStartView(APIView):
    """POST /api/internships/{id}/start/ (university administration, on or after the start date)."""

    permission_classes = [IsAuthenticated, IsUniversityAdmin]

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        updated = start_internship(internship, actor_user_id=request.user.user_id)
        return Response(InternshipSerializer(updated).data)


class InternshipCompleteView(APIView):
    """POST /api/internships/{id}/complete/ (assigned supervisor or university administration)."""

    permission_classes = [IsAuthenticated, IsSupervisorOrUniversityAdmin]

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        updated = complete_internship(internship, actor_user_id=request.user.user_id)
        return Response(InternshipSerializer(updated).data)


class InternshipHistoryView(APIView):
    """GET /api/internships/{id}/history/ for everyone who can see the internship."""

    def get(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        entries = get_history(internship)
        return Response({"results": InternshipAuditSerializer(entries, many=True).data})


class CancellationRequestListCreateView(APIView):
    """
    GET: cancellation requests for an internship the caller can see.
    POST: request a cancellation (student or company on the internship only).
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStudentOrCompany()]
        return [IsAuthenticated()]

    def get(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        requests_qs = internship.cancellation_requests.all()
        return Response(
            {"results": CancellationRequestSerializer(requests_qs, many=True).data}
        )

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        serializer = CancellationRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cancellation = request_cancellation(
            internship,
            requested_by_user_id=request.user.user_id,
            requested_by_role=request.user.role,
            reason=serializer.validated_data["reason"],
        )
        return Response(
            CancellationRequestSerializer(cancellation).data,
            status=http_status.HTTP_201_CREATED,
        )


class CancellationDecisionView(APIView):
    """Base for approve and reject. University administration only."""

    permission_classes = [IsAuthenticated, IsUniversityAdmin]
    approve = False

    def post(self, request, pk, request_id):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        cancellation = get_object_or_404(
            CancellationRequest.objects.filter(internship=internship), pk=request_id
        )
        serializer = CancellationDecisionSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        _, updated_internship = decide_cancellation(
            internship,
            cancellation,
            approve=self.approve,
            actor_user_id=request.user.user_id,
            reason=serializer.validated_data["reason"],
        )
        return Response(InternshipSerializer(updated_internship).data)


class CancellationApproveView(CancellationDecisionView):
    approve = True


class CancellationRejectView(CancellationDecisionView):
    approve = False


# ---------------------------------------------------------------------------
# Final submissions (P1-2), review (P1-3) and evaluation (P1-4)
# ---------------------------------------------------------------------------


class InternshipSubmissionListCreateView(APIView):
    """
    GET: list the submission versions of an internship the caller may read.
    POST: upload a new version (student on the internship only).
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStudent()]
        return [IsAuthenticated()]

    def get(self, request, pk):
        internship = get_object_or_404(
            visible_internships_for_submissions(request.user), pk=pk
        )
        return Response(
            {
                "results": InternshipSubmissionSerializer(
                    list_submissions(internship), many=True
                ).data
            }
        )

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        serializer = SubmissionFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = create_submission(
            internship,
            upload=serializer.validated_data["file"],
            submitted_by_user_id=request.user.user_id,
        )
        return Response(
            InternshipSubmissionSerializer(submission).data,
            status=http_status.HTTP_201_CREATED,
        )


class InternshipSubmissionDownloadView(APIView):
    """GET: authorised download of one stored submission file."""

    def get(self, request, pk, submission_id):
        internship = get_object_or_404(
            visible_internships_for_submissions(request.user), pk=pk
        )
        submission = get_object_or_404(
            internship.submissions.all(), pk=submission_id
        )

        try:
            file_handle = submission.file.open("rb")
        except FileNotFoundError as exc:
            raise SubmissionNotFound(message="The stored file is missing.") from exc

        response = FileResponse(
            file_handle,
            as_attachment=True,
            filename=submission.original_filename or "submission",
            content_type=submission.content_type or "application/octet-stream",
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class SubmissionReviewView(APIView):
    """Base for approve and reject. Only the assigned supervisor may review."""

    permission_classes = [IsAuthenticated, IsSupervisor]
    approve = False

    def post(self, request, pk, submission_id):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        submission = get_object_or_404(
            internship.submissions.all(), pk=submission_id
        )
        serializer = SubmissionReviewSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        updated = review_submission(
            internship,
            submission,
            approve=self.approve,
            actor_user_id=request.user.user_id,
            reason=serializer.validated_data["reason"],
        )
        return Response(InternshipSubmissionSerializer(updated).data)


class SubmissionApproveView(SubmissionReviewView):
    approve = True


class SubmissionRejectView(SubmissionReviewView):
    approve = False


class InternshipEvaluationView(APIView):
    """
    GET: read the evaluation (student, company, assigned supervisor, university admin).
    POST: record it and complete the internship (assigned supervisor only).
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsSupervisor()]
        return [IsAuthenticated()]

    def get(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        evaluation = get_evaluation(internship)
        if evaluation is None:
            raise EvaluationNotFound()
        return Response(InternshipEvaluationSerializer(evaluation).data)

    def post(self, request, pk):
        internship = get_object_or_404(visible_internships_for(request.user), pk=pk)
        serializer = EvaluationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        evaluation = create_evaluation(
            internship,
            supervisor_user_id=request.user.user_id,
            grade=serializer.validated_data["grade"],
            comment=serializer.validated_data["comment"],
        )
        return Response(
            InternshipEvaluationSerializer(evaluation).data,
            status=http_status.HTTP_201_CREATED,
        )
