from django.db import models


class Notification(models.Model):
    """An in-app notification for one recipient.

    Other services' IDs (recipient, related object) are stored as plain
    fields: there are no cross-service foreign keys.
    """

    class Type(models.TextChoices):
        APPLICATION_PENDING_VALIDATION = "application_pending_validation"  # -> university admin
        APPLICATION_VALIDATED = "application_validated"  # -> student
        APPLICATION_REJECTED_BY_UNIVERSITY = "application_rejected_by_university"  # -> student + company
        STUDENT_DECISION = "student_decision"  # -> company
        APPLICATION_WITHDRAWN = "application_withdrawn"  # -> student / company
        INTERNSHIP_CREATED = "internship_created"
        SUPERVISOR_ASSIGNED = "supervisor_assigned"
        CANCELLATION_REQUESTED = "cancellation_requested"
        CANCELLATION_DECIDED = "cancellation_decided"
        SUBMISSION_REVIEWED = "submission_reviewed"
        EVALUATION_PUBLISHED = "evaluation_published"
        GENERIC = "generic"

    recipient_user_id = models.BigIntegerField()
    type = models.CharField(max_length=64, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_object_type = models.CharField(max_length=64, blank=True)
    related_object_id = models.CharField(max_length=64, blank=True)
    deduplication_key = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient_user_id", "-created_at"], name="notif_recipient_created_idx"),
            models.Index(fields=["recipient_user_id", "read_at"], name="notif_recipient_read_idx"),
        ]

    def __str__(self):
        return f"Notification {self.pk} -> user {self.recipient_user_id} ({self.type})"
