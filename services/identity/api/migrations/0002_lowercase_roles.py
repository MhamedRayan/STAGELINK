from django.db import migrations, models


ROLE_MAP = {
    "Student": "student",
    "Company": "company",
    "Supervisor": "supervisor",
    "University Administration": "university_admin",
    "Platform Administrator": "platform_admin",
}

REVERSE_ROLE_MAP = {new: old for old, new in ROLE_MAP.items()}


def forwards(apps, schema_editor):
    User = apps.get_model("api", "User")
    for old_role, new_role in ROLE_MAP.items():
        User.objects.filter(role=old_role).update(role=new_role)


def backwards(apps, schema_editor):
    User = apps.get_model("api", "User")
    for new_role, old_role in REVERSE_ROLE_MAP.items():
        User.objects.filter(role=new_role).update(role=old_role)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="user",
            name="users_user_role_valid",
        ),
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("student", "Student"),
                    ("company", "Company"),
                    ("supervisor", "Supervisor"),
                    ("university_admin", "University administration"),
                    ("platform_admin", "Platform administrator"),
                ],
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    role__in=[
                        "student",
                        "company",
                        "supervisor",
                        "university_admin",
                        "platform_admin",
                    ]
                ),
                name="users_user_role_valid",
            ),
        ),
    ]
