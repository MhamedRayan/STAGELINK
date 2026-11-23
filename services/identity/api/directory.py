"""Field-visibility rules for the authenticated user directory.

The directory is the only user-facing way to resolve the UUIDs carried by
applications and internships. Every caller gets ``id``, ``name`` and ``role``;
additional fields are added here according to the viewer's role. Keep this
logic in one place so the list, single lookup and batch lookup cannot drift.
"""

from django.core.exceptions import ObjectDoesNotExist

from api.models import UserRole
from api.profile_services import ensure_role_profile

ADMIN_ROLES = (UserRole.UNIVERSITY_ADMIN, UserRole.PLATFORM_ADMIN)
STUDENT_ACADEMIC_FIELDS = (
    "university",
    "department",
    "specialty",
    "academic_year",
)

PROFILE_RELATED_NAMES = {
    UserRole.STUDENT: "student_profile",
    UserRole.COMPANY: "company_profile",
    UserRole.SUPERVISOR: "supervisor_profile",
    UserRole.UNIVERSITY_ADMIN: "university_admin_profile",
}


def role_profile(user):
    """Return an existing profile without an extra query when prefetched."""
    related_name = PROFILE_RELATED_NAMES.get(user.role)
    if related_name is None:
        return None
    try:
        profile = getattr(user, related_name)
    except ObjectDoesNotExist:
        profile = None
    return profile if profile is not None else ensure_role_profile(user)


def user_summary(viewer, user, profile=None):
    """Build the visibility-filtered directory representation of ``user``."""
    result = {
        "id": str(user.id),
        "name": user.name,
        "role": user.role,
    }
    is_admin = viewer.role in ADMIN_ROLES
    is_self = viewer.pk == user.pk

    if is_admin:
        result["is_active"] = user.is_active
    if is_admin or is_self:
        result["email"] = user.email

    if profile is None:
        profile = role_profile(user)
    if profile is None:
        return result

    if user.role == UserRole.COMPANY:
        if is_admin or is_self:
            result["phone"] = profile.phone
        return result

    if user.role == UserRole.STUDENT:
        # Supervisors and companies see the academic line so they can identify
        # the student behind an application or internship. Matricule and
        # contact details remain private to the student and administrators.
        if is_admin or is_self or viewer.role in (UserRole.SUPERVISOR, UserRole.COMPANY):
            for field in STUDENT_ACADEMIC_FIELDS:
                result[field] = getattr(profile, field)
        if is_admin or is_self:
            result["matricule"] = profile.matricule
        return result

    if user.role == UserRole.SUPERVISOR:
        if is_admin or is_self:
            result["university"] = profile.university
            result["department"] = profile.department
            result["grade"] = profile.grade
        return result

    if user.role == UserRole.UNIVERSITY_ADMIN:
        if is_admin or is_self:
            result["university"] = profile.university
            result["department"] = profile.department
        return result

    return result
