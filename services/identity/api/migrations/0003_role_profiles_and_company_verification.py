import uuid

from django.db import migrations, models
import django.db.models.deletion


def create_existing_profiles(apps, schema_editor):
    User = apps.get_model("api", "User")
    StudentProfile = apps.get_model("api", "StudentProfile")
    CompanyProfile = apps.get_model("api", "CompanyProfile")
    SupervisorProfile = apps.get_model("api", "SupervisorProfile")
    database = schema_editor.connection.alias

    for user in User.objects.using(database).filter(role="student").iterator():
        StudentProfile.objects.using(database).get_or_create(user_id=user.pk)
    for user in User.objects.using(database).filter(role="company").iterator():
        CompanyProfile.objects.using(database).get_or_create(
            user_id=user.pk,
            defaults={
                "verification_status": "active" if user.is_active else "pending"
            },
        )
    for user in User.objects.using(database).filter(role="supervisor").iterator():
        SupervisorProfile.objects.using(database).get_or_create(user_id=user.pk)


class Migration(migrations.Migration):
    dependencies = [("api", "0002_lowercase_roles")]

    operations = [
        migrations.CreateModel(
            name="StudentProfile",
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
                ("university", models.CharField(blank=True, default="", max_length=255)),
                ("department", models.CharField(blank=True, default="", max_length=255)),
                ("specialty", models.CharField(blank=True, default="", max_length=255)),
                ("academic_year", models.CharField(blank=True, default="", max_length=64)),
                ("matricule", models.CharField(blank=True, default="", max_length=128)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_profile",
                        to="api.user",
                    ),
                ),
            ],
            options={"db_table": "users_student_profile"},
        ),
        migrations.CreateModel(
            name="CompanyProfile",
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
                ("legal_name", models.CharField(blank=True, default="", max_length=255)),
                ("address", models.TextField(blank=True, default="")),
                ("contact_person", models.CharField(blank=True, default="", max_length=255)),
                ("phone", models.CharField(blank=True, default="", max_length=64)),
                ("website", models.URLField(blank=True, default="", max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "verification_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("active", "Active"),
                            ("rejected", "Rejected"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("rejection_reason", models.TextField(blank=True, default="")),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="company_profile",
                        to="api.user",
                    ),
                ),
                (
                    "verified_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verified_companies",
                        to="api.user",
                    ),
                ),
            ],
            options={"db_table": "users_company_profile"},
        ),
        migrations.CreateModel(
            name="SupervisorProfile",
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
                ("department", models.CharField(blank=True, default="", max_length=255)),
                ("grade", models.CharField(blank=True, default="", max_length=255)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="supervisor_profile",
                        to="api.user",
                    ),
                ),
            ],
            options={"db_table": "users_supervisor_profile"},
        ),
        migrations.RunPython(create_existing_profiles, migrations.RunPython.noop),
    ]
