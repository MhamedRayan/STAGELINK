import uuid

from django.db import migrations, models
import django.db.models.deletion
from django.db.models.functions import Lower


UNIVERSITY_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
DEPARTMENT_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")
DEFAULT_UNIVERSITY_NAME = "M'hamed Bougara University, Boumerdès"
DEFAULT_DEPARTMENT_NAME = "Computer Science Department, Faculty of Sciences"


def forwards(apps, schema_editor):
    University = apps.get_model("api", "University")
    Department = apps.get_model("api", "Department")
    Specialty = apps.get_model("api", "Specialty")
    StudentProfile = apps.get_model("api", "StudentProfile")
    SupervisorProfile = apps.get_model("api", "SupervisorProfile")
    database = schema_editor.connection.alias

    def university_for(name):
        name = (name or "").strip()
        if not name:
            return None
        university = University.objects.using(database).filter(name__iexact=name).first()
        if university is None:
            university = University.objects.using(database).create(name=name)
        return university

    def department_for(university, name):
        name = (name or "").strip()
        if university is None or not name:
            return None
        department = Department.objects.using(database).filter(
            university_id=university.pk, name__iexact=name
        ).first()
        if department is None:
            department = Department.objects.using(database).create(
                university_id=university.pk,
                name=name,
            )
        return department

    def specialty_for(department, name):
        name = (name or "").strip()
        if department is None or not name:
            return None
        specialty = Specialty.objects.using(database).filter(
            department_id=department.pk, name__iexact=name
        ).first()
        if specialty is None:
            specialty = Specialty.objects.using(database).create(
                department_id=department.pk,
                name=name,
            )
        return specialty

    default_university, _ = University.objects.using(database).get_or_create(
        pk=UNIVERSITY_ID,
        defaults={"name": DEFAULT_UNIVERSITY_NAME},
    )
    default_department, _ = Department.objects.using(database).get_or_create(
        pk=DEPARTMENT_ID,
        defaults={
            "university_id": default_university.pk,
            "name": DEFAULT_DEPARTMENT_NAME,
        },
    )

    for profile in StudentProfile.objects.using(database).all().iterator():
        university_name = (profile.university or "").strip()
        department_name = (profile.department or "").strip()
        specialty_name = (profile.specialty or "").strip()

        university = university_for(university_name)
        if university is None and (department_name or specialty_name):
            university = default_university
        department = department_for(
            university,
            department_name or ("Unspecified" if specialty_name else ""),
        )
        specialty = specialty_for(department, specialty_name)
        StudentProfile.objects.using(database).filter(pk=profile.pk).update(
            university_reference_id=university.pk if university else None,
            department_reference_id=department.pk if department else None,
            specialty_reference_id=specialty.pk if specialty else None,
        )

    for profile in SupervisorProfile.objects.using(database).all().iterator():
        department_name = (profile.department or "").strip()
        if not department_name:
            continue
        university = default_university
        department = department_for(university, department_name)
        SupervisorProfile.objects.using(database).filter(pk=profile.pk).update(
            department_reference_id=department.pk
        )


def backwards(apps, schema_editor):
    StudentProfile = apps.get_model("api", "StudentProfile")
    SupervisorProfile = apps.get_model("api", "SupervisorProfile")
    database = schema_editor.connection.alias

    for profile in StudentProfile.objects.using(database).select_related(
        "university_reference", "department_reference", "specialty_reference"
    ).iterator():
        StudentProfile.objects.using(database).filter(pk=profile.pk).update(
            university=profile.university_reference.name
            if profile.university_reference_id
            else "",
            department=profile.department_reference.name
            if profile.department_reference_id
            else "",
            specialty=profile.specialty_reference.name
            if profile.specialty_reference_id
            else "",
        )

    for profile in SupervisorProfile.objects.using(database).select_related(
        "department_reference"
    ).iterator():
        SupervisorProfile.objects.using(database).filter(pk=profile.pk).update(
            department=profile.department_reference.name
            if profile.department_reference_id
            else ""
        )


class Migration(migrations.Migration):
    dependencies = [("api", "0003_role_profiles_and_company_verification")]

    operations = [
        migrations.CreateModel(
            name="University",
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
                ("name", models.CharField(max_length=255)),
            ],
            options={"ordering": ("name",)},
        ),
        migrations.CreateModel(
            name="Department",
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
                ("name", models.CharField(max_length=255)),
                (
                    "university",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="departments",
                        to="api.university",
                    ),
                ),
            ],
            options={"ordering": ("university__name", "name")},
        ),
        migrations.CreateModel(
            name="Specialty",
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
                ("name", models.CharField(max_length=255)),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="specialties",
                        to="api.department",
                    ),
                ),
            ],
            options={"ordering": ("department__name", "name")},
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="university_reference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="student_profiles",
                to="api.university",
            ),
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="department_reference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="student_profiles",
                to="api.department",
            ),
        ),
        migrations.AddField(
            model_name="studentprofile",
            name="specialty_reference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="student_profiles",
                to="api.specialty",
            ),
        ),
        migrations.AddField(
            model_name="supervisorprofile",
            name="department_reference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="supervisor_profiles",
                to="api.department",
            ),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(model_name="studentprofile", name="university"),
        migrations.RemoveField(model_name="studentprofile", name="department"),
        migrations.RemoveField(model_name="studentprofile", name="specialty"),
        migrations.RemoveField(model_name="supervisorprofile", name="department"),
        migrations.RenameField(
            model_name="studentprofile",
            old_name="university_reference",
            new_name="university",
        ),
        migrations.RenameField(
            model_name="studentprofile",
            old_name="department_reference",
            new_name="department",
        ),
        migrations.RenameField(
            model_name="studentprofile",
            old_name="specialty_reference",
            new_name="specialty",
        ),
        migrations.RenameField(
            model_name="supervisorprofile",
            old_name="department_reference",
            new_name="department",
        ),
        migrations.AddConstraint(
            model_name="university",
            constraint=models.UniqueConstraint(
                Lower("name"), name="identity_university_name_ci_unique"
            ),
        ),
        migrations.AddConstraint(
            model_name="department",
            constraint=models.UniqueConstraint(
                Lower("name"),
                "university",
                name="identity_department_univ_name_ci_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="specialty",
            constraint=models.UniqueConstraint(
                Lower("name"),
                "department",
                name="identity_specialty_dept_name_ci_unique",
            ),
        ),
    ]
