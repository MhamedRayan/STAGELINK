from .models import Internship
from .roles import Role

# The field that links each role to an internship it takes part in.
PARTICIPATION_FIELDS = {
    Role.STUDENT: "student_user_id",
    Role.COMPANY: "company_user_id",
    Role.SUPERVISOR: "supervisor_user_id",
}


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

    if actor.role == Role.UNIVERSITY_ADMIN:
        return Internship.objects.all()

    # Platform Administrator, and any role not listed above, sees nothing.
    return Internship.objects.none()


def filter_internships(queryset, actor, filters):
    """
    Apply the caller's filters and ordering to an already visible queryset.
    Filters only narrow the result. They can never widen what the caller sees,
    because they are applied after visible_internships_for().
    """
    if filters.get("status"):
        queryset = queryset.filter(status=filters["status"])

    for field in ("student_user_id", "company_user_id", "supervisor_user_id"):
        if filters.get(field):
            queryset = queryset.filter(**{field: filters[field]})

    if filters.get("start_date_from"):
        queryset = queryset.filter(start_date__gte=filters["start_date_from"])
    if filters.get("start_date_to"):
        queryset = queryset.filter(start_date__lte=filters["start_date_to"])

    if filters.get("mine"):
        # "mine" means the caller's own participation. Roles without one
        # (university administration, platform administration) get nothing.
        field = PARTICIPATION_FIELDS.get(actor.role)
        queryset = queryset.filter(**{field: actor.user_id}) if field else queryset.none()

    ordering = filters.get("ordering") or "-created_at"
    return queryset.order_by(ordering, "pk")
