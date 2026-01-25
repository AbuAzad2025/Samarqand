from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0013_rfqdocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_about",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_contact",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_floating_cta",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_footer",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_home_ai_banner",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_home_quick_links",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_rfq_templates",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="sitevisibilitysettings",
            name="show_whatsapp_button",
            field=models.BooleanField(default=True),
        ),
    ]

