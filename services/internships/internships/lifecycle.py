from .exceptions import InvalidTransition
from .models import InternshipStatus

# Allowed status changes, from the functional spec (section 4.2).
#
# Cancelled is not in this table. It is reached only through the cancellation
# request process (P1-1), never by a direct status write.
ALLOWED_TRANSITIONS = {
    InternshipStatus.CONFIRMED: frozenset({InternshipStatus.IN_PROGRESS}),
    InternshipStatus.IN_PROGRESS: frozenset({InternshipStatus.COMPLETED}),
}


def ensure_transition_allowed(current_status, target_status):
    allowed = ALLOWED_TRANSITIONS.get(current_status, frozenset())
    if target_status not in allowed:
        raise InvalidTransition(
            message=f"Cannot change an internship from '{current_status}' to '{target_status}'."
        )
