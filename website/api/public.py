"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Any
from typing import Iterator

from django.db.models import Prefetch
from django.http import HttpRequest
from django.http import JsonResponse
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_POST
from django.views.decorators.http import require_safe
from wagtail.models import Page

from website.models import ArticleIndexPage
from website.models import ArticlePage
from website.models import CompanySettings
from website.models import EventIndexPage
from website.models import EventOccurrence
from website.models import EventPage
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomePageSettings
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import Lead
from website.models import LocationIndexPage
from website.models import LocationPage
from website.models import ProjectGalleryImage
from website.models import ProjectIndexPage
from website.models import ProjectPage
from website.models import ServicePage
from website.models import SiteContentSettings
from website.models import SiteVisibilitySettings
from website.models import TeamMember
from website.models import Testimonial

logger = logging.getLogger(__name__)


from .common import *
from .common import _streamfield_to_html

# Stable machine codes keep the API contract; the message is always a short,
# Arabic, user-facing explanation. No exception text, path or setting name is
# ever included in a public error response.
_PUBLIC_ERROR_MESSAGES: dict[str, str] = {
    "invalid_name": "الاسم غير صالح. استخدم من 2 إلى 255 حرفاً.",
    "invalid_phone": "رقم الهاتف غير صالح.",
    "invalid_email": "البريد الإلكتروني غير صالح.",
    "invalid_project_type": "نوع المشروع غير صالح.",
    "invalid_message": "الرسالة طويلة جداً.",
    "invalid_source": "مصدر الطلب غير صالح.",
    "invalid_area": "المساحة غير صالحة. أدخل رقماً أكبر من صفر ولا يتجاوز 100000 م².",
    "invalid_floors": "عدد الطوابق غير صالح. أدخل رقماً صحيحاً من 1 إلى 20.",
    "invalid_description": "التفاصيل طويلة جداً.",
    "invalid_topic": "الموضوع طويل جداً.",
    "invalid_style": "الطراز غير صالح.",
    "invalid_aspect_ratio": "نسبة أبعاد الصورة غير صالحة.",
    "invalid_slug": "الرابط المطلوب غير صالح.",
    "invalid_project_status": "حالة المشروع غير صالحة.",
    "invalid_content_type": "نوع المحتوى غير صالح.",
    "not_found": "المحتوى المطلوب غير موجود.",
    "site_not_found": "الموقع غير متاح حالياً.",
    "calculation_failed": "تعذّر إجراء الحساب. تحقق من المدخلات وحاول مجدداً.",
    "ai_not_configured": "ميزات الذكاء الاصطناعي غير متاحة حالياً.",
}


def _public_error(code: str, *, status: int = 400) -> JsonResponse:
    """Return an opaque code plus an understandable Arabic message."""
    return _api_error(
        code,
        status=status,
        message=_PUBLIC_ERROR_MESSAGES.get(
            code, "تعذّر إتمام الطلب. يرجى المحاولة لاحقاً."
        ),
    )


@require_POST
def site_leads_create(request: HttpRequest) -> JsonResponse:
    """Capture a public website enquiry so the team can follow it up."""
    limited = _check_rate_limit(
        request, scope="site_lead_create", limit=5, window_seconds=900
    )
    if limited:
        return limited

    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    phone_raw = str(data.get("phone") or "").strip()
    phone = "".join(ch for ch in phone_raw if ch.isdigit() or ch == "+")
    email = str(data.get("email") or "").strip()
    project_type = str(data.get("projectType") or "").strip()
    message = str(data.get("message") or "").strip()
    source = str(data.get("source") or Lead.SOURCE_WEBSITE).strip()

    if len(name) < 2 or len(name) > 255:
        return _public_error("invalid_name", status=400)
    if not (7 <= len(phone) <= 20):
        return _public_error("invalid_phone", status=400)
    if email and ("@" not in email or len(email) > 254):
        return _public_error("invalid_email", status=400)
    if len(project_type) > 128:
        return _public_error("invalid_project_type", status=400)
    if len(message) > 4000:
        return _public_error("invalid_message", status=400)
    allowed_sources = {key for key, _ in Lead.SOURCE_CHOICES}
    if source not in allowed_sources:
        return _public_error("invalid_source", status=400)

    lead = Lead.objects.create(
        name=name,
        phone=phone_raw[:64],
        email=email,
        project_type=project_type,
        message=message,
        source=source,
    )
    return _api_ok({"id": lead.id}, status=201)


def _require_ai_key() -> JsonResponse | None:
    if not (os.environ.get("GEMINI_API_KEY") or "").strip():
        return _public_error("ai_not_configured", status=503)
    return None


@require_POST
def analyze_design(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="ai_analyze_design", limit=30, window_seconds=900
    )
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
    unconfigured = _require_ai_key()
    if unconfigured:
        return unconfigured
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    area_raw = str(data.get("area") or "").strip()
    description = str(data.get("description") or "").strip()

    if not project_type or len(project_type) > 128:
        return _public_error("invalid_project_type")
    if len(description) > 4000:
        return _public_error("invalid_description")
    try:
        area_m2 = float(area_raw)
    except (TypeError, ValueError):
        return _public_error("invalid_area")
    if not (0 < area_m2 <= 100000):
        return _public_error("invalid_area")

    ai_settings = _get_ai_settings(request)
    context = ai_settings.company_context if ai_settings else ""
    extra_prompt = ai_settings.design_analyzer_prompt if ai_settings else ""

    prompt = (
        context
        + "\n"
        + extra_prompt
        + "\n"
        + "حلل مشروع بناء وفق المدخلات التالية، وأرجع JSON فقط بالمفاتيح: design, materials, estimatedCost, duration, tips.\n"
        + f"نوع المشروع: {project_type}\n"
        + f"المساحة: {area_m2} m2\n"
        + f"تفاصيل: {description}\n"
        + "estimatedCost يجب أن يكون نصاً يتضمن العملة ₪.\n"
    ).strip()

    text = _gemini_generate_text(prompt, ai_settings=ai_settings)
    if text:
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return _api_ok(parsed)
        except Exception:
            pass

    return _api_ok(
        _design_analysis_fallback(project_type, area_m2, description)
    )


@require_POST
def generate_content(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="ai_generate_content", limit=30, window_seconds=900
    )
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
    unconfigured = _require_ai_key()
    if unconfigured:
        return unconfigured
    data = _read_json(request)
    kind = str(data.get("type") or "blog").strip()
    topic = str(data.get("topic") or "").strip()

    if len(kind) > 64 or len(topic) > 2000:
        return _public_error("invalid_topic")

    ai_settings = _get_ai_settings(request)
    site = _get_site(request)
    company_name = (
        CompanySettings.for_site(site).name
        if site
        else "شركة سمر قند للمقاولات"
    )

    prompt_context = ai_settings.company_context if ai_settings else ""
    extra_prompt = ai_settings.content_generator_prompt if ai_settings else ""

    prompt = (
        prompt_context
        + "\n"
        + extra_prompt
        + "\n"
        + "اكتب محتوى تسويقي عربي وفق التالي:\n"
        + f"النوع: {kind}\n"
        + f"الموضوع: {topic}\n"
        + "أرجع النص فقط بدون JSON.\n"
    ).strip()

    text = _gemini_generate_text(prompt, ai_settings=ai_settings)
    if not text:
        text = _generate_content_fallback(kind, topic, company_name)

    return _api_ok({"content": text})


@require_POST
def calculate(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="calculate", limit=90, window_seconds=300
    )
    if limited:
        return limited
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    if len(project_type) > 128:
        return _public_error("invalid_project_type")
    try:
        area = float(data.get("area") or 0.0)
    except (TypeError, ValueError):
        return _public_error("invalid_area")
    if not (0 < area <= 100000):
        return _public_error("invalid_area")
    try:
        floors = int(data.get("floors") or 1)
    except (TypeError, ValueError):
        return _public_error("invalid_floors")
    if not (1 <= floors <= 20):
        return _public_error("invalid_floors")
    currency = str(data.get("currency") or "").strip().upper()
    settings_obj = _get_calc_settings(request)
    try:
        return _api_ok(
            _calculator_response(
                project_type, area, floors, settings_obj, currency=currency
            )
        )
    except Exception:
        logger.exception("Calculator request failed")
        return _public_error("calculation_failed", status=400)


@require_POST
def generate_visualization(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="ai_generate_visualization", limit=30, window_seconds=900
    )
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
    unconfigured = _require_ai_key()
    if unconfigured:
        return unconfigured
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    description = str(data.get("description") or "").strip()
    style = str(data.get("style") or "").strip()
    aspect_ratio = str(data.get("aspectRatio") or "").strip()

    if len(project_type) > 128 or len(description) > 4000:
        return _public_error("invalid_description")
    if len(style) > 64:
        return _public_error("invalid_style")
    if aspect_ratio and aspect_ratio not in {"1:1", "9:16", "4:3", "16:9"}:
        return _public_error("invalid_aspect_ratio")

    ai_settings = _get_ai_settings(request)
    if ai_settings and ai_settings.visualizer_prompt:
        _ = description

    resolved_style = (
        style
        or (ai_settings.visualizer_default_style if ai_settings else "modern")
        or "modern"
    )
    resolved_ratio = (
        aspect_ratio
        or (
            ai_settings.visualizer_default_aspect_ratio
            if ai_settings
            else "16:9"
        )
        or "16:9"
    )
    png = _create_placeholder_visual(
        project_type or "تصور معماري",
        resolved_style,
        resolved_ratio,
        ai_settings=ai_settings,
    )
    encoded = base64.b64encode(png).decode("ascii")
    return _api_ok({"image": encoded, "mimeType": "image/png"})


@require_POST
def chat(request: HttpRequest) -> StreamingHttpResponse | JsonResponse:
    limited = _check_rate_limit(
        request, scope="ai_chat", limit=90, window_seconds=900
    )
    if limited:
        return limited
    unconfigured = _require_ai_key()
    if unconfigured:
        return unconfigured
    data = _read_json(request)
    message = str(data.get("message") or "")
    if len(message) > 4000:
        return _public_error("invalid_message")

    ai_settings = _get_ai_settings(request)
    prompt_context = ai_settings.company_context if ai_settings else ""
    extra_prompt = ai_settings.chat_prompt if ai_settings else ""
    prompt = (
        prompt_context
        + "\n"
        + extra_prompt
        + "\n"
        + "أجب بالعربية وبشكل عملي وقصير على التالي:\n"
        + message
    ).strip()
    text = _gemini_generate_text(
        prompt, ai_settings=ai_settings
    ) or _chat_reply(message)

    def events() -> Iterator[bytes]:
        for chunk in [text[i : i + 30] for i in range(0, len(text), 30)]:
            payload = json.dumps({"text": chunk}, ensure_ascii=False)
            yield f"data: {payload}\n\n".encode("utf-8")
            time.sleep(0.02)
        yield b"data: [DONE]\n\n"

    resp = StreamingHttpResponse(
        events(), content_type="text/event-stream; charset=utf-8"
    )
    resp["Cache-Control"] = "no-cache"
    return resp


@require_safe
def site_company(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _public_error("site_not_found", status=400)
    company = CompanySettings.for_site(site)
    logo_url = ""
    if company.logo_image and getattr(company.logo_image, "file", None):
        logo_url = _abs_url(request, company.logo_image.file.url)
    return _api_ok(
        {
            "name": company.name,
            "brandTitle": company.brand_title,
            "brandSubtitle": company.brand_subtitle,
            "slogan": company.slogan,
            "description": company.description,
            "mission": company.mission,
            "vision": company.vision,
            "topbarSlogan": company.topbar_slogan,
            "address": company.address,
            "registrationStatus": company.registration_status,
            "chamberMembership": company.chamber_membership,
            "classification": company.classification,
            "email": company.email,
            "phone1": company.phone_1,
            "phone2": company.phone_2,
            "facebookUrl": company.facebook_url,
            "instagramUrl": company.instagram_url,
            "linkedinUrl": company.linkedin_url,
            "logoUrl": logo_url,
        }
    )


@require_safe
def site_config(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _public_error("site_not_found", status=400)
    v = SiteVisibilitySettings.for_site(site)
    return _api_ok(
        {
            "visibility": {
                "showServices": v.show_services,
                "showProjects": v.show_projects,
                "showTools": v.show_tools,
                "showShowcase": v.show_showcase,
                "showAbout": v.show_about,
                "showContact": v.show_contact,
                "showTeam": v.show_team,
                "showTestimonials": v.show_testimonials,
                "showHomeTrustBadges": v.show_home_trust_badges,
                "showHomeStats": v.show_home_stats,
                "showHomeTimeline": v.show_home_timeline,
                "showHomeQuickLinks": v.show_home_quick_links,
                "showRfqTemplates": v.show_rfq_templates,
                "showHomeAIBanner": v.show_home_ai_banner,
                "showNewsletter": v.show_newsletter,
                "showAIChatbot": v.show_ai_chatbot,
                "showWhatsAppButton": v.show_whatsapp_button,
                "showFloatingCTA": v.show_floating_cta,
                "showFooter": v.show_footer,
                "showControlProjectsManagement": v.show_control_projects_management,
            }
        }
    )


@require_safe
def site_home(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _public_error("site_not_found", status=400)
    home = HomePageSettings.for_site(site)
    bg_url = ""
    if home.hero_background_image and getattr(
        home.hero_background_image, "file", None
    ):
        bg_url = _abs_url(request, home.hero_background_image.file.url)
    return _api_ok(
        {
            "heroTitleLine1": home.hero_title_line_1,
            "heroTitleLine2": home.hero_title_line_2,
            "heroLead": home.hero_lead,
            "heroPrimaryCtaLabel": home.hero_primary_cta_label,
            "heroPrimaryCtaUrl": home.hero_primary_cta_url,
            "heroSecondaryCtaLabel": home.hero_secondary_cta_label,
            "heroSecondaryCtaUrl": home.hero_secondary_cta_url,
            "heroBackgroundUrl": bg_url,
            "newsletterTitle": home.newsletter_title,
            "newsletterSubtitle": home.newsletter_subtitle,
        }
    )


@require_safe
def site_content(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _public_error("site_not_found", status=400)
    content = SiteContentSettings.for_site(site)
    return _api_ok(
        {
            "workingHours": content.working_hours,
            "values": content.values or [],
            "headings": content.headings or {},
            "projectTypes": content.project_types or [],
        }
    )


@require_safe
def site_services(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return _public_error("site_not_found", status=400)
    services_index = root.get_children().live().filter(slug="services").first()
    if not services_index:
        return _api_ok({"items": []})
    # Query the specific model directly so cover_image is joined once instead
    # of fetching it for every service in the loop.
    pages = (
        ServicePage.objects.child_of(services_index)
        .live()
        .select_related("cover_image")
    )
    items: list[dict[str, Any]] = []
    for p in pages:
        cover_url = ""
        cover = getattr(p, "cover_image", None)
        if cover and getattr(cover, "file", None):
            cover_url = _abs_url(request, cover.file.url)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "url": p.url,
                "description": getattr(p, "short_description", "") or "",
                "imageUrl": cover_url,
            }
        )
    return _api_ok({"items": items})


@require_safe
def site_projects(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return _public_error("site_not_found", status=400)
    projects_index = root.get_children().live().filter(slug="projects").first()
    if not projects_index:
        return _api_ok({"items": []})
    status = str(request.GET.get("status") or "").strip()
    if status and status not in {
        ProjectPage.STATUS_ONGOING,
        ProjectPage.STATUS_COMPLETED,
    }:
        return _public_error("invalid_project_status", status=400)
    pages = (
        ProjectPage.objects.child_of(projects_index)
        .live()
        .exclude(status=ProjectPage.STATUS_ARCHIVED)
        .select_related("cover_image")
    )
    if status:
        pages = pages.filter(status=status)
    pages = pages.order_by("path")
    pages = pages.prefetch_related(
        Prefetch(
            "gallery_images",
            queryset=ProjectGalleryImage.objects.select_related(
                "image"
            ).order_by("sort_order", "id"),
        )
    )
    items: list[dict[str, Any]] = []
    for p in pages:
        cover_url = _project_cover_url(request, p)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "url": p.url,
                "category": getattr(p, "client_name", "") or "",
                "description": getattr(p, "short_description", "") or "",
                "status": getattr(p, "status", ProjectPage.STATUS_COMPLETED)
                or ProjectPage.STATUS_COMPLETED,
                "location": getattr(p, "project_location", "") or "",
                "year": str(getattr(p, "completion_year", "") or ""),
                "imageUrl": cover_url,
            }
        )
    return _api_ok({"items": items})


_CONTENT_MODELS: dict[str, Any] = {
    "articles": ArticlePage,
    "events": EventPage,
    "locations": LocationPage,
    "projects": ProjectPage,
}
_INDEX_MODELS: dict[str, Any] = {
    "articles": ArticleIndexPage,
    "events": EventIndexPage,
    "locations": LocationIndexPage,
    "projects": ProjectIndexPage,
}
_INDEX_SLUGS: dict[str, set[str]] = {
    "articles": {"blog", "blogs", "articles", "news"},
    "events": {"events", "event"},
    "locations": {"locations", "location"},
    "projects": {"projects", "project"},
}


def _content_index(request: HttpRequest, kind: str):
    root = _site_root(request)
    if not root:
        return None
    # Resolve the index directly instead of loading every sibling as a
    # specific page (which costs one query per page type).
    index_model = _INDEX_MODELS.get(kind)
    if index_model:
        index = index_model.objects.child_of(root).live().first()
        if index:
            return index
    slugs = _INDEX_SLUGS.get(kind, set())
    if slugs:
        return Page.objects.child_of(root).live().filter(slug__in=slugs).first()
    return None


@require_safe
def site_content_list(request: HttpRequest, kind: str) -> JsonResponse:
    model = _CONTENT_MODELS.get(kind)
    if not model:
        return _public_error("invalid_content_type", status=400)
    index = _content_index(request, kind)
    if not index:
        return _api_ok({"items": []})
    pages = (
        model.objects.child_of(index)
        .live()
        .select_related("cover_image")
        .order_by("-first_published_at", "path")
    )
    items: list[dict[str, Any]] = []
    for p in pages:
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "url": p.url,
                "excerpt": str(
                    getattr(p, "search_description", "")
                    or getattr(p, "caption", "")
                    or getattr(p, "map_description", "")
                    or ""
                )[:300],
                "imageUrl": _image_url(request, getattr(p, "cover_image", None))
                or "",
                "date": _to_iso(getattr(p, "first_published_at", None)) or "",
                "author": str(getattr(p, "author_display", "") or ""),
            }
        )
    return _api_ok({"items": items})


@require_safe
def site_content_detail(
    request: HttpRequest, kind: str, slug: str
) -> JsonResponse:
    model = _CONTENT_MODELS.get(kind)
    if not model:
        return _public_error("invalid_content_type", status=400)
    if (
        not slug
        or len(slug) > 255
        or any(ord(ch) < 32 or ord(ch) == 127 for ch in slug)
    ):
        return _public_error("invalid_slug")
    index = _content_index(request, kind)
    if not index:
        return _public_error("not_found", status=404)
    queryset = (
        model.objects.child_of(index).live().select_related("cover_image")
    )
    if kind == "events":
        queryset = queryset.prefetch_related(
            Prefetch(
                "occurrences",
                queryset=EventOccurrence.objects.order_by("start"),
            )
        )
    elif kind == "projects":
        queryset = queryset.prefetch_related(
            Prefetch(
                "gallery_images",
                queryset=ProjectGalleryImage.objects.select_related(
                    "image"
                ).order_by("sort_order", "id"),
            )
        )
    page = queryset.filter(slug=slug).first()
    if not page:
        return _public_error("not_found", status=404)
    result: dict[str, Any] = {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "url": page.url,
        "seoTitle": getattr(page, "seo_title", "") or page.title,
        "description": getattr(page, "search_description", "")
        or str(
            getattr(page, "caption", "")
            or getattr(page, "map_description", "")
            or ""
        ),
        "bodyHtml": _streamfield_to_html(getattr(page, "body", None)),
        "canonicalUrl": str(getattr(page, "canonical_url", "") or ""),
        "imageUrl": _image_url(request, getattr(page, "cover_image", None))
        or "",
        "date": _to_iso(getattr(page, "first_published_at", None)) or "",
        "author": str(getattr(page, "author_display", "") or ""),
    }
    if kind == "locations":
        result.update(
            {
                "address": str(getattr(page, "address", "") or ""),
                "latitude": getattr(page, "latitude", None),
                "longitude": getattr(page, "longitude", None),
                "mapTitle": str(getattr(page, "map_title", "") or ""),
                "phone": str(getattr(page, "phone_number", "") or ""),
                "website": str(getattr(page, "website", "") or ""),
            }
        )
    if kind == "events":
        occurrences = []
        for occ in page.occurrences.all():
            occurrences.append(
                {
                    "start": _to_iso(getattr(occ, "start", None)),
                    "end": _to_iso(getattr(occ, "end", None)),
                    "repeat": str(getattr(occ, "repeat", "") or ""),
                }
            )
        result["occurrences"] = occurrences
        result["nextOccurrence"] = occurrences[0] if occurrences else None
        result["address"] = str(getattr(page, "address", "") or "")
    if kind == "projects":
        result["description"] = (
            str(getattr(page, "scope_statement", "") or "")
            or str(getattr(page, "short_description", "") or "")
            or result["description"]
        )
        result["location"] = str(getattr(page, "project_location", "") or "")
        result["status"] = str(getattr(page, "status", "") or "")
        budget = getattr(page, "budget_amount", None)
        result["budgetAmount"] = float(budget) if budget is not None else None
        timeline = []
        for line in str(
            getattr(page, "management_notes", "") or ""
        ).splitlines():
            parts = [part.strip() for part in line.split("|")]
            if len(parts) >= 3 and len(parts[0]) == 10 and parts[0][4] == "-":
                timeline.append(
                    {
                        "date": parts[0],
                        "title": parts[1],
                        "description": parts[2],
                    }
                )
        result["timeline"] = timeline
        if slug == "jericho-hall":
            from django.conf import settings

            timeline_file = (
                Path(settings.BASE_DIR)
                / "website"
                / "data"
                / "jericho_timeline.json"
            )
            try:
                days = json.loads(timeline_file.read_text(encoding="utf-8"))
                result["timeline"] = days
                # Verified from the daily reports in the project folder.
                result["contract"] = "MOF/WB/2026/021-CTD"
                result["documentedDays"] = len(days)
                result["documentedPhotos"] = sum(
                    int(row.get("photos") or 0) for row in days
                )
            except Exception:
                pass
        gallery: list[dict[str, Any]] = []
        for item in page.gallery_images.all():
            url = _image_url(request, getattr(item, "image", None))
            if url:
                gallery.append({"url": url, "caption": str(item.caption or "")})
        result["gallery"] = gallery
        if not result["imageUrl"] and gallery:
            result["imageUrl"] = gallery[0]["url"]
    return _api_ok(result)


@require_safe
def site_team(request: HttpRequest) -> JsonResponse:
    items: list[dict[str, Any]] = []
    for m in TeamMember.objects.select_related("image").all():
        image_url = ""
        if m.image and getattr(m.image, "file", None):
            image_url = _abs_url(request, m.image.file.url)
        items.append(
            {
                "id": m.id,
                "name": m.name,
                "position": m.position,
                "specialization": m.specialization,
                "experience": m.experience,
                "bio": m.bio,
                "imageUrl": image_url,
            }
        )
    return _api_ok({"items": items})


@require_safe
def site_testimonials(request: HttpRequest) -> JsonResponse:
    items: list[dict[str, Any]] = []
    for t in Testimonial.objects.all():
        items.append(
            {
                "id": t.id,
                "name": t.name,
                "project": t.project,
                "text": t.text,
                "rating": t.rating,
            }
        )
    return _api_ok({"items": items})


@require_safe
def site_home_sections(request: HttpRequest) -> JsonResponse:
    badges = [
        {
            "id": b.id,
            "title": b.title,
            "description": b.description,
            "iconClass": b.icon_class,
        }
        for b in HomeTrustBadge.objects.all()
    ]
    stats = [
        {
            "id": s.id,
            "label": s.label,
            "value": s.value,
            "iconClass": s.icon_class,
        }
        for s in HomeStat.objects.all()
    ]
    steps = [
        {
            "id": st.id,
            "title": st.title,
            "description": st.description,
            "iconClass": st.icon_class,
        }
        for st in HomeTimelineStep.objects.all()
    ]
    ai_features = [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "badgeText": f.badge_text,
        }
        for f in HomeAIFeature.objects.all()
    ]
    ai_metrics = [
        {
            "id": m.id,
            "value": m.value,
            "label": m.label,
        }
        for m in HomeAIMetric.objects.all()
    ]
    return _api_ok(
        {
            "trustBadges": badges,
            "stats": stats,
            "timelineSteps": steps,
            "aiFeatures": ai_features,
            "aiMetrics": ai_metrics,
        }
    )
