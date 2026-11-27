"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import re
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.http import HttpRequest
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import AISettings
from website.models import CalculatorSettings
from website.models import CompanySettings
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomePageSettings
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import Lead
from website.models import ProjectPage
from website.models import RFQDocument
from website.models import ServicePage
from website.models import SiteVisibilitySettings
from website.models import TeamMember
from website.models import Testimonial
from website.models import Worker

logger = logging.getLogger(__name__)


def _setting_str(data: dict[str, Any], key: str, current: Any) -> str:
    """Missing key keeps the old value; an explicit empty string clears it."""
    value = data.get(key)
    return str(current) if value is None else str(value)


from .common import *


def admin_summary(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden

    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)

    company = CompanySettings.for_site(site)
    home = HomePageSettings.for_site(site)
    ai = AISettings.for_site(site)

    warnings: list[str] = []
    if not company.logo_image:
        warnings.append("الشعار غير محدد.")
    if not company.phone_1 and not company.phone_2:
        warnings.append("أرقام الهاتف غير محددة.")
    if not company.email:
        warnings.append("البريد الإلكتروني غير محدد.")
    if not home.hero_background_image:
        warnings.append("خلفية الهيرو غير محددة.")
    if ai and not ai.gemini_enabled:
        warnings.append("Gemini غير مفعل في إعدادات الذكاء الاصطناعي.")

    counts = {
        "services": ServicePage.objects.live().count(),
        "projects": ProjectPage.objects.live().count(),
        "team": TeamMember.objects.count(),
        "testimonials": Testimonial.objects.count(),
        "rfqDocuments": RFQDocument.objects.count(),
        "leads": Lead.objects.count(),
        "trustBadges": HomeTrustBadge.objects.count(),
        "stats": HomeStat.objects.count(),
        "timeline": HomeTimelineStep.objects.count(),
        "aiFeatures": HomeAIFeature.objects.count(),
        "aiMetrics": HomeAIMetric.objects.count(),
    }

    return _api_ok(
        {
            "warnings": warnings,
            "counts": counts,
            "links": {
                "backup": "/control/backup",
                "publicSite": "/",
                "tools": "/tools",
            },
        }
    )


def admin_company_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    company = CompanySettings.for_site(site)
    logo_id = getattr(company.logo_image, "id", None)
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
            "logoImageId": logo_id,
            "logoUrl": _image_url(request, company.logo_image),
            "logoThumbUrl": _image_rendition_url(
                request, company.logo_image, "max-320x320|jpegquality-70"
            ),
        }
    )


@require_POST
def admin_company_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    company = CompanySettings.for_site(site)
    data = _read_json(request)
    company.name = _setting_str(data, "name", company.name)
    company.brand_title = _setting_str(data, "brandTitle", company.brand_title)
    company.brand_subtitle = _setting_str(
        data, "brandSubtitle", company.brand_subtitle
    )
    company.slogan = _setting_str(data, "slogan", company.slogan)
    company.description = _setting_str(data, "description", company.description)
    company.mission = _setting_str(data, "mission", company.mission)
    company.vision = _setting_str(data, "vision", company.vision)
    company.topbar_slogan = _setting_str(
        data, "topbarSlogan", company.topbar_slogan
    )
    company.address = _setting_str(data, "address", company.address)
    company.registration_status = _setting_str(
        data, "registrationStatus", company.registration_status
    )
    company.chamber_membership = _setting_str(
        data, "chamberMembership", company.chamber_membership
    )
    company.classification = _setting_str(
        data, "classification", company.classification
    )
    company.email = _setting_str(data, "email", company.email)
    company.phone_1 = _setting_str(data, "phone1", company.phone_1)
    company.phone_2 = _setting_str(data, "phone2", company.phone_2)
    company.facebook_url = _setting_str(
        data, "facebookUrl", company.facebook_url
    )
    company.instagram_url = _setting_str(
        data, "instagramUrl", company.instagram_url
    )
    company.linkedin_url = _setting_str(
        data, "linkedinUrl", company.linkedin_url
    )

    if data.get("logoImageId") is not None:
        val = data.get("logoImageId")
        if val in {"", None}:
            company.logo_image = None
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(val))).first()
            except Exception:
                img = None
            if not img:
                return _api_error("invalid_image", status=400)
            company.logo_image = img

    company.save()
    return _api_ok()


def admin_home_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    home = HomePageSettings.for_site(site)
    hero_bg_id = getattr(home.hero_background_image, "id", None)
    hero_bg_url = _image_url(request, home.hero_background_image)
    return _api_ok(
        {
            "heroTitleLine1": home.hero_title_line_1,
            "heroTitleLine2": home.hero_title_line_2,
            "heroLead": home.hero_lead,
            "heroPrimaryCtaLabel": home.hero_primary_cta_label,
            "heroPrimaryCtaUrl": home.hero_primary_cta_url,
            "heroSecondaryCtaLabel": home.hero_secondary_cta_label,
            "heroSecondaryCtaUrl": home.hero_secondary_cta_url,
            "heroBackgroundImageId": hero_bg_id,
            "heroBackgroundUrl": hero_bg_url,
            "heroBackgroundThumbUrl": _image_rendition_url(
                request,
                home.hero_background_image,
                "fill-640x360|jpegquality-70",
            ),
            "newsletterTitle": home.newsletter_title,
            "newsletterSubtitle": home.newsletter_subtitle,
        }
    )


@require_POST
def admin_home_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    home = HomePageSettings.for_site(site)
    data = _read_json(request)
    home.hero_title_line_1 = _setting_str(
        data, "heroTitleLine1", home.hero_title_line_1
    )
    home.hero_title_line_2 = _setting_str(
        data, "heroTitleLine2", home.hero_title_line_2
    )
    home.hero_lead = _setting_str(data, "heroLead", home.hero_lead)
    home.hero_primary_cta_label = _setting_str(
        data, "heroPrimaryCtaLabel", home.hero_primary_cta_label
    )
    home.hero_primary_cta_url = _setting_str(
        data, "heroPrimaryCtaUrl", home.hero_primary_cta_url
    )
    home.hero_secondary_cta_label = _setting_str(
        data, "heroSecondaryCtaLabel", home.hero_secondary_cta_label
    )
    home.hero_secondary_cta_url = _setting_str(
        data, "heroSecondaryCtaUrl", home.hero_secondary_cta_url
    )
    home.newsletter_title = _setting_str(
        data, "newsletterTitle", home.newsletter_title
    )
    home.newsletter_subtitle = _setting_str(
        data, "newsletterSubtitle", home.newsletter_subtitle
    )

    hero_bg_id = data.get("heroBackgroundImageId")
    if hero_bg_id is None:
        pass
    else:
        if hero_bg_id in {"", None}:
            home.hero_background_image = None
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(hero_bg_id))).first()
            except Exception:
                img = None
            if not img:
                return _api_error("invalid_image", status=400)
            home.hero_background_image = img

    home.save()
    return _api_ok()


def admin_ai_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    s = AISettings.for_site(site)
    return _api_ok(
        {
            "geminiApiKeyEnvVar": s.gemini_api_key_env_var,
            "geminiModel": s.gemini_model,
            "geminiEnabled": s.gemini_enabled,
            "temperature": s.temperature,
            "maxOutputTokens": s.max_output_tokens,
            "companyContext": s.company_context,
            "designAnalyzerPrompt": s.design_analyzer_prompt,
            "contentGeneratorPrompt": s.content_generator_prompt,
            "chatPrompt": s.chat_prompt,
            "visualizerPrompt": s.visualizer_prompt,
            "visualizerDefaultStyle": s.visualizer_default_style,
            "visualizerDefaultAspectRatio": s.visualizer_default_aspect_ratio,
            "visualizerPlaceholderPrimaryHex": s.visualizer_placeholder_primary_hex,
            "visualizerPlaceholderSecondaryHex": s.visualizer_placeholder_secondary_hex,
            "visualizerPlaceholderFooterText": s.visualizer_placeholder_footer_text,
        }
    )


@require_POST
def admin_ai_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    s = AISettings.for_site(site)
    data = _read_json(request)
    requested_env_var = _setting_str(
        data, "geminiApiKeyEnvVar", s.gemini_api_key_env_var
    ).strip()
    if requested_env_var != s.gemini_api_key_env_var:
        # Changing the env-var name could be used to read arbitrary secrets
        # from the process environment. Restrict it to Gemini names and to
        # superusers only.
        if not getattr(request.user, "is_superuser", False):
            return _api_error("forbidden", status=403)
        if not re.fullmatch(r"GEMINI[A-Z0-9_]*", requested_env_var):
            return _api_error("invalid_env_var", status=400)
    s.gemini_api_key_env_var = requested_env_var
    s.gemini_model = _setting_str(data, "geminiModel", s.gemini_model)
    s.gemini_enabled = bool(
        data.get("geminiEnabled")
        if data.get("geminiEnabled") is not None
        else s.gemini_enabled
    )
    temp_val = data.get("temperature")
    if temp_val is not None:
        try:
            s.temperature = float(temp_val)
        except Exception:
            return _api_error("invalid_temperature", status=400)
    max_val = data.get("maxOutputTokens")
    if max_val is not None:
        try:
            s.max_output_tokens = int(max_val)
        except Exception:
            return _api_error("invalid_max_output_tokens", status=400)
    s.company_context = _setting_str(data, "companyContext", s.company_context)
    s.design_analyzer_prompt = _setting_str(
        data, "designAnalyzerPrompt", s.design_analyzer_prompt
    )
    s.content_generator_prompt = _setting_str(
        data, "contentGeneratorPrompt", s.content_generator_prompt
    )
    s.chat_prompt = _setting_str(data, "chatPrompt", s.chat_prompt)
    s.visualizer_prompt = _setting_str(
        data, "visualizerPrompt", s.visualizer_prompt
    )
    s.visualizer_default_style = _setting_str(
        data, "visualizerDefaultStyle", s.visualizer_default_style
    )
    s.visualizer_default_aspect_ratio = _setting_str(
        data, "visualizerDefaultAspectRatio", s.visualizer_default_aspect_ratio
    )
    s.visualizer_placeholder_primary_hex = _setting_str(
        data,
        "visualizerPlaceholderPrimaryHex",
        s.visualizer_placeholder_primary_hex,
    )
    s.visualizer_placeholder_secondary_hex = _setting_str(
        data,
        "visualizerPlaceholderSecondaryHex",
        s.visualizer_placeholder_secondary_hex,
    )
    s.visualizer_placeholder_footer_text = _setting_str(
        data,
        "visualizerPlaceholderFooterText",
        s.visualizer_placeholder_footer_text,
    )
    s.save()
    return _api_ok()


def admin_calculator_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    s = CalculatorSettings.for_site(site)
    items = (
        s.items
        if isinstance(s.items, list) and len(s.items)
        else _default_calculator_items(s)
    )
    return _api_ok(
        {
            "concreteM3PerM2": s.concrete_m3_per_m2,
            "concreteUnitPriceIls": s.concrete_unit_price_ils,
            "steelKgPerM2": s.steel_kg_per_m2,
            "steelUnitPriceIls": s.steel_unit_price_ils,
            "blocksPerM2": s.blocks_per_m2,
            "blockUnitPriceIls": s.block_unit_price_ils,
            "tilesM2PerM2": s.tiles_m2_per_m2,
            "tilesUnitPriceIls": s.tiles_unit_price_ils,
            "paintLitersPerM2": s.paint_liters_per_m2,
            "paintUnitPriceIls": s.paint_unit_price_ils,
            "electricUnitPriceIls": s.electric_unit_price_ils,
            "plumbingUnitPriceIls": s.plumbing_unit_price_ils,
            "laborPercent": s.labor_percent,
            "currencyDefault": s.currency_default,
            "usdToIlsRate": s.usd_to_ils_rate,
            "overheadPercent": s.overhead_percent,
            "profitPercent": s.profit_percent,
            "contingencyPercent": s.contingency_percent,
            "includeVat": s.include_vat,
            "vatPercent": s.vat_percent,
            "items": items,
        }
    )


@require_POST
def admin_calculator_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    s = CalculatorSettings.for_site(site)
    data = _read_json(request)
    if data.get("currencyDefault") is not None:
        val = str(data.get("currencyDefault") or "").strip().upper()
        if val not in {"ILS", "USD"}:
            return _api_error("invalid_currencyDefault", status=400)
        s.currency_default = val
    raw_usd_to_ils = data.get("usdToIlsRate")
    if raw_usd_to_ils is not None:
        try:
            s.usd_to_ils_rate = float(raw_usd_to_ils)
        except Exception:
            return _api_error("invalid_usdToIlsRate", status=400)
    raw_overhead = data.get("overheadPercent")
    if raw_overhead is not None:
        try:
            s.overhead_percent = float(raw_overhead)
        except Exception:
            return _api_error("invalid_overheadPercent", status=400)
    raw_profit = data.get("profitPercent")
    if raw_profit is not None:
        try:
            s.profit_percent = float(raw_profit)
        except Exception:
            return _api_error("invalid_profitPercent", status=400)
    raw_contingency = data.get("contingencyPercent")
    if raw_contingency is not None:
        try:
            s.contingency_percent = float(raw_contingency)
        except Exception:
            return _api_error("invalid_contingencyPercent", status=400)
    if data.get("includeVat") is not None:
        s.include_vat = bool(data.get("includeVat"))
    raw_vat = data.get("vatPercent")
    if raw_vat is not None:
        try:
            s.vat_percent = float(raw_vat)
        except Exception:
            return _api_error("invalid_vatPercent", status=400)
    if data.get("items") is not None:
        items = data.get("items")
        if not isinstance(items, list):
            return _api_error("invalid_items", status=400)
        cleaned: list[dict[str, Any]] = []
        for raw in items[:400]:
            if not isinstance(raw, dict):
                continue
            key = str(raw.get("key") or "").strip()
            if not key:
                continue
            label = str(raw.get("label") or "").strip()
            category = str(raw.get("category") or "").strip()
            unit = str(raw.get("unit") or "").strip()
            basis = str(raw.get("basis") or "").strip()
            try:
                factor = float(raw.get("factor") or 0.0)
                unit_price_ils = float(raw.get("unitPriceIls") or 0.0)
            except Exception:
                return _api_error("invalid_items", status=400)
            enabled = bool(raw.get("enabled", True))
            if basis not in {"area_total", "area_per_floor"}:
                basis = "area_total"
            cleaned.append(
                {
                    "key": key[:64],
                    "label": label[:128] if label else key[:64],
                    "category": category[:64] if category else "Ø£Ø®Ø±Ù‰",
                    "unit": unit[:16] if unit else "Ù…Â²",
                    "basis": basis,
                    "factor": factor,
                    "unitPriceIls": unit_price_ils,
                    "enabled": enabled,
                }
            )
        s.items = cleaned
    for key, attr in [
        ("concreteM3PerM2", "concrete_m3_per_m2"),
        ("concreteUnitPriceIls", "concrete_unit_price_ils"),
        ("steelKgPerM2", "steel_kg_per_m2"),
        ("steelUnitPriceIls", "steel_unit_price_ils"),
        ("blocksPerM2", "blocks_per_m2"),
        ("blockUnitPriceIls", "block_unit_price_ils"),
        ("tilesM2PerM2", "tiles_m2_per_m2"),
        ("tilesUnitPriceIls", "tiles_unit_price_ils"),
        ("paintLitersPerM2", "paint_liters_per_m2"),
        ("paintUnitPriceIls", "paint_unit_price_ils"),
        ("electricUnitPriceIls", "electric_unit_price_ils"),
        ("plumbingUnitPriceIls", "plumbing_unit_price_ils"),
        ("laborPercent", "labor_percent"),
    ]:
        raw_val: Any = data.get(key)
        if raw_val is None:
            continue
        try:
            setattr(s, attr, float(raw_val))
        except Exception:
            return _api_error(f"invalid_{key}", status=400)
    s.save()
    return _api_ok()


def admin_visibility_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    v = SiteVisibilitySettings.for_site(site)
    return _api_ok(
        {
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
    )


@require_POST
def admin_visibility_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    v = SiteVisibilitySettings.for_site(site)
    data = _read_json(request)
    for key, attr in [
        ("showServices", "show_services"),
        ("showProjects", "show_projects"),
        ("showTools", "show_tools"),
        ("showShowcase", "show_showcase"),
        ("showAbout", "show_about"),
        ("showContact", "show_contact"),
        ("showTeam", "show_team"),
        ("showTestimonials", "show_testimonials"),
        ("showHomeTrustBadges", "show_home_trust_badges"),
        ("showHomeStats", "show_home_stats"),
        ("showHomeTimeline", "show_home_timeline"),
        ("showHomeQuickLinks", "show_home_quick_links"),
        ("showRfqTemplates", "show_rfq_templates"),
        ("showHomeAIBanner", "show_home_ai_banner"),
        ("showNewsletter", "show_newsletter"),
        ("showAIChatbot", "show_ai_chatbot"),
        ("showWhatsAppButton", "show_whatsapp_button"),
        ("showFloatingCTA", "show_floating_cta"),
        ("showFooter", "show_footer"),
        ("showControlProjectsManagement", "show_control_projects_management"),
    ]:
        if data.get(key) is None:
            continue
        setattr(v, attr, bool(data.get(key)))
    v.save()
    return _api_ok()


@require_POST
def admin_users(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(
        request, scope="admin_users", limit=12, window_seconds=600
    )
    if limited:
        return limited

    data = _read_json(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "").strip()
    role = str(data.get("role") or "manager").strip()

    if not username:
        return _api_error("missing_username", status=400)

    allowed_roles = {
        "guest",
        "registered_guest",
        "employee",
        "registrar",
        "accountant",
        "manager",
        "superadmin",
    }
    if role not in allowed_roles:
        return _api_error("invalid_role", status=400)

    User = get_user_model()
    obj, created = User.objects.get_or_create(username=username)
    obj.is_staff = True

    generated_password: str | None = None
    if not password:
        generated_password = _generate_password()
        password = generated_password

    try:
        role_group_names: set[str] = set()
        for names in ROLE_GROUPS.values():
            role_group_names |= set(names)
        to_remove = list(Group.objects.filter(name__in=role_group_names))
        if to_remove:
            obj.groups.remove(*to_remove)
    except Exception:
        pass

    if role == "superadmin":
        obj.is_superuser = True
    else:
        obj.is_superuser = False
        role_to_group_name = {
            "guest": "Guests",
            "registered_guest": "Registered Guests",
            "employee": "Employees",
            "registrar": "Registrars",
            "accountant": "Accountants",
            "manager": "Managers",
        }
        group_name = role_to_group_name.get(role)
        if group_name:
            grp, _ = Group.objects.get_or_create(name=group_name)
            obj.groups.add(grp)

    obj.set_password(password)
    obj.save()

    return _api_ok(
        {
            "created": created,
            "generatedPassword": generated_password,
        }
    )


@require_GET
def admin_users_list(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    limit = int(request.GET.get("limit") or 200) or 200
    limit = max(1, min(limit, 500))
    User = get_user_model()
    qs = (
        User.objects.filter(is_staff=True)
        .prefetch_related("groups")
        .order_by("username", "id")[:limit]
    )
    user_ids = [int(u.id) for u in qs]
    worker_map: dict[int, int] = {}
    try:
        for row in Worker.objects.filter(user_id__in=user_ids).values(
            "user_id", "id"
        ):
            uid = int(row.get("user_id") or 0)
            wid = int(row.get("id") or 0)
            if uid:
                worker_map[uid] = wid
    except Exception:
        worker_map = {}
    items: list[dict[str, Any]] = []
    for u in qs:
        groups = []
        try:
            groups = [str(g.name) for g in u.groups.all()]
        except Exception:
            groups = []
        items.append(
            {
                "id": int(u.id),
                "username": getattr(u, "username", "") or "",
                "isSuperuser": bool(getattr(u, "is_superuser", False)),
                "role": _user_role(u),
                "groups": groups,
                "workerId": int(worker_map.get(int(u.id), 0) or 0),
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_content_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    from website.models import SiteContentSettings

    content = SiteContentSettings.for_site(site)
    return _api_ok(
        {
            "workingHours": content.working_hours,
            "values": content.values or [],
            "headings": content.headings or {},
            "projectTypes": content.project_types or [],
        }
    )


@require_POST
def admin_content_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    from website.models import SiteContentSettings

    data = _read_json(request)
    content = SiteContentSettings.for_site(site)
    if "workingHours" in data:
        content.working_hours = str(data["workingHours"] or "")[:255]
    for field, key in (
        ("values", "values"),
        ("headings", "headings"),
        ("projectTypes", "projectTypes"),
    ):
        if key in data:
            value = data[key]
            if not isinstance(value, (list, dict)):
                return _api_error("invalid_value", status=400)
            setattr(content, field, value)
    content.save()
    return _api_ok()
