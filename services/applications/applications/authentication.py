import uuid
from dataclasses import dataclass

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .roles import ALL_ROLES


@dataclass(frozen=True)
class AuthenticatedUser:
    """The authenticated caller, built from a verified JWT.

    Applications has no local user table: identity owns accounts, so the token
    claims are the only user data this service needs.
    """

    id: uuid.UUID
    role: str

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class IdentityJWTAuthentication(BaseAuthentication):
    """
    Validates a Bearer JWT issued by the Identity & Profiles service.
    The signature is checked locally, so this service never calls Identity
    to verify a token.
    """

    keyword = b"bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).split()

        # No credentials at all: let the permission classes decide.
        if not header:
            return None

        if len(header) != 2 or header[0].lower() != self.keyword:
            raise AuthenticationFailed("Malformed authorization header.")

        try:
            token = header[1].decode("utf-8")
        except UnicodeDecodeError:
            raise AuthenticationFailed("Malformed token.")

        return self._build_user(token), token

    def authenticate_header(self, request):
        # Returning a value makes DRF answer 401 (not 403) when credentials are missing.
        return 'Bearer realm="api"'

    def _build_user(self, token):
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SIGNING_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"require": ["exp", "user_id", "role"]},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Invalid token.")

        # Only access tokens may be used on the API. Refresh tokens are not
        # accepted, even though they share the same signing key.
        if payload.get("token_type", "access") != "access":
            raise AuthenticationFailed("Invalid token type.")

        # Role values are matched exactly. "STUDENT" and "student" are different.
        role = payload["role"]
        if role not in ALL_ROLES:
            raise AuthenticationFailed("Unknown role.")

        try:
            user_id = uuid.UUID(str(payload["user_id"]))
        except (TypeError, ValueError, AttributeError):
            raise AuthenticationFailed("Invalid user id.")

        return AuthenticatedUser(id=user_id, role=role)
