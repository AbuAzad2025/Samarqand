from django.db import migrations, models

import website.models.settings


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0039_seed_site_content"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="headings",
            field=models.JSONField(
                blank=True, default=website.models.settings.default_section_headings
            ),
        ),
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="project_types",
            field=models.JSONField(
                blank=True, default=website.models.settings.default_project_types
            ),
        ),
        migrations.AlterField(
            model_name="sitecontentsettings",
            name="values",
            field=models.JSONField(
                blank=True, default=website.models.settings.default_company_values
            ),
        ),
    ]
