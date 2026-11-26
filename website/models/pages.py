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
from wagtail.fields import RichTextField
from wagtail.images import get_image_model_string
from wagtail.models import Orderable
from wagtail.models import Page

from .snippets import HomeAIFeature
from .snippets import HomeAIMetric
from .snippets import HomeStat
from .snippets import HomeTimelineStep
from .snippets import HomeTrustBadge
from .snippets import TeamMember
from .snippets import Testimonial


class ArticlePage(CoderedArticlePage):
    """
    Article, suitable for news or blog content.
    """

    class Meta:
        verbose_name = "Article"
        ordering = ["-first_published_at"]

    parent_page_types = ["website.ArticleIndexPage"]

    template = "coderedcms/pages/spa_shell.html"
    search_template = "coderedcms/pages/article_page.search.html"


class ArticleIndexPage(CoderedArticleIndexPage):
    """
    Shows a list of article sub-pages.
    """

    class Meta:
        verbose_name = "Article Landing Page"

    index_query_pagemodel = "website.ArticlePage"

    subpage_types = ["website.ArticlePage"]

    template = "coderedcms/pages/spa_shell.html"


class EventPage(CoderedEventPage):
    class Meta:
        verbose_name = "Event Page"

    parent_page_types = ["website.EventIndexPage"]
    template = "coderedcms/pages/spa_shell.html"


class EventIndexPage(CoderedEventIndexPage):
    """
    Shows a list of event sub-pages.
    """

    class Meta:
        verbose_name = "Events Landing Page"

    index_query_pagemodel = "website.EventPage"

    subpage_types = ["website.EventPage"]

    template = "coderedcms/pages/spa_shell.html"


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
            if "form-control" not in classes and input_type not in {
                "checkbox",
                "radio",
            }:
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

    template = "coderedcms/pages/spa_shell.html"

    parent_page_types = ["website.LocationIndexPage"]


class LocationIndexPage(CoderedLocationIndexPage):
    """
    A page that holds a list of locations and displays them with a Google Map.
    This does require a Google Maps API Key in Settings > CRX Settings
    """

    class Meta:
        verbose_name = "Location Landing Page"

    index_query_pagemodel = "website.LocationPage"

    subpage_types = ["website.LocationPage"]

    template = "coderedcms/pages/spa_shell.html"


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

        services_index = (
            nav_root.get_children().live().filter(slug="services").first()
        )
        projects_index = (
            nav_root.get_children().live().filter(slug="projects").first()
        )
        certifications_index = (
            nav_root.get_children().live().filter(slug="certifications").first()
        )
        about_page = nav_root.get_children().live().filter(slug="about").first()
        companies_index = (
            nav_root.get_children().live().filter(slug="companies").first()
        )
        contact_page = (
            nav_root.get_children().live().filter(slug="contact").first()
        )
        quote_page = (
            nav_root.get_children().live().filter(slug="request-quote").first()
        )
        tools_index = (
            nav_root.get_children().live().filter(slug="tools").first()
        )

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
            context["companies"] = (
                Page.objects.child_of(companies_index).live().specific()[:6]
            )
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

    short_description: models.CharField = models.CharField(
        max_length=255, blank=True
    )

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

    short_description: models.CharField = models.CharField(
        max_length=255, blank=True
    )
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
    progress_percent: models.PositiveSmallIntegerField = (
        models.PositiveSmallIntegerField(default=0)
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
    project_location: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    completion_year: models.PositiveIntegerField = models.PositiveIntegerField(
        blank=True, null=True
    )
    executing_agency: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    project_owner: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    funder: models.CharField = models.CharField(max_length=255, blank=True)
    supervisor: models.CharField = models.CharField(max_length=255, blank=True)
    company_role: models.CharField = models.CharField(
        max_length=255, blank=True
    )
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
            Page.objects.child_of(self)
            .live()
            .type(CertificationPage)
            .specific()
        )
        return context


class CertificationPage(CoderedWebPage):
    class Meta:
        verbose_name = "اعتماد/شهادة"

    parent_page_types = ["website.CertificationIndexPage"]
    template = "coderedcms/pages/spa_shell.html"

    issuer: models.CharField = models.CharField(max_length=255, blank=True)
    certificate_id: models.CharField = models.CharField(
        max_length=255, blank=True
    )
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
