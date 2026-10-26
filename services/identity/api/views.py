from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import IntegrityError, transaction

from api.authentication import ServiceJWTAuthentication
from api.models import User
from api.permissions import IsTrustedService
from api.serializers import (
    UserLoginSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


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


class InternalUserLookupView(APIView):
    authentication_classes = (ServiceJWTAuthentication,)
    permission_classes = (IsAuthenticated, IsTrustedService)

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
