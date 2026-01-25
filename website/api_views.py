import base64
import json
import os
import random
import secrets
import string
import tempfile
import time
from io import BytesIO
from io import StringIO
from typing import Any
from typing import Iterator

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.db import transaction
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import JsonResponse
from django.http import StreamingHttpResponse
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST
from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont
from wagtail.models import Page
from wagtail.models import Site

from website.models import AIContentGeneratorPage
from website.models import AIDesignAnalyzerPage
from website.models import AISettings
from website.models import ArchitecturalVisualizerPage
from website.models import ArticleIndexPage
from website.models import ArticlePage
from website.models import CalculatorSettings
from website.models import CertificationIndexPage
from website.models import CertificationPage
from website.models import CompanySettings
from website.models import ConstructionCalculatorPage
from website.models import ContactPage
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomePageSettings
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import LocationIndexPage
from website.models import LocationPage
from website.models import ProjectGalleryImage
from website.models import ProjectIndexPage
from website.models import ProjectPage
from website.models import QuoteRequestPage
from website.models import RFQDocument
from website.models import ServiceIndexPage
from website.models import ServicePage
from website.models import SiteVisibilitySettings
from website.models import TeamMember
from website.models import Testimonial
from website.models import ToolsIndexPage
from website.models import WebPage


def _read_json(request: HttpRequest) -> dict[str, Any]:
    try:
        raw = request.body.decode("utf-8") if request.body else "{}"
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _can_use_restricted_tools(request: HttpRequest) -> bool:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_staff", False):
        return False
    if getattr(user, "is_superuser", False):
        return True

    try:
        group_names = set(user.groups.values_list("name", flat=True))
    except Exception:
        return False

    allowed = {"Managers", "Manager", "مدراء", "المدراء", "مدراء الموقع"}
    return any(name in allowed for name in group_names)


def auth_access(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"canUseRestrictedTools": _can_use_restricted_tools(request)})


@require_POST
def auth_login(request: HttpRequest) -> JsonResponse:
    data = _read_json(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    user = authenticate(request, username=username, password=password)
    if not user:
        return JsonResponse({"error": "invalid_credentials"}, status=401)
    if not getattr(user, "is_active", False):
        return JsonResponse({"error": "inactive"}, status=403)
    if not getattr(user, "is_staff", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    django_login(request, user)
    return JsonResponse({"ok": True})


@ensure_csrf_cookie
def auth_me(request: HttpRequest) -> JsonResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return JsonResponse(
            {
                "authenticated": False,
                "username": "",
                "isStaff": False,
                "isSuperuser": False,
                "groups": [],
            }
        )
    try:
        groups = list(user.groups.values_list("name", flat=True))
    except Exception:
        groups = []
    return JsonResponse(
        {
            "authenticated": True,
            "username": getattr(user, "username", "") or "",
            "isStaff": bool(getattr(user, "is_staff", False)),
            "isSuperuser": bool(getattr(user, "is_superuser", False)),
            "groups": groups,
        }
    )


@require_POST
def auth_logout(request: HttpRequest) -> JsonResponse:
    django_logout(request)
    return JsonResponse({"ok": True})


@require_POST
def auth_change_password(request: HttpRequest) -> JsonResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    if not getattr(user, "is_staff", False):
        return JsonResponse({"error": "forbidden"}, status=403)

    data = _read_json(request)
    old_password = str(data.get("oldPassword") or "")
    new_password = str(data.get("newPassword") or "")

    if not old_password or not new_password:
        return JsonResponse({"error": "missing_fields"}, status=400)

    if not user.check_password(old_password):
        return JsonResponse({"error": "invalid_old_password"}, status=400)

    user.set_password(new_password)
    user.save()
    django_login(request, user)
    return JsonResponse({"ok": True})


def _require_staff(request: HttpRequest) -> Any | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    if not getattr(user, "is_staff", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    return None


def _require_superuser(request: HttpRequest) -> Any | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    if not getattr(user, "is_superuser", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    return None


def admin_summary(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden

    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)

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
        "trustBadges": HomeTrustBadge.objects.count(),
        "stats": HomeStat.objects.count(),
        "timeline": HomeTimelineStep.objects.count(),
        "aiFeatures": HomeAIFeature.objects.count(),
        "aiMetrics": HomeAIMetric.objects.count(),
    }

    return JsonResponse(
        {
            "warnings": warnings,
            "counts": counts,
            "links": {
                "djangoAdmin": "/django-admin/",
                "publicSite": "/",
                "tools": "/tools",
            },
        }
    )


def admin_company_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    company = CompanySettings.for_site(site)
    logo_id = getattr(company.logo_image, "id", None)
    return JsonResponse(
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
        }
    )


@require_POST
def admin_company_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    company = CompanySettings.for_site(site)
    data = _read_json(request)
    company.name = str(data.get("name") or company.name)
    company.brand_title = str(data.get("brandTitle") or company.brand_title)
    company.brand_subtitle = str(data.get("brandSubtitle") or company.brand_subtitle)
    company.slogan = str(data.get("slogan") or company.slogan)
    company.description = str(data.get("description") or company.description)
    company.mission = str(data.get("mission") or company.mission)
    company.vision = str(data.get("vision") or company.vision)
    company.topbar_slogan = str(data.get("topbarSlogan") or company.topbar_slogan)
    company.address = str(data.get("address") or company.address)
    company.registration_status = str(
        data.get("registrationStatus") or company.registration_status
    )
    company.chamber_membership = str(
        data.get("chamberMembership") or company.chamber_membership
    )
    company.classification = str(data.get("classification") or company.classification)
    company.email = str(data.get("email") or company.email)
    company.phone_1 = str(data.get("phone1") or company.phone_1)
    company.phone_2 = str(data.get("phone2") or company.phone_2)
    company.facebook_url = str(data.get("facebookUrl") or company.facebook_url)
    company.instagram_url = str(data.get("instagramUrl") or company.instagram_url)
    company.linkedin_url = str(data.get("linkedinUrl") or company.linkedin_url)

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
                return JsonResponse({"error": "invalid_image"}, status=400)
            company.logo_image = img

    company.save()
    return JsonResponse({"ok": True})


def admin_home_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    home = HomePageSettings.for_site(site)
    hero_bg_id = getattr(home.hero_background_image, "id", None)
    hero_bg_url = _image_url(request, home.hero_background_image)
    return JsonResponse(
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
            "newsletterTitle": home.newsletter_title,
            "newsletterSubtitle": home.newsletter_subtitle,
        }
    )


@require_POST
def admin_home_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    home = HomePageSettings.for_site(site)
    data = _read_json(request)
    home.hero_title_line_1 = str(data.get("heroTitleLine1") or home.hero_title_line_1)
    home.hero_title_line_2 = str(data.get("heroTitleLine2") or home.hero_title_line_2)
    home.hero_lead = str(data.get("heroLead") or home.hero_lead)
    home.hero_primary_cta_label = str(
        data.get("heroPrimaryCtaLabel") or home.hero_primary_cta_label
    )
    home.hero_primary_cta_url = str(
        data.get("heroPrimaryCtaUrl") or home.hero_primary_cta_url
    )
    home.hero_secondary_cta_label = str(
        data.get("heroSecondaryCtaLabel") or home.hero_secondary_cta_label
    )
    home.hero_secondary_cta_url = str(
        data.get("heroSecondaryCtaUrl") or home.hero_secondary_cta_url
    )
    home.newsletter_title = str(data.get("newsletterTitle") or home.newsletter_title)
    home.newsletter_subtitle = str(
        data.get("newsletterSubtitle") or home.newsletter_subtitle
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
                return JsonResponse({"error": "invalid_image"}, status=400)
            home.hero_background_image = img

    home.save()
    return JsonResponse({"ok": True})


def admin_ai_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    s = AISettings.for_site(site)
    return JsonResponse(
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
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    s = AISettings.for_site(site)
    data = _read_json(request)
    s.gemini_api_key_env_var = str(
        data.get("geminiApiKeyEnvVar") or s.gemini_api_key_env_var
    )
    s.gemini_model = str(data.get("geminiModel") or s.gemini_model)
    s.gemini_enabled = bool(
        data.get("geminiEnabled") if data.get("geminiEnabled") is not None else s.gemini_enabled
    )
    temp_val = data.get("temperature")
    if temp_val is not None:
        try:
            s.temperature = float(temp_val)
        except Exception:
            return JsonResponse({"error": "invalid_temperature"}, status=400)
    max_val = data.get("maxOutputTokens")
    if max_val is not None:
        try:
            s.max_output_tokens = int(max_val)
        except Exception:
            return JsonResponse({"error": "invalid_max_output_tokens"}, status=400)
    s.company_context = str(data.get("companyContext") or s.company_context)
    s.design_analyzer_prompt = str(
        data.get("designAnalyzerPrompt") or s.design_analyzer_prompt
    )
    s.content_generator_prompt = str(
        data.get("contentGeneratorPrompt") or s.content_generator_prompt
    )
    s.chat_prompt = str(data.get("chatPrompt") or s.chat_prompt)
    s.visualizer_prompt = str(data.get("visualizerPrompt") or s.visualizer_prompt)
    s.visualizer_default_style = str(
        data.get("visualizerDefaultStyle") or s.visualizer_default_style
    )
    s.visualizer_default_aspect_ratio = str(
        data.get("visualizerDefaultAspectRatio") or s.visualizer_default_aspect_ratio
    )
    s.visualizer_placeholder_primary_hex = str(
        data.get("visualizerPlaceholderPrimaryHex") or s.visualizer_placeholder_primary_hex
    )
    s.visualizer_placeholder_secondary_hex = str(
        data.get("visualizerPlaceholderSecondaryHex") or s.visualizer_placeholder_secondary_hex
    )
    s.visualizer_placeholder_footer_text = str(
        data.get("visualizerPlaceholderFooterText") or s.visualizer_placeholder_footer_text
    )
    s.save()
    return JsonResponse({"ok": True})


def _default_calculator_items(settings_obj: CalculatorSettings | None) -> list[dict[str, Any]]:
    s = settings_obj
    concrete_m3_per_m2 = s.concrete_m3_per_m2 if s else 0.25
    concrete_unit = s.concrete_unit_price_ils if s else 520.0
    steel_kg_per_m2 = s.steel_kg_per_m2 if s else 35.0
    steel_unit = s.steel_unit_price_ils if s else 4.8
    blocks_per_m2 = s.blocks_per_m2 if s else 12.0
    block_unit = s.block_unit_price_ils if s else 3.2
    tiles_m2_per_m2 = s.tiles_m2_per_m2 if s else 1.1
    tiles_unit = s.tiles_unit_price_ils if s else 55.0
    paint_liters_per_m2 = s.paint_liters_per_m2 if s else 0.35
    paint_unit = s.paint_unit_price_ils if s else 18.0
    electric_unit = s.electric_unit_price_ils if s else 22.0
    plumbing_unit = s.plumbing_unit_price_ils if s else 18.0

    return [
        {
            "key": "site_setup",
            "label": "تجهيزات الموقع (تقديري)",
            "category": "الأعمال التمهيدية",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.0,
            "unitPriceIls": 12.0,
            "enabled": True,
        },
        {
            "key": "excavation",
            "label": "حفر",
            "category": "أعمال الحفر والردم",
            "unit": "م³",
            "basis": "area_total",
            "factor": 0.55,
            "unitPriceIls": 42.0,
            "enabled": True,
        },
        {
            "key": "backfill",
            "label": "ردم وتسوية",
            "category": "أعمال الحفر والردم",
            "unit": "م³",
            "basis": "area_total",
            "factor": 0.35,
            "unitPriceIls": 28.0,
            "enabled": True,
        },
        {
            "key": "concrete",
            "label": "خرسانة جاهزة",
            "category": "أعمال الخرسانة",
            "unit": "م³",
            "basis": "area_total",
            "factor": float(concrete_m3_per_m2),
            "unitPriceIls": float(concrete_unit),
            "enabled": True,
        },
        {
            "key": "formwork",
            "label": "شدات/نجارة (تقديري)",
            "category": "أعمال النجارة/الشدات",
            "unit": "م²",
            "basis": "area_total",
            "factor": 2.2,
            "unitPriceIls": 68.0,
            "enabled": True,
        },
        {
            "key": "rebar",
            "label": "حديد تسليح",
            "category": "أعمال الحدادة",
            "unit": "كغم",
            "basis": "area_total",
            "factor": float(steel_kg_per_m2),
            "unitPriceIls": float(steel_unit),
            "enabled": True,
        },
        {
            "key": "blocks",
            "label": "بلوك",
            "category": "أعمال المباني",
            "unit": "حبة",
            "basis": "area_total",
            "factor": float(blocks_per_m2),
            "unitPriceIls": float(block_unit),
            "enabled": True,
        },
        {
            "key": "plaster",
            "label": "لياسة/قصارة (تقديري)",
            "category": "أعمال اللياسة والقصارة",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.8,
            "unitPriceIls": 32.0,
            "enabled": True,
        },
        {
            "key": "waterproof_roof",
            "label": "عزل سطح (تقديري)",
            "category": "أعمال العزل",
            "unit": "م²",
            "basis": "area_per_floor",
            "factor": 1.0,
            "unitPriceIls": 46.0,
            "enabled": True,
        },
        {
            "key": "waterproof_wet_areas",
            "label": "عزل حمامات ومناطق رطبة (تقديري)",
            "category": "أعمال العزل",
            "unit": "م²",
            "basis": "area_total",
            "factor": 0.18,
            "unitPriceIls": 42.0,
            "enabled": True,
        },
        {
            "key": "tiles",
            "label": "بلاط أرضيات (تقديري)",
            "category": "أعمال التشطيبات",
            "unit": "م²",
            "basis": "area_total",
            "factor": float(tiles_m2_per_m2),
            "unitPriceIls": float(tiles_unit),
            "enabled": True,
        },
        {
            "key": "paint",
            "label": "دهان",
            "category": "أعمال التشطيبات",
            "unit": "لتر",
            "basis": "area_total",
            "factor": float(paint_liters_per_m2),
            "unitPriceIls": float(paint_unit),
            "enabled": True,
        },
        {
            "key": "gypsum_ceiling",
            "label": "أسقف جبس/جبسمبورد (تقديري)",
            "category": "أعمال التشطيبات",
            "unit": "م²",
            "basis": "area_total",
            "factor": 0.6,
            "unitPriceIls": 58.0,
            "enabled": False,
        },
        {
            "key": "windows_aluminum",
            "label": "شبابيك ألمنيوم (تقديري)",
            "category": "الأبواب والشبابيك",
            "unit": "م²",
            "basis": "area_total",
            "factor": 0.12,
            "unitPriceIls": 640.0,
            "enabled": False,
        },
        {
            "key": "doors_internal",
            "label": "أبواب داخلية (تقديري)",
            "category": "الأبواب والشبابيك",
            "unit": "باب",
            "basis": "area_total",
            "factor": 0.014,
            "unitPriceIls": 720.0,
            "enabled": False,
        },
        {
            "key": "electric",
            "label": "كهرباء (تقديري)",
            "category": "أعمال الكهرباء",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.0,
            "unitPriceIls": float(electric_unit),
            "enabled": True,
        },
        {
            "key": "plumbing",
            "label": "سباكة وصحي (تقديري)",
            "category": "أعمال السباكة والصحي",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.0,
            "unitPriceIls": float(plumbing_unit),
            "enabled": True,
        },
        {
            "key": "hvac",
            "label": "تكييف وتهوية (تقديري)",
            "category": "أعمال التكييف والتهوية",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.0,
            "unitPriceIls": 35.0,
            "enabled": False,
        },
        {
            "key": "external_paving",
            "label": "أعمال خارجية/إنترلوك (تقديري)",
            "category": "أعمال خارجية",
            "unit": "م²",
            "basis": "area_total",
            "factor": 0.15,
            "unitPriceIls": 75.0,
            "enabled": False,
        },
        {
            "key": "demolition",
            "label": "هدم/تكسير (ترميم) (تقديري)",
            "category": "أعمال الترميم",
            "unit": "م²",
            "basis": "area_total",
            "factor": 1.0,
            "unitPriceIls": 45.0,
            "enabled": False,
        },
    ]


def admin_calculator_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    s = CalculatorSettings.for_site(site)
    items = s.items if isinstance(s.items, list) and len(s.items) else _default_calculator_items(s)
    return JsonResponse(
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
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    s = CalculatorSettings.for_site(site)
    data = _read_json(request)
    if data.get("currencyDefault") is not None:
        val = str(data.get("currencyDefault") or "").strip().upper()
        if val not in {"ILS", "USD"}:
            return JsonResponse({"error": "invalid_currencyDefault"}, status=400)
        s.currency_default = val
    raw_usd_to_ils = data.get("usdToIlsRate")
    if raw_usd_to_ils is not None:
        try:
            s.usd_to_ils_rate = float(raw_usd_to_ils)
        except Exception:
            return JsonResponse({"error": "invalid_usdToIlsRate"}, status=400)
    raw_overhead = data.get("overheadPercent")
    if raw_overhead is not None:
        try:
            s.overhead_percent = float(raw_overhead)
        except Exception:
            return JsonResponse({"error": "invalid_overheadPercent"}, status=400)
    raw_profit = data.get("profitPercent")
    if raw_profit is not None:
        try:
            s.profit_percent = float(raw_profit)
        except Exception:
            return JsonResponse({"error": "invalid_profitPercent"}, status=400)
    raw_contingency = data.get("contingencyPercent")
    if raw_contingency is not None:
        try:
            s.contingency_percent = float(raw_contingency)
        except Exception:
            return JsonResponse({"error": "invalid_contingencyPercent"}, status=400)
    if data.get("includeVat") is not None:
        s.include_vat = bool(data.get("includeVat"))
    raw_vat = data.get("vatPercent")
    if raw_vat is not None:
        try:
            s.vat_percent = float(raw_vat)
        except Exception:
            return JsonResponse({"error": "invalid_vatPercent"}, status=400)
    if data.get("items") is not None:
        items = data.get("items")
        if not isinstance(items, list):
            return JsonResponse({"error": "invalid_items"}, status=400)
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
                return JsonResponse({"error": "invalid_items"}, status=400)
            enabled = bool(raw.get("enabled", True))
            if basis not in {"area_total", "area_per_floor"}:
                basis = "area_total"
            cleaned.append(
                {
                    "key": key[:64],
                    "label": label[:128] if label else key[:64],
                    "category": category[:64] if category else "أخرى",
                    "unit": unit[:16] if unit else "م²",
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
            return JsonResponse({"error": f"invalid_{key}"}, status=400)
    s.save()
    return JsonResponse({"ok": True})


def admin_visibility_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    v = SiteVisibilitySettings.for_site(site)
    return JsonResponse(
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
        }
    )


@require_POST
def admin_visibility_settings_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
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
    ]:
        if data.get(key) is None:
            continue
        setattr(v, attr, bool(data.get(key)))
    v.save()
    return JsonResponse({"ok": True})


def admin_team(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in TeamMember.objects.all():
        items.append(
            {
                "id": m.id,
                "sortOrder": m.sort_order,
                "name": m.name,
                "position": m.position,
                "specialization": m.specialization,
                "experience": m.experience,
                "bio": m.bio,
                "imageId": getattr(m.image, "id", None),
                "imageUrl": _image_url(request, m.image),
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_team_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "missing_name"}, status=400)

    image_id_raw = data.get("imageId")
    image_id: int | None = None
    if isinstance(image_id_raw, int):
        image_id = image_id_raw
    elif isinstance(image_id_raw, str) and image_id_raw.strip():
        try:
            image_id = int(image_id_raw)
        except Exception:
            image_id = None

    img = None
    if image_id is not None:
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=image_id).first()
        except Exception:
            img = None

    last = TeamMember.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    m = TeamMember.objects.create(
        sort_order=sort_order,
        name=name,
        position=str(data.get("position") or ""),
        specialization=str(data.get("specialization") or ""),
        experience=str(data.get("experience") or ""),
        bio=str(data.get("bio") or ""),
        image=img,
    )
    return JsonResponse({"ok": True, "id": m.id})


@require_POST
def admin_team_update(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return JsonResponse({"error": "missing_name"}, status=400)
        m.name = name

    for key, attr in [
        ("position", "position"),
        ("specialization", "specialization"),
        ("experience", "experience"),
        ("bio", "bio"),
    ]:
        if data.get(key) is not None:
            setattr(m, attr, str(data.get(key) or ""))

    if data.get("imageId") is not None:
        image_id_raw = data.get("imageId")
        image_id: int | None = None
        if isinstance(image_id_raw, int):
            image_id = image_id_raw
        elif isinstance(image_id_raw, str) and image_id_raw.strip():
            try:
                image_id = int(image_id_raw)
            except Exception:
                image_id = None

        if image_id is None:
            m.image = None
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=image_id).first()
            except Exception:
                img = None
            if not img:
                return JsonResponse({"error": "invalid_image"}, status=400)
            m.image = img

    m.save()
    return JsonResponse({"ok": True, "imageUrl": _image_url(request, m.image), "imageId": getattr(m.image, "id", None)})


@require_POST
def admin_team_delete(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return JsonResponse({"error": "not_found"}, status=404)
    m.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_team_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue

    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)

    members = TeamMember.objects.filter(pk__in=cleaned)
    by_id = {m.id: m for m in members}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            m = by_id.get(mid)
            if not m:
                continue
            m.sort_order = idx
            m.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_testimonials(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for t in Testimonial.objects.all():
        items.append(
            {
                "id": t.id,
                "sortOrder": t.sort_order,
                "name": t.name,
                "project": t.project,
                "text": t.text,
                "rating": int(t.rating or 0),
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_testimonials_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    text = str(data.get("text") or "").strip()
    if not name:
        return JsonResponse({"error": "missing_name"}, status=400)
    if not text:
        return JsonResponse({"error": "missing_text"}, status=400)

    rating_raw = data.get("rating")
    rating = 5
    if rating_raw is not None and rating_raw != "":
        try:
            rating = int(rating_raw)
        except Exception:
            return JsonResponse({"error": "invalid_rating"}, status=400)
        rating = max(1, min(5, rating))

    last = Testimonial.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    t = Testimonial.objects.create(
        sort_order=sort_order,
        name=name,
        project=str(data.get("project") or ""),
        text=text,
        rating=rating,
    )
    return JsonResponse({"ok": True, "id": t.id})


@require_POST
def admin_testimonials_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            t.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return JsonResponse({"error": "missing_name"}, status=400)
        t.name = name

    if data.get("text") is not None:
        text = str(data.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "missing_text"}, status=400)
        t.text = text

    if data.get("project") is not None:
        t.project = str(data.get("project") or "")

    rating_raw = data.get("rating")
    if rating_raw is not None:
        try:
            rating = int(rating_raw)
        except Exception:
            return JsonResponse({"error": "invalid_rating"}, status=400)
        t.rating = max(1, min(5, rating))

    t.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_testimonials_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return JsonResponse({"error": "not_found"}, status=404)
    t.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_testimonials_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = Testimonial.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_home_trust_badges(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for b in HomeTrustBadge.objects.all():
        items.append(
            {
                "id": b.id,
                "sortOrder": b.sort_order,
                "title": b.title,
                "description": b.description,
                "iconClass": b.icon_class,
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_home_trust_badges_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return JsonResponse({"error": "missing_title"}, status=400)
    last = HomeTrustBadge.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    b = HomeTrustBadge.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-shield-alt") or "fas fa-shield-alt",
    )
    return JsonResponse({"ok": True, "id": b.id})


@require_POST
def admin_home_trust_badges_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            b.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return JsonResponse({"error": "missing_title"}, status=400)
        b.title = title
    if data.get("description") is not None:
        b.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        b.icon_class = str(data.get("iconClass") or "")
    b.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_trust_badges_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return JsonResponse({"error": "not_found"}, status=404)
    b.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_trust_badges_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = HomeTrustBadge.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_home_stats(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for s in HomeStat.objects.all():
        items.append(
            {
                "id": s.id,
                "sortOrder": s.sort_order,
                "label": s.label,
                "value": s.value,
                "iconClass": s.icon_class,
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_home_stats_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    label = str(data.get("label") or "").strip()
    value = str(data.get("value") or "").strip()
    if not label:
        return JsonResponse({"error": "missing_label"}, status=400)
    if not value:
        return JsonResponse({"error": "missing_value"}, status=400)
    last = HomeStat.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    s = HomeStat.objects.create(
        sort_order=sort_order,
        label=label,
        value=value,
        icon_class=str(data.get("iconClass") or "fas fa-building") or "fas fa-building",
    )
    return JsonResponse({"ok": True, "id": s.id})


@require_POST
def admin_home_stats_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            s.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return JsonResponse({"error": "missing_label"}, status=400)
        s.label = label
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return JsonResponse({"error": "missing_value"}, status=400)
        s.value = value
    if data.get("iconClass") is not None:
        s.icon_class = str(data.get("iconClass") or "")
    s.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_stats_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return JsonResponse({"error": "not_found"}, status=404)
    s.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_stats_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = HomeStat.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_home_timeline(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for st in HomeTimelineStep.objects.all():
        items.append(
            {
                "id": st.id,
                "sortOrder": st.sort_order,
                "title": st.title,
                "description": st.description,
                "iconClass": st.icon_class,
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_home_timeline_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return JsonResponse({"error": "missing_title"}, status=400)
    last = HomeTimelineStep.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    st = HomeTimelineStep.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-file-search") or "fas fa-file-search",
    )
    return JsonResponse({"ok": True, "id": st.id})


@require_POST
def admin_home_timeline_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            st.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return JsonResponse({"error": "missing_title"}, status=400)
        st.title = title
    if data.get("description") is not None:
        st.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        st.icon_class = str(data.get("iconClass") or "")
    st.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_timeline_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return JsonResponse({"error": "not_found"}, status=404)
    st.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_timeline_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = HomeTimelineStep.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_home_ai_features(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for f in HomeAIFeature.objects.all():
        items.append(
            {
                "id": f.id,
                "sortOrder": f.sort_order,
                "title": f.title,
                "description": f.description,
                "badgeText": f.badge_text,
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_home_ai_features_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return JsonResponse({"error": "missing_title"}, status=400)
    last = HomeAIFeature.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    f = HomeAIFeature.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        badge_text=str(data.get("badgeText") or "AI") or "AI",
    )
    return JsonResponse({"ok": True, "id": f.id})


@require_POST
def admin_home_ai_features_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            f.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return JsonResponse({"error": "missing_title"}, status=400)
        f.title = title
    if data.get("description") is not None:
        f.description = str(data.get("description") or "")
    if data.get("badgeText") is not None:
        f.badge_text = str(data.get("badgeText") or "")
    f.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_ai_features_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return JsonResponse({"error": "not_found"}, status=404)
    f.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_ai_features_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = HomeAIFeature.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def admin_home_ai_metrics(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in HomeAIMetric.objects.all():
        items.append(
            {
                "id": m.id,
                "sortOrder": m.sort_order,
                "value": m.value,
                "label": m.label,
            }
        )
    return JsonResponse({"items": items})


@require_POST
def admin_home_ai_metrics_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    value = str(data.get("value") or "").strip()
    label = str(data.get("label") or "").strip()
    if not value:
        return JsonResponse({"error": "missing_value"}, status=400)
    if not label:
        return JsonResponse({"error": "missing_label"}, status=400)
    last = HomeAIMetric.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    m = HomeAIMetric.objects.create(sort_order=sort_order, value=value, label=label)
    return JsonResponse({"ok": True, "id": m.id})


@require_POST
def admin_home_ai_metrics_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return JsonResponse({"error": "invalid_sortOrder"}, status=400)
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return JsonResponse({"error": "missing_value"}, status=400)
        m.value = value
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return JsonResponse({"error": "missing_label"}, status=400)
        m.label = label
    m.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_ai_metrics_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return JsonResponse({"error": "not_found"}, status=404)
    m.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_home_ai_metrics_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return JsonResponse({"error": "invalid_ids"}, status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return JsonResponse({"error": "invalid_ids"}, status=400)
    items = HomeAIMetric.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return JsonResponse({"ok": True})


def _unique_child_slug(parent: Page, base_slug: str) -> str:
    base_slug = (base_slug or "item").strip("-")[:60]
    existing = set(parent.get_children().values_list("slug", flat=True))
    if base_slug not in existing:
        return base_slug
    i = 2
    while True:
        candidate = f"{base_slug}-{i}"
        if candidate not in existing:
            return candidate
        i += 1


def _projects_index(request: HttpRequest) -> Page | None:
    root = _site_root(request)
    if not root:
        return None
    return root.get_children().filter(slug="projects").first()


def _services_index(request: HttpRequest) -> Page | None:
    root = _site_root(request)
    if not root:
        return None
    return root.get_children().filter(slug="services").first()


def _articles_index(request: HttpRequest) -> Page | None:
    root = _site_root(request)
    if not root:
        return None
    try:
        idx = ArticleIndexPage.objects.descendant_of(root).first()
    except Exception:
        idx = None
    if idx:
        return idx
    return root.get_children().filter(slug__in=["blog", "blogs", "articles", "news"]).first()


def _streamfield_first_html(body: Any) -> str:
    try:
        data = getattr(body, "raw_data", None)
        if data is None:
            data = getattr(body, "stream_data", None)
    except Exception:
        data = None
    if not isinstance(data, list):
        return ""
    for block in data:
        if not isinstance(block, dict):
            continue
        if block.get("type") != "html":
            continue
        val = block.get("value")
        return val if isinstance(val, str) else ""
    return ""


def admin_services(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return JsonResponse({"items": []})
    pages = Page.objects.child_of(idx).type(ServicePage).specific()
    items: list[dict[str, Any]] = []
    for p in pages:
        cover = getattr(p, "cover_image", None)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(getattr(p, "first_published_at", "") or ""),
                "coverUrl": _image_url(request, cover),
                "shortDescription": getattr(p, "short_description", "") or "",
            }
        )
    return JsonResponse({"items": items})


def admin_service_detail(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    cover = getattr(page, "cover_image", None)
    return JsonResponse(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "firstPublishedAt": str(getattr(page, "first_published_at", "") or ""),
            "shortDescription": getattr(page, "short_description", "") or "",
            "coverImageId": getattr(cover, "id", None),
            "coverUrl": _image_url(request, cover),
            "bodyHtml": _streamfield_first_html(getattr(page, "body", None)),
        }
    )


@require_POST
def admin_service_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return JsonResponse({"error": "services_index_missing"}, status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "خدمة"
    base_slug = slugify(str(data.get("slug") or title)) or "service"
    page = ServicePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        short_description=str(data.get("shortDescription") or ""),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None and hasattr(page, "body"):
        setattr(page, "body", [{"type": "html", "value": str(body_html or "")}])

    cover_image_id = data.get("coverImageId")
    if cover_image_id not in {None, ""} and hasattr(page, "cover_image"):
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=int(str(cover_image_id))).first()
        except Exception:
            img = None
        if img:
            setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if bool(data.get("live", True)):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return JsonResponse({"ok": True, "id": page.id})


@require_POST
def admin_service_update(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        page.title = str(data.get("title") or "")
    if data.get("shortDescription") is not None:
        page.short_description = str(data.get("shortDescription") or "")

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(page, "body", [{"type": "html", "value": str(data.get("bodyHtml") or "")}])

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        val = data.get("coverImageId")
        if val in {"", None}:
            setattr(page, "cover_image", None)
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(val))).first()
            except Exception:
                img = None
            if not img:
                return JsonResponse({"error": "invalid_image"}, status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse({"ok": True})


@require_POST
def admin_service_publish(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.save_revision().publish()
    return JsonResponse({"ok": True})


@require_POST
def admin_service_unpublish(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return JsonResponse({"ok": True})


@require_POST
def admin_service_delete(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.delete()
    return JsonResponse({"ok": True})


def _allowed_page_models() -> dict[str, type[Page]]:
    models: list[type[Page]] = [
        WebPage,
        ServiceIndexPage,
        ServicePage,
        ProjectIndexPage,
        ProjectPage,
        CertificationIndexPage,
        CertificationPage,
        ArticleIndexPage,
        ArticlePage,
        ToolsIndexPage,
        AIDesignAnalyzerPage,
        ConstructionCalculatorPage,
        ArchitecturalVisualizerPage,
        AIContentGeneratorPage,
        ContactPage,
        QuoteRequestPage,
        LocationIndexPage,
        LocationPage,
    ]
    return {m._meta.label_lower: m for m in models}


def _page_type_label(page: Page) -> str:
    try:
        cls = page.specific_class
        return str(getattr(cls._meta, "label_lower", "") or "")
    except Exception:
        return ""


def _page_type_name(page: Page) -> str:
    try:
        cls = page.specific_class
        return str(getattr(cls._meta, "verbose_name", "") or getattr(cls, "__name__", ""))
    except Exception:
        return ""


def admin_pages_tree(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    parent_id_raw = request.GET.get("parentId")
    parent_id = None
    if parent_id_raw:
        try:
            parent_id = int(str(parent_id_raw))
        except Exception:
            parent_id = None

    parent: Page | None = None
    if parent_id:
        parent = Page.objects.filter(pk=parent_id).first()
    if not parent:
        parent = _site_root(request)
    if not parent:
        return JsonResponse({"error": "site_not_found"}, status=400)

    children = Page.objects.child_of(parent).order_by("path")
    items: list[dict[str, Any]] = []
    for p in children:
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "type": _page_type_label(p),
                "typeName": _page_type_name(p),
                "url": getattr(p, "url", "") or "",
                "parentId": p.get_parent().id if p.get_parent() else None,
                "hasChildren": bool(p.get_children().exists()),
                "depth": int(getattr(p, "depth", 0) or 0),
            }
        )
    return JsonResponse(
        {
            "parent": {
                "id": parent.id,
                "title": parent.title,
                "slug": parent.slug,
                "type": _page_type_label(parent),
                "typeName": _page_type_name(parent),
                "url": getattr(parent, "url", "") or "",
            },
            "items": items,
        }
    )


def admin_pages_allowed_types(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    parent_id_raw = request.GET.get("parentId")
    if not parent_id_raw:
        return JsonResponse({"error": "missing_parentId"}, status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return JsonResponse({"error": "invalid_parentId"}, status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return JsonResponse({"error": "not_found"}, status=404)

    allowed = _allowed_page_models()
    items: list[dict[str, Any]] = []
    try:
        models = parent.get_allowed_subpage_models()
    except Exception:
        models = []
    for m in models:
        label = str(getattr(m._meta, "label_lower", "") or "")
        if label not in allowed:
            continue
        items.append(
            {
                "type": label,
                "typeName": str(getattr(m._meta, "verbose_name", "") or m.__name__),
            }
        )
    return JsonResponse({"items": items})


def admin_page_detail(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)

    body_html = ""
    if hasattr(page, "body"):
        body_html = _streamfield_first_html(getattr(page, "body", None))

    data: dict[str, Any] = {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "live": bool(getattr(page, "live", False)),
        "type": _page_type_label(page),
        "typeName": _page_type_name(page),
        "url": getattr(page, "url", "") or "",
        "parentId": page.get_parent().id if page.get_parent() else None,
        "searchDescription": str(getattr(page, "search_description", "") or ""),
        "bodyHtml": body_html,
    }

    if isinstance(page, ServicePage):
        data["shortDescription"] = page.short_description
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)

    if isinstance(page, ProjectPage):
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)
        data["shortDescription"] = page.short_description
        data["clientName"] = page.client_name
        data["projectLocation"] = page.project_location
        data["completionYear"] = page.completion_year
        data["executingAgency"] = page.executing_agency
        data["projectOwner"] = page.project_owner
        data["funder"] = page.funder
        data["supervisor"] = page.supervisor
        data["companyRole"] = page.company_role
        data["scopeOfWork"] = str(getattr(page, "scope_of_work", "") or "")

    if isinstance(page, CertificationPage):
        data["issuer"] = page.issuer
        data["certificateId"] = page.certificate_id
        data["issuedYear"] = page.issued_year

    if isinstance(page, ArticlePage):
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        data["toAddress"] = str(getattr(page, "to_address", "") or "")
        data["subject"] = str(getattr(page, "subject", "") or "")
        data["replyAddress"] = str(getattr(page, "reply_address", "") or "")

    return JsonResponse(data)


@require_POST
def admin_page_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    parent_id_raw = data.get("parentId")
    type_raw = str(data.get("type") or "").strip()
    title = str(data.get("title") or "").strip() or "صفحة"
    slug_raw = str(data.get("slug") or title).strip()
    live = bool(data.get("live", True))

    if parent_id_raw in {None, ""}:
        return JsonResponse({"error": "invalid_parentId"}, status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return JsonResponse({"error": "invalid_parentId"}, status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return JsonResponse({"error": "parent_not_found"}, status=404)

    allowed = _allowed_page_models()
    Model = allowed.get(type_raw)
    if not Model:
        return JsonResponse({"error": "invalid_type"}, status=400)

    try:
        allowed_models = parent.get_allowed_subpage_models()
    except Exception:
        allowed_models = []
    if Model not in allowed_models:
        return JsonResponse({"error": "type_not_allowed_here"}, status=400)

    base_slug = slugify(slug_raw) or "page"
    page = Model(title=title, slug=_unique_child_slug(parent, base_slug))

    parent.add_child(instance=page)
    if live:
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return JsonResponse({"ok": True, "id": page.id})


@require_POST
def admin_page_update(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        page.title = str(data.get("title") or "")

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("searchDescription") is not None and hasattr(page, "search_description"):
        setattr(page, "search_description", str(data.get("searchDescription") or ""))

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(page, "body", [{"type": "html", "value": str(data.get("bodyHtml") or "")}])

    if isinstance(page, ServicePage):
        if data.get("shortDescription") is not None:
            page.short_description = str(data.get("shortDescription") or "")
        if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
            val = data.get("coverImageId")
            if val in {"", None}:
                setattr(page, "cover_image", None)
            else:
                try:
                    from wagtail.images import get_image_model

                    ImageModel = get_image_model()
                    img = ImageModel.objects.filter(pk=int(str(val))).first()
                except Exception:
                    img = None
                if not img:
                    return JsonResponse({"error": "invalid_image"}, status=400)
                setattr(page, "cover_image", img)

    if isinstance(page, CertificationPage):
        if data.get("issuer") is not None:
            page.issuer = str(data.get("issuer") or "")
        if data.get("certificateId") is not None:
            page.certificate_id = str(data.get("certificateId") or "")
        if data.get("issuedYear") is not None:
            val = data.get("issuedYear")
            if val in {"", None}:
                page.issued_year = None
            else:
                try:
                    page.issued_year = int(str(val))
                except Exception:
                    return JsonResponse({"error": "invalid_issuedYear"}, status=400)

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        if data.get("toAddress") is not None:
            setattr(page, "to_address", str(data.get("toAddress") or ""))
        if data.get("subject") is not None:
            setattr(page, "subject", str(data.get("subject") or ""))
        if data.get("replyAddress") is not None:
            setattr(page, "reply_address", str(data.get("replyAddress") or ""))

    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse({"ok": True})


@require_POST
def admin_page_publish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.save_revision().publish()
    return JsonResponse({"ok": True})


@require_POST
def admin_page_unpublish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return JsonResponse({"ok": True})


@require_POST
def admin_page_delete(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.delete()
    return JsonResponse({"ok": True})


def admin_articles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return JsonResponse({"items": []})
    pages = Page.objects.child_of(idx).type(ArticlePage).specific()
    items: list[dict[str, Any]] = []
    for p in pages:
        cover = getattr(p, "cover_image", None)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(getattr(p, "first_published_at", "") or ""),
                "coverUrl": _image_url(request, cover),
                "searchDescription": str(getattr(p, "search_description", "") or ""),
            }
        )
    return JsonResponse({"items": items})


def admin_article_detail(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    cover = getattr(page, "cover_image", None)
    return JsonResponse(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "firstPublishedAt": str(getattr(page, "first_published_at", "") or ""),
            "searchDescription": str(getattr(page, "search_description", "") or ""),
            "coverImageId": getattr(cover, "id", None),
            "coverUrl": _image_url(request, cover),
            "bodyHtml": _streamfield_first_html(getattr(page, "body", None)),
        }
    )


@require_POST
def admin_article_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return JsonResponse({"error": "articles_index_missing"}, status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "مقال"
    base_slug = slugify(str(data.get("slug") or title)) or "article"
    page = ArticlePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        search_description=str(data.get("searchDescription") or ""),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None:
        page.body = [{"type": "html", "value": str(body_html or "")}]

    cover_image_id = data.get("coverImageId")
    if cover_image_id not in {None, ""}:
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=int(str(cover_image_id))).first()
        except Exception:
            img = None
        if img and hasattr(page, "cover_image"):
            setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if bool(data.get("live", True)):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return JsonResponse({"ok": True, "id": page.id})


@require_POST
def admin_article_update(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)

    for key, attr in [("title", "title"), ("searchDescription", "search_description")]:
        if data.get(key) is None:
            continue
        setattr(page, attr, str(data.get(key) or ""))

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None:
        page.body = [{"type": "html", "value": str(data.get("bodyHtml") or "")}]

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        val = data.get("coverImageId")
        if val in {"", None}:
            setattr(page, "cover_image", None)
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(val))).first()
            except Exception:
                img = None
            if not img:
                return JsonResponse({"error": "invalid_image"}, status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse({"ok": True})


@require_POST
def admin_article_publish(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.save_revision().publish()
    return JsonResponse({"ok": True})


@require_POST
def admin_article_unpublish(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_article_delete(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.delete()
    return JsonResponse({"ok": True})


def _rfq_number() -> str:
    ts = time.strftime("%Y%m%d")
    suffix = secrets.token_hex(2).upper()
    return f"RFQ-{ts}-{suffix}"


def admin_rfq_documents(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for d in RFQDocument.objects.all()[:200]:
        items.append(
            {
                "id": d.id,
                "title": d.title,
                "number": d.number,
                "templateKey": d.template_key,
                "currency": d.currency,
                "createdAt": d.created_at.isoformat() if d.created_at else "",
                "updatedAt": d.updated_at.isoformat() if d.updated_at else "",
            }
        )
    return JsonResponse({"items": items})


def admin_rfq_document_detail(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return JsonResponse({"error": "not_found"}, status=404)
    return JsonResponse(
        {
            "id": d.id,
            "title": d.title,
            "number": d.number,
            "templateKey": d.template_key,
            "currency": d.currency,
            "data": d.data if isinstance(d.data, dict) else {},
            "createdAt": d.created_at.isoformat() if d.created_at else "",
            "updatedAt": d.updated_at.isoformat() if d.updated_at else "",
        }
    )


@require_POST
def admin_rfq_document_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    template_key = str(data.get("templateKey") or "").strip()
    currency = str(data.get("currency") or "ILS").strip()[:8] or "ILS"
    payload = data.get("data")
    payload_dict = payload if isinstance(payload, dict) else {}

    d = RFQDocument.objects.create(
        title=title,
        template_key=template_key,
        currency=currency,
        number=_rfq_number(),
        data=payload_dict,
        created_by=getattr(request, "user", None) if getattr(request, "user", None) else None,
    )
    return JsonResponse({"ok": True, "id": d.id})


@require_POST
def admin_rfq_document_update(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return JsonResponse({"error": "not_found"}, status=404)

    data = _read_json(request)
    if data.get("title") is not None:
        d.title = str(data.get("title") or "").strip()
    if data.get("templateKey") is not None:
        d.template_key = str(data.get("templateKey") or "").strip()
    if data.get("currency") is not None:
        d.currency = str(data.get("currency") or "ILS").strip()[:8] or "ILS"
    if data.get("data") is not None:
        payload = data.get("data")
        d.data = payload if isinstance(payload, dict) else {}
    d.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_rfq_document_delete(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return JsonResponse({"error": "not_found"}, status=404)
    d.delete()
    return JsonResponse({"ok": True})


def _pdf_sanitize_text(val: Any) -> str:
    s = str(val or "")
    out = []
    for ch in s:
        code = ord(ch)
        if ch in {"\n", "\r", "\t"}:
            out.append(" ")
            continue
        if 32 <= code <= 126:
            if ch in {"(", ")", "\\"}:
                out.append("\\" + ch)
            else:
                out.append(ch)
    return "".join(out).strip()


def _company_logo_as_jpeg(company: Any | None) -> tuple[bytes, int, int] | None:
    if not company:
        return None
    logo_image = getattr(company, "logo_image", None)
    if not logo_image:
        return None
    logo_file = getattr(logo_image, "file", None)
    if not logo_file:
        return None

    try:
        img = None
        path = getattr(logo_file, "path", None)
        if isinstance(path, str) and path and os.path.exists(path):
            img = Image.open(path)
            img.load()
        else:
            try:
                logo_file.open("rb")
                f = getattr(logo_file, "file", None) or logo_file
                try:
                    f.seek(0)
                except Exception:
                    pass
                img = Image.open(f)
                img.load()
            finally:
                try:
                    logo_file.close()
                except Exception:
                    pass

        if not img:
            return None

        img_rgba = img.convert("RGBA")
        img_rgba.thumbnail((700, 300))
        bg = Image.new("RGBA", img_rgba.size, (255, 255, 255, 255))
        bg.alpha_composite(img_rgba)
        img_rgb = bg.convert("RGB")

        out = BytesIO()
        img_rgb.save(out, format="JPEG", quality=82, optimize=True)
        jpg = out.getvalue()
        if not jpg:
            return None
        return jpg, img_rgb.width, img_rgb.height
    except Exception:
        return None


def _simple_pdf_from_lines(
    lines: list[str],
    *,
    logo_jpeg: bytes | None = None,
    logo_px: tuple[int, int] | None = None,
) -> bytes:
    safe_lines = [
        (_pdf_sanitize_text(line) or "-")[:160] for line in (lines or [])
    ]
    if not safe_lines:
        safe_lines = ["-"]

    content_lines: list[str] = []
    if logo_jpeg and logo_px and logo_px[0] > 0 and logo_px[1] > 0:
        px_w, px_h = logo_px
        max_w = 130.0
        max_h = 64.0
        ratio = float(px_h) / float(px_w)
        draw_w = max_w
        draw_h = draw_w * ratio
        if draw_h > max_h:
            draw_h = max_h
            draw_w = draw_h / ratio if ratio else max_w
        x = 595.0 - 50.0 - draw_w
        y = 842.0 - 50.0 - draw_h
        content_lines.extend(
            [
                "q",
                f"{draw_w:.2f} 0 0 {draw_h:.2f} {x:.2f} {y:.2f} cm",
                "/Im1 Do",
                "Q",
            ]
        )

    content_lines.extend(["BT", "/F1 12 Tf", "50 800 Td"])
    for i, line in enumerate(safe_lines[:45]):
        if i == 0:
            content_lines.append(f"({line}) Tj")
        else:
            content_lines.append("0 -16 Td")
            content_lines.append(f"({line}) Tj")
    content_lines.append("ET")
    content = "\n".join(content_lines).encode("ascii", "ignore")

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    if logo_jpeg and logo_px and logo_px[0] > 0 and logo_px[1] > 0:
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>"
        )
    else:
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        )

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content))

    if logo_jpeg and logo_px and logo_px[0] > 0 and logo_px[1] > 0:
        px_w, px_h = logo_px
        img_obj = (
            f"<< /Type /XObject /Subtype /Image /Width {int(px_w)} /Height {int(px_h)} "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(logo_jpeg)} >>\nstream\n"
        ).encode("ascii")
        img_obj += logo_jpeg + b"\nendstream"
        objects.append(img_obj)

    parts: list[bytes] = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(sum(len(p) for p in parts))
        parts.append(f"{i} 0 obj\n".encode("ascii"))
        parts.append(obj)
        parts.append(b"\nendobj\n")

    xref_start = sum(len(p) for p in parts)
    xref_lines = ["xref", f"0 {len(objects)+1}", "0000000000 65535 f "]
    for off in offsets[1:]:
        xref_lines.append(f"{off:010d} 00000 n ")
    parts.append(("\n".join(xref_lines) + "\n").encode("ascii"))
    parts.append(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode("ascii"))
    return b"".join(parts)


def _rfq_extract_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    items = data.get("items")
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        out.append(it)
    return out[:200]


def _rfq_totals(data: dict[str, Any]) -> tuple[float, float, float, float]:
    items = _rfq_extract_items(data)
    subtotal = 0.0
    for it in items:
        try:
            qty = float(it.get("qty") or 0)
        except Exception:
            qty = 0.0
        try:
            unit_price = float(it.get("unitPrice") or 0)
        except Exception:
            unit_price = 0.0
        subtotal += qty * unit_price
    try:
        discount_rate = float(data.get("discountRate") or 0)
    except Exception:
        discount_rate = 0.0
    try:
        tax_rate = float(data.get("taxRate") or 0)
    except Exception:
        tax_rate = 0.0
    discount = subtotal * discount_rate
    after_discount = subtotal - discount
    tax = after_discount * tax_rate
    total = after_discount + tax
    return subtotal, discount, tax, total


@require_POST
def admin_rfq_document_pdf(request: HttpRequest, doc_id: int) -> HttpResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return JsonResponse({"error": "not_found"}, status=404)
    site = _get_site(request)
    company = CompanySettings.for_site(site) if site else None
    payload = d.data if isinstance(d.data, dict) else {}
    items = _rfq_extract_items(payload)
    subtotal, discount, tax, total = _rfq_totals(payload)

    vendor = payload.get("vendor")
    vendor_name = vendor.get("name") if isinstance(vendor, dict) else ""
    rfq = payload.get("rfq")
    subject = rfq.get("subject") if isinstance(rfq, dict) else ""
    due_date = rfq.get("dueDate") if isinstance(rfq, dict) else ""

    company_name = getattr(company, "name", "") if company else ""
    company_email = getattr(company, "email", "") if company else ""
    company_phone = getattr(company, "phone_1", "") if company else ""
    company_address = getattr(company, "address", "") if company else ""

    lines: list[str] = []
    lines.append(company_name or "Company")
    if company_phone or company_email:
        lines.append(f"Phone: {company_phone} | Email: {company_email}")
    if company_address:
        lines.append(f"Address: {company_address}")
    lines.append("")
    lines.append(f"RFQ: {d.number or d.id}")
    if d.title:
        lines.append(f"Title: {d.title}")
    if subject:
        lines.append(f"Subject: {subject}")
    if due_date:
        lines.append(f"Due: {due_date}")
    if vendor_name:
        lines.append(f"Vendor: {vendor_name}")
    if d.currency:
        lines.append(f"Currency: {d.currency}")
    lines.append("")
    lines.append("Items:")
    for idx, it in enumerate(items[:25], start=1):
        desc = str(it.get("description") or "")
        unit = str(it.get("unit") or "")
        qty = it.get("qty") or 0
        unit_price = it.get("unitPrice") or 0
        lines.append(f"{idx}. {desc} | qty={qty} {unit} | unit_price={unit_price}")
    if len(items) > 25:
        lines.append(f"... ({len(items) - 25} more)")
    lines.append("")
    lines.append(f"Subtotal: {subtotal:.2f} {d.currency}")
    lines.append(f"Discount: {discount:.2f} {d.currency}")
    lines.append(f"Tax: {tax:.2f} {d.currency}")
    lines.append(f"Total: {total:.2f} {d.currency}")

    logo = _company_logo_as_jpeg(company)
    if logo:
        logo_jpeg, logo_w, logo_h = logo
        pdf_bytes = _simple_pdf_from_lines(lines, logo_jpeg=logo_jpeg, logo_px=(logo_w, logo_h))
    else:
        pdf_bytes = _simple_pdf_from_lines(lines)
    filename = _pdf_sanitize_text(d.number or f"rfq-{d.id}") or f"rfq-{d.id}"
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return resp


def _image_url(request: HttpRequest, image: Any | None) -> str:
    if not image or not getattr(image, "file", None):
        return ""
    return _abs_url(request, image.file.url)


def admin_projects(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _projects_index(request)
    if not idx:
        return JsonResponse({"items": []})
    pages = Page.objects.child_of(idx).type(ProjectPage).specific()
    items: list[dict[str, Any]] = []
    for p in pages:
        cover = getattr(p, "cover_image", None)
        cover_url = _image_url(request, cover)
        if not cover_url:
            first = p.gallery_images.first()
            cover_url = _image_url(request, first.image if first else None)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(getattr(p, "first_published_at", "") or ""),
                "coverUrl": cover_url,
                "shortDescription": getattr(p, "short_description", "") or "",
                "clientName": getattr(p, "client_name", "") or "",
                "projectLocation": getattr(p, "project_location", "") or "",
                "completionYear": getattr(p, "completion_year", None),
            }
        )
    return JsonResponse({"items": items})


def admin_project_detail(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    gallery = []
    for gi in page.gallery_images.all():
        gallery.append(
            {
                "id": gi.id,
                "imageId": getattr(gi.image, "id", None),
                "url": _image_url(request, gi.image),
                "caption": gi.caption,
                "sortOrder": gi.sort_order,
            }
        )
    return JsonResponse(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "shortDescription": page.short_description,
            "clientName": page.client_name,
            "projectLocation": page.project_location,
            "completionYear": page.completion_year,
            "executingAgency": page.executing_agency,
            "projectOwner": page.project_owner,
            "funder": page.funder,
            "supervisor": page.supervisor,
            "companyRole": page.company_role,
            "scopeOfWork": page.scope_of_work,
            "gallery": gallery,
        }
    )


@require_POST
def admin_project_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    idx = _projects_index(request)
    if not idx:
        return JsonResponse({"error": "projects_index_missing"}, status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "مشروع"
    base_slug = slugify(str(data.get("slug") or title)) or "project"
    completion_year: int | None = None
    cy = data.get("completionYear")
    if cy not in {None, ""}:
        try:
            completion_year = int(str(cy))
        except Exception:
            return JsonResponse({"error": "invalid_completion_year"}, status=400)
    page = ProjectPage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        short_description=str(data.get("shortDescription") or ""),
        client_name=str(data.get("clientName") or ""),
        project_location=str(data.get("projectLocation") or ""),
        completion_year=completion_year,
        executing_agency=str(data.get("executingAgency") or ""),
        project_owner=str(data.get("projectOwner") or ""),
        funder=str(data.get("funder") or ""),
        supervisor=str(data.get("supervisor") or ""),
        company_role=str(data.get("companyRole") or ""),
        scope_of_work=str(data.get("scopeOfWork") or ""),
    )
    idx.add_child(instance=page)
    page.save_revision().publish()
    return JsonResponse({"ok": True, "id": page.id})


@require_POST
def admin_project_update(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    for key, attr in [
        ("title", "title"),
        ("shortDescription", "short_description"),
        ("clientName", "client_name"),
        ("projectLocation", "project_location"),
        ("executingAgency", "executing_agency"),
        ("projectOwner", "project_owner"),
        ("funder", "funder"),
        ("supervisor", "supervisor"),
        ("companyRole", "company_role"),
        ("scopeOfWork", "scope_of_work"),
    ]:
        if data.get(key) is None:
            continue
        setattr(page, attr, str(data.get(key) or ""))
    if data.get("completionYear") is not None:
        val = data.get("completionYear")
        if val in {"", None}:
            page.completion_year = None
        else:
            try:
                page.completion_year = int(str(val))
            except Exception:
                return JsonResponse({"error": "invalid_completion_year"}, status=400)
    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)
    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse({"ok": True})


@require_POST
def admin_project_publish(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.save_revision().publish()
    return JsonResponse({"ok": True})


@require_POST
def admin_project_unpublish(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return JsonResponse({"ok": True})


@require_POST
def admin_project_delete(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    page.delete()
    return JsonResponse({"ok": True})


@require_POST
def admin_project_gallery_add(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    data = _read_json(request)
    image_id = data.get("imageId")
    caption = str(data.get("caption") or "")
    if not image_id:
        return JsonResponse({"error": "missing_image"}, status=400)
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=int(image_id)).first()
    except Exception:
        img = None
    if not img:
        return JsonResponse({"error": "invalid_image"}, status=400)
    item = ProjectGalleryImage.objects.create(page=page, image=img, caption=caption)
    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse(
        {"ok": True, "id": item.id, "url": _image_url(request, img), "imageId": img.id}
    )


@require_POST
def admin_project_gallery_remove(request: HttpRequest, project_id: int, item_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return JsonResponse({"error": "not_found"}, status=404)
    ProjectGalleryImage.objects.filter(pk=item_id, page=page).delete()
    page.save_revision().publish() if page.live else page.save_revision().save()
    return JsonResponse({"ok": True})


@require_POST
def admin_image_upload(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "missing_file"}, status=400)
    title = str(request.POST.get("title") or getattr(f, "name", "") or "image")
    try:
        from wagtail.images import get_image_model
        from wagtail.models import Collection

        ImageModel = get_image_model()
        root_collection = Collection.get_first_root_node()
        img = ImageModel(title=title, file=f, collection=root_collection)
        img.save()
        return JsonResponse(
            {"ok": True, "id": img.id, "url": _image_url(request, img), "title": img.title}
        )
    except Exception:
        return JsonResponse({"error": "upload_failed"}, status=400)


def admin_media_images(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    q = str(request.GET.get("q") or "").strip()
    limit_raw = request.GET.get("limit")
    offset_raw = request.GET.get("offset")
    try:
        limit = max(1, min(200, int(str(limit_raw or "50"))))
    except Exception:
        limit = 50
    try:
        offset = max(0, int(str(offset_raw or "0")))
    except Exception:
        offset = 0

    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
    except Exception:
        return JsonResponse({"error": "images_unavailable"}, status=400)

    qs = ImageModel.objects.all().order_by("-id")
    if q:
        qs = qs.filter(title__icontains=q)

    total = qs.count()
    items: list[dict[str, Any]] = []
    for img in qs[offset : offset + limit]:
        items.append(
            {
                "id": img.id,
                "title": str(getattr(img, "title", "") or ""),
                "url": _image_url(request, img),
                "width": int(getattr(img, "width", 0) or 0),
                "height": int(getattr(img, "height", 0) or 0),
                "createdAt": str(getattr(img, "created_at", "") or ""),
            }
        )
    return JsonResponse({"items": items, "total": total, "limit": limit, "offset": offset})


@require_POST
def admin_media_images_delete(request: HttpRequest, image_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=image_id).first()
    except Exception:
        img = None
    if not img:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        img.delete()
    except Exception:
        return JsonResponse({"error": "delete_failed"}, status=400)
    return JsonResponse({"ok": True})


def admin_media_documents(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    q = str(request.GET.get("q") or "").strip()
    limit_raw = request.GET.get("limit")
    offset_raw = request.GET.get("offset")
    try:
        limit = max(1, min(200, int(str(limit_raw or "50"))))
    except Exception:
        limit = 50
    try:
        offset = max(0, int(str(offset_raw or "0")))
    except Exception:
        offset = 0

    try:
        from wagtail.documents import get_document_model

        DocumentModel = get_document_model()
    except Exception:
        return JsonResponse({"error": "documents_unavailable"}, status=400)

    qs = DocumentModel.objects.all().order_by("-id")
    if q:
        qs = qs.filter(title__icontains=q)

    total = qs.count()
    items: list[dict[str, Any]] = []
    for d in qs[offset : offset + limit]:
        url = ""
        try:
            f = getattr(d, "file", None)
            url = _abs_url(request, f.url) if f and getattr(f, "url", None) else ""
        except Exception:
            url = ""
        items.append(
            {
                "id": d.id,
                "title": str(getattr(d, "title", "") or ""),
                "url": url,
                "fileSize": int(getattr(getattr(d, "file", None), "size", 0) or 0),
                "createdAt": str(getattr(d, "created_at", "") or ""),
            }
        )
    return JsonResponse({"items": items, "total": total, "limit": limit, "offset": offset})


@require_POST
def admin_media_documents_upload(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "missing_file"}, status=400)
    title = str(request.POST.get("title") or getattr(f, "name", "") or "document")
    try:
        from wagtail.documents import get_document_model
        from wagtail.models import Collection

        DocumentModel = get_document_model()
        root_collection = Collection.get_first_root_node()
        doc = DocumentModel(title=title, file=f, collection=root_collection)
        doc.save()
        url = ""
        try:
            url = _abs_url(request, doc.file.url) if getattr(doc, "file", None) else ""
        except Exception:
            url = ""
        return JsonResponse({"ok": True, "id": doc.id, "url": url, "title": doc.title})
    except Exception:
        return JsonResponse({"error": "upload_failed"}, status=400)


@require_POST
def admin_media_documents_delete(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    try:
        from wagtail.documents import get_document_model

        DocumentModel = get_document_model()
        doc = DocumentModel.objects.filter(pk=doc_id).first()
    except Exception:
        doc = None
    if not doc:
        return JsonResponse({"error": "not_found"}, status=404)
    try:
        doc.delete()
    except Exception:
        return JsonResponse({"error": "delete_failed"}, status=400)
    return JsonResponse({"ok": True})


@require_POST
def admin_backup_export(request: HttpRequest) -> HttpResponse | JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden

    out = StringIO()
    try:
        call_command(
            "dumpdata",
            "website",
            "wagtailcore",
            "wagtailimages",
            "wagtaildocs",
            "coderedcms",
            "taggit",
            "auth",
            indent=2,
            stdout=out,
            exclude=["contenttypes", "admin.logentry", "sessions"],
        )
    except Exception:
        return JsonResponse({"error": "export_failed"}, status=400)

    payload = out.getvalue()
    ts = time.strftime("%Y%m%d-%H%M%S")
    resp = HttpResponse(payload, content_type="application/json; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="backup-{ts}.json"'
    return resp


@require_POST
def admin_backup_import(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "missing_file"}, status=400)

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
            tmp.write(f.read())
            tmp_path = tmp.name
    except Exception:
        return JsonResponse({"error": "invalid_file"}, status=400)

    try:
        with transaction.atomic():
            call_command("loaddata", tmp_path, verbosity=0)
    except Exception:
        return JsonResponse({"error": "import_failed"}, status=400)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    return JsonResponse({"ok": True})


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(max(12, length)))


@require_POST
def admin_users(request: HttpRequest) -> JsonResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return JsonResponse({"error": "forbidden"}, status=403)
    if not getattr(user, "is_superuser", False):
        return JsonResponse({"error": "forbidden"}, status=403)

    data = _read_json(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "").strip()
    role = str(data.get("role") or "manager").strip()

    if not username:
        return JsonResponse({"error": "missing_username"}, status=400)

    User = get_user_model()
    obj, created = User.objects.get_or_create(username=username)
    obj.is_staff = True

    generated_password: str | None = None
    if not password:
        generated_password = _generate_password()
        password = generated_password

    if role == "superadmin":
        obj.is_superuser = True
        try:
            managers_group = Group.objects.filter(name="Managers").first()
            if managers_group:
                obj.groups.remove(managers_group)
        except Exception:
            pass
    else:
        obj.is_superuser = False
        managers_group, _ = Group.objects.get_or_create(name="Managers")
        obj.groups.add(managers_group)

    obj.set_password(password)
    obj.save()

    return JsonResponse(
        {
            "ok": True,
            "created": created,
            "generatedPassword": generated_password,
        }
    )


def _get_site(request: HttpRequest) -> Site | None:
    site = getattr(request, "site", None)
    if isinstance(site, Site):
        return site
    return Site.find_for_request(request)


def _get_ai_settings(request: HttpRequest) -> AISettings | None:
    site = _get_site(request)
    if not site:
        return None
    return AISettings.for_site(site)


def _get_calc_settings(request: HttpRequest) -> CalculatorSettings | None:
    site = _get_site(request)
    if not site:
        return None
    return CalculatorSettings.for_site(site)


def _abs_url(request: HttpRequest, url: str) -> str:
    if not url:
        return ""
    try:
        if url.startswith("http://") or url.startswith("https://"):
            return url
        return request.build_absolute_uri(url)
    except Exception:
        return url


def _fmt_ils(value: float) -> str:
    rounded = int(round(value))
    return f"{rounded:,} ₪".replace(",", "،")


def _gemini_generate_text(prompt: str, *, ai_settings: AISettings | None) -> str | None:
    if ai_settings and not ai_settings.gemini_enabled:
        return None

    key_env = ai_settings.gemini_api_key_env_var if ai_settings else "GEMINI_API_KEY"
    api_key = os.environ.get(key_env) or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    import urllib.request

    model = ai_settings.gemini_model if ai_settings else "gemini-1.5-flash"
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + model
        + ":generateContent?key="
        + api_key
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": ai_settings.temperature if ai_settings else 0.7,
            "maxOutputTokens": ai_settings.max_output_tokens if ai_settings else 1024,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
        data = json.loads(body)
        candidates = data.get("candidates") or []
        if not candidates:
            return None
        content = candidates[0].get("content") or {}
        parts = content.get("parts") or []
        texts = [
            str(p.get("text"))
            for p in parts
            if isinstance(p, dict) and p.get("text") is not None
        ]
        return "\n".join(texts).strip() or None
    except Exception:
        return None


def _design_analysis_fallback(project_type: str, area_m2: float, description: str) -> dict[str, Any]:
    base_rate = 1550.0
    if "فيلا" in project_type:
        base_rate = 1850.0
    elif "تجاري" in project_type:
        base_rate = 2050.0
    elif "مستودع" in project_type:
        base_rate = 1200.0

    complexity = 1.0
    for kw in ["3D", "تكييف", "مصعد", "واجهة حجر", "زجاج", "طابقين", "ثلاثة طوابق"]:
        if kw in description:
            complexity += 0.05
    estimated = area_m2 * base_rate * complexity

    duration_months = max(4, int(round(area_m2 / 120.0)))
    if "تجاري" in project_type:
        duration_months += 1

    materials = [
        "خرسانة جاهزة + إضافات عزل حسب الحاجة",
        "حديد تسليح مطابق للمواصفات",
        "بلوك/طوب معزول",
        "عزل مائي للأسطح والحمامات",
        "تشطيبات (دهان، بلاط، أبواب ونوافذ)",
    ]
    tips = [
        "اعتماد مخطط معماري وإنشائي قبل التسعير النهائي",
        "عمل دراسة تربة للموقع لتحديد الأساسات",
        "تحديد مستوى التشطيب المطلوب (اقتصادي/متوسط/فاخر)",
        "تجهيز مخطط كهرباء وسباكة لتقليل التعديلات أثناء التنفيذ",
    ]

    return {
        "design": f"تصميم {project_type} بمساحة تقريبية {int(area_m2)}م² مع توزيع عملي للفراغات وواجهة متوازنة حسب المتطلبات.",
        "materials": materials,
        "estimatedCost": _fmt_ils(estimated),
        "duration": f"{duration_months}–{duration_months + 2} أشهر",
        "tips": tips,
    }


@csrf_exempt
@require_POST
def analyze_design(request: HttpRequest) -> JsonResponse:
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    area_raw = str(data.get("area") or "").strip()
    description = str(data.get("description") or "").strip()

    try:
        area_m2 = float(area_raw)
    except Exception:
        area_m2 = 0.0

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
                return JsonResponse(parsed)
        except Exception:
            pass

    return JsonResponse(_design_analysis_fallback(project_type, area_m2, description))


def _generate_content_fallback(kind: str, topic: str, company_name: str) -> str:
    if kind == "social":
        lines = [
            f"هل تفكر في {topic}؟",
            f"{company_name} جاهزون لنساعدك بخبرة فلسطينية ومعايير جودة عالية.",
            "احجز استشارة مجانية اليوم.",
            "",
            "#مقاولات #بناء #فلسطين #سمرقند #هندسة #تشطيبات",
        ]
        return "\n".join(lines)

    return "\n".join(
        [
            f"مقدمة: {topic}",
            "",
            "يعد اختيار الحلول المناسبة في مشاريع البناء خطوة أساسية لتقليل التكلفة ورفع الجودة.",
            "في هذا المقال نوضح أهم النقاط العملية التي يجب الانتباه لها، وكيفية اتخاذ قرار مبني على معطيات واضحة.",
            "",
            "1) تحديد الاحتياج الفعلي",
            "ابدأ بتحديد المتطلبات: المساحة، عدد الطوابق، مستوى التشطيب، والميزانية.",
            "",
            "2) الدراسة الهندسية",
            "وجود مخطط معماري وإنشائي يقلل الأخطاء ويمنع التعديل المكلف أثناء التنفيذ.",
            "",
            "3) إدارة التكاليف",
            "اعتماد جدول كميات وأسعار واضح يساعدك في مقارنة العروض وتجنب المفاجآت.",
            "",
            f"خاتمة: إذا أردت استشارة دقيقة حول {topic}، تواصل مع {company_name} وسنساعدك بخطوات واضحة.",
        ]
    )


@csrf_exempt
@require_POST
def generate_content(request: HttpRequest) -> JsonResponse:
    if not _can_use_restricted_tools(request):
        return JsonResponse({"error": "forbidden"}, status=403)
    data = _read_json(request)
    kind = str(data.get("type") or "blog").strip()
    topic = str(data.get("topic") or "").strip()

    ai_settings = _get_ai_settings(request)
    site = _get_site(request)
    company_name = CompanySettings.for_site(site).name if site else "شركة سمر قند للمقاولات"

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

    return JsonResponse({"content": text})


def _calculator_response(
    project_type: str,
    area: float,
    floors: int,
    settings_obj: CalculatorSettings | None,
    *,
    currency: str,
) -> dict[str, Any]:
    floors = max(1, int(floors))
    area_per_floor = max(0.0, float(area))
    area_total = area_per_floor * floors

    s = settings_obj
    items = s.items if s and isinstance(s.items, list) and len(s.items) else _default_calculator_items(s)

    usd_to_ils = float(s.usd_to_ils_rate) if s else 3.65
    if usd_to_ils <= 0:
        usd_to_ils = 3.65

    currency = (currency or (s.currency_default if s else "ILS")).strip().upper()
    if currency not in {"ILS", "USD"}:
        currency = "ILS"

    labor_percent = float(s.labor_percent) if s else 0.28
    overhead_percent = float(s.overhead_percent) if s else 0.1
    profit_percent = float(s.profit_percent) if s else 0.1
    contingency_percent = float(s.contingency_percent) if s else 0.05
    include_vat = bool(s.include_vat) if s else False
    vat_percent = float(s.vat_percent) if s else 0.16

    def _to_currency(amount_ils: float) -> float:
        if currency == "USD":
            return amount_ils / usd_to_ils
        return amount_ils

    def _round_qty(unit: str, qty: float) -> float:
        u = (unit or "").strip()
        if u in {"كغم", "حبة", "باب"}:
            return float(round(qty, 0))
        if u in {"م³"}:
            return float(round(qty, 2))
        return float(round(qty, 1))

    sections_map: dict[str, dict[str, Any]] = {}
    for it in items:
        if not isinstance(it, dict):
            continue
        if it.get("enabled") is False:
            continue
        key = str(it.get("key") or "").strip()
        if not key:
            continue
        label = str(it.get("label") or key).strip()
        category = str(it.get("category") or "أخرى").strip()
        unit = str(it.get("unit") or "م²").strip()
        basis = str(it.get("basis") or "area_total").strip()
        try:
            factor = float(it.get("factor") or 0.0)
            unit_price_ils = float(it.get("unitPriceIls") or 0.0)
        except Exception:
            continue

        basis_val = area_total if basis == "area_total" else area_per_floor
        qty = _round_qty(unit, basis_val * factor)
        unit_price = _to_currency(unit_price_ils)
        total = float(round(qty * unit_price, 2))

        sec = sections_map.get(category)
        if not sec:
            sec = {"label": category, "items": []}
            sections_map[category] = sec
        sec["items"].append(
            {
                "key": key,
                "item": label,
                "quantity": qty,
                "unit": unit,
                "unitPrice": float(round(unit_price, 2)),
                "total": total,
                "basis": basis,
                "factor": factor,
            }
        )

    ordered_categories = [
        "الأعمال التمهيدية",
        "أعمال الحفر والردم",
        "أعمال الخرسانة",
        "أعمال النجارة/الشدات",
        "أعمال الحدادة",
        "أعمال المباني",
        "أعمال اللياسة والقصارة",
        "أعمال العزل",
        "أعمال التشطيبات",
        "الأبواب والشبابيك",
        "أعمال الكهرباء",
        "أعمال السباكة والصحي",
        "أعمال التكييف والتهوية",
        "أعمال خارجية",
        "أعمال الترميم",
        "أخرى",
    ]
    sections = []
    for c in ordered_categories:
        if c in sections_map:
            sections.append(sections_map[c])
    for c, sec in sections_map.items():
        if c not in ordered_categories:
            sections.append(sec)

    all_items: list[dict[str, Any]] = []
    for sec in sections:
        all_items.extend(sec.get("items") or [])

    materials_cost = float(round(sum((float(it.get("total") or 0.0) for it in all_items), 0.0), 2))
    labor_cost = float(round(materials_cost * labor_percent, 2))
    subtotal_before_overheads = float(round(materials_cost + labor_cost, 2))
    overhead_cost = float(round(subtotal_before_overheads * overhead_percent, 2))
    contingency_cost = float(round(subtotal_before_overheads * contingency_percent, 2))
    profit_base = float(round(subtotal_before_overheads + overhead_cost + contingency_cost, 2))
    profit_cost = float(round(profit_base * profit_percent, 2))
    vat_base = float(round(profit_base + profit_cost, 2))
    vat_cost = float(round(vat_base * vat_percent, 2)) if include_vat else 0.0
    total_cost = float(round(vat_base + vat_cost, 2))

    structural_categories = {
        "الأعمال التمهيدية",
        "أعمال الحفر والردم",
        "أعمال الخرسانة",
        "أعمال النجارة/الشدات",
        "أعمال الحدادة",
        "أعمال المباني",
        "أعمال اللياسة والقصارة",
        "أعمال العزل",
    }
    finishes_categories = {"أعمال التشطيبات", "الأبواب والشبابيك"}
    structural = []
    finishes = []
    other = []
    for sec in sections:
        cat = str(sec.get("label") or "").strip()
        for it in sec.get("items") or []:
            if cat in structural_categories:
                structural.append(it)
            elif cat in finishes_categories:
                finishes.append(it)
            else:
                other.append(it)

    notes = [
        "الحسابات تقديرية وتعتمد على المساحة/الطوابق ومعاملات قابلة للتعديل.",
        "الأسعار مبنية على تقدير للسوق الفلسطيني ويمكن تعديلها من إعدادات الحاسبة.",
        "لنتائج دقيقة: يلزم مخططات معمارية وإنشائية وجدول كميات معتمد.",
    ]
    if "مستودع" in project_type:
        notes.append("مشاريع المستودعات قد تتطلب حلول هيكلية مختلفة حسب الاستخدام.")
    if currency == "USD":
        notes.append(f"تم التحويل إلى USD حسب سعر صرف: 1$ = {usd_to_ils} ₪")

    return {
        "boq": {
            "currency": currency,
            "usdToIlsRate": usd_to_ils,
            "areaPerFloor": area_per_floor,
            "floors": floors,
            "areaTotal": area_total,
            "sections": sections,
        },
        "quantities": {
            "structural": structural,
            "finishes": finishes,
            "other": other,
        },
        "summary": {
            "materialsCost": materials_cost,
            "laborCost": labor_cost,
            "overheadCost": overhead_cost,
            "contingencyCost": contingency_cost,
            "profitCost": profit_cost,
            "vatCost": vat_cost,
            "totalCost": total_cost,
            "currency": currency,
        },
        "notes": notes,
    }


@csrf_exempt
@require_POST
def calculate(request: HttpRequest) -> JsonResponse:
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    area = float(data.get("area") or 0.0)
    floors = int(data.get("floors") or 1)
    currency = str(data.get("currency") or "").strip().upper()
    settings_obj = _get_calc_settings(request)
    return JsonResponse(
        _calculator_response(project_type, area, floors, settings_obj, currency=currency)
    )


def _parse_aspect_ratio(value: str) -> tuple[int, int]:
    if value == "1:1":
        return (1024, 1024)
    if value == "9:16":
        return (768, 1366)
    if value == "4:3":
        return (1024, 768)
    return (1366, 768)


def _hex_to_rgb(value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    v = (value or "").strip().lstrip("#")
    if len(v) != 6:
        return fallback
    try:
        r = int(v[0:2], 16)
        g = int(v[2:4], 16)
        b = int(v[4:6], 16)
        return (r, g, b)
    except Exception:
        return fallback


def _create_placeholder_visual(
    project_type: str,
    style: str,
    aspect_ratio: str,
    *,
    ai_settings: AISettings | None,
) -> bytes:
    w, h = _parse_aspect_ratio(aspect_ratio)
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    c1 = _hex_to_rgb(
        ai_settings.visualizer_placeholder_primary_hex if ai_settings else "",
        (74, 144, 226),
    )
    c2 = _hex_to_rgb(
        ai_settings.visualizer_placeholder_secondary_hex if ai_settings else "",
        (93, 173, 226),
    )
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(c1[0] * (1 - t) + c2[0] * t)
        g = int(c1[1] * (1 - t) + c2[1] * t)
        b = int(c1[2] * (1 - t) + c2[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(18):
        x0 = random.randint(0, w - 1)
        y0 = random.randint(0, h - 1)
        x1 = x0 + random.randint(120, 420)
        y1 = y0 + random.randint(120, 420)
        od.ellipse([x0, y0, x1, y1], fill=(255, 255, 255, 20))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    font = ImageFont.load_default()
    footer = (
        ai_settings.visualizer_placeholder_footer_text
        if ai_settings
        else "تصور تجريبي • سمر قند"
    )
    title = f"{project_type} • {style} • {footer}"
    pad = 24
    box_h = 90
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, h - box_h, w, h], fill=(0, 0, 0))
    draw.text((pad, h - box_h + 28), title, fill=(255, 255, 255), font=font)

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@csrf_exempt
@require_POST
def generate_visualization(request: HttpRequest) -> JsonResponse:
    if not _can_use_restricted_tools(request):
        return JsonResponse({"error": "forbidden"}, status=403)
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    description = str(data.get("description") or "").strip()
    style = str(data.get("style") or "").strip()
    aspect_ratio = str(data.get("aspectRatio") or "").strip()

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
            ai_settings.visualizer_default_aspect_ratio if ai_settings else "16:9"
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
    return JsonResponse({"success": True, "image": encoded, "mimeType": "image/png"})


def _chat_reply(message: str) -> str:
    msg = message.strip()
    if not msg:
        return "كيف يمكنني مساعدتك؟"
    if "خدمات" in msg:
        return "نقدم المقاولات العامة، الاستشارات الهندسية، التصاميم المعمارية، التشطيبات، وأعمال الترميم. أخبرني نوع مشروعك والمساحة."
    if "تكلفة" in msg or "سعر" in msg:
        return "التكلفة تعتمد على المساحة وعدد الطوابق ومستوى التشطيب. استخدم حاسبة الكميات والتكاليف في صفحة الأدوات، أو أعطني المساحة والطوابق لأعطيك تقديراً أولياً."
    if "مدة" in msg or "كم يستغرق" in msg:
        return "مدة التنفيذ تعتمد على نوع المشروع وحجمه. بشكل عام، منزل 200م² قد يستغرق 6–8 أشهر بحسب المخططات والتوريد."
    if "استشارة" in msg:
        return "نعم، نقدم استشارة أولية مجانية. أرسل تفاصيل مشروعك وموقعه وسنتواصل معك."
    return "وصلتني رسالتك. اكتب نوع المشروع والمساحة وعدد الطوابق ومستوى التشطيب وسأقترح خطة وتقديراً أولياً."


@csrf_exempt
@require_POST
def chat(request: HttpRequest) -> StreamingHttpResponse:
    data = _read_json(request)
    message = str(data.get("message") or "")

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
    text = _gemini_generate_text(prompt, ai_settings=ai_settings) or _chat_reply(message)

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


def site_company(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    company = CompanySettings.for_site(site)
    logo_url = ""
    if company.logo_image and getattr(company.logo_image, "file", None):
        logo_url = _abs_url(request, company.logo_image.file.url)
    return JsonResponse(
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


def site_config(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    v = SiteVisibilitySettings.for_site(site)
    return JsonResponse(
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
            }
        }
    )


def site_home(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return JsonResponse({"error": "site_not_found"}, status=400)
    home = HomePageSettings.for_site(site)
    bg_url = ""
    if home.hero_background_image and getattr(home.hero_background_image, "file", None):
        bg_url = _abs_url(request, home.hero_background_image.file.url)
    return JsonResponse(
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


def _site_root(request: HttpRequest) -> Page | None:
    site = _get_site(request)
    if not site:
        return None
    return site.root_page


def site_services(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return JsonResponse({"error": "site_not_found"}, status=400)
    services_index = root.get_children().live().filter(slug="services").first()
    if not services_index:
        return JsonResponse({"items": []})
    pages = (
        Page.objects.child_of(services_index).live().type(ServicePage).specific()
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
    return JsonResponse({"items": items})


def site_projects(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return JsonResponse({"error": "site_not_found"}, status=400)
    projects_index = root.get_children().live().filter(slug="projects").first()
    if not projects_index:
        return JsonResponse({"items": []})
    pages = (
        Page.objects.child_of(projects_index).live().type(ProjectPage).specific()
    )
    items: list[dict[str, Any]] = []
    for p in pages:
        cover_url = ""
        cover = getattr(p, "cover_image", None)
        if cover and getattr(cover, "file", None):
            cover_url = _abs_url(request, cover.file.url)
        if not cover_url:
            first = p.gallery_images.first()
            image = first.image if first else None
            if image and getattr(image, "file", None):
                cover_url = _abs_url(request, image.file.url)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "url": p.url,
                "category": getattr(p, "client_name", "") or "",
                "description": getattr(p, "short_description", "") or "",
                "location": getattr(p, "project_location", "") or "",
                "year": str(getattr(p, "completion_year", "") or ""),
                "imageUrl": cover_url,
            }
        )
    return JsonResponse({"items": items})


def site_team(request: HttpRequest) -> JsonResponse:
    items: list[dict[str, Any]] = []
    for m in TeamMember.objects.all():
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
    return JsonResponse({"items": items})


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
    return JsonResponse({"items": items})


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
    return JsonResponse(
        {
            "trustBadges": badges,
            "stats": stats,
            "timelineSteps": steps,
            "aiFeatures": ai_features,
            "aiMetrics": ai_metrics,
        }
    )
