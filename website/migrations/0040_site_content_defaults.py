from django.db import migrations, models

from website.models.settings import default_company_values
from website.models.settings import default_project_types
from website.models.settings import default_section_headings


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0039_seed_site_content"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="headings",
            field=models.JSONField(
                blank=True, default=default_section_headings
            ),
        ),
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="project_types",
            field=models.JSONField(
                blank=True, default=default_project_types
            ),
        ),
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="values",
            field=models.JSONField(
                blank=True, default=default_company_values
            ),
        ),
    ]
