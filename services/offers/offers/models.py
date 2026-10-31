import uuid

from django.core.validators import MinValueValidator
from django.db import models


class OfferStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    CLOSED = "closed", "Closed"


class Offer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_user_id = models.UUIDField(db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    requirements = models.TextField()
    location = models.CharField(max_length=255)
    deadline = models.DateTimeField()
    capacity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=20,
        choices=OfferStatus.choices,
        default=OfferStatus.DRAFT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["company_user_id"], name="offer_company_user_idx"),
            models.Index(fields=["status"], name="offer_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(capacity__gte=1),
                name="offer_capacity_gte_1",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=OfferStatus.values),
                name="offer_status_valid",
            ),
        ]
