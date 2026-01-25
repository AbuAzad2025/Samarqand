from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0003_certificationindexpage_certificationpage_contactpage_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectpage",
            name="company_role",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="projectpage",
            name="executing_agency",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="projectpage",
            name="funder",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="projectpage",
            name="project_owner",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="projectpage",
            name="supervisor",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]

