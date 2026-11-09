"""
Business operations for internships.

Every change to an internship goes through a function in this module. Each one
runs in a database transaction, writes its audit entry in that same transaction,
and locks the row when the change depends on its current state.
"""

import logging
import os

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .applications_client import release_place
from .exceptions import (
    ActiveInternshipConflict,
    ApplicationsUnavailable,
    ApprovedSubmissionRequired,
    CancellationAlreadyPending,
    CancellationNotPending,
    EvaluationAlreadyExists,
    EvaluationRequired,
    InvalidInternshipState,
    InvalidSupervisor,
    NotAssignedSupervisor,
    ReasonRequired,
    StartDateNotReached,
    SubmissionAlreadyApproved,
    SubmissionAlreadyPending,
    SubmissionNotFound,
    SubmissionNotPending,
)
from .identity_client import fetch_identity_user
from .lifecycle import ensure_transition_allowed
from .models import (
    CancellationRequest,
    CancellationStatus,
    Internship,
    InternshipAudit,
    InternshipAuditAction,
    InternshipEvaluation,
    InternshipStatus,
    InternshipSubmission,
    SubmissionStatus,
)
from .notifications import (
    notify_cancellation_decided,
    notify_cancellation_requested,
    notify_evaluation_published,
    notify_internship_created,
    notify_submission_reviewed,
    notify_supervisor_assigned,
)
from .roles import Role

logger = logging.getLogger(__name__)

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
            notify_internship_created(internship)
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
    # Completion requires a recorded evaluation. The evaluation is the output of
    # the supervisor's review, so its existence is the authoritative check.
    return InternshipEvaluation.objects.filter(internship=internship).exists()


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
        notify_supervisor_assigned(locked, supervisor_user_id)
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
        notify_cancellation_requested(locked, request)
    return request


def deliver_place_release(internship_id):
    """
    Release the place reserved by the internship's source application.

    Best effort and idempotent: Applications releases at most once, and the
    marker means a successful release is never repeated. Returns True when the
    place is known to be released (now or earlier), False when delivery failed.
    """
    internship = Internship.objects.filter(pk=internship_id).first()
    if internship is None or internship.place_released_at is not None:
        return internship is not None

    try:
        release_place(internship.source_application_id)
    except ApplicationsUnavailable as exc:
        logger.warning(
            "Place release failed for internship %s: %s", internship_id, exc.message
        )
        return False

    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship_id)
        if locked.place_released_at is None:
            locked.place_released_at = timezone.now()
            locked.save(update_fields=["place_released_at"])
            _record(
                locked,
                action=InternshipAuditAction.PLACE_RELEASED,
                reason="Reserved place released to the offer.",
            )
    return True


def decide_cancellation(internship, request, *, approve, actor_user_id, reason=""):
    """
    University administration approves or rejects a pending request.

    Approval moves the internship to Cancelled, records the decision and queues
    the release of the place on the source application. The release is
    best-effort after commit; the release_cancelled_places command retries any
    release that did not succeed. Rejection leaves the internship unchanged.
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
            internship_id = locked.pk
            transaction.on_commit(lambda: deliver_place_release(internship_id))
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

        notify_cancellation_decided(locked, current, approved=approve)

    return current, locked


# ---------------------------------------------------------------------------
# Final submissions (P1-2) and supervisor review (P1-3)
# ---------------------------------------------------------------------------

SUBMISSION_STATUSES = (InternshipStatus.IN_PROGRESS,)


def _submission_original_filename(upload):
    name = os.path.basename(getattr(upload, "name", "") or "")
    return name[:255] or "submission"


def _submission_content_type(upload):
    content_type = getattr(upload, "content_type", "") or ""
    if content_type not in settings.ALLOWED_SUBMISSION_CONTENT_TYPES:
        return "application/octet-stream"
    return content_type


def create_submission(internship, *, upload, submitted_by_user_id):
    """
    Store a new version of the student's final submission.

    Versions are allocated under the internship row lock, so concurrent uploads
    cannot pick the same version number. The partial unique indexes enforce the
    same rules in the database as a second guard.
    """
    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)

        if locked.status not in SUBMISSION_STATUSES:
            raise InvalidInternshipState(
                message="Submissions are only accepted while the internship is in progress."
            )

        latest = locked.submissions.order_by("-version").first()
        if latest is not None:
            if latest.status == SubmissionStatus.SUBMITTED:
                raise SubmissionAlreadyPending()
            if latest.status == SubmissionStatus.APPROVED:
                raise SubmissionAlreadyApproved()
            version = latest.version + 1
        else:
            version = 1

        submission = InternshipSubmission.objects.create(
            internship=locked,
            version=version,
            file=upload,
            original_filename=_submission_original_filename(upload),
            content_type=_submission_content_type(upload),
            size_bytes=upload.size,
            submitted_by_user_id=submitted_by_user_id,
            status=SubmissionStatus.SUBMITTED,
        )
        _record(
            locked,
            action=InternshipAuditAction.SUBMISSION_CREATED,
            actor_user_id=submitted_by_user_id,
            reason=f"Submission version {version} uploaded.",
        )
    return submission


def list_submissions(internship):
    """Newest version first; only versions of this internship."""
    return internship.submissions.order_by("-version", "pk")


def review_submission(internship, submission, *, approve, actor_user_id, reason):
    """
    Approve or reject a pending submission. Only the assigned supervisor may
    review it, and every decision requires a reason.
    """
    reason = (reason or "").strip()
    if not reason:
        raise ReasonRequired(message="A reason is required to review a submission.")

    with transaction.atomic():
        # Same lock order as every other operation: internship, then child row.
        locked = Internship.objects.select_for_update().get(pk=internship.pk)
        current = InternshipSubmission.objects.select_for_update().get(pk=submission.pk)

        if locked.supervisor_user_id != actor_user_id:
            raise NotAssignedSupervisor()
        if locked.status not in SUBMISSION_STATUSES:
            raise InvalidInternshipState(
                message="Submissions can only be reviewed while the internship is in progress."
            )
        if current.internship_id != locked.pk:
            raise SubmissionNotFound()
        if current.status != SubmissionStatus.SUBMITTED:
            raise SubmissionNotPending()

        now = timezone.now()
        current.status = (
            SubmissionStatus.APPROVED if approve else SubmissionStatus.REJECTED
        )
        current.reviewed_by_user_id = actor_user_id
        current.reviewed_at = now
        current.review_reason = reason
        current.save(
            update_fields=[
                "status",
                "reviewed_by_user_id",
                "reviewed_at",
                "review_reason",
            ]
        )

        _record(
            locked,
            action=(
                InternshipAuditAction.SUBMISSION_APPROVED
                if approve
                else InternshipAuditAction.SUBMISSION_REJECTED
            ),
            actor_user_id=actor_user_id,
            reason=reason,
        )
        notify_submission_reviewed(locked, current, approved=approve)

    return current


# ---------------------------------------------------------------------------
# Supervisor evaluation (P1-4)
# ---------------------------------------------------------------------------


def create_evaluation(internship, *, supervisor_user_id, grade, comment=""):
    """
    Record the final grade and complete the internship in the same transaction.

    An approved submission must exist. One evaluation per internship: the
    OneToOne field and this check make a second attempt impossible.
    """
    comment = (comment or "").strip()

    with transaction.atomic():
        locked = Internship.objects.select_for_update().get(pk=internship.pk)

        if locked.supervisor_user_id != supervisor_user_id:
            raise NotAssignedSupervisor()
        if InternshipEvaluation.objects.filter(internship=locked).exists():
            raise EvaluationAlreadyExists()
        if locked.status not in SUBMISSION_STATUSES:
            raise InvalidInternshipState(
                message="An evaluation can only be recorded while the internship is in progress."
            )
        if not locked.submissions.filter(status=SubmissionStatus.APPROVED).exists():
            raise ApprovedSubmissionRequired()

        evaluation = InternshipEvaluation.objects.create(
            internship=locked,
            supervisor_user_id=supervisor_user_id,
            grade=grade,
            comment=comment,
        )
        _record(
            locked,
            action=InternshipAuditAction.EVALUATION_PUBLISHED,
            actor_user_id=supervisor_user_id,
            reason=comment,
        )
        change_internship_status(
            locked,
            InternshipStatus.COMPLETED,
            actor_user_id=supervisor_user_id,
            reason="Evaluation recorded.",
        )
        notify_evaluation_published(locked, evaluation)

    return evaluation


def get_evaluation(internship):
    """Return the internship's evaluation, or None when it has not been graded."""
    return InternshipEvaluation.objects.filter(internship=internship).first()
