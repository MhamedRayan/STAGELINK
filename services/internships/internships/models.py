import os
import uuid

from django.db import models
from django.db.models import F, Q
from django.utils.text import get_valid_filename


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
    # Set once the place reserved by the source application has been released
    # back to the offer after an approved cancellation. Null means either that no
    # release is needed (the internship was never cancelled) or that delivery to
    # the Applications service has not succeeded yet.
    place_released_at = models.DateTimeField(null=True, blank=True)
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
    SUBMISSION_CREATED = "submission_created", "Submission created"
    SUBMISSION_APPROVED = "submission_approved", "Submission approved"
    SUBMISSION_REJECTED = "submission_rejected", "Submission rejected"
    EVALUATION_PUBLISHED = "evaluation_published", "Evaluation published"
    PLACE_RELEASED = "place_released", "Place released"


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


class SubmissionStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


def submission_upload_path(instance, filename):
    """
    Store each file under its internship and version, with a sanitised name.

    The path never becomes a public URL: downloads go through an authorised
    endpoint. The original filename is kept separately for the download header.
    """
    safe_name = get_valid_filename(os.path.basename(filename))[:120]
    return f"submissions/{instance.internship_id}/v{instance.version}/{safe_name}"


class InternshipSubmission(models.Model):
    """
    One version of the student's final submission. Versions are immutable once
    reviewed; a rejected submission can be followed by a new version.

    At most one version per internship may be pending, and versions are unique
    per internship. Both rules are enforced by partial unique indexes so they
    hold even when two uploads race each other.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internship = models.ForeignKey(
        Internship,
        on_delete=models.PROTECT,
        related_name="submissions",
    )
    version = models.PositiveIntegerField()
    file = models.FileField(upload_to=submission_upload_path, max_length=255)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveBigIntegerField()
    submitted_by_user_id = models.UUIDField()
    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
    )
    reviewed_by_user_id = models.UUIDField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["internship", "version"],
                name="one_submission_version_per_internship",
            ),
            models.UniqueConstraint(
                fields=["internship"],
                condition=Q(status=SubmissionStatus.SUBMITTED),
                name="one_pending_submission_per_internship",
            ),
        ]

    def __str__(self):
        return f"Submission v{self.version} for {self.internship_id} ({self.status})"


class InternshipEvaluation(models.Model):
    """
    The final grade for an internship, recorded once by the assigned
    supervisor. It is immutable: corrections are out of scope in v1.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internship = models.OneToOneField(
        Internship,
        on_delete=models.PROTECT,
        related_name="evaluation",
    )
    supervisor_user_id = models.UUIDField()
    grade = models.DecimalField(max_digits=4, decimal_places=2)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(grade__gte=0) & Q(grade__lte=20),
                name="evaluation_grade_between_0_and_20",
            ),
        ]

    def __str__(self):
        return f"Evaluation {self.grade}/20 for {self.internship_id}"
