import jwt
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from django.conf import settings


class ServicePrincipal:
    is_authenticated = True
    is_anonymous = False

    def __init__(self, service_id):
        self.service_id = service_id


class ServiceJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()
        if not auth_header:
            return None
        if len(auth_header) != 2 or auth_header[0].lower() != b"bearer":
            raise AuthenticationFailed("Invalid service authorization header.")

        try:
            raw_token = auth_header[1].decode("utf-8")
            claims = jwt.decode(
                raw_token,
                settings.SERVICE_JWT_SIGNING_KEY,
                algorithms=[settings.SERVICE_JWT_ALGORITHM],
                audience=settings.SERVICE_JWT_AUDIENCE,
                issuer=settings.SERVICE_JWT_ISSUER,
                options={
                    "require": ["aud", "exp", "iat", "iss", "scope", "sub"]
                },
            )
        except (UnicodeDecodeError, jwt.InvalidTokenError) as exc:
            raise AuthenticationFailed("Invalid or expired service token.") from exc

        service_id = claims.get("sub")
        if not isinstance(service_id, str) or not service_id.strip():
            raise AuthenticationFailed("Invalid service identity.")
        issued_at = claims.get("iat")
        expires_at = claims.get("exp")
        if (
            not isinstance(issued_at, (int, float))
            or isinstance(issued_at, bool)
            or not isinstance(expires_at, (int, float))
            or isinstance(expires_at, bool)
            or expires_at <= issued_at
            or expires_at - issued_at > settings.SERVICE_JWT_MAX_LIFETIME_SECONDS
        ):
            raise AuthenticationFailed("Invalid service token lifetime.")
        if claims.get("scope") != "identity:users:read":
            raise AuthenticationFailed("The service token has insufficient scope.")

        return ServicePrincipal(service_id), claims

    def authenticate_header(self, request):
        return "Bearer"
