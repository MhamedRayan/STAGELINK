from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from api.models import (
    CompanyProfile,
    PUBLIC_REGISTRATION_ROLES,
    StudentProfile,
    SupervisorProfile,
    User,
    UserRole,
)
from api.profile_services import ensure_role_profile


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
            user = User.objects.create_user(**validated_data)
            ensure_role_profile(user)
            return user
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


class StrictModelSerializer(serializers.ModelSerializer):
    """Reject unknown input instead of silently ignoring misspelled fields."""

    PROTECTED_INPUT_FIELDS = {
        "id",
        "user",
        "user_id",
        "email",
        "role",
        "is_active",
        "date_joined",
        "password",
        "password_hash",
    }

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            supplied = set(data.keys())
            allowed = set(self.fields.keys())
            read_only_fields = {
                field_name
                for field_name, field in self.fields.items()
                if field.read_only
            }
            errors = {
                field: "This field is read-only."
                for field in supplied & (self.PROTECTED_INPUT_FIELDS | read_only_fields)
            }
            errors.update(
                {
                    field: "Unknown field."
                    for field in supplied - allowed - set(errors)
                }
            )
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)


class StudentProfileSerializer(StrictModelSerializer):
    university = serializers.CharField(max_length=255, required=True, allow_blank=True)
    department = serializers.CharField(max_length=255, required=True, allow_blank=True)
    specialty = serializers.CharField(max_length=255, required=True, allow_blank=True)
    academic_year = serializers.CharField(max_length=64, required=True, allow_blank=True)
    matricule = serializers.CharField(max_length=128, required=True, allow_blank=True)

    class Meta:
        model = StudentProfile
        fields = ("id", "university", "department", "specialty", "academic_year", "matricule")
        read_only_fields = ("id",)


class CompanyProfileSerializer(StrictModelSerializer):
    legal_name = serializers.CharField(max_length=255, required=True, allow_blank=True)
    address = serializers.CharField(required=True, allow_blank=True)
    contact_person = serializers.CharField(max_length=255, required=True, allow_blank=True)
    phone = serializers.CharField(max_length=64, required=True, allow_blank=True)
    website = serializers.URLField(max_length=255, required=True, allow_blank=True)
    description = serializers.CharField(required=True, allow_blank=True)
    verified_by = serializers.UUIDField(source="verified_by_id", read_only=True, allow_null=True)

    class Meta:
        model = CompanyProfile
        fields = (
            "id",
            "legal_name",
            "address",
            "contact_person",
            "phone",
            "website",
            "description",
            "verification_status",
            "verified_by",
            "verified_at",
            "rejection_reason",
        )
        read_only_fields = (
            "id",
            "verification_status",
            "verified_by",
            "verified_at",
            "rejection_reason",
        )


class PublicCompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ("id", "legal_name", "address", "website", "description")


class SupervisorProfileSerializer(StrictModelSerializer):
    department = serializers.CharField(max_length=255, required=True, allow_blank=True)
    grade = serializers.CharField(max_length=255, required=True, allow_blank=True)

    class Meta:
        model = SupervisorProfile
        fields = ("id", "department", "grade")
        read_only_fields = ("id",)


class CompanyRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False, trim_whitespace=True)

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra_fields = set(data.keys()) - {"reason"}
            if extra_fields:
                raise serializers.ValidationError(
                    {field: "Unknown field." for field in extra_fields}
                )
        return super().to_internal_value(data)


class AdminUserCreateSerializer(serializers.Serializer):
    PROVISIONABLE_ROLES = (
        UserRole.COMPANY,
        UserRole.UNIVERSITY_ADMIN,
        UserRole.SUPERVISOR,
    )

    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(max_length=255)
    role = serializers.ChoiceField(choices=[(role, role) for role in PROVISIONABLE_ROLES])
    password = serializers.CharField(
        max_length=128,
        required=False,
        write_only=True,
        trim_whitespace=False,
    )
    generate_password = serializers.BooleanField(required=False, default=False)

    ALLOWED_FIELDS = {"email", "name", "role", "password", "generate_password"}

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra_fields = set(data.keys()) - self.ALLOWED_FIELDS
            if extra_fields:
                raise serializers.ValidationError(
                    {field: "Unknown field." for field in extra_fields}
                )
        return super().to_internal_value(data)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "An account with this email address already exists."
            )
        return email

    def validate(self, attrs):
        password = attrs.get("password")
        generate_password = attrs.get("generate_password", False)
        if bool(password) == bool(generate_password):
            raise serializers.ValidationError(
                {
                    "password": (
                        "Provide either a password or set generate_password to true, "
                        "but not both."
                    )
                }
            )
        if password:
            candidate = User(
                email=attrs["email"],
                name=attrs["name"],
                role=attrs["role"],
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class AdminUserUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    verification_status = serializers.ChoiceField(
        choices=CompanyProfile.VerificationStatus.choices,
        required=False,
    )
    rejection_reason = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=True,
    )

    ALLOWED_FIELDS = {"is_active", "verification_status", "rejection_reason"}

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra_fields = set(data.keys()) - self.ALLOWED_FIELDS
            if extra_fields:
                raise serializers.ValidationError(
                    {field: "This field cannot be updated here." for field in extra_fields}
                )
        return super().to_internal_value(data)

    def validate(self, attrs):
        user = self.context["user"]
        if user.role != UserRole.COMPANY and {
            "verification_status",
            "rejection_reason",
        }.intersection(attrs):
            raise serializers.ValidationError(
                {"verification_status": "Verification fields apply only to company accounts."}
            )
        if user.role == UserRole.COMPANY:
            profile = ensure_role_profile(user)
            status_value = attrs.get("verification_status", profile.verification_status)
            reason = attrs.get("rejection_reason", profile.rejection_reason)
            if status_value == CompanyProfile.VerificationStatus.REJECTED and not reason.strip():
                raise serializers.ValidationError(
                    {"rejection_reason": "A reason is required when rejecting a company."}
                )
            if attrs.get("is_active") is True and status_value != CompanyProfile.VerificationStatus.ACTIVE:
                raise serializers.ValidationError(
                    {"is_active": "A company must be verified before it can be activated."}
                )
        if not attrs:
            raise serializers.ValidationError("At least one update field is required.")
        return attrs
