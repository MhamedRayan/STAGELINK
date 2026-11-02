from rest_framework import serializers

from .models import Internship, InternshipAudit, InternshipStatus

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
