import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Recreate the internships table with UUID identifiers.

    Existing integer cross-service identifiers cannot be mapped to the UUIDs
    owned by identity, offers, and applications, so this migration intentionally
    drops and recreates the table. Internship rows in development databases are
    lost.
    """

    dependencies = [
        ("internships", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Internship",
        ),
        migrations.CreateModel(
            name="Internship",
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
                ("source_application_id", models.UUIDField(unique=True)),
                ("student_user_id", models.UUIDField()),
                ("company_user_id", models.UUIDField()),
                ("offer_id", models.UUIDField()),
                (
                    "supervisor_user_id",
                    models.UUIDField(blank=True, null=True),
                ),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("confirmed", "Confirmed"),
                            ("in_progress", "In progress"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="confirmed",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(
                            ("end_date__gte", models.F("start_date"))
                        ),
                        name="internship_end_not_before_start",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(
                            ("status__in", ("confirmed", "in_progress"))
                        ),
                        fields=("student_user_id",),
                        name="one_active_internship_per_student",
                    ),
                ],
            },
        ),
    ]
