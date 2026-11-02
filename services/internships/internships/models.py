import uuid

from django.db import models
from django.db.models import F, Q


class InternshipStatus(models.TextChoices):
    CONFIRMED = "confirmed", "Confirmed"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


# Statuses that count as "active" for the one-internship-at-a-time rule.
ACTIVE_INTERNSHIP_STATUSES = (
    InternshipStatus.CONFIRMED,
    InternshipStatus.IN_PROGRESS,
)


class Internship(models.Model):
    # Identifiers owned by other services: UUIDs, no foreign keys.
    # source_application_id is the idempotency key. It is unique in the
    # database, so a duplicate creation request cannot insert a second row.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_application_id = models.UUIDField(unique=True)
    student_user_id = models.UUIDField()
    company_user_id = models.UUIDField()
    offer_id = models.UUIDField()
    supervisor_user_id = models.UUIDField(null=True, blank=True)
    # Who assigned the current supervisor, and when. Set by university administration.
    supervisor_assigned_by_user_id = models.UUIDField(null=True, blank=True)
    supervisor_assigned_at = models.DateTimeField(null=True, blank=True)

    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=InternshipStatus.choices,
        default=InternshipStatus.CONFIRMED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="internship_end_not_before_start",
            ),
            # Partial unique index: a student can have at most one row in an
            # active status. Enforced by PostgreSQL, so it holds even when two
            # confirmations race each other.
            models.UniqueConstraint(
                fields=["student_user_id"],
                condition=Q(status__in=ACTIVE_INTERNSHIP_STATUSES),
                name="one_active_internship_per_student",
            ),
        ]

    def __str__(self):
        return f"Internship {self.pk} (application {self.source_application_id})"


class InternshipAuditAction(models.TextChoices):
    CREATED = "created", "Created"
    STATUS_CHANGED = "status_changed", "Status changed"
    SUPERVISOR_ASSIGNED = "supervisor_assigned", "Supervisor assigned"
    SUPERVISOR_REASSIGNED = "supervisor_reassigned", "Supervisor reassigned"
    CANCELLATION_REQUESTED = "cancellation_requested", "Cancellation requested"
    CANCELLATION_APPROVED = "cancellation_approved", "Cancellation approved"
    CANCELLATION_REJECTED = "cancellation_rejected", "Cancellation rejected"


class InternshipAudit(models.Model):
    """
    Append-only history of internship events. Rows are written in the same
    transaction as the change they describe and are never edited by the API.
    actor_user_id is None when the system (for example the scheduled start) acted.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internship = models.ForeignKey(
        Internship,
        on_delete=models.PROTECT,
        related_name="audit_entries",
    )
    action = models.CharField(max_length=32, choices=InternshipAuditAction.choices)
    from_status = models.CharField(
        max_length=20, choices=InternshipStatus.choices, null=True, blank=True
    )
    to_status = models.CharField(
        max_length=20, choices=InternshipStatus.choices, null=True, blank=True
    )
    from_supervisor_user_id = models.UUIDField(null=True, blank=True)
    to_supervisor_user_id = models.UUIDField(null=True, blank=True)
    actor_user_id = models.UUIDField(null=True, blank=True)
    reason = models.CharField(max_length=500, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at", "pk"]

    def __str__(self):
        return f"{self.internship_id}: {self.action}"


class CancellationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class CancellationRequest(models.Model):
    """
    A request by the student or the company to cancel an active internship.
    University administration decides it. At most one request may be pending
    per internship, enforced by a partial unique index.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internship = models.ForeignKey(
        Internship,
        on_delete=models.PROTECT,
        related_name="cancellation_requests",
    )
    requested_by_user_id = models.UUIDField()
    requested_by_role = models.CharField(max_length=20)
    reason = models.CharField(max_length=500)
    status = models.CharField(
        max_length=20,
        choices=CancellationStatus.choices,
        default=CancellationStatus.PENDING,
    )
    decided_by_user_id = models.UUIDField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["internship"],
                condition=Q(status=CancellationStatus.PENDING),
                name="one_pending_cancellation_per_internship",
            ),
        ]

    def __str__(self):
        return f"Cancellation {self.pk} ({self.status}) for {self.internship_id}"
