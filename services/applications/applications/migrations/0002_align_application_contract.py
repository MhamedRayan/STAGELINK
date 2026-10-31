import datetime
import uuid

from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):
    """
    Align applications with the shared contract.

    Renames company_id to company_user_id and adds the internship period that
    applications forwards to the internships service. Existing rows get a
    placeholder period because the dates are required.
    """

    dependencies = [
        ("applications", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="application",
            old_name="company_id",
            new_name="company_user_id",
        ),
        migrations.AddField(
            model_name="application",
            name="start_date",
            field=models.DateField(default=datetime.date(2027, 1, 1)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="application",
            name="end_date",
            field=models.DateField(default=datetime.date(2027, 6, 30)),
            preserve_default=False,
        ),
        migrations.AddConstraint(
            model_name="application",
            constraint=models.CheckConstraint(
                condition=Q(("end_date__gte", F("start_date"))),
                name="application_end_not_before_start",
            ),
        ),
    ]
