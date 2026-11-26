"""Clear legacy CodeRed CMS custom templates so all pages use the SPA shell."""

from django.db import migrations


def clear_legacy_templates(apps, schema_editor):
    CoderedPage = apps.get_model("coderedcms", "CoderedPage")
    CoderedPage.objects.exclude(custom_template="").update(custom_template="")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0035_mail_attachment_nullable"),
    ]

    operations = [
        migrations.RunPython(clear_legacy_templates, noop),
    ]
