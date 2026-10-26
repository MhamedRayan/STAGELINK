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
    # Identifiers owned by other services: plain numbers, no foreign keys.
    # source_application_id is the idempotency key. It is unique in the
    # database, so a duplicate creation request cannot insert a second row.
    source_application_id = models.PositiveBigIntegerField(unique=True)
    student_user_id = models.PositiveBigIntegerField()
    company_user_id = models.PositiveBigIntegerField()
    offer_id = models.PositiveBigIntegerField()
    supervisor_user_id = models.PositiveBigIntegerField(null=True, blank=True)

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
