import uuid

from django.db import models
from django.db.models import F, Q


class ApplicationStatus(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'Submitted'
    COMPANY_ACCEPTED = 'COMPANY_ACCEPTED', 'Company Accepted'
    COMPANY_REJECTED = 'COMPANY_REJECTED', 'Company Rejected'
    UNIVERSITY_VALIDATED = 'UNIVERSITY_VALIDATED', 'University Validated'
    UNIVERSITY_REJECTED = 'UNIVERSITY_REJECTED', 'University Rejected'
    STUDENT_ACCEPTED = 'STUDENT_ACCEPTED', 'Student Accepted'
    STUDENT_DECLINED = 'STUDENT_DECLINED', 'Student Declined'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    WITHDRAWN = 'WITHDRAWN', 'Withdrawn'


# States in which the student can still withdraw.
WITHDRAWABLE_STATUSES = frozenset({
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.COMPANY_ACCEPTED,
    ApplicationStatus.UNIVERSITY_VALIDATED,
    ApplicationStatus.STUDENT_ACCEPTED,
})

# States in which the application holds a provisional place reservation.
RESERVED_STATUSES = frozenset({
    ApplicationStatus.COMPANY_ACCEPTED,
    ApplicationStatus.UNIVERSITY_VALIDATED,
    ApplicationStatus.STUDENT_ACCEPTED,
})

# States that are still in flight for the purposes of auto-withdrawal.
OPEN_STATUSES = frozenset({
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.COMPANY_ACCEPTED,
    ApplicationStatus.UNIVERSITY_VALIDATED,
    ApplicationStatus.STUDENT_ACCEPTED,
})


class DecisionChoices(models.TextChoices):
    ACCEPT = 'ACCEPT', 'Accept'
    REJECT = 'REJECT', 'Reject'


class StudentDecisionChoices(models.TextChoices):
    ACCEPT = 'ACCEPT', 'Accept'
    DECLINE = 'DECLINE', 'Decline'


class Application(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Microservice plain ID references
    offer_id = models.UUIDField(db_index=True)
    company_user_id = models.UUIDField(db_index=True)
    student_user_id = models.UUIDField(db_index=True)
    university_user_id = models.UUIDField(db_index=True, null=True, blank=True)

    # Internship period agreed on the application and forwarded to internships.
    start_date = models.DateField()
    end_date = models.DateField()

    # Workflow state
    status = models.CharField(
        max_length=30,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.SUBMITTED,
        db_index=True
    )

    # Decisions and Reasons
    company_decision = models.CharField(max_length=10, choices=DecisionChoices.choices, null=True, blank=True)
    company_reason = models.TextField(null=True, blank=True)

    university_decision = models.CharField(max_length=10, choices=DecisionChoices.choices, null=True, blank=True)
    university_reason = models.TextField(null=True, blank=True)

    student_decision = models.CharField(max_length=10, choices=StudentDecisionChoices.choices, null=True, blank=True)

    # Withdrawal and place-release bookkeeping.
    withdrawal_reason = models.TextField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    place_released_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Enforce that a student cannot submit duplicate active applications for the exact same offer
        constraints = [
            models.UniqueConstraint(
                fields=['offer_id', 'student_user_id'],
                name='unique_application_per_student_offer'
            ),
            models.CheckConstraint(
                condition=Q(end_date__gte=F('start_date')),
                name='application_end_not_before_start',
            ),
        ]
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"App {self.id} | Offer {self.offer_id} | Student {self.student_user_id} [{self.status}]"


class OfferReservation(models.Model):
    """Local, lockable counter of the places held on one offer.

    Applications owns the reservation lifecycle; Offers stores no counter.
    ``reserved`` covers applications that hold a provisional place and
    ``occupied`` covers confirmed internships. ``capacity`` is refreshed from
    Offers when a reservation is first created and whenever it grows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer_id = models.UUIDField(unique=True, db_index=True)
    capacity = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0)
    occupied = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(reserved__gte=0),
                name='offer_reservation_reserved_gte_0',
            ),
            models.CheckConstraint(
                condition=Q(occupied__gte=0),
                name='offer_reservation_occupied_gte_0',
            ),
        ]

    @property
    def committed(self):
        return self.reserved + self.occupied

    @property
    def available(self):
        return max(0, self.capacity - self.committed)

    def __str__(self):
        return (
            f"Reservation {self.offer_id}: "
            f"{self.committed}/{self.capacity} committed"
        )


class ApplicationStatusHistory(models.Model):
    """Append-only record of every application state transition."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application,
        related_name='history',
        on_delete=models.CASCADE,
    )
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    actor_user_id = models.UUIDField(null=True, blank=True)
    actor_role = models.CharField(max_length=32, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(
                fields=['application', 'created_at'],
                name='application_history_idx',
            ),
        ]

    def __str__(self):
        return f"{self.application_id}: {self.from_status or '-'} -> {self.to_status}"
