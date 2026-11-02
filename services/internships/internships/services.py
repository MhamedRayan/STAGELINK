"""
Business operations for internships.

Every change to an internship goes through a function in this module. Each one
runs in a database transaction, writes its audit entry in that same transaction,
and locks the row when the change depends on its current state.
"""

from django.db import IntegrityError, transaction
from django.utils import timezone

from .exceptions import (
    ActiveInternshipConflict,
    CancellationAlreadyPending,
    CancellationNotPending,
    EvaluationRequired,
    InvalidInternshipState,
    InvalidSupervisor,
    ReasonRequired,
    StartDateNotReached,
)
from .identity_client import fetch_identity_user
from .lifecycle import ensure_transition_allowed
from .models import (
    CancellationRequest,
    CancellationStatus,
    Internship,
    InternshipAudit,
    InternshipAuditAction,
    InternshipStatus,
)
from .roles import Role

# A supervisor can only be assigned while the internship is still running or about to start.
SUPERVISOR_ASSIGNABLE_STATUSES = (
    InternshipStatus.CONFIRMED,
    InternshipStatus.IN_PROGRESS,
)


def _record(
    internship,
    *,
    action,
    actor_user_id=None,
    from_status=None,
    to_status=None,
    from_supervisor_user_id=None,
    to_supervisor_user_id=None,
    reason="",
):
    InternshipAudit.objects.create(
        internship=internship,
        action=action,
        actor_user_id=actor_user_id,
        from_status=from_status,
        to_status=to_status,
        from_supervisor_user_id=from_supervisor_user_id,
        to_supervisor_user_id=to_supervisor_user_id,
        reason=reason,
    )


def _find_by_source_application(source_application_id):
    return Internship.objects.filter(source_application_id=source_application_id).first()


def create_internship(
    *,
    source_application_id,
    student_user_id,
    company_user_id,
    offer_id,
    start_date,
    end_date,
):
    """
    Create an internship for an accepted application.

    Returns (internship, created). created is False when the internship already
    existed for this source_application_id (an idempotent retry).

    Raises ActiveInternshipConflict if the student already has an active internship.
    """
    existing = _find_by_source_application(source_application_id)
    if existing is not None:
        return existing, False

    try:
        with transaction.atomic():
            internship = Internship.objects.create(
                source_application_id=source_application_id,
                student_user_id=student_user_id,
                company_user_id=company_user_id,
                offer_id=offer_id,
                start_date=start_date,
                end_date=end_date,
                status=InternshipStatus.CONFIRMED,
            )
            _record(
                internship,
                action=InternshipAuditAction.CREATED,
                to_status=InternshipStatus.CONFIRMED,
            )
        return internship, True
    except IntegrityError:
        # Two identical requests raced. The other one committed first, so the
        # row exists now. Return it instead of failing.
        existing = _find_by_source_application(source_application_id)
        if existing is not None:
            return existing, False
        # No row for this application, so the database refused because the
        # student already has an active internship.
        raise ActiveInternshipConflict()


def change_internship_status(internship, target_status, *, actor_user_id=None, reason=""):
    """
    The only place where an internship's status changes. It validates the
    transition, updates the row and writes the audit entry in one transaction.
    """
    with transaction.atomic():
        ensure_transition_allowed(internship.status, target_status)

        previous_status = internship.status
        internship.status = target_status
        internship.save(update_fields=["status"])

        _record(
            internship,
            action=InternshipAuditAction.STATUS_CHANGED,
            actor_user_id=actor_user_id,
            from_status=previous_status,
            to_status=target_status,
            reason=reason,
        )
    return internship


def start_due_internships(today=None):
    """
    Scheduled job: move every Confirmed internship whose start date has been
    reached to In progress. Returns how many were started.

    select_for_update locks the rows, so overlapping runs cannot start the same
    internship twice. Running it again changes nothing.
    """
    today = today or timezone.localdate()

    with transaction.atomic():
        due = list(
            Internship.objects.select_for_update()
            .filter(status=InternshipStatus.CONFIRMED, start_date__lte=today)
            .order_by("pk")
        )
        for internship in due:
            change_internship_status(
                internship,
                InternshipStatus.IN_PROGRESS,
                reason="Start date reached.",
            )

    return len(due)


def start_internship(internship, *, actor_user_id, today=None):
    """
    Manual start by university administration. Allowed only once the start date
    has been reached, because the spec makes the start automatic on that date.
    """
    today = today or timezone.localdate()

    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)
        ensure_transition_allowed(locked.status, InternshipStatus.IN_PROGRESS)
        if locked.start_date > today:
            raise StartDateNotReached()
        return change_internship_status(
            locked,
            InternshipStatus.IN_PROGRESS,
            actor_user_id=actor_user_id,
            reason="Started by university administration.",
        )


def _has_approved_evaluation(internship):
    # Placeholder until the evaluation model exists (P1-4). Until then no
    # internship can be completed, which is the safe default.
    return False


def complete_internship(internship, *, actor_user_id):
    """
    Move an In progress internship to Completed. The spec requires an approved
    final submission and a supervisor evaluation first.
    """
    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)
        ensure_transition_allowed(locked.status, InternshipStatus.COMPLETED)
        if not _has_approved_evaluation(locked):
            raise EvaluationRequired()
        return change_internship_status(
            locked,
            InternshipStatus.COMPLETED,
            actor_user_id=actor_user_id,
            reason="Evaluation recorded.",
        )


def assign_supervisor(internship, *, supervisor_user_id, actor_user_id, reason=""):
    """
    Assign or reassign the supervisor of a Confirmed or In progress internship.

    The supervisor is checked with the Identity service before any database
    lock is taken, so no transaction is held open during an HTTP call.
    Re-assigning requires a reason. Assigning the same supervisor again changes nothing.
    """
    reason = (reason or "").strip()

    user = fetch_identity_user(supervisor_user_id)
    if user is None or user.get("role") != Role.SUPERVISOR or not user.get("is_active"):
        raise InvalidSupervisor()

    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)

        if locked.status not in SUPERVISOR_ASSIGNABLE_STATUSES:
            raise InvalidInternshipState()

        previous = locked.supervisor_user_id
        if previous == supervisor_user_id:
            return locked

        if previous is not None and not reason:
            raise ReasonRequired(message="A reason is required to change the supervisor.")

        locked.supervisor_user_id = supervisor_user_id
        locked.supervisor_assigned_by_user_id = actor_user_id
        locked.supervisor_assigned_at = timezone.now()
        locked.save(
            update_fields=[
                "supervisor_user_id",
                "supervisor_assigned_by_user_id",
                "supervisor_assigned_at",
            ]
        )

        _record(
            locked,
            action=(
                InternshipAuditAction.SUPERVISOR_REASSIGNED
                if previous is not None
                else InternshipAuditAction.SUPERVISOR_ASSIGNED
            ),
            actor_user_id=actor_user_id,
            from_supervisor_user_id=previous,
            to_supervisor_user_id=supervisor_user_id,
            reason=reason,
        )
    return locked


def get_history(internship):
    return InternshipAudit.objects.filter(internship=internship).order_by("at", "pk")


# ---------------------------------------------------------------------------
# Cancellation requests (functional spec section 4.2)
#
# Cancelled is reached only through an approved request. The generic status
# change refuses it, so these two functions are the only way out.
# ---------------------------------------------------------------------------

CANCELLABLE_STATUSES = (
    InternshipStatus.CONFIRMED,
    InternshipStatus.IN_PROGRESS,
)


def request_cancellation(internship, *, requested_by_user_id, requested_by_role, reason):
    """
    Create a pending cancellation request. The internship row is locked, so two
    simultaneous requests cannot both succeed. The partial unique index is a second guard.
    """
    reason = (reason or "").strip()
    if not reason:
        raise ReasonRequired(message="A reason is required to request a cancellation.")

    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)

        if locked.status not in CANCELLABLE_STATUSES:
            raise InvalidInternshipState(
                message="Only a confirmed or in-progress internship can be cancelled."
            )
        if locked.cancellation_requests.filter(status=CancellationStatus.PENDING).exists():
            raise CancellationAlreadyPending()

        request = CancellationRequest.objects.create(
            internship=locked,
            requested_by_user_id=requested_by_user_id,
            requested_by_role=requested_by_role,
            reason=reason,
        )
        _record(
            locked,
            action=InternshipAuditAction.CANCELLATION_REQUESTED,
            actor_user_id=requested_by_user_id,
            reason=reason,
        )
    return request


def decide_cancellation(internship, request, *, approve, actor_user_id, reason=""):
    """
    University administration approves or rejects a pending request.

    Approval moves the internship to Cancelled and records the decision.
    Rejection leaves the internship unchanged.

    TODO(P1-1, cross-team): approval must also release the student's place on
    the offer through Applications/Offers. No such internal endpoint exists yet,
    so the release is not performed here. This needs a contract agreed with
    the Applications/Offers owner before it can be added.
    """
    reason = (reason or "").strip()
    if not approve and not reason:
        raise ReasonRequired(message="A reason is required to reject a cancellation.")

    with transaction.atomic():
        # Lock the internship first, then the request: same order every time,
        # so concurrent decisions cannot deadlock.
        locked = Internship.objects.select_for_update().get(pk=internship.pk)
        current = CancellationRequest.objects.select_for_update().get(pk=request.pk)

        if current.internship_id != locked.pk:
            raise CancellationNotPending()
        if current.status != CancellationStatus.PENDING:
            raise CancellationNotPending()

        now = timezone.now()
        current.decided_by_user_id = actor_user_id
        current.decided_at = now
        current.decision_reason = reason

        if approve:
            if locked.status not in CANCELLABLE_STATUSES:
                raise InvalidInternshipState()

            previous_status = locked.status
            locked.status = InternshipStatus.CANCELLED
            locked.save(update_fields=["status"])

            current.status = CancellationStatus.APPROVED
            current.save(
                update_fields=["status", "decided_by_user_id", "decided_at", "decision_reason"]
            )

            _record(
                locked,
                action=InternshipAuditAction.STATUS_CHANGED,
                actor_user_id=actor_user_id,
                from_status=previous_status,
                to_status=InternshipStatus.CANCELLED,
                reason="Cancellation approved.",
            )
            _record(
                locked,
                action=InternshipAuditAction.CANCELLATION_APPROVED,
                actor_user_id=actor_user_id,
                reason=reason,
            )
        else:
            current.status = CancellationStatus.REJECTED
            current.save(
                update_fields=["status", "decided_by_user_id", "decided_at", "decision_reason"]
            )
            _record(
                locked,
                action=InternshipAuditAction.CANCELLATION_REJECTED,
                actor_user_id=actor_user_id,
                reason=reason,
            )

    return current, locked
