from .models import Internship
from .roles import Role


def visible_internships_for(actor):
    """
    Returns only the internships this caller is allowed to see.
    Every read goes through this function, so the rules live in one place.
    """
    if actor.role == Role.STUDENT:
        return Internship.objects.filter(student_user_id=actor.user_id)

    if actor.role == Role.COMPANY:
        return Internship.objects.filter(company_user_id=actor.user_id)

    if actor.role == Role.SUPERVISOR:
        # Supervisors see only internships explicitly assigned to them.
        return Internship.objects.filter(supervisor_user_id=actor.user_id)

    if actor.role == Role.UNIVERSITY_ADMINISTRATION:
        return Internship.objects.all()

    # Platform Administrator, and any role not listed above, sees nothing.
    # Default-deny.
    return Internship.objects.none()
