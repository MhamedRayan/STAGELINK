from rest_framework import serializers

from .models import Internship


class InternshipCreateSerializer(serializers.Serializer):
    """
    Input for creating an internship. It is a plain Serializer on purpose:
    a ModelSerializer would add a uniqueness validator on source_application_id
    and reject retries with 400. Retries must return the existing record instead.
    The status field is absent on purpose: the server always sets it to Confirmed.
    """

    source_application_id = serializers.IntegerField(min_value=1)
    student_user_id = serializers.IntegerField(min_value=1)
    company_user_id = serializers.IntegerField(min_value=1)
    offer_id = serializers.IntegerField(min_value=1)
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
            "start_date",
            "end_date",
            "status",
            "created_at",
        ]
        read_only_fields = fields
