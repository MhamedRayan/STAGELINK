import uuid
from django.db import models
from django.core.exceptions import ValidationError

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
    company_id = models.UUIDField(db_index=True)
    student_user_id = models.UUIDField(db_index=True)
    university_user_id = models.UUIDField(db_index=True, null=True, blank=True)

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

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Enforce that a student cannot submit duplicate active applications for the exact same offer
        constraints = [
            models.UniqueConstraint(
                fields=['offer_id', 'student_user_id'],
                name='unique_application_per_student_offer'
            )
        ]

    def __str__(self):
        return f"App {self.id} | Offer {self.offer_id} | Student {self.student_user_id} [{self.status}]"
