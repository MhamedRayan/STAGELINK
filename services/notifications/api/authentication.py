"""Authentication classes for the notifications service.

JWTAuthentication validates tokens issued by Identity & Profiles locally
(signature + expiry); there is no local User table.

DevHeaderAuthentication is a development-only stub that trusts X-User-Id.
It only works when DEV_AUTH_ENABLED is true (default: same as DEBUG).
"""
import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

USER_ID_HEADER = "HTTP_X_USER_ID"
ALLOWED_JWT_ALGORITHMS = {"HS256", "HS384", "HS512", "RS256", "RS384", "RS512"}
ACCESS_TOKEN_TYPE = "access"


class StatelessUser:
    """Lightweight user built from the token; there is no local User table."""

    is_authenticated = True

    def __init__(self, user_id, role=None):
        self.id = user_id
        self.role = role


class JWTAuthentication(BaseAuthentication):
    """Validate 'Authorization: Bearer <token>' locally.

    Only the configured algorithm is accepted (so "none" and algorithm
    switching are rejected), an expiry is mandatory, and refresh tokens
    cannot be used to call the API.
    """

    def authenticate(self, request):
        auth_parts = get_authorization_header(request).split()
        if not auth_parts or auth_parts[0].lower() != b"bearer":
            return None  # No bearer token: let other authenticators try.

        if len(auth_parts) != 2:
            raise AuthenticationFailed("Invalid Authorization header.")

        try:
            token = auth_parts[1].decode()
        except UnicodeError:
            raise AuthenticationFailed("Invalid token.")

        payload = self._decode_token(token)
        user_id = self._extract_user_id(payload)
        role = payload.get(settings.JWT_ROLE_CLAIM)
        return (StatelessUser(user_id, role), token)

    def authenticate_header(self, request):
        return "Bearer"

    def _decode_token(self, token):
        if settings.JWT_ALGORITHM not in ALLOWED_JWT_ALGORITHMS:
            raise AuthenticationFailed("Unsupported JWT algorithm configuration.")
        if not settings.JWT_SIGNING_KEY:
            raise AuthenticationFailed("JWT verification is not configured.")

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SIGNING_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"require": ["exp"]},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired.")
        except jwt.PyJWTError:
            raise AuthenticationFailed("Invalid token.")

        if payload.get("token_type", ACCESS_TOKEN_TYPE) != ACCESS_TOKEN_TYPE:
            raise AuthenticationFailed("Only access tokens are accepted.")

        return payload

    def _extract_user_id(self, payload):
        raw_user_id = payload.get(settings.JWT_USER_ID_CLAIM)
        if raw_user_id is None or isinstance(raw_user_id, (bool, float)):
            raise AuthenticationFailed("Token has no valid user id.")

        try:
            user_id = int(raw_user_id)
        except (TypeError, ValueError):
            raise AuthenticationFailed("Token has no valid user id.")

        if user_id < 1:
            raise AuthenticationFailed("Token has no valid user id.")
        return user_id


class DevHeaderAuthentication(BaseAuthentication):
    """DEV ONLY: trust the X-User-Id header when DEV_AUTH_ENABLED is true."""

    def authenticate(self, request):
        if not settings.DEV_AUTH_ENABLED:
            return None

        raw_user_id = request.META.get(USER_ID_HEADER)
        if raw_user_id is None:
            return None

        try:
            user_id = int(raw_user_id)
        except ValueError:
            raise AuthenticationFailed("X-User-Id must be an integer.")

        return (StatelessUser(user_id), None)

    def authenticate_header(self, request):
        return "X-User-Id"
