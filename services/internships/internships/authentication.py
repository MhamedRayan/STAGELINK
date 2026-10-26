from dataclasses import dataclass

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .roles import ALL_ROLES


@dataclass(frozen=True)
class Actor:
    """The authenticated caller, built from a verified JWT."""

    user_id: int
    role: str

    @property
    def is_authenticated(self):
        return True


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

        return self._build_actor(token), token

    def authenticate_header(self, request):
        # Returning a value makes DRF answer 401 (not 403) when credentials are missing.
        return 'Bearer realm="api"'

    def _build_actor(self, token):
        try:
            # algorithms is a fixed list, so a token claiming "none" or any other
            # algorithm is rejected. Required claims must be present.
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

        # Role values are matched exactly. "STUDENT" and "Student" are different.
        role = payload["role"]
        if role not in ALL_ROLES:
            raise AuthenticationFailed("Unknown role.")

        try:
            user_id = int(payload["user_id"])
        except (TypeError, ValueError):
            raise AuthenticationFailed("Invalid user id.")
        if user_id < 1:
            raise AuthenticationFailed("Invalid user id.")

        return Actor(user_id=user_id, role=role)
