"""
Create or customize your page models here.
"""

from typing import Any

from coderedcms.forms import CoderedFormField
from coderedcms.models import CoderedArticleIndexPage
from coderedcms.models import CoderedArticlePage
from coderedcms.models import CoderedEmail
from coderedcms.models import CoderedEventIndexPage
from coderedcms.models import CoderedEventOccurrence
from coderedcms.models import CoderedEventPage
from coderedcms.models import CoderedFormPage
from coderedcms.models import CoderedLocationIndexPage
from coderedcms.models import CoderedLocationPage
from coderedcms.models import CoderedWebPage
from django.conf import settings
from django.db import models
from modelcluster.fields import ParentalKey
from wagtail.admin.panels import FieldPanel
from wagtail.admin.panels import InlinePanel
from wagtail.admin.panels import MultiFieldPanel
from wagtail.contrib.settings.models import BaseSiteSetting
from wagtail.contrib.settings.models import register_setting
from wagtail.fields import RichTextField
from wagtail.images import get_image_model_string
from wagtail.models import Orderable
from wagtail.models import Page
from wagtail.snippets.models import register_snippet


class ArticlePage(CoderedArticlePage):
    """
    Article, suitable for news or blog content.
    """

    class Meta:
        verbose_name = "Article"
        ordering = ["-first_published_at"]

    # Only allow this page to be created beneath an ArticleIndexPage.
    parent_page_types = ["website.ArticleIndexPage"]

    template = "coderedcms/pages/article_page.html"
    search_template = "coderedcms/pages/article_page.search.html"


class ArticleIndexPage(CoderedArticleIndexPage):
    """
    Shows a list of article sub-pages.
    """

    class Meta:
        verbose_name = "Article Landing Page"

    # Override to specify custom index ordering choice/default.
    index_query_pagemodel = "website.ArticlePage"

    # Only allow ArticlePages beneath this page.
    subpage_types = ["website.ArticlePage"]

    template = "coderedcms/pages/article_index_page.html"


class EventPage(CoderedEventPage):
    class Meta:
        verbose_name = "Event Page"

    parent_page_types = ["website.EventIndexPage"]
    template = "coderedcms/pages/event_page.html"


class EventIndexPage(CoderedEventIndexPage):
    """
    Shows a list of event sub-pages.
    """

    class Meta:
        verbose_name = "Events Landing Page"

    index_query_pagemodel = "website.EventPage"

    # Only allow EventPages beneath this page.
    subpage_types = ["website.EventPage"]

    template = "coderedcms/pages/event_index_page.html"


class EventOccurrence(CoderedEventOccurrence):
    event = ParentalKey(EventPage, related_name="occurrences")


class FormPage(CoderedFormPage):
    """
    A page with an html <form>.
    """

    class Meta:
        verbose_name = "Form"

    template = "coderedcms/pages/spa_shell.html"

    def get_form(self, request, *args, **kwargs):
        form = super().get_form(request, *args, **kwargs)
        for bound_field in form:
            widget = bound_field.field.widget
            attrs = widget.attrs.copy()
            classes = attrs.get("class", "").split()
            input_type = getattr(widget, "input_type", None)
            if "form-control" not in classes and input_type not in {"checkbox", "radio"}:
                classes.append("form-control")
            attrs["class"] = " ".join([c for c in classes if c])
            widget.attrs = attrs
        return form


class FormPageField(CoderedFormField):
    """
    A field that links to a FormPage.
    """

    class Meta:
        ordering = ["sort_order"]

    page = ParentalKey("FormPage", related_name="form_fields")


class FormConfirmEmail(CoderedEmail):
    """
    Sends a confirmation email after submitting a FormPage.
    """

    page = ParentalKey("FormPage", related_name="confirmation_emails")


class LocationPage(CoderedLocationPage):
    """
    A page that holds a location.  This could be a store, a restaurant, etc.
    """

    class Meta:
        verbose_name = "Location Page"

    template = "coderedcms/pages/location_page.html"

    # Only allow LocationIndexPages above this page.
    parent_page_types = ["website.LocationIndexPage"]


class LocationIndexPage(CoderedLocationIndexPage):
    """
    A page that holds a list of locations and displays them with a Google Map.
    This does require a Google Maps API Key in Settings > CRX Settings
    """

    class Meta:
        verbose_name = "Location Landing Page"

    # Override to specify custom index ordering choice/default.
    index_query_pagemodel = "website.LocationPage"

    # Only allow LocationPages beneath this page.
    subpage_types = ["website.LocationPage"]

    template = "coderedcms/pages/location_index_page.html"


class WebPage(CoderedWebPage):
    """
    General use page with featureful streamfield and SEO attributes.
    """

    class Meta:
        verbose_name = "Web Page"

    template = "coderedcms/pages/spa_shell.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)

        site = getattr(request, "site", None)
        root_page = getattr(site, "root_page", None) if site else None
        nav_root = root_page if root_page is not None else self

        services_index = nav_root.get_children().live().filter(slug="services").first()
        projects_index = nav_root.get_children().live().filter(slug="projects").first()
        certifications_index = nav_root.get_children().live().filter(slug="certifications").first()
        about_page = nav_root.get_children().live().filter(slug="about").first()
        companies_index = nav_root.get_children().live().filter(slug="companies").first()
        contact_page = nav_root.get_children().live().filter(slug="contact").first()
        quote_page = nav_root.get_children().live().filter(slug="request-quote").first()
        tools_index = nav_root.get_children().live().filter(slug="tools").first()

        context["services_index"] = services_index
        context["projects_index"] = projects_index
        context["certifications_index"] = certifications_index
        context["about_page"] = about_page
        context["companies_index"] = companies_index
        context["contact_page"] = contact_page
        context["quote_page"] = quote_page
        context["tools_index"] = tools_index

        if self.slug != "home":
            return context

        if services_index:
            context["services"] = (
                Page.objects.child_of(services_index)
                .live()
                .type(ServicePage)
                .specific()[:6]
            )
        else:
            context["services"] = []

        if projects_index:
            context["projects"] = (
                Page.objects.child_of(projects_index)
                .live()
                .type(ProjectPage)
                .specific()[:6]
            )
        else:
            context["projects"] = []

        if certifications_index:
            context["certifications"] = (
                Page.objects.child_of(certifications_index)
                .live()
                .type(CertificationPage)
                .specific()[:6]
            )
        else:
            context["certifications"] = []

        if companies_index:
            context["companies"] = Page.objects.child_of(companies_index).live().specific()[:6]
        else:
            context["companies"] = []

        context["home_trust_badges"] = list(HomeTrustBadge.objects.all())
        context["home_ai_features"] = list(HomeAIFeature.objects.all())
        context["home_ai_metrics"] = list(HomeAIMetric.objects.all())
        context["home_stats"] = list(HomeStat.objects.all())
        context["home_timeline_steps"] = list(HomeTimelineStep.objects.all())
        context["team_members"] = list(TeamMember.objects.all())
        context["testimonials"] = list(Testimonial.objects.all())

        return context


class ServiceIndexPage(CoderedWebPage):
    class Meta:
        verbose_name = "خدمات"

    index_show_subpages_default = True
    index_order_by_default = "title"
    index_num_per_page_default = 24

    subpage_types = ["website.ServicePage"]
    template = "coderedcms/pages/spa_shell.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["listing_items"] = (
            Page.objects.child_of(self).live().type(ServicePage).specific()
        )
        return context


class ServicePage(CoderedWebPage):
    class Meta:
        verbose_name = "خدمة"

    parent_page_types = ["website.ServiceIndexPage"]
    template = "coderedcms/pages/spa_shell.html"

    short_description: models.CharField = models.CharField(max_length=255, blank=True)

    content_panels = CoderedWebPage.content_panels + [
        FieldPanel("short_description"),
    ]


class ProjectIndexPage(CoderedWebPage):
    class Meta:
        verbose_name = "مشاريع"

    index_show_subpages_default = True
    index_order_by_default = "-first_published_at"
    index_num_per_page_default = 24

    subpage_types = ["website.ProjectPage"]
    template = "coderedcms/pages/spa_shell.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["listing_items"] = (
            Page.objects.child_of(self).live().type(ProjectPage).specific()
        )
        return context


class ProjectPage(CoderedWebPage):
    class Meta:
        verbose_name = "مشروع"

    parent_page_types = ["website.ProjectIndexPage"]
    template = "coderedcms/pages/spa_shell.html"

    short_description: models.CharField = models.CharField(max_length=255, blank=True)
    client_name: models.CharField = models.CharField(max_length=255, blank=True)
    project_location: models.CharField = models.CharField(max_length=255, blank=True)
    completion_year: models.PositiveIntegerField = models.PositiveIntegerField(
        blank=True, null=True
    )
    executing_agency: models.CharField = models.CharField(max_length=255, blank=True)
    project_owner: models.CharField = models.CharField(max_length=255, blank=True)
    funder: models.CharField = models.CharField(max_length=255, blank=True)
    supervisor: models.CharField = models.CharField(max_length=255, blank=True)
    company_role: models.CharField = models.CharField(max_length=255, blank=True)
    scope_of_work = RichTextField(blank=True)

    content_panels = CoderedWebPage.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("short_description"),
                FieldPanel("client_name"),
                FieldPanel("project_location"),
                FieldPanel("completion_year"),
                FieldPanel("executing_agency"),
                FieldPanel("project_owner"),
                FieldPanel("funder"),
                FieldPanel("supervisor"),
                FieldPanel("company_role"),
                FieldPanel("scope_of_work"),
            ],
            heading="تفاصيل المشروع",
        ),
        InlinePanel("gallery_images", label="صور المشروع"),
    ]


class ProjectGalleryImage(Orderable):
    page = ParentalKey(
        ProjectPage,
        on_delete=models.CASCADE,
        related_name="gallery_images",
    )
    image: Any = models.ForeignKey(
        get_image_model_string(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    caption: models.CharField = models.CharField(max_length=255, blank=True)

    panels = [
        FieldPanel("image"),
        FieldPanel("caption"),
    ]


class CertificationIndexPage(CoderedWebPage):
    class Meta:
        verbose_name = "اعتمادات وشهادات"

    index_show_subpages_default = True
    index_order_by_default = "-first_published_at"
    index_num_per_page_default = 48

    subpage_types = ["website.CertificationPage"]
    template = "coderedcms/pages/spa_shell.html"

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["listing_items"] = (
            Page.objects.child_of(self).live().type(CertificationPage).specific()
        )
        return context


class CertificationPage(CoderedWebPage):
    class Meta:
        verbose_name = "اعتماد/شهادة"

    parent_page_types = ["website.CertificationIndexPage"]
    template = "coderedcms/pages/spa_shell.html"

    issuer: models.CharField = models.CharField(max_length=255, blank=True)
    certificate_id: models.CharField = models.CharField(max_length=255, blank=True)
    issued_year: models.PositiveIntegerField = models.PositiveIntegerField(
        blank=True, null=True
    )

    content_panels = CoderedWebPage.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("issuer"),
                FieldPanel("certificate_id"),
                FieldPanel("issued_year"),
            ],
            heading="تفاصيل الاعتماد",
        ),
    ]


class ContactPage(FormPage):
    class Meta:
        verbose_name = "اتصل بنا"

    parent_page_types = ["website.WebPage"]
    template = "coderedcms/pages/spa_shell.html"


class QuoteRequestPage(FormPage):
    class Meta:
        verbose_name = "طلب عرض سعر"

    parent_page_types = ["website.WebPage"]
    template = "coderedcms/pages/spa_shell.html"


class ToolsIndexPage(CoderedWebPage):
    class Meta:
        verbose_name = "الأدوات الذكية"

    parent_page_types = ["website.WebPage"]
    subpage_types = [
        "website.AIDesignAnalyzerPage",
        "website.ConstructionCalculatorPage",
        "website.ArchitecturalVisualizerPage",
        "website.AIContentGeneratorPage",
    ]
    template = "coderedcms/pages/spa_shell.html"


class AIDesignAnalyzerPage(CoderedWebPage):
    class Meta:
        verbose_name = "محلل التصاميم بالذكاء الاصطناعي"

    parent_page_types = ["website.ToolsIndexPage"]
    template = "coderedcms/pages/spa_shell.html"


class ConstructionCalculatorPage(CoderedWebPage):
    class Meta:
        verbose_name = "حاسبة الكميات والتكاليف"

    parent_page_types = ["website.ToolsIndexPage"]
    template = "coderedcms/pages/spa_shell.html"


class ArchitecturalVisualizerPage(CoderedWebPage):
    class Meta:
        verbose_name = "تخيل مشروعك قبل البناء"

    parent_page_types = ["website.ToolsIndexPage"]
    template = "coderedcms/pages/spa_shell.html"


class AIContentGeneratorPage(CoderedWebPage):
    class Meta:
        verbose_name = "مولّد المحتوى التسويقي بالذكاء الاصطناعي"

    parent_page_types = ["website.ToolsIndexPage"]
    template = "coderedcms/pages/spa_shell.html"


@register_setting
class CompanySettings(BaseSiteSetting):
    name: models.CharField = models.CharField(
        max_length=255, default="شركة سمر قند للمقاولات"
    )
    brand_title: models.CharField = models.CharField(max_length=64, default="سمر قند")
    brand_subtitle: models.CharField = models.CharField(max_length=255, blank=True)
    slogan: models.CharField = models.CharField(max_length=255, blank=True)
    description: models.TextField = models.TextField(blank=True)
    founded_year: models.PositiveIntegerField = models.PositiveIntegerField(
        blank=True, null=True
    )
    headquarters: models.CharField = models.CharField(max_length=255, blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    founders: models.TextField = models.TextField(blank=True)
    classification: models.CharField = models.CharField(max_length=255, blank=True)
    registration_status: models.CharField = models.CharField(max_length=255, blank=True)
    chamber_membership: models.CharField = models.CharField(max_length=255, blank=True)
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

    topbar_slogan: models.CharField = models.CharField(max_length=255, blank=True)
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
    hero_primary_cta_url: models.CharField = models.CharField(max_length=255, blank=True)
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
    show_tools: models.BooleanField = models.BooleanField(default=True)
    show_showcase: models.BooleanField = models.BooleanField(default=True)
    show_about: models.BooleanField = models.BooleanField(default=True)
    show_contact: models.BooleanField = models.BooleanField(default=True)
    show_team: models.BooleanField = models.BooleanField(default=True)
    show_testimonials: models.BooleanField = models.BooleanField(default=True)
    show_home_trust_badges: models.BooleanField = models.BooleanField(default=True)
    show_home_stats: models.BooleanField = models.BooleanField(default=True)
    show_home_timeline: models.BooleanField = models.BooleanField(default=True)
    show_home_quick_links: models.BooleanField = models.BooleanField(default=True)
    show_rfq_templates: models.BooleanField = models.BooleanField(default=True)
    show_home_ai_banner: models.BooleanField = models.BooleanField(default=True)
    show_newsletter: models.BooleanField = models.BooleanField(default=True)
    show_ai_chatbot: models.BooleanField = models.BooleanField(default=True)
    show_whatsapp_button: models.BooleanField = models.BooleanField(default=True)
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
    max_output_tokens: models.PositiveIntegerField = models.PositiveIntegerField(
        default=1024
    )

    company_context: models.TextField = models.TextField(
        blank=True,
        default="أنت مساعد ذكي لشركة سمر قند للمقاولات في فلسطين. اكتب بالعربية وبشكل عملي ومختصر.",
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
    concrete_unit_price_ils: models.FloatField = models.FloatField(default=520.0)
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
    currency_default: models.CharField = models.CharField(max_length=3, default="ILS")
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


@register_snippet
class HomeAIFeature(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    badge_text: models.CharField = models.CharField(max_length=16, default="AI")

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("badge_text"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ميزة AI"
        verbose_name_plural = "ميزات AI"

    def __str__(self) -> str:
        return self.title


@register_snippet
class HomeAIMetric(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    value: models.CharField = models.CharField(max_length=64)
    label: models.CharField = models.CharField(max_length=255)

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("value"),
        FieldPanel("label"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "مؤشر AI"
        verbose_name_plural = "مؤشرات AI"

    def __str__(self) -> str:
        return self.label


@register_snippet
class HomeTrustBadge(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-shield-alt"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ميزة ثقة"
        verbose_name_plural = "ميزات الثقة"

    def __str__(self) -> str:
        return self.title


@register_snippet
class HomeStat(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    label: models.CharField = models.CharField(max_length=255)
    value: models.CharField = models.CharField(max_length=64)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-building"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("label"),
        FieldPanel("value"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "إحصائية"
        verbose_name_plural = "إحصاءات"

    def __str__(self) -> str:
        return self.label


@register_snippet
class HomeTimelineStep(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-file-search"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "خطوة عمل"
        verbose_name_plural = "خطوات العمل"

    def __str__(self) -> str:
        return self.title


@register_snippet
class TeamMember(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    name: models.CharField = models.CharField(max_length=255)
    position: models.CharField = models.CharField(max_length=255, blank=True)
    specialization: models.CharField = models.CharField(max_length=255, blank=True)
    experience: models.CharField = models.CharField(max_length=255, blank=True)
    bio: models.TextField = models.TextField(blank=True)
    image: Any = models.ForeignKey(
        get_image_model_string(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("name"),
        FieldPanel("position"),
        FieldPanel("specialization"),
        FieldPanel("experience"),
        FieldPanel("bio"),
        FieldPanel("image"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "عضو فريق"
        verbose_name_plural = "فريق العمل"

    def __str__(self) -> str:
        return self.name


@register_snippet
class Testimonial(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    name: models.CharField = models.CharField(max_length=255)
    project: models.CharField = models.CharField(max_length=255, blank=True)
    text: models.TextField = models.TextField()
    rating: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField(default=5)

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("name"),
        FieldPanel("project"),
        FieldPanel("text"),
        FieldPanel("rating"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "رأي عميل"
        verbose_name_plural = "آراء العملاء"

    def __str__(self) -> str:
        return self.name


class RFQDocument(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    title: models.CharField = models.CharField(max_length=255, blank=True)
    template_key: models.CharField = models.CharField(max_length=64, blank=True)
    currency: models.CharField = models.CharField(max_length=8, default="ILS")
    number: models.CharField = models.CharField(max_length=32, blank=True)
    data: models.JSONField = models.JSONField(default=dict, blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "طلب عرض سعر (RFQ)"
        verbose_name_plural = "طلبات عروض الأسعار (RFQ)"

    def __str__(self) -> str:
        return self.title or self.number or str(self.pk or "")
