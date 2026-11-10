from api.models import (
    CompanyProfile,
    StudentProfile,
    SupervisorProfile,
    UserRole,
)


ROLE_PROFILE_MODELS = {
    UserRole.STUDENT: StudentProfile,
    UserRole.COMPANY: CompanyProfile,
    UserRole.SUPERVISOR: SupervisorProfile,
}


def ensure_role_profile(user):
    """Create the supported role profile once, including for existing users."""
    profile_model = ROLE_PROFILE_MODELS.get(user.role)
    if profile_model is None:
        return None
    profile, _ = profile_model.objects.get_or_create(user=user)
    return profile
