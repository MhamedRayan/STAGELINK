import uuid

import api.models
import django.contrib.auth.models
import django.db.models.functions
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                (
                    "last_login",
                    models.DateTimeField(blank=True, null=True, verbose_name="last login"),
                ),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("password_hash", models.CharField(max_length=128)),
                ("name", models.CharField(max_length=255)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("Student", "Student"),
                            ("Company", "Company"),
                            ("Supervisor", "Supervisor"),
                            ("University Administration", "University Administration"),
                            ("Platform Administrator", "Platform Administrator"),
                        ],
                        max_length=32,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("is_staff", models.BooleanField(default=False)),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "db_table": "users_user",
                "ordering": ("email",),
                "constraints": [
                    models.UniqueConstraint(
                        django.db.models.functions.Lower("email"),
                        name="users_user_email_ci_unique",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            role__in=[
                                "Student",
                                "Company",
                                "Supervisor",
                                "University Administration",
                                "Platform Administrator",
                            ]
                        ),
                        name="users_user_role_valid",
                    ),
                ],
            },
            managers=[("objects", api.models.UserManager())],
        ),
    ]
