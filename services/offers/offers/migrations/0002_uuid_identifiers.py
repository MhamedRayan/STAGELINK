import uuid

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Recreate the offers table with UUID identifiers.

    Existing integer company identifiers cannot be mapped to the UUIDs owned by
    identity, so this migration intentionally drops and recreates the table.
    Offer rows in development databases are lost.
    """

    dependencies = [
        ("offers", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Offer",
        ),
        migrations.CreateModel(
            name="Offer",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("company_user_id", models.UUIDField(db_index=True)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField()),
                ("requirements", models.TextField()),
                ("location", models.CharField(max_length=255)),
                ("deadline", models.DateTimeField()),
                (
                    "capacity",
                    models.PositiveIntegerField(
                        validators=[django.core.validators.MinValueValidator(1)]
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("published", "Published"),
                            ("closed", "Closed"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["company_user_id"],
                        name="offer_company_user_idx",
                    ),
                    models.Index(fields=["status"], name="offer_status_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("capacity__gte", 1)),
                        name="offer_capacity_gte_1",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("status__in", ["draft", "published", "closed"])
                        ),
                        name="offer_status_valid",
                    ),
                ],
            },
        ),
    ]
