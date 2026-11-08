from decimal import Decimal
from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import (
    CancellationRequest,
    Internship,
    InternshipAudit,
    InternshipEvaluation,
    InternshipStatus,
    InternshipSubmission,
)

ORDERING_CHOICES = ["created_at", "-created_at", "start_date", "-start_date"]


class InternshipCreateSerializer(serializers.Serializer):
    """
    Input for creating an internship. It is a plain Serializer on purpose:
    a ModelSerializer would add a uniqueness validator on source_application_id
    and reject retries with 400. Retries must return the existing record instead.
    The status field is absent on purpose: the server always sets it to confirmed.
    """

    source_application_id = serializers.UUIDField()
    student_user_id = serializers.UUIDField()
    company_user_id = serializers.UUIDField()
    offer_id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before start date."}
            )
        return attrs


class InternshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Internship
        fields = [
            "id",
            "source_application_id",
            "student_user_id",
            "company_user_id",
            "offer_id",
            "supervisor_user_id",
            "supervisor_assigned_by_user_id",
            "supervisor_assigned_at",
            "start_date",
            "end_date",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class InternshipQuerySerializer(serializers.Serializer):
    """Validated query parameters for GET /api/internships/."""

    limit = serializers.IntegerField(required=False, default=20, min_value=1, max_value=100)
    offset = serializers.IntegerField(required=False, default=0, min_value=0)
    status = serializers.ChoiceField(choices=InternshipStatus.choices, required=False)
    student_user_id = serializers.UUIDField(required=False)
    company_user_id = serializers.UUIDField(required=False)
    supervisor_user_id = serializers.UUIDField(required=False)
    start_date_from = serializers.DateField(required=False)
    start_date_to = serializers.DateField(required=False)
    mine = serializers.BooleanField(required=False, default=False)
    ordering = serializers.ChoiceField(choices=ORDERING_CHOICES, required=False)

    def validate(self, attrs):
        start_from = attrs.get("start_date_from")
        start_to = attrs.get("start_date_to")
        if start_from and start_to and start_to < start_from:
            raise serializers.ValidationError(
                {"start_date_to": "Must not be before start_date_from."}
            )
        return attrs


class SupervisorAssignSerializer(serializers.Serializer):
    supervisor_user_id = serializers.UUIDField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")


class InternshipAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternshipAudit
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "from_supervisor_user_id",
            "to_supervisor_user_id",
            "actor_user_id",
            "reason",
            "at",
        ]
        read_only_fields = fields


class CancellationRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)


class CancellationDecisionSerializer(serializers.Serializer):
    """Approving may omit the reason. Rejecting requires it; the service enforces that rule."""

    reason = serializers.CharField(
        max_length=500, required=False, allow_blank=True, trim_whitespace=True, default=""
    )


class CancellationRequestSerializer(serializers.ModelSerializer):
    internship_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = CancellationRequest
        fields = [
            "id",
            "internship_id",
            "requested_by_user_id",
            "requested_by_role",
            "reason",
            "status",
            "decided_by_user_id",
            "decided_at",
            "decision_reason",
            "created_at",
        ]
        read_only_fields = fields


class SubmissionFileSerializer(serializers.Serializer):
    """Validates an uploaded final submission before it reaches the service."""

    file = serializers.FileField()

    def validate_file(self, upload):
        extension = Path(upload.name or "").suffix.lower()
        if extension not in settings.ALLOWED_SUBMISSION_EXTENSIONS:
            allowed = ", ".join(settings.ALLOWED_SUBMISSION_EXTENSIONS)
            raise serializers.ValidationError(
                f"Unsupported file type. Allowed extensions: {allowed}."
            )
        if upload.size <= 0:
            raise serializers.ValidationError("The uploaded file is empty.")
        if upload.size > settings.MAX_SUBMISSION_SIZE_BYTES:
            raise serializers.ValidationError(
                "The uploaded file exceeds the maximum size of "
                f"{settings.MAX_SUBMISSION_SIZE_BYTES} bytes."
            )
        return upload


class InternshipSubmissionSerializer(serializers.ModelSerializer):
    """
    Read-only submission metadata. The storage path is deliberately absent:
    files are only reachable through the authorised download endpoint.
    """

    internship_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = InternshipSubmission
        fields = [
            "id",
            "internship_id",
            "version",
            "original_filename",
            "content_type",
            "size_bytes",
            "submitted_by_user_id",
            "status",
            "reviewed_by_user_id",
            "reviewed_at",
            "review_reason",
            "created_at",
        ]
        read_only_fields = fields


class SubmissionReviewSerializer(serializers.Serializer):
    """A reason is required for both approval and rejection. The service enforces it."""

    reason = serializers.CharField(
        max_length=500, allow_blank=True, trim_whitespace=True
    )


class EvaluationCreateSerializer(serializers.Serializer):
    grade = serializers.DecimalField(
        max_digits=4,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("20.00"),
    )
    comment = serializers.CharField(
        required=False, allow_blank=True, max_length=5000, default=""
    )


class InternshipEvaluationSerializer(serializers.ModelSerializer):
    internship_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = InternshipEvaluation
        fields = [
            "id",
            "internship_id",
            "supervisor_user_id",
            "grade",
            "comment",
            "created_at",
        ]
        read_only_fields = fields
