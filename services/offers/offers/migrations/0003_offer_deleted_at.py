from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("offers", "0002_uuid_identifiers"),
    ]

    operations = [
        migrations.AddField(
            model_name="offer",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]