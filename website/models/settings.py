"""
Settings models for Samarqand Contracting Company.
"""

from __future__ import annotations

from typing import Any

from django.db import models
from wagtail.admin.panels import FieldPanel
from wagtail.admin.panels import MultiFieldPanel
from wagtail.contrib.settings.models import BaseSiteSetting
from wagtail.contrib.settings.models import register_setting
from wagtail.images import get_image_model_string


@register_setting
class CompanySettings(BaseSiteSetting):
    name: models.CharField = models.CharField(
        max_length=255, default="شركة سمر قند للمقاولات"
    )
    brand_title: models.CharField = models.CharField(
        max_length=64, default="سمر قند"
    )
    brand_subtitle: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    slogan: models.CharField = models.CharField(max_length=255, blank=True)
    description: models.TextField = models.TextField(blank=True)
    founded_year: models.PositiveIntegerField = models.PositiveIntegerField(
        blank=True, null=True
    )
    headquarters: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    address: models.CharField = models.CharField(max_length=255, blank=True)
    founders: models.TextField = models.TextField(blank=True)
    classification: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    registration_status: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    chamber_membership: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    mission: models.TextField = models.TextField(blank=True)
    vision: models.TextField = models.TextField(blank=True)
    logo_image: Any = models.ForeignKey(
        get_image_model_string(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    email: models.EmailField = models.EmailField(blank=True)
    phone_1: models.CharField = models.CharField(max_length=64, blank=True)
    phone_2: models.CharField = models.CharField(max_length=64, blank=True)
    fax: models.CharField = models.CharField(max_length=64, blank=True)

    topbar_slogan: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    footer_about: models.TextField = models.TextField(blank=True)

    facebook_url: models.URLField = models.URLField(blank=True)
    instagram_url: models.URLField = models.URLField(blank=True)
    linkedin_url: models.URLField = models.URLField(blank=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("name"),
                FieldPanel("logo_image"),
                FieldPanel("brand_title"),
                FieldPanel("brand_subtitle"),
                FieldPanel("slogan"),
                FieldPanel("description"),
                FieldPanel("founded_year"),
                FieldPanel("headquarters"),
                FieldPanel("address"),
                FieldPanel("founders"),
                FieldPanel("classification"),
                FieldPanel("registration_status"),
                FieldPanel("chamber_membership"),
                FieldPanel("mission"),
                FieldPanel("vision"),
            ],
            heading="بيانات الشركة",
        ),
        MultiFieldPanel(
            [
                FieldPanel("email"),
                FieldPanel("phone_1"),
                FieldPanel("phone_2"),
                FieldPanel("fax"),
            ],
            heading="معلومات التواصل",
        ),
        MultiFieldPanel(
            [
                FieldPanel("topbar_slogan"),
                FieldPanel("footer_about"),
            ],
            heading="نصوص الموقع",
        ),
        MultiFieldPanel(
            [
                FieldPanel("facebook_url"),
                FieldPanel("instagram_url"),
                FieldPanel("linkedin_url"),
            ],
            heading="روابط التواصل الاجتماعي",
        ),
    ]


@register_setting
class HomePageSettings(BaseSiteSetting):
    hero_title_line_1: models.CharField = models.CharField(
        max_length=255, default="شركة سمر قند"
    )
    hero_title_line_2: models.CharField = models.CharField(
        max_length=255, default="للمقاولات"
    )
    hero_lead: models.CharField = models.CharField(
        max_length=255, default="نبني أحلامك بأيدٍ فلسطينية ماهرة"
    )
    hero_primary_cta_label: models.CharField = models.CharField(
        max_length=64, default="ابدأ مشروعك الآن"
    )
    hero_primary_cta_url: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    hero_secondary_cta_label: models.CharField = models.CharField(
        max_length=64, default="تعرّف على خدماتنا"
    )
    hero_secondary_cta_url: models.CharField = models.CharField(
        max_length=255, default="#services"
    )
    hero_background_image: Any = models.ForeignKey(
        get_image_model_string(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    newsletter_title: models.CharField = models.CharField(
        max_length=255, default="اشترك في نشرتنا الإخبارية"
    )
    newsletter_subtitle: models.CharField = models.CharField(
        max_length=255,
        default="احصل على آخر العروض والنصائح الهندسية مباشرة على بريدك",
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("hero_title_line_1"),
                FieldPanel("hero_title_line_2"),
                FieldPanel("hero_lead"),
                FieldPanel("hero_primary_cta_label"),
                FieldPanel("hero_primary_cta_url"),
                FieldPanel("hero_secondary_cta_label"),
                FieldPanel("hero_secondary_cta_url"),
                FieldPanel("hero_background_image"),
            ],
            heading="الهيرو",
        ),
        MultiFieldPanel(
            [
                FieldPanel("newsletter_title"),
                FieldPanel("newsletter_subtitle"),
            ],
            heading="النشرة",
        ),
    ]


@register_setting
class SiteVisibilitySettings(BaseSiteSetting):
    show_services: models.BooleanField = models.BooleanField(default=True)
    show_projects: models.BooleanField = models.BooleanField(default=True)
    show_control_projects_management: models.BooleanField = models.BooleanField(
        default=True
    )
    show_tools: models.BooleanField = models.BooleanField(default=True)
    show_showcase: models.BooleanField = models.BooleanField(default=True)
    show_about: models.BooleanField = models.BooleanField(default=True)
    show_contact: models.BooleanField = models.BooleanField(default=True)
    show_team: models.BooleanField = models.BooleanField(default=True)
    show_testimonials: models.BooleanField = models.BooleanField(default=True)
    show_home_trust_badges: models.BooleanField = models.BooleanField(
        default=True
    )
    show_home_stats: models.BooleanField = models.BooleanField(default=True)
    show_home_timeline: models.BooleanField = models.BooleanField(default=True)
    show_home_quick_links: models.BooleanField = models.BooleanField(
        default=True
    )
    show_rfq_templates: models.BooleanField = models.BooleanField(default=True)
    show_home_ai_banner: models.BooleanField = models.BooleanField(default=True)
    show_newsletter: models.BooleanField = models.BooleanField(default=True)
    show_ai_chatbot: models.BooleanField = models.BooleanField(default=True)
    show_whatsapp_button: models.BooleanField = models.BooleanField(
        default=True
    )
    show_floating_cta: models.BooleanField = models.BooleanField(default=True)
    show_footer: models.BooleanField = models.BooleanField(default=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("show_services"),
                FieldPanel("show_projects"),
                FieldPanel("show_tools"),
                FieldPanel("show_showcase"),
                FieldPanel("show_about"),
                FieldPanel("show_contact"),
            ],
            heading="أقسام الموقع",
        ),
        MultiFieldPanel(
            [
                FieldPanel("show_team"),
                FieldPanel("show_testimonials"),
            ],
            heading="محتوى اجتماعي",
        ),
        MultiFieldPanel(
            [
                FieldPanel("show_home_trust_badges"),
                FieldPanel("show_home_stats"),
                FieldPanel("show_home_timeline"),
                FieldPanel("show_home_quick_links"),
                FieldPanel("show_rfq_templates"),
                FieldPanel("show_home_ai_banner"),
                FieldPanel("show_newsletter"),
            ],
            heading="محتوى الصفحة الرئيسية",
        ),
        MultiFieldPanel(
            [
                FieldPanel("show_ai_chatbot"),
                FieldPanel("show_whatsapp_button"),
                FieldPanel("show_floating_cta"),
                FieldPanel("show_footer"),
                FieldPanel("show_control_projects_management"),
            ],
            heading="ميزات",
        ),
    ]


@register_setting
class AISettings(BaseSiteSetting):
    gemini_api_key_env_var: models.CharField = models.CharField(
        max_length=64, default="GEMINI_API_KEY"
    )
    gemini_model: models.CharField = models.CharField(
        max_length=64, default="gemini-1.5-flash"
    )
    gemini_enabled: models.BooleanField = models.BooleanField(default=True)
    temperature: models.FloatField = models.FloatField(default=0.7)
    max_output_tokens: models.PositiveIntegerField = (
        models.PositiveIntegerField(default=1024)
    )

    company_context: models.TextField = models.TextField(
        blank=True,
        default=(
            "أنت مساعد ذكي لشركة سمر قند للمقاولات في فلسطين. "
            "اكتب بالعربية وبشكل عملي ومختصر."
        ),
    )
    design_analyzer_prompt: models.TextField = models.TextField(blank=True)
    content_generator_prompt: models.TextField = models.TextField(blank=True)
    chat_prompt: models.TextField = models.TextField(blank=True)
    visualizer_prompt: models.TextField = models.TextField(blank=True)

    visualizer_default_style: models.CharField = models.CharField(
        max_length=32, default="modern"
    )
    visualizer_default_aspect_ratio: models.CharField = models.CharField(
        max_length=8, default="16:9"
    )
    visualizer_placeholder_primary_hex: models.CharField = models.CharField(
        max_length=7, default="#4A90E2"
    )
    visualizer_placeholder_secondary_hex: models.CharField = models.CharField(
        max_length=7, default="#5DADE2"
    )
    visualizer_placeholder_footer_text: models.CharField = models.CharField(
        max_length=255, default="تصور تجريبي • سمر قند"
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("gemini_enabled"),
                FieldPanel("gemini_api_key_env_var"),
                FieldPanel("gemini_model"),
                FieldPanel("temperature"),
                FieldPanel("max_output_tokens"),
            ],
            heading="مزود الذكاء الاصطناعي",
        ),
        MultiFieldPanel(
            [
                FieldPanel("company_context"),
                FieldPanel("design_analyzer_prompt"),
                FieldPanel("content_generator_prompt"),
                FieldPanel("chat_prompt"),
                FieldPanel("visualizer_prompt"),
            ],
            heading="Prompts",
        ),
        MultiFieldPanel(
            [
                FieldPanel("visualizer_default_style"),
                FieldPanel("visualizer_default_aspect_ratio"),
                FieldPanel("visualizer_placeholder_primary_hex"),
                FieldPanel("visualizer_placeholder_secondary_hex"),
                FieldPanel("visualizer_placeholder_footer_text"),
            ],
            heading="التخيل (إعدادات افتراضية)",
        ),
    ]


@register_setting
class CalculatorSettings(BaseSiteSetting):
    concrete_m3_per_m2: models.FloatField = models.FloatField(default=0.25)
    concrete_unit_price_ils: models.FloatField = models.FloatField(
        default=520.0
    )
    steel_kg_per_m2: models.FloatField = models.FloatField(default=35.0)
    steel_unit_price_ils: models.FloatField = models.FloatField(default=4.8)
    blocks_per_m2: models.FloatField = models.FloatField(default=12.0)
    block_unit_price_ils: models.FloatField = models.FloatField(default=3.2)
    tiles_m2_per_m2: models.FloatField = models.FloatField(default=1.1)
    tiles_unit_price_ils: models.FloatField = models.FloatField(default=55.0)
    paint_liters_per_m2: models.FloatField = models.FloatField(default=0.35)
    paint_unit_price_ils: models.FloatField = models.FloatField(default=18.0)
    labor_percent: models.FloatField = models.FloatField(default=0.28)
    electric_unit_price_ils: models.FloatField = models.FloatField(default=22.0)
    plumbing_unit_price_ils: models.FloatField = models.FloatField(default=18.0)
    currency_default: models.CharField = models.CharField(
        max_length=3, default="ILS"
    )
    usd_to_ils_rate: models.FloatField = models.FloatField(default=3.65)
    overhead_percent: models.FloatField = models.FloatField(default=0.1)
    profit_percent: models.FloatField = models.FloatField(default=0.1)
    contingency_percent: models.FloatField = models.FloatField(default=0.05)
    include_vat: models.BooleanField = models.BooleanField(default=False)
    vat_percent: models.FloatField = models.FloatField(default=0.16)
    items: models.JSONField = models.JSONField(default=list, blank=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("concrete_m3_per_m2"),
                FieldPanel("concrete_unit_price_ils"),
                FieldPanel("steel_kg_per_m2"),
                FieldPanel("steel_unit_price_ils"),
                FieldPanel("blocks_per_m2"),
                FieldPanel("block_unit_price_ils"),
                FieldPanel("tiles_m2_per_m2"),
                FieldPanel("tiles_unit_price_ils"),
                FieldPanel("paint_liters_per_m2"),
                FieldPanel("paint_unit_price_ils"),
                FieldPanel("electric_unit_price_ils"),
                FieldPanel("plumbing_unit_price_ils"),
                FieldPanel("labor_percent"),
                FieldPanel("currency_default"),
                FieldPanel("usd_to_ils_rate"),
                FieldPanel("overhead_percent"),
                FieldPanel("profit_percent"),
                FieldPanel("contingency_percent"),
                FieldPanel("include_vat"),
                FieldPanel("vat_percent"),
            ],
            heading="أسعار ومعاملات الحاسبة",
        )
    ]


def default_company_values() -> list[str]:
    return [
        "الجودة والإتقان",
        "الالتزام بالمواعيد",
        "الشفافية والمصداقية",
        "السلامة المهنية",
        "رضا العميل أولاً",
        "دعم المنتج المحلي",
    ]


def default_section_headings() -> dict[str, dict[str, str]]:
    return {
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


def default_project_types() -> list[str]:
    return [
        "منزل سكني",
        "فيلا",
        "عمارة سكنية",
        "مبنى تجاري",
        "استشارة هندسية",
        "تصميم معماري",
        "أخرى",
    ]


@register_setting
class SiteContentSettings(BaseSiteSetting):
    """Editable front-end copy that otherwise lives hard-coded in React."""

    working_hours = models.CharField(
        max_length=255,
        default="السبت - الخميس: 8:00 صباحاً - 6:00 مساءً | الجمعة: مغلق",
    )
    values = models.JSONField(default=default_company_values, blank=True)
    headings = models.JSONField(default=default_section_headings, blank=True)
    project_types = models.JSONField(default=default_project_types, blank=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("working_hours"),
                FieldPanel("values"),
                FieldPanel("headings"),
                FieldPanel("project_types"),
            ],
            heading="نصوص الواجهة",
        )
    ]
