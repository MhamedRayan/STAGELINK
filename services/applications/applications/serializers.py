from rest_framework import serializers
from .models import Application, DecisionChoices, StudentDecisionChoices

class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ('id', 'status', 'created_at', 'updated_at')

class ApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ('offer_id', 'company_id')

class CompanyDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=DecisionChoices.choices)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['decision'] == DecisionChoices.REJECT and not data.get('reason'):
            raise serializers.ValidationError({"reason": "A reason is strictly required when rejecting an application."})
        return data

class UniversityDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=DecisionChoices.choices)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['decision'] == DecisionChoices.REJECT and not data.get('reason'):
            raise serializers.ValidationError({"reason": "A reason is strictly required when rejecting an application."})
        return data

class StudentDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=StudentDecisionChoices.choices)
