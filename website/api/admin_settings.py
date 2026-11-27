"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import math
import os
import re
from functools import wraps
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


from .common import *

# ---------------------------------------------------------------------------
# Strict input validation with short, non-technical Arabic messages.
# ---------------------------------------------------------------------------

_api_error_base = _api_error

_SAFE_MESSAGES: dict[str, str] = {
    "unauthorized": "يرجى تسجيل الدخول أولاً.",
    "forbidden": "لا تملك صلاحية لتنفيذ هذا الإجراء.",
    "not_found": "العنصر المطلوب غير موجود.",
    "site_not_found": "تعذّر تحديد الموقع.",
    "invalid_input": "البيانات المدخلة غير صالحة. يرجى مراجعتها والمحاولة مجدداً.",
    "invalid_image": "الصورة المحددة غير صالحة.",
    "invalid_env_var": "اسم متغير المفتاح غير صالح.",
    "invalid_temperature": "قيمة الحرارة غير صالحة.",
    "invalid_max_output_tokens": "الحد الأقصى للرموز غير صالح.",
    "invalid_currencyDefault": "العملة المحددة غير صالحة.",
    "invalid_items": "بيانات البنود غير صالحة.",
    "invalid_value": "القيمة المدخلة غير صالحة.",
    "missing_username": "يرجى إدخال اسم المستخدم.",
    "invalid_role": "الدور المحدد غير صالح.",
}


def _err(
    code: str,
    *,
    status: int = 400,
    message: str | None = None,
    details: dict[str, Any] | None = None,
) -> JsonResponse:
    safe = (
        message or _SAFE_MESSAGES.get(code) or _SAFE_MESSAGES["invalid_input"]
    )
    return _api_error_base(code, status=status, message=safe, details=details)


class _InputError(Exception):
    """A validation failure whose message is safe to display to an admin."""

    def __init__(self, message: str, code: str = "invalid_input") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def _validated(view_func: Any) -> Any:
    @wraps(view_func)
    def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:
        try:
            return view_func(request, *args, **kwargs)
        except _InputError as exc:
            return _err(exc.code, message=exc.message)

    return _wrapped


def _text(value: Any, label: str, *, max_len: int = 255) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.")
    result = value.strip()
    if len(result) > max_len:
        raise _InputError(f"يجب ألا يتجاوز {label} {max_len} حرفاً.")
    return result


_LONG_TEXT = 100_000

_LONG_SETTING_KEYS = {
    "description",
    "mission",
    "vision",
    "companyContext",
    "designAnalyzerPrompt",
    "contentGeneratorPrompt",
    "chatPrompt",
    "visualizerPrompt",
    "heroLead",
    "newsletterSubtitle",
}

_SETTING_LABELS = {
    "name": "اسم الشركة",
    "brandTitle": "عنوان العلامة",
    "brandSubtitle": "عنوان العلامة الفرعي",
    "slogan": "الشعار",
    "description": "الوصف",
    "mission": "الرسالة",
    "vision": "الرؤية",
    "topbarSlogan": "شعار الشريط العلوي",
    "address": "العنوان",
    "registrationStatus": "حالة التسجيل",
    "chamberMembership": "العضوية في الغرفة",
    "classification": "التصنيف",
    "email": "البريد الإلكتروني",
    "phone1": "الهاتف الأول",
    "phone2": "الهاتف الثاني",
    "facebookUrl": "رابط فيسبوك",
    "instagramUrl": "رابط إنستغرام",
    "linkedinUrl": "رابط لينكدإن",
    "heroTitleLine1": "عنوان الهيرو الأول",
    "heroTitleLine2": "عنوان الهيرو الثاني",
    "heroLead": "مقدمة الهيرو",
    "heroPrimaryCtaLabel": "نص الزر الأساسي",
    "heroPrimaryCtaUrl": "رابط الزر الأساسي",
    "heroSecondaryCtaLabel": "نص الزر الثانوي",
    "heroSecondaryCtaUrl": "رابط الزر الثانوي",
    "newsletterTitle": "عنوان النشرة",
    "newsletterSubtitle": "وصف النشرة",
    "geminiApiKeyEnvVar": "اسم متغير المفتاح",
    "geminiModel": "النموذج",
    "companyContext": "سياق الشركة",
    "designAnalyzerPrompt": "برومبت تحليل التصميم",
    "contentGeneratorPrompt": "برومبت توليد المحتوى",
    "chatPrompt": "برومبت المحادثة",
    "visualizerPrompt": "برومبت التخيل",
    "visualizerDefaultStyle": "النمط الافتراضي",
    "visualizerDefaultAspectRatio": "نسبة الأبعاد",
    "visualizerPlaceholderPrimaryHex": "اللون الأساسي",
    "visualizerPlaceholderSecondaryHex": "اللون الثانوي",
    "visualizerPlaceholderFooterText": "نص التذييل",
}


def _setting_str(
    data: dict[str, Any], key: str, current: Any, *, max_len: int | None = None
) -> str:
    """Missing key keeps the old value; an explicit empty string clears it."""
    value = data.get(key)
    if value is None:
        return str(current)
    if max_len is None:
        max_len = _LONG_TEXT if key in _LONG_SETTING_KEYS else 255
    return _text(value, _SETTING_LABELS.get(key, "القيمة"), max_len=max_len)


def _bool(value: Any, label: str, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise _InputError(f"قيمة {label} غير صالحة.")


def _number(
    value: Any,
    label: str,
    *,
    low: float,
    high: float,
    code: str = "invalid_input",
) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    if not math.isfinite(number) or number < low or number > high:
        raise _InputError(f"يجب أن يكون {label} بين {low} و {high}.", code)
    return number


def _safe_json(value: Any, *, depth: int = 0) -> None:
    """Limit size and nesting of free-form settings without changing its shape."""
    if depth > 4:
        raise _InputError("البيانات المدخلة غير صالحة.", "invalid_value")
    if isinstance(value, str):
        if len(value) > 1000:
            raise _InputError("أحد النصوص المدخلة طويل جداً.", "invalid_value")
    elif isinstance(value, (int, float, bool)) or value is None:
        return
    elif isinstance(value, list):
        if len(value) > 200:
            raise _InputError("عدد العناصر كبير جداً.", "invalid_value")
        for item in value:
            _safe_json(item, depth=depth + 1)
    elif isinstance(value, dict):
        if len(value) > 200:
            raise _InputError("عدد العناصر كبير جداً.", "invalid_value")
        for key, item in value.items():
            if not isinstance(key, str) or len(key) > 128:
                raise _InputError("مفتاح العنصر غير صالح.", "invalid_value")
            _safe_json(item, depth=depth + 1)
    else:
        raise _InputError("البيانات المدخلة غير صالحة.", "invalid_value")


def _integer(
    value: Any, label: str, *, low: int, high: int, code: str = "invalid_input"
) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    if number < low or number > high:
        raise _InputError(f"يجب أن يكون {label} بين {low} و {high}.", code)
    return number


def _image(value: Any) -> Any:
    """Resolve an image id, or None when the field is being cleared/omitted."""
    if value is None or value == "":
        return None
    pk = _integer(value, "الصورة", low=1, high=9_223_372_036_854_775_807)
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=pk).first()
    except Exception:
        img = None
    if not img:
        raise _InputError("الصورة المحددة غير صالحة.", "invalid_image")
    return img


def _gemini_key_available(s: Any) -> bool:
    """Only report AI as active when an API key is actually configured."""
    env_name = _text(
        str(getattr(s, "gemini_api_key_env_var", "") or ""),
        "اسم متغير المفتاح",
        max_len=64,
    )
    if not re.fullmatch(r"GEMINI[A-Z0-9_]*", env_name):
        return False
    return bool(os.environ.get(env_name) or os.environ.get("GEMINI_API_KEY"))


def _gemini_enabled_for(s: Any) -> bool:
    return bool(getattr(s, "gemini_enabled", False)) and _gemini_key_available(
        s
    )


def admin_summary(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden

    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)

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
    if not (ai and _gemini_enabled_for(ai)):
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
        return _err("site_not_found", status=400)
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
@_validated
def admin_company_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
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
        company.logo_image = _image(data.get("logoImageId"))

    company.save()
    return _api_ok()


def admin_home_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
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
@_validated
def admin_home_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
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

    if data.get("heroBackgroundImageId") is not None:
        home.hero_background_image = _image(data.get("heroBackgroundImageId"))

    home.save()
    return _api_ok()


def admin_ai_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
    s = AISettings.for_site(site)
    return _api_ok(
        {
            "geminiApiKeyEnvVar": s.gemini_api_key_env_var,
            "geminiModel": s.gemini_model,
            "geminiEnabled": _gemini_enabled_for(s),
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
@_validated
def admin_ai_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
    s = AISettings.for_site(site)
    data = _read_json(request)
    requested_env_var = _setting_str(
        data, "geminiApiKeyEnvVar", s.gemini_api_key_env_var, max_len=64
    ).strip()
    if requested_env_var != s.gemini_api_key_env_var:
        # Changing the env-var name could be used to read arbitrary secrets
        # from the process environment. Restrict it to Gemini names and to
        # superusers only.
        if not getattr(request.user, "is_superuser", False):
            return _err("forbidden", status=403)
        if not re.fullmatch(r"GEMINI[A-Z0-9_]*", requested_env_var):
            return _err("invalid_env_var", status=400)
    s.gemini_api_key_env_var = requested_env_var
    s.gemini_model = _setting_str(
        data, "geminiModel", s.gemini_model, max_len=64
    )
    requested_enabled = _bool(
        data.get("geminiEnabled"),
        "حالة التفعيل",
        default=bool(s.gemini_enabled),
    )
    # Do not persist a claim that AI is enabled unless a key is really present.
    s.gemini_enabled = bool(requested_enabled) and _gemini_key_available(s)
    temp_val = data.get("temperature")
    if temp_val is not None:
        s.temperature = _number(
            temp_val, "الحرارة", low=0.0, high=2.0, code="invalid_temperature"
        )
    max_val = data.get("maxOutputTokens")
    if max_val is not None:
        s.max_output_tokens = int(
            _number(
                max_val,
                "الحد الأقصى للرموز",
                low=1,
                high=1_000_000,
                code="invalid_max_output_tokens",
            )
        )
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
    if "visualizerDefaultAspectRatio" in data:
        ratio = _text(
            data.get("visualizerDefaultAspectRatio"), "نسبة الأبعاد", max_len=8
        )
        if ratio not in {"1:1", "4:3", "16:9", "9:16"}:
            raise _InputError("نسبة الأبعاد غير صالحة.")
        s.visualizer_default_aspect_ratio = ratio
    for key, attr in (
        (
            "visualizerPlaceholderPrimaryHex",
            "visualizer_placeholder_primary_hex",
        ),
        (
            "visualizerPlaceholderSecondaryHex",
            "visualizer_placeholder_secondary_hex",
        ),
    ):
        if key in data:
            color = _setting_str(data, key, getattr(s, attr), max_len=7)
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
                raise _InputError("اللون غير صالح؛ استخدم صيغة #RRGGBB.")
            setattr(s, attr, color)
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
        return _err("site_not_found", status=400)
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
@_validated
def admin_calculator_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
    s = CalculatorSettings.for_site(site)
    data = _read_json(request)
    if data.get("currencyDefault") is not None:
        val = _text(data.get("currencyDefault"), "العملة", max_len=8).upper()
        if val not in {"ILS", "USD"}:
            raise _InputError(
                "العملة المحددة غير صالحة.", "invalid_currencyDefault"
            )
        s.currency_default = val
    for key, attr, low, high in (
        ("usdToIlsRate", "usd_to_ils_rate", 0.0001, 1_000_000),
        ("overheadPercent", "overhead_percent", 0, 100),
        ("profitPercent", "profit_percent", 0, 100),
        ("contingencyPercent", "contingency_percent", 0, 100),
        ("vatPercent", "vat_percent", 0, 100),
    ):
        raw_val = data.get(key)
        if raw_val is not None:
            setattr(s, attr, _number(raw_val, key, low=low, high=high))
    if data.get("includeVat") is not None:
        s.include_vat = _bool(data.get("includeVat"), "ضريبة القيمة المضافة")
    if data.get("items") is not None:
        items = data.get("items")
        if not isinstance(items, list) or len(items) > 400:
            raise _InputError("بيانات البنود غير صالحة.", "invalid_items")
        cleaned: list[dict[str, Any]] = []
        for raw in items:
            if not isinstance(raw, dict):
                raise _InputError("بيانات البنود غير صالحة.", "invalid_items")
            key = _text(raw.get("key"), "مفتاح البند", max_len=64)
            if not key:
                raise _InputError("بيانات البنود غير صالحة.", "invalid_items")
            label = _text(raw.get("label"), "اسم البند", max_len=128)
            category = _text(raw.get("category"), "الفئة", max_len=64)
            unit = _text(raw.get("unit"), "الوحدة", max_len=16)
            basis = _text(raw.get("basis"), "الأساس", max_len=32)
            raw_factor = raw.get("factor")
            raw_price = raw.get("unitPriceIls")
            factor = _number(
                0 if raw_factor is None else raw_factor,
                "المعامل",
                low=0,
                high=1_000_000,
                code="invalid_items",
            )
            unit_price_ils = _number(
                0 if raw_price is None else raw_price,
                "السعر",
                low=0,
                high=1_000_000_000,
                code="invalid_items",
            )
            enabled = _bool(raw.get("enabled"), "التفعيل", default=True)
            if basis not in {"area_total", "area_per_floor"}:
                basis = "area_total"
            cleaned.append(
                {
                    "key": key,
                    "label": label or key,
                    "category": category or "Ø£Ø®Ø±Ù‰",
                    "unit": unit or "Ù…Â²",
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
        setattr(
            s,
            attr,
            _number(
                raw_val,
                key,
                low=0,
                high=1_000_000_000,
                code=f"invalid_{key}",
            ),
        )
    s.save()
    return _api_ok()


def admin_visibility_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
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
@_validated
def admin_visibility_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
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
        setattr(v, attr, _bool(data.get(key), key))
    v.save()
    return _api_ok()


@require_POST
@_validated
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
    username = _text(data.get("username"), "اسم المستخدم", max_len=150)
    password = _text(data.get("password"), "كلمة المرور", max_len=128)
    role = _text(data.get("role"), "الدور", max_len=32) or "manager"

    if not username:
        return _err("missing_username", status=400)
    if not re.fullmatch(r"[\w.@+-]+", username):
        raise _InputError("اسم المستخدم غير صالح.")
    if password and len(password) < 8:
        raise _InputError("يجب ألا تقل كلمة المرور عن 8 أحرف.")

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
        return _err("invalid_role", status=400)

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
    try:
        limit = int(str(request.GET.get("limit") or "200").strip()) or 200
    except (TypeError, ValueError):
        limit = 200
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
        return _err("site_not_found", status=400)
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
@_validated
def admin_content_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _err("site_not_found", status=400)
    from website.models import SiteContentSettings

    data = _read_json(request)
    content = SiteContentSettings.for_site(site)
    if "workingHours" in data:
        content.working_hours = _text(
            data["workingHours"], "ساعات العمل", max_len=255
        )
    for field, key in (
        ("values", "values"),
        ("headings", "headings"),
        ("projectTypes", "projectTypes"),
    ):
        if key in data:
            value = data[key]
            if not isinstance(value, (list, dict)):
                raise _InputError("القيمة المدخلة غير صالحة.", "invalid_value")
            _safe_json(value)
            setattr(content, field, value)
    content.save()
    return _api_ok()
