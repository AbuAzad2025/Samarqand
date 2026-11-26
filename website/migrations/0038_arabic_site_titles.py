from django.db import migrations


SITE_NAME = "شركة سمر قند للمقاولات"
HOME_TITLE = "شركة سمر قند للمقاولات"


def arabic_titles(apps, schema_editor):
    Page = apps.get_model("wagtailcore.Page")
    Site = apps.get_model("wagtailcore.Site")
    Page.objects.filter(slug="home", depth=2).update(title=HOME_TITLE)
    Site.objects.filter(is_default_site=True).update(site_name=SITE_NAME)


def restore_english_titles(apps, schema_editor):
    Page = apps.get_model("wagtailcore.Page")
    Site = apps.get_model("wagtailcore.Site")
    Page.objects.filter(slug="home", depth=2).update(title="Home")
    Site.objects.filter(is_default_site=True).update(site_name="Contracting Co")


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0037_sitecontentsettings"),
    ]

    operations = [
        migrations.RunPython(arabic_titles, restore_english_titles),
    ]
