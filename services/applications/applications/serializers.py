from rest_framework import serializers

from .models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    DecisionChoices,
    StudentDecisionChoices,
)


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = (
            'id',
            'status',
            'company_decision',
            'company_reason',
            'university_decision',
            'university_reason',
            'university_user_id',
            'student_decision',
            'withdrawal_reason',
            'withdrawn_at',
            'place_released_at',
            'created_at',
            'updated_at',
        )


class ApplicationCreateSerializer(serializers.ModelSerializer):
    """The company is derived from the offer, never supplied by the student."""

    class Meta:
        model = Application
        fields = ('offer_id', 'start_date', 'end_date')

    def validate(self, attrs):
        if attrs['end_date'] < attrs['start_date']:
            raise serializers.ValidationError(
                {'end_date': 'End date cannot be before start date.'}
            )
        return attrs


class CompanyDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=DecisionChoices.choices)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['decision'] == DecisionChoices.REJECT and not data.get('reason'):
            raise serializers.ValidationError(
                {"reason": "A reason is strictly required when rejecting an application."}
            )
        return data


class UniversityDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=DecisionChoices.choices)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['decision'] == DecisionChoices.REJECT and not data.get('reason'):
            raise serializers.ValidationError(
                {"reason": "A reason is strictly required when rejecting an application."}
            )
        return data


class StudentDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=StudentDecisionChoices.choices)


class WithdrawalSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationStatusHistory
        fields = (
            'id',
            'from_status',
            'to_status',
            'actor_user_id',
            'actor_role',
            'reason',
            'created_at',
        )
        read_only_fields = fields


ORDERING_FIELDS = (
    'created_at',
    'updated_at',
    'status',
    'start_date',
    'end_date',
)


class ApplicationQuerySerializer(serializers.Serializer):
    """Validated filters for the application list (P1-2)."""

    status = serializers.ChoiceField(choices=ApplicationStatus.choices, required=False)
    offer_id = serializers.UUIDField(required=False)
    student_user_id = serializers.UUIDField(required=False)
    company_user_id = serializers.UUIDField(required=False)
    created_after = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
    ordering = serializers.ChoiceField(
        choices=ORDERING_FIELDS + tuple(f'-{field}' for field in ORDERING_FIELDS),
        required=False,
        default='-created_at',
    )
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=20)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)


class HistoryQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=20)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)
