"""Institution scoping for university administrators.

Identity stores the institution as plain text on each role profile and compares
it case-insensitively after trimming. There is intentionally no foreign key to a
reference-data model: reference data is deferred, and the same
plain-UUID/plain-text rule applies across services.
"""

from django.db.models import Q

from api.models import UserRole
from api.profile_services import ensure_role_profile

SCOPED_ROLES = (UserRole.STUDENT, UserRole.SUPERVISOR)


def normalise_university(value):
    """Return a comparable university name, or an empty string."""
    return (value or "").strip().casefold()


def admin_university(admin):
    """Return the caller's trimmed university text, or None for other roles."""
    if admin is None or not getattr(admin, "is_authenticated", False):
        return None
    if admin.role != UserRole.UNIVERSITY_ADMIN:
        return None
    profile = ensure_role_profile(admin)
    return (profile.university or "").strip()


def scope_admin_users(admin, queryset):
    """Limit a user queryset to the accounts a university admin may manage."""
    university = admin_university(admin)
    if university is None:
        return queryset
    if not university:
        return queryset.none()
    university = normalise_university(university)
    return queryset.filter(
        Q(
            role=UserRole.STUDENT,
            student_profile__university__iexact=university,
        )
        | Q(
            role=UserRole.SUPERVISOR,
            supervisor_profile__university__iexact=university,
        )
    )
