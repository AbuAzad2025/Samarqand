"""
Create or customize your page models here.
"""

from __future__ import annotations

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

    STATUS_ONGOING = "ongoing"
    STATUS_COMPLETED = "completed"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [
        (STATUS_ONGOING, "قيد العمل"),
        (STATUS_COMPLETED, "منجز"),
        (STATUS_ARCHIVED, "مؤرشف"),
    ]

    PHASE_INITIATING = "initiating"
    PHASE_PLANNING = "planning"
    PHASE_EXECUTING = "executing"
    PHASE_MONITORING = "monitoring"
    PHASE_CLOSING = "closing"
    PHASE_CHOICES = [
        (PHASE_INITIATING, "البدء (Initiating)"),
        (PHASE_PLANNING, "التخطيط (Planning)"),
        (PHASE_EXECUTING, "التنفيذ (Executing)"),
        (PHASE_MONITORING, "المتابعة والتحكم (Monitoring & Controlling)"),
        (PHASE_CLOSING, "الإغلاق (Closing)"),
    ]

    parent_page_types = ["website.ProjectIndexPage"]
    template = "coderedcms/pages/spa_shell.html"

    short_description: models.CharField = models.CharField(max_length=255, blank=True)
    status: models.CharField = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_COMPLETED,
    )
    pmp_phase: models.CharField = models.CharField(
        max_length=30,
        choices=PHASE_CHOICES,
        default=PHASE_PLANNING,
    )
    progress_percent: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField(
        default=0
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    target_end_date: models.DateField = models.DateField(blank=True, null=True)
    budget_amount: models.DecimalField = models.DecimalField(
        blank=True,
        null=True,
        max_digits=12,
        decimal_places=2,
    )
    scope_statement: models.TextField = models.TextField(blank=True)
    key_deliverables: models.TextField = models.TextField(blank=True)
    key_stakeholders: models.TextField = models.TextField(blank=True)
    key_risks: models.TextField = models.TextField(blank=True)
    management_notes: models.TextField = models.TextField(blank=True)
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
                FieldPanel("status"),
                FieldPanel("pmp_phase"),
                FieldPanel("progress_percent"),
                FieldPanel("start_date"),
                FieldPanel("target_end_date"),
                FieldPanel("budget_amount"),
                FieldPanel("scope_statement"),
                FieldPanel("key_deliverables"),
                FieldPanel("key_stakeholders"),
                FieldPanel("key_risks"),
                FieldPanel("management_notes"),
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


class ProjectDocument(Orderable):
    class Meta:
        ordering = ["sort_order"]

    page = ParentalKey(
        ProjectPage,
        on_delete=models.CASCADE,
        related_name="project_documents",
    )
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    title: models.CharField = models.CharField(max_length=255, blank=True)
    document: Any = models.ForeignKey(
        "wagtaildocs.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    uploaded_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    panels = [
        FieldPanel("title"),
        FieldPanel("document"),
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
    show_control_projects_management: models.BooleanField = models.BooleanField(
        default=True
    )
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


class CompanyDocument(models.Model):
    CATEGORY_TEMPLATE = "template"
    CATEGORY_LETTERHEAD = "letterhead"
    CATEGORY_INVOICE = "invoice"
    CATEGORY_RECEIPT = "receipt"
    CATEGORY_COMPANY_DOCUMENT = "company_document"
    CATEGORY_COMPANY_CERTIFICATE = "company_certificate"
    CATEGORY_CHOICES = [
        (CATEGORY_TEMPLATE, "قوالب"),
        (CATEGORY_LETTERHEAD, "ترويسات"),
        (CATEGORY_INVOICE, "فواتير"),
        (CATEGORY_RECEIPT, "سندات قبض"),
        (CATEGORY_COMPANY_DOCUMENT, "مستندات الشركة"),
        (CATEGORY_COMPANY_CERTIFICATE, "وثائق الشركة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    category: models.CharField = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    title: models.CharField = models.CharField(max_length=255, blank=True)
    document: Any = models.ForeignKey(
        "wagtaildocs.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    uploaded_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["category", "sort_order", "id"]
        verbose_name = "مستند الشركة"
        verbose_name_plural = "مستندات الشركة"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")


class Client(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "عميل"
        verbose_name_plural = "العملاء"

    def __str__(self) -> str:
        return self.name


class ClientContactLog(models.Model):
    KIND_CALL = "call"
    KIND_VISIT = "visit"
    KIND_EMAIL = "email"
    KIND_WHATSAPP = "whatsapp"
    KIND_OTHER = "other"
    KIND_CHOICES = [
        (KIND_CALL, "مكالمة"),
        (KIND_VISIT, "زيارة"),
        (KIND_EMAIL, "بريد"),
        (KIND_WHATSAPP, "واتساب"),
        (KIND_OTHER, "أخرى"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    client: models.ForeignKey["Client", "Client"] = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="contact_logs"
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_CALL
    )
    subject: models.CharField = models.CharField(max_length=255, blank=True)
    body: models.TextField = models.TextField(blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "سجل تواصل"
        verbose_name_plural = "سجل التواصل"

    def __str__(self) -> str:
        return self.subject or f"{self.get_kind_display()} - {self.client.name}"


class Supplier(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    category: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "مورد"
        verbose_name_plural = "الموردون"

    def __str__(self) -> str:
        return self.name


class Subcontractor(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    specialty: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "مقاول فرعي"
        verbose_name_plural = "المقاولون الفرعيون"

    def __str__(self) -> str:
        return self.name


class ProjectContract(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_CLOSED = "closed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_ACTIVE, "ساري"),
        (STATUS_CLOSED, "مغلق"),
        (STATUS_CANCELLED, "ملغي"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contracts",
    )
    client: models.ForeignKey["Client | None", "Client | None"] = models.ForeignKey(
        Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="contracts"
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    number: models.CharField = models.CharField(max_length=64, blank=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)
    document_file: models.FileField = models.FileField(
        upload_to="contracts/", blank=True
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "عقد"
        verbose_name_plural = "العقود"

    def __str__(self) -> str:
        return self.title or self.number or str(self.pk or "")


class ContractAddendum(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    contract: models.ForeignKey["ProjectContract", "ProjectContract"] = models.ForeignKey(
        ProjectContract, on_delete=models.CASCADE, related_name="addendums"
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    amount_delta: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    notes: models.TextField = models.TextField(blank=True)
    document_file: models.FileField = models.FileField(
        upload_to="contracts/addendums/", blank=True
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "ملحق عقد"
        verbose_name_plural = "ملاحق العقود"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")


class ContractPayment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PARTIAL = "partial"
    STATUS_PAID = "paid"
    STATUS_OVERDUE = "overdue"
    STATUS_CHOICES = [
        (STATUS_PENDING, "معلق"),
        (STATUS_PARTIAL, "جزئي"),
        (STATUS_PAID, "مدفوع"),
        (STATUS_OVERDUE, "متأخر"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    contract: models.ForeignKey["ProjectContract", "ProjectContract"] = models.ForeignKey(
        ProjectContract, on_delete=models.CASCADE, related_name="payments"
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    due_date: models.DateField = models.DateField(blank=True, null=True)
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    paid_amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    paid_date: models.DateField = models.DateField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "دفعة/مستخلص"
        verbose_name_plural = "الدفعات/المستخلصات"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")


class PurchaseOrder(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_SENT, "مرسل"),
        (STATUS_RECEIVED, "مستلم"),
        (STATUS_CANCELLED, "ملغي"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    supplier: models.ForeignKey["Supplier | None", "Supplier | None"] = models.ForeignKey(
        Supplier, null=True, blank=True, on_delete=models.SET_NULL, related_name="purchase_orders"
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="purchase_orders",
    )
    number: models.CharField = models.CharField(max_length=64, blank=True)
    date: models.DateField = models.DateField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    total_amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "أمر شراء"
        verbose_name_plural = "أوامر الشراء"

    def __str__(self) -> str:
        return self.number or str(self.pk or "")


class InventoryItem(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    sku: models.CharField = models.CharField(max_length=64, blank=True)
    name: models.CharField = models.CharField(max_length=255)
    unit: models.CharField = models.CharField(max_length=32, blank=True)
    current_qty: models.DecimalField = models.DecimalField(
        default=0, max_digits=14, decimal_places=3
    )
    reorder_level: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=14, decimal_places=3
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "صنف مخزون"
        verbose_name_plural = "المخزون"

    def __str__(self) -> str:
        return self.name


class InventoryTransaction(models.Model):
    KIND_IN = "in"
    KIND_OUT = "out"
    KIND_ADJUST = "adjust"
    KIND_CHOICES = [
        (KIND_IN, "إدخال"),
        (KIND_OUT, "إخراج"),
        (KIND_ADJUST, "تسوية"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    item: models.ForeignKey["InventoryItem", "InventoryItem"] = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="transactions"
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_transactions",
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_IN
    )
    quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3
    )
    unit_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    date: models.DateField = models.DateField(blank=True, null=True)
    reference: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "حركة مخزون"
        verbose_name_plural = "حركات المخزون"

    def __str__(self) -> str:
        return self.reference or str(self.pk or "")


class Equipment(models.Model):
    STATUS_AVAILABLE = "available"
    STATUS_ON_SITE = "on_site"
    STATUS_MAINTENANCE = "maintenance"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "متاح"),
        (STATUS_ON_SITE, "على الموقع"),
        (STATUS_MAINTENANCE, "صيانة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    code: models.CharField = models.CharField(max_length=64, blank=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_AVAILABLE
    )
    hourly_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "معدة"
        verbose_name_plural = "المعدات"

    def __str__(self) -> str:
        return self.name


class Worker(models.Model):
    KIND_WORKER = "worker"
    KIND_EMPLOYEE = "employee"
    KIND_CHOICES = [
        (KIND_WORKER, "عامل"),
        (KIND_EMPLOYEE, "موظف"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    user: Any = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_worker",
    )
    name: models.CharField = models.CharField(max_length=255)
    role: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    time_clock_id: models.CharField = models.CharField(
        max_length=64, blank=True, null=True, unique=True
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_WORKER
    )
    daily_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    monthly_salary: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    active: models.BooleanField = models.BooleanField(default=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "موظف/عامل"
        verbose_name_plural = "الموظفون/العمال"

    def __str__(self) -> str:
        return self.name


class WorkerAttendance(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_HALF_DAY = "half_day"
    STATUS_LEAVE = "leave"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "حاضر"),
        (STATUS_ABSENT, "غائب"),
        (STATUS_HALF_DAY, "نصف يوم"),
        (STATUS_LEAVE, "إجازة"),
    ]
    STATE_DRAFT = "draft"
    STATE_REVIEW = "review"
    STATE_APPROVED = "approved"
    STATE_LOCKED = "locked"
    STATE_CHOICES = [
        (STATE_DRAFT, "مسودة"),
        (STATE_REVIEW, "قيد المراجعة"),
        (STATE_APPROVED, "معتمد"),
        (STATE_LOCKED, "مقفول"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker, on_delete=models.CASCADE, related_name="attendance"
    )
    date: models.DateField = models.DateField()
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PRESENT
    )
    hours: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=5, decimal_places=2
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="worker_attendance",
    )
    notes: models.TextField = models.TextField(blank=True)
    state: models.CharField = models.CharField(
        max_length=16, choices=STATE_CHOICES, default=STATE_DRAFT
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    approved_at: models.DateTimeField = models.DateTimeField(blank=True, null=True)
    locked_by: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    locked_at: models.DateTimeField = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "دوام"
        verbose_name_plural = "الدوام"
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "date"], name="uniq_worker_attendance_per_day"
            )
        ]

    def __str__(self) -> str:
        return f"{self.worker.name} - {self.date.isoformat()}"


class WorkerPayrollEntry(models.Model):
    KIND_SALARY = "salary"
    KIND_ADVANCE = "advance"
    KIND_BONUS = "bonus"
    KIND_DEDUCTION = "deduction"
    KIND_CHOICES = [
        (KIND_SALARY, "راتب"),
        (KIND_ADVANCE, "سلفة"),
        (KIND_BONUS, "مكافأة"),
        (KIND_DEDUCTION, "خصم"),
    ]
    SOURCE_MANUAL = "manual"
    SOURCE_AUTO_ATTENDANCE = "auto_attendance"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "يدوي"),
        (SOURCE_AUTO_ATTENDANCE, "تلقائي من الدوام"),
    ]
    STATUS_DRAFT = "draft"
    STATUS_APPROVED = "approved"
    STATUS_PAID = "paid"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_APPROVED, "معتمد"),
        (STATUS_PAID, "مدفوع"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker, on_delete=models.CASCADE, related_name="payroll_entries"
    )
    year: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField()
    month: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField()
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_SALARY
    )
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    date: models.DateField = models.DateField(blank=True, null=True)
    notes: models.TextField = models.TextField(blank=True)
    source: models.CharField = models.CharField(
        max_length=32, choices=SOURCE_CHOICES, default=SOURCE_MANUAL
    )
    source_meta: models.JSONField = models.JSONField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    approved_at: models.DateTimeField = models.DateTimeField(blank=True, null=True)
    paid_at: models.DateTimeField = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-year", "-month", "-id"]
        verbose_name = "دفعة رواتب"
        verbose_name_plural = "دفعات الرواتب"

    def __str__(self) -> str:
        return f"{self.worker.name} - {self.year}/{self.month}"


class ResourceAssignment(models.Model):
    RESOURCE_WORKER = "worker"
    RESOURCE_EQUIPMENT = "equipment"
    RESOURCE_CHOICES = [
        (RESOURCE_WORKER, "عامل"),
        (RESOURCE_EQUIPMENT, "معدة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resource_assignments",
    )
    resource_type: models.CharField = models.CharField(
        max_length=16, choices=RESOURCE_CHOICES, default=RESOURCE_WORKER
    )
    worker: models.ForeignKey["Worker | None", "Worker | None"] = models.ForeignKey(
        Worker, null=True, blank=True, on_delete=models.SET_NULL, related_name="assignments"
    )
    equipment: models.ForeignKey["Equipment | None", "Equipment | None"] = models.ForeignKey(
        Equipment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assignments",
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    hours_per_day: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=6, decimal_places=2
    )
    cost_override: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "تعيين مورد"
        verbose_name_plural = "تعيينات الموارد"

    def __str__(self) -> str:
        return str(self.pk or "")


class OpsAuditLog(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    actor: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    role: models.CharField = models.CharField(max_length=32, blank=True)
    action: models.CharField = models.CharField(max_length=64)
    entity_type: models.CharField = models.CharField(max_length=64, blank=True)
    entity_id: models.CharField = models.CharField(max_length=64, blank=True)
    before: models.JSONField = models.JSONField(blank=True, null=True)
    after: models.JSONField = models.JSONField(blank=True, null=True)
    meta: models.JSONField = models.JSONField(blank=True, null=True)
    ip: models.CharField = models.CharField(max_length=64, blank=True)
    user_agent: models.CharField = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "سجل تدقيق"
        verbose_name_plural = "سجل التدقيق"

    def __str__(self) -> str:
        return f"{self.action} - {self.entity_type}:{self.entity_id}"


class OpsPermissionRule(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    code: models.CharField = models.CharField(max_length=64, unique=True)
    allowed_roles: models.JSONField = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["code", "id"]
        verbose_name = "قاعدة صلاحية"
        verbose_name_plural = "قواعد الصلاحيات"

    def __str__(self) -> str:
        return self.code


class OpsTimeclockImportRun(models.Model):
    SOURCE_MANUAL = "manual"
    SOURCE_FOLDER = "folder"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "يدوي"),
        (SOURCE_FOLDER, "مجلد"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    actor: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    role: models.CharField = models.CharField(max_length=32, blank=True)
    source: models.CharField = models.CharField(
        max_length=16, choices=SOURCE_CHOICES, default=SOURCE_MANUAL
    )
    dry_run: models.BooleanField = models.BooleanField(default=False)
    default_project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    items_count: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    created_count: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    updated_count: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    error_count: models.PositiveIntegerField = models.PositiveIntegerField(default=0)
    errors: models.JSONField = models.JSONField(blank=True, null=True)
    results: models.JSONField = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "استيراد ساعة دوام"
        verbose_name_plural = "استيرادات ساعة الدوام"

    def __str__(self) -> str:
        return f"{self.created_at.isoformat()} - {self.source}"
