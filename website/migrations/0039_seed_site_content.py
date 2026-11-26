from django.db import migrations


VALUES = [
    "الجودة والإتقان",
    "الالتزام بالمواعيد",
    "الشفافية والمصداقية",
    "السلامة المهنية",
    "رضا العميل أولاً",
    "دعم المنتج المحلي",
]

HEADINGS = {
    "projects": {
        "title": "مشاريعنا",
        "subtitle": "نفخر بإنجازاتنا ومشاريعنا المنجزة",
    },
    "testimonials": {
        "title": "آراء عملائنا",
        "subtitle": "ما يقوله عملاؤنا عن خدماتنا",
    },
    "services": {
        "title": "خدماتنا",
        "subtitle": "نقدم خدمات متكاملة تلبي احتياجاتكم",
    },
    "showcase": {
        "title": "معرض الأعمال",
        "subtitle": "شاهد التحول الذي نحققه في مشاريعنا",
    },
    "tools": {
        "title": "الأدوات الذكية",
        "subtitle": "أدوات تساعدك في تخطيط مشروعك",
    },
    "contact": {
        "title": "تواصل معنا",
        "subtitle": "نحن هنا لمساعدتك في كل خطوة",
    },
    "requestQuote": {
        "title": "طلب عرض سعر",
        "subtitle": "أخبرنا بتفاصيل مشروعك وسنرسل لك عرضاً مناسباً",
    },
    "rfq": {
        "title": "نماذج عروض الأسعار",
        "subtitle": "اختر قالباً مناسباً واطلب عرض سعر بسرعة",
    },
}

PROJECT_TYPES = [
    "منزل سكني",
    "فيلا",
    "عمارة سكنية",
    "مبنى تجاري",
    "استشارة هندسية",
    "تصميم معماري",
    "أخرى",
]


def seed(apps, schema_editor):
    Site = apps.get_model("wagtailcore.Site")
    Setting = apps.get_model("website.SiteContentSettings")
    for site in Site.objects.all():
        setting, _ = Setting.objects.get_or_create(site=site)
        changed = False
        if not setting.values:
            setting.values = list(VALUES)
            changed = True
        if not setting.headings:
            setting.headings = dict(HEADINGS)
            changed = True
        if not setting.project_types:
            setting.project_types = list(PROJECT_TYPES)
            changed = True
        if changed:
            setting.save()


def unseed(apps, schema_editor):
    Setting = apps.get_model("website.SiteContentSettings")
    Setting.objects.update(values=[], headings={}, project_types=[])


class Migration(migrations.Migration):
    dependencies = [
        ("website", "0038_arabic_site_titles"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
