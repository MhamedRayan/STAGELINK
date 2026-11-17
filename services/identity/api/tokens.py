from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)


def revoke_user_refresh_tokens(user):
    """Blacklist every outstanding refresh token issued to a user."""
    for token in OutstandingToken.objects.filter(user_id=user.pk).iterator():
        BlacklistedToken.objects.get_or_create(token=token)
