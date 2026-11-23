import secrets
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from api.admin_scope import (
    SCOPED_ROLES,
    admin_university,
    normalise_university,
    scope_admin_users,
)
from api.directory import user_summary
from api.models import (
    CompanyProfile,
    User,
    UserRole,
)
from api.permissions import IsPlatformAdmin, IsTrustedService, IsUniversityAdmin
from api.profile_services import ROLE_PROFILE_MODELS, ensure_role_profile
from api.serializers import (
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    CompanyProfileSerializer,
    CompanyRejectSerializer,
    DeactivateAccountSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PublicCompanyProfileSerializer,
    StudentProfileSerializer,
    SupervisorProfileSerializer,
    UniversityAdminProfileSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


class ApiPagePagination(PageNumberPagination):
    page_size = 20
    page_query_param = "page"


def health(request):
    """Unauthenticated liveness probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "identity"})


class UserRegistrationView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "register"

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserProfileSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class UserLoginView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "login"

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        ensure_role_profile(user)

        refresh_token = RefreshToken.for_user(user)
        refresh_token["email"] = user.email
        refresh_token["role"] = user.role
        access_token = refresh_token.access_token

        return Response(
            {
                "token_type": "Bearer",
                "access": str(access_token),
                "refresh": str(refresh_token),
                "expires_in": int(access_token.lifetime.total_seconds()),
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class UserProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError as exc:
            raise ValidationError(
                {"email": "An account with this email address already exists."}
            ) from exc
        return Response(UserProfileSerializer(user).data)


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            refresh_token = RefreshToken(serializer.validated_data["refresh"])
        except TokenError as exc:
            if "blacklist" in str(exc).lower():
                # Logging out twice is harmless; the token is already revoked.
                return Response({"detail": "Logged out."})
            raise ValidationError(
                {"refresh": "This refresh token is invalid or has expired."}
            ) from exc

        if str(refresh_token.get("user_id")) != str(request.user.pk):
            raise PermissionDenied("This refresh token belongs to another account.")

        refresh_token.blacklist()
        return Response({"detail": "Logged out."})


def _blacklist_all_refresh_tokens(user):
    """Revoke every refresh token issued to a user.

    Access tokens are stateless and stay valid until they expire, but no new
    access token can be obtained once the refresh tokens are blacklisted.
    """
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


class PasswordChangeView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password_hash"])
        _blacklist_all_refresh_tokens(user)

        return Response({"detail": "Password changed. Sign in again."})


class DeactivateAccountView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = DeactivateAccountSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.is_active = False
        user.save(update_fields=["is_active"])
        _blacklist_all_refresh_tokens(user)

        return Response({"detail": "Account deactivated."})


class InternalUserLookupView(APIView):
    authentication_classes = ()
    permission_classes = (IsTrustedService,)

    def get(self, request, user_id):
        try:
            user = User.objects.only(
                "id", "email", "name", "role", "is_active"
            ).get(pk=user_id)
        except User.DoesNotExist as exc:
            raise NotFound("User not found.") from exc

        return Response(
            {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "is_active": user.is_active,
            }
        )


class UserRoleProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def _get_profile_and_serializer(self, user):
        profile_model = ROLE_PROFILE_MODELS.get(user.role)
        if profile_model is None:
            raise PermissionDenied("This account role does not have a role-specific profile.")
        profile = ensure_role_profile(user)
        serializer_class = {
            UserRole.STUDENT: StudentProfileSerializer,
            UserRole.COMPANY: CompanyProfileSerializer,
            UserRole.SUPERVISOR: SupervisorProfileSerializer,
            UserRole.UNIVERSITY_ADMIN: UniversityAdminProfileSerializer,
        }[user.role]
        return profile, serializer_class

    def get(self, request):
        profile, serializer_class = self._get_profile_and_serializer(request.user)
        return Response(serializer_class(profile).data)

    def put(self, request):
        profile, serializer_class = self._get_profile_and_serializer(request.user)
        serializer = serializer_class(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PublicCompanyProfileView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, company_id):
        try:
            profile = CompanyProfile.objects.select_related("user").get(
                user_id=company_id,
                user__role=UserRole.COMPANY,
                user__is_active=True,
                verification_status=CompanyProfile.VerificationStatus.ACTIVE,
            )
        except CompanyProfile.DoesNotExist as exc:
            raise NotFound("Verified company profile not found.") from exc
        return Response(PublicCompanyProfileSerializer(profile).data)


class PublicCompanyVerificationView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, company_id):
        try:
            profile = CompanyProfile.objects.only("verification_status").get(
                user_id=company_id,
                user__role=UserRole.COMPANY,
            )
        except CompanyProfile.DoesNotExist as exc:
            raise NotFound("Company account not found.") from exc
        return Response(
            {
                "id": str(company_id),
                "verification_status": profile.verification_status,
            }
        )


class UserDirectoryListView(APIView):
    permission_classes = (IsAuthenticated,)

    allowed_query_params = {"role", "q", "university", "page"}

    def get(self, request):
        params = request.query_params
        unknown = set(params.keys()) - self.allowed_query_params
        if unknown:
            raise ValidationError(
                {name: "Unknown query parameter." for name in sorted(unknown)}
            )

        users = User.objects.filter(is_active=True).select_related(
            "student_profile",
            "company_profile",
            "supervisor_profile",
            "university_admin_profile",
        )
        role = params.get("role")
        if role is not None:
            if role not in UserRole.values:
                raise ValidationError({"role": "Unknown role."})
            users = users.filter(role=role)
        query = params.get("q", "").strip()
        if query:
            users = users.filter(Q(name__icontains=query) | Q(email__icontains=query))
        university = params.get("university", "").strip()
        if university:
            if not normalise_university(university):
                raise ValidationError({"university": "This field may not be blank."})
            users = users.filter(
                Q(student_profile__university__iexact=university)
                | Q(supervisor_profile__university__iexact=university)
                | Q(university_admin_profile__university__iexact=university)
            )
        users = users.order_by("email")
        paginator = ApiPagePagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response(
            [user_summary(request.user, user) for user in page]
        )


class UserLookupView(APIView):
    """Batch resolver for the UUIDs carried by other services."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        raw_ids = request.query_params.get("ids")
        if raw_ids is None:
            raise ValidationError({"ids": "Provide comma-separated user UUIDs."})
        if set(request.query_params.keys()) != {"ids"}:
            raise ValidationError(
                {"ids": "Batch lookup cannot be combined with directory filters."}
            )
        raw_values = raw_ids.split(",")
        if not raw_values or any(not value.strip() for value in raw_values):
            raise ValidationError({"ids": "Provide comma-separated UUIDs."})
        if len(raw_values) > 100:
            raise ValidationError({"ids": "At most 100 IDs may be requested."})
        try:
            requested_ids = [str(UUID(value.strip())) for value in raw_values]
        except (ValueError, AttributeError) as exc:
            raise ValidationError({"ids": "Every ID must be a valid UUID."}) from exc

        users_by_id = {
            str(user.id): user
            for user in User.objects.filter(id__in=set(requested_ids)).select_related(
                "student_profile",
                "company_profile",
                "supervisor_profile",
                "university_admin_profile",
            )
        }
        results = [
            user_summary(request.user, users_by_id[user_id])
            for user_id in requested_ids
            if user_id in users_by_id
        ]
        return Response({"results": results})


class UserDirectoryDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, user_id):
        try:
            user = User.objects.select_related(
                "student_profile",
                "company_profile",
                "supervisor_profile",
                "university_admin_profile",
            ).get(pk=user_id)
        except User.DoesNotExist as exc:
            raise NotFound("User not found.") from exc
        return Response(user_summary(request.user, user))


class InternalUserDirectoryView(APIView):
    authentication_classes = ()
    permission_classes = (IsTrustedService,)

    allowed_query_params = {"role", "department", "page", "ids"}

    @staticmethod
    def _directory_user(user):
        return {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    def get(self, request):
        params = request.query_params
        unknown_params = set(params.keys()) - self.allowed_query_params
        if unknown_params:
            raise ValidationError(
                {name: "Unknown query parameter." for name in sorted(unknown_params)}
            )

        if "ids" in params:
            if len(params) != 1:
                raise ValidationError(
                    {"ids": "Batch lookup cannot be combined with directory filters."}
                )
            raw_ids = params.get("ids", "").split(",")
            if not raw_ids or any(not value.strip() for value in raw_ids):
                raise ValidationError({"ids": "Provide comma-separated UUIDs."})
            if len(raw_ids) > 100:
                raise ValidationError({"ids": "At most 100 IDs may be requested."})
            try:
                requested_ids = [str(UUID(value.strip())) for value in raw_ids]
            except (ValueError, AttributeError) as exc:
                raise ValidationError({"ids": "Every ID must be a valid UUID."}) from exc

            users_by_id = {
                str(user.id): user
                for user in User.objects.filter(id__in=set(requested_ids)).only(
                    "id", "name"
                )
            }
            results = [
                {"id": user_id, "name": users_by_id[user_id].name}
                for user_id in requested_ids
                if user_id in users_by_id
            ]
            return Response({"results": results})

        # Directory recipients must be usable accounts. Batch lookup stays
        # unfiltered so callers can still render historical display names.
        users = User.objects.filter(is_active=True).only(
            "id", "name", "email", "role"
        )
        role = params.get("role")
        if role is not None:
            if role not in UserRole.values:
                raise ValidationError({"role": "Unknown role."})
            users = users.filter(role=role)

        department = params.get("department")
        if department is not None:
            if not department.strip():
                raise ValidationError({"department": "This field may not be blank."})
            users = users.filter(
                Q(student_profile__department=department.strip())
                | Q(supervisor_profile__department=department.strip())
            )

        users = users.order_by("email")
        paginator = ApiPagePagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response([self._directory_user(user) for user in page])


def _company_admin_summary(user):
    profile = ensure_role_profile(user)
    if not isinstance(profile, CompanyProfile):
        raise NotFound("Company account not found.")
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "verification_status": profile.verification_status,
        "verified_by": str(profile.verified_by_id) if profile.verified_by_id else None,
        "verified_at": profile.verified_at,
        "rejection_reason": profile.rejection_reason,
        "legal_name": profile.legal_name,
    }


def _admin_user_summary(user):
    result = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }
    if user.role == UserRole.COMPANY:
        profile = ensure_role_profile(user)
        result.update(
            {
                "verification_status": profile.verification_status,
                "verified_by": str(profile.verified_by_id) if profile.verified_by_id else None,
                "verified_at": profile.verified_at,
                "rejection_reason": profile.rejection_reason,
            }
        )
    elif user.role in (UserRole.STUDENT, UserRole.SUPERVISOR, UserRole.UNIVERSITY_ADMIN):
        profile = ensure_role_profile(user)
        result["university"] = getattr(profile, "university", "")
    return result


class AdminCompanyListView(APIView):
    permission_classes = (IsAuthenticated, IsPlatformAdmin)

    def get(self, request):
        unknown_params = set(request.query_params.keys()) - {"status", "page"}
        if unknown_params:
            raise ValidationError(
                {name: "Unknown query parameter." for name in sorted(unknown_params)}
            )
        verification_status = request.query_params.get("status")
        if verification_status not in CompanyProfile.VerificationStatus.values:
            raise ValidationError(
                {"status": "Choose pending, active, or rejected."}
            )
        profiles = CompanyProfile.objects.select_related("user", "verified_by").filter(
            verification_status=verification_status
        ).order_by("user__email")
        paginator = ApiPagePagination()
        page = paginator.paginate_queryset(profiles, request, view=self)
        return paginator.get_paginated_response(
            [_company_admin_summary(profile.user) for profile in page]
        )


class AdminCompanyVerifyView(APIView):
    permission_classes = (IsAuthenticated, IsPlatformAdmin)

    @transaction.atomic
    def post(self, request, company_id):
        try:
            profile = CompanyProfile.objects.select_related("user").get(
                user_id=company_id, user__role=UserRole.COMPANY
            )
        except CompanyProfile.DoesNotExist as exc:
            raise NotFound("Company account not found.") from exc
        user = profile.user
        user.is_active = True
        user.save(update_fields=["is_active"])
        if profile.verification_status != CompanyProfile.VerificationStatus.ACTIVE:
            profile.verification_status = CompanyProfile.VerificationStatus.ACTIVE
            profile.verified_by = request.user
            profile.verified_at = timezone.now()
            profile.rejection_reason = ""
            profile.save(
                update_fields=(
                    "verification_status",
                    "verified_by",
                    "verified_at",
                    "rejection_reason",
                )
            )
        elif profile.verified_by_id is None or profile.verified_at is None:
            profile.verified_by = request.user
            profile.verified_at = timezone.now()
            profile.save(update_fields=("verified_by", "verified_at"))
        return Response(_company_admin_summary(user))


class AdminCompanyRejectView(APIView):
    permission_classes = (IsAuthenticated, IsPlatformAdmin)

    @transaction.atomic
    def post(self, request, company_id):
        serializer = CompanyRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            profile = CompanyProfile.objects.select_related("user").get(
                user_id=company_id, user__role=UserRole.COMPANY
            )
        except CompanyProfile.DoesNotExist as exc:
            raise NotFound("Company account not found.") from exc
        profile.verification_status = CompanyProfile.VerificationStatus.REJECTED
        profile.rejection_reason = serializer.validated_data["reason"]
        profile.verified_by = None
        profile.verified_at = None
        profile.save(
            update_fields=(
                "verification_status",
                "rejection_reason",
                "verified_by",
                "verified_at",
            )
        )
        profile.user.is_active = False
        profile.user.save(update_fields=["is_active"])
        return Response(_company_admin_summary(profile.user))


ADMIN_USER_PERMISSIONS = (IsAuthenticated, IsPlatformAdmin | IsUniversityAdmin)


def _provisioned_university(request, role, values):
    """Validate and normalise the institution for a provisioned account.

    Returns the university to store on the role profile, or None when the
    account role has no institution field.
    """
    caller_university = admin_university(request.user)
    supplied = values.pop("university", None)

    if caller_university is not None:
        if role not in SCOPED_ROLES:
            raise PermissionDenied(
                "University administrators may provision only students and supervisors."
            )
        if not caller_university:
            raise PermissionDenied(
                "Your account has no university assigned; contact a platform administrator."
            )
        if supplied is not None and (
            normalise_university(supplied) != normalise_university(caller_university)
        ):
            raise ValidationError(
                {"university": "Students and supervisors must belong to your university."}
            )
        return caller_university

    if role not in (
        UserRole.STUDENT,
        UserRole.SUPERVISOR,
        UserRole.UNIVERSITY_ADMIN,
    ):
        if supplied is not None:
            raise ValidationError(
                {"university": "This role does not have a university."}
            )
        return None
    return (supplied or "").strip()


class AdminUserListCreateView(APIView):
    permission_classes = ADMIN_USER_PERMISSIONS

    def get(self, request):
        unknown_params = set(request.query_params.keys()) - {
            "role",
            "q",
            "university",
            "page",
        }
        if unknown_params:
            raise ValidationError(
                {name: "Unknown query parameter." for name in sorted(unknown_params)}
            )
        users = scope_admin_users(request.user, User.objects.all()).order_by("email")
        role = request.query_params.get("role")
        if role is not None:
            if role not in UserRole.values:
                raise ValidationError({"role": "Unknown role."})
            users = users.filter(role=role)
        query = request.query_params.get("q", "").strip()
        if query:
            users = users.filter(Q(name__icontains=query) | Q(email__icontains=query))
        university = request.query_params.get("university", "").strip()
        if university:
            if not normalise_university(university):
                raise ValidationError({"university": "This field may not be blank."})
            users = users.filter(
                Q(student_profile__university__iexact=university)
                | Q(supervisor_profile__university__iexact=university)
                | Q(university_admin_profile__university__iexact=university)
            )
        paginator = ApiPagePagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response([_admin_user_summary(user) for user in page])

    @transaction.atomic
    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        role = values["role"]
        university = _provisioned_university(request, role, values)
        one_time_password = None
        if values.pop("generate_password", False):
            one_time_password = secrets.token_urlsafe(24)
            values["password"] = one_time_password
        try:
            user = User.objects.create_user(**values)
        except IntegrityError as exc:
            raise ValidationError(
                {"email": "An account with this email address already exists."}
            ) from exc
        profile = ensure_role_profile(user)
        if university is not None and profile is not None:
            profile.university = university
            profile.save(update_fields=["university"])
        response_data = _admin_user_summary(user)
        if one_time_password:
            response_data["one_time_password"] = one_time_password
        location = request.build_absolute_uri(
            f"/api/admin/users/{user.id}/"
        )
        return Response(
            response_data,
            status=status.HTTP_201_CREATED,
            headers={"Location": location},
        )


class AdminUserDetailView(APIView):
    permission_classes = ADMIN_USER_PERMISSIONS

    def _get_user(self, request, user_id):
        user = scope_admin_users(request.user, User.objects.all()).filter(pk=user_id).first()
        if user is None:
            raise NotFound("User not found.")
        return user

    def get(self, request, user_id):
        return Response(_admin_user_summary(self._get_user(request, user_id)))

    @transaction.atomic
    def patch(self, request, user_id):
        user = self._get_user(request, user_id)
        caller_university = admin_university(request.user)
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if caller_university is not None:
            forbidden = set(data) - {
                "name",
                "email",
                "university",
                "department",
                "specialty",
                "academic_year",
                "matricule",
                "grade",
            }
            if forbidden:
                raise PermissionDenied(
                    "University administrators may edit scoped profile details only."
                )
            if "university" in data and (
                normalise_university(data["university"])
                != normalise_university(caller_university)
            ):
                raise ValidationError(
                    {"university": "Students and supervisors must belong to your university."}
                )
        serializer = AdminUserUpdateSerializer(
            data=data,
            context={"user": user},
        )
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data
        if user.role == UserRole.COMPANY:
            profile = ensure_role_profile(user)
            new_status = updates.get("verification_status")
            if new_status is not None:
                profile.verification_status = new_status
                if new_status == CompanyProfile.VerificationStatus.ACTIVE:
                    profile.verified_by = request.user
                    profile.verified_at = timezone.now()
                    profile.rejection_reason = ""
                    user.is_active = True
                elif new_status == CompanyProfile.VerificationStatus.REJECTED:
                    profile.verified_by = None
                    profile.verified_at = None
                    profile.rejection_reason = updates.get(
                        "rejection_reason", profile.rejection_reason
                    )
                    user.is_active = False
                else:
                    profile.verified_by = None
                    profile.verified_at = None
                    profile.rejection_reason = ""
                    user.is_active = False
                profile.save(
                    update_fields=(
                        "verification_status",
                        "verified_by",
                        "verified_at",
                        "rejection_reason",
                    )
                )
            elif "rejection_reason" in updates:
                profile.rejection_reason = updates["rejection_reason"]
                profile.save(update_fields=("rejection_reason",))
        else:
            profile = ensure_role_profile(user)
            profile_fields = {
                UserRole.STUDENT: (
                    "university",
                    "department",
                    "specialty",
                    "academic_year",
                    "matricule",
                ),
                UserRole.SUPERVISOR: ("university", "department", "grade"),
                UserRole.UNIVERSITY_ADMIN: ("university", "department"),
            }.get(user.role, ())
            changed_fields = [field for field in profile_fields if field in updates]
            for field in changed_fields:
                setattr(profile, field, updates[field])
            if changed_fields:
                profile.save(update_fields=changed_fields)
        user_fields = [field for field in ("name", "email", "is_active") if field in updates]
        for field in user_fields:
            setattr(user, field, updates[field])
        if user_fields:
            try:
                user.save(update_fields=user_fields)
            except IntegrityError as exc:
                raise ValidationError(
                    {"email": "An account with this email address already exists."}
                ) from exc
        return Response(_admin_user_summary(user))
