from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from api.models import PUBLIC_REGISTRATION_ROLES, User, UserRole


class UserRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(
        max_length=128,
        write_only=True,
        trim_whitespace=False,
    )
    name = serializers.CharField(max_length=255)
    role = serializers.ChoiceField(choices=UserRole.choices)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        attrs["email"] = email

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "An account with this email address already exists."}
            )
        if attrs["role"] not in PUBLIC_REGISTRATION_ROLES:
            raise serializers.ValidationError(
                {"role": "This role must be provisioned by an administrator."}
            )

        candidate = User(email=email, name=attrs["name"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        try:
            return User.objects.create_user(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"email": "An account with this email address already exists."}
            ) from exc


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(
        max_length=128,
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            make_password(password)
            raise AuthenticationFailed("Invalid email or password.")

        password_matches = user.check_password(password)
        if not password_matches or not user.is_active:
            raise AuthenticationFailed("Invalid email or password.")

        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, max_length=254)

    PROTECTED_INPUT_FIELDS = {
        "id",
        "role",
        "is_active",
        "date_joined",
        "password",
        "password_hash",
        "is_staff",
        "is_superuser",
    }

    class Meta:
        model = User
        fields = ("id", "email", "name", "role", "is_active", "date_joined")
        read_only_fields = ("id", "role", "is_active", "date_joined")

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            attempted_fields = self.PROTECTED_INPUT_FIELDS.intersection(data.keys())
            if attempted_fields:
                field_errors = {
                    field_name: "This field is read-only."
                    for field_name in sorted(attempted_fields)
                }
                raise serializers.ValidationError(field_errors)
        return super().to_internal_value(data)

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exclude(
            pk=self.instance.pk
        ).exists():
            raise serializers.ValidationError(
                "An account with this email address already exists."
            )
        return normalized_email
