"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import json
import logging
import os
import random
import secrets
import string
import time
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.http import HttpRequest
from django.http import JsonResponse
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
from website.models import ConstructionCalculatorPage
from website.models import ContactPage
from website.models import LocationIndexPage
from website.models import LocationPage
from website.models import OpsAuditLog
from website.models import OpsPermissionRule
from website.models import ProjectIndexPage
from website.models import ProjectPage
from website.models import QuoteRequestPage
from website.models import ServiceIndexPage
from website.models import ServicePage
from website.models import SiteVisibilitySettings
from website.models import ToolsIndexPage
from website.models import WebPage
from website.models import Worker
from website.models import WorkerAttendance

logger = logging.getLogger(__name__)


def _read_json(request: HttpRequest) -> dict[str, Any]:
    try:
        raw = request.body.decode("utf-8") if request.body else "{}"
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _api_ok(
    payload: dict[str, Any] | None = None, *, status: int = 200
) -> JsonResponse:
    result: dict[str, Any] = payload or {}
    return JsonResponse(
        {"ok": True, "result": result, "data": result}, status=status
    )


def _api_error(
    code: str,
    *,
    status: int = 400,
    message: str | None = None,
    details: dict[str, Any] | None = None,
) -> JsonResponse:
    error_obj: dict[str, Any] = {"code": code}
    if message:
        error_obj["message"] = message
    if details:
        error_obj["details"] = details
    return JsonResponse(
        {"ok": False, "error": error_obj, "errorCode": code}, status=status
    )


def _client_ip(request: HttpRequest) -> str:
    """Return the client IP, honouring X-Forwarded-For only from trusted proxies."""
    remote = str(request.META.get("REMOTE_ADDR") or "").strip() or "unknown"
    trusted = set(getattr(settings, "TRUSTED_PROXY_IPS", None) or [])
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
    if trusted and remote in trusted and forwarded:
        return forwarded.split(",")[0].strip() or remote
    return remote


def _rate_limit_key(
    request: HttpRequest, *, scope: str, window_seconds: int
) -> str:
    user = getattr(request, "user", None)
    user_id = (
        getattr(user, "id", None)
        if user and getattr(user, "is_authenticated", False)
        else None
    )
    ident = f"u:{user_id}" if user_id else f"ip:{_client_ip(request)}"
    bucket = int(time.time() // max(1, int(window_seconds)))
    return f"rl:{scope}:{ident}:{bucket}"


def _check_rate_limit(
    request: HttpRequest,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
) -> JsonResponse | None:
    lim = max(1, int(limit))
    win = max(1, int(window_seconds))
    key = _rate_limit_key(request, scope=scope, window_seconds=win)
    try:
        added = cache.add(key, 1, timeout=win)
        if added:
            return None
        current = cache.incr(key)
        if int(current) <= lim:
            return None
    except Exception:
        # Fail closed: if the cache is unavailable we cannot enforce limits,
        # so reject the request instead of silently allowing unlimited calls.
        return _api_error(
            "rate_limit_unavailable",
            status=503,
            message="تعذّر التحقق من حد الطلبات. يرجى المحاولة لاحقاً.",
        )

    now = int(time.time())
    retry_after = win - (now % win)
    return _api_error(
        "rate_limited",
        status=429,
        message="تم تجاوز الحد المسموح من المحاولات. يرجى المحاولة لاحقاً.",
        details={"retryAfterSeconds": retry_after},
    )


def _fail(exc: Exception, code: str, log_message: str) -> JsonResponse:
    """Log the internal error and return a stable, opaque API error code."""
    logger.exception("%s: %s", log_message, exc)
    return _api_error(code, status=400)


def _safe_uploaded_filename(
    original_name: str, *, allowed_exts: set[str]
) -> str:
    suffix = Path(original_name or "").suffix.lower()
    ext = suffix if suffix in allowed_exts else ""
    token = secrets.token_urlsafe(12).replace("-", "").replace("_", "")
    return f"{token}{ext}" if ext else token


ROLE_GROUPS: dict[str, set[str]] = {
    "guest": {"Guests", "Guest", "ضيف"},
    "registered_guest": {
        "Registered Guests",
        "Registered Guest",
        "ضيف مسجل",
        "ضيف مُسجل",
    },
    "employee": {"Employees", "Employee", "موظف", "موظفين"},
    "registrar": {"Registrars", "Registrar", "مسجل", "المسجل"},
    "accountant": {"Accountants", "Accountant", "محاسب", "محاسبون", "الحسابات"},
    "manager": {
        "Managers",
        "Manager",
        "مدير",
        "مدراء",
        "المدراء",
        "مدراء الموقع",
        "مدير الموقع",
    },
}


def _user_group_names(user: Any) -> set[str]:
    try:
        raw = user.groups.values_list("name", flat=True) if user else []
        return {str(x) for x in raw if str(x).strip()}
    except Exception:
        return set()


def _user_in_any_group(user: Any, group_names: set[str]) -> bool:
    if not user:
        return False
    if not group_names:
        return False
    try:
        return bool(user.groups.filter(name__in=group_names).exists())
    except Exception:
        existing = _user_group_names(user)
        return any(name in existing for name in group_names)


def _user_role(user: Any) -> str:
    if not user or not getattr(user, "is_authenticated", False):
        return "anonymous"
    if getattr(user, "is_superuser", False):
        return "superadmin"
    if _user_in_any_group(user, ROLE_GROUPS["manager"]):
        return "manager"
    if _user_in_any_group(user, ROLE_GROUPS["accountant"]):
        return "accountant"
    if _user_in_any_group(user, ROLE_GROUPS["registrar"]):
        return "registrar"
    if _user_in_any_group(user, ROLE_GROUPS["employee"]):
        return "employee"
    if _user_in_any_group(user, ROLE_GROUPS["registered_guest"]):
        return "registered_guest"
    if _user_in_any_group(user, ROLE_GROUPS["guest"]):
        return "guest"
    return "staff"


def _ops_rule_allowed_roles(code: str) -> set[str] | None:
    key = f"ops_perm_rule:{code}"
    cached = cache.get(key)
    if isinstance(cached, list):
        return {str(x) for x in cached if str(x).strip()}
    if cached is False:
        return None
    rule = OpsPermissionRule.objects.filter(code=code).first()
    roles = None
    if rule and isinstance(rule.allowed_roles, list):
        roles = {str(x) for x in rule.allowed_roles if str(x).strip()}
    cache.set(key, list(roles) if roles is not None else False, 60)
    return roles


def _require_ops_rule(
    request: HttpRequest, code: str, *, default_allowed_roles: set[str]
) -> Any | None:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    if user and getattr(user, "is_superuser", False):
        return None
    override = _ops_rule_allowed_roles(code)
    allowed_roles = override if override is not None else default_allowed_roles
    role = _user_role(user)
    if role in allowed_roles:
        return None
    return _api_error("forbidden", status=403)


def _audit_ops(
    request: HttpRequest,
    *,
    action: str,
    entity_type: str = "",
    entity_id: str = "",
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    try:
        user = getattr(request, "user", None)
        actor = (
            user if user and getattr(user, "is_authenticated", False) else None
        )
        OpsAuditLog.objects.create(
            actor=actor,
            role=_user_role(user),
            action=str(action),
            entity_type=str(entity_type or ""),
            entity_id=str(entity_id or ""),
            before=before,
            after=after,
            meta=meta,
            ip=str(request.META.get("REMOTE_ADDR") or "").strip(),
            user_agent=str(request.META.get("HTTP_USER_AGENT") or "")[:255],
        )
    except Exception:
        return None


def _require_manager(request: HttpRequest) -> Any | None:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    if user and getattr(user, "is_superuser", False):
        return None
    if _user_in_any_group(user, ROLE_GROUPS["manager"]):
        return None
    return _api_error("forbidden", status=403)


def _require_ops_management(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_management",
        default_allowed_roles={
            "manager",
            "accountant",
            "registrar",
            "employee",
        },
    )


def _require_ops_crm_read(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_crm_read",
        default_allowed_roles={"manager", "accountant", "registrar"},
    )


def _require_ops_crm_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_crm_write",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_ops_contracts_read(request: HttpRequest) -> Any | None:
    return _require_accounting(request)


def _require_ops_contracts_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_contracts_write",
        default_allowed_roles={"manager", "accountant"},
    )


def _require_ops_procurement_read(request: HttpRequest) -> Any | None:
    return _require_accounting(request)


def _require_ops_procurement_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_procurement_write",
        default_allowed_roles={"manager", "accountant"},
    )


def _require_ops_workers_read(request: HttpRequest) -> Any | None:
    return _require_ops_management(request)


def _require_ops_workers_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_workers_write",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_ops_attendance_read(request: HttpRequest) -> Any | None:
    return _require_ops_management(request)


def _require_ops_attendance_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_attendance_write",
        default_allowed_roles={"manager", "registrar", "employee"},
    )


def _require_ops_timeclock_import(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_timeclock_import",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_ops_equipment_read(request: HttpRequest) -> Any | None:
    return _require_ops_management(request)


def _require_ops_equipment_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_equipment_write",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_ops_assignments_read(request: HttpRequest) -> Any | None:
    return _require_ops_management(request)


def _require_ops_assignments_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_assignments_write",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_accounting(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "accounting",
        default_allowed_roles={"manager", "accountant"},
    )


def _require_registration(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "registration",
        default_allowed_roles={"manager", "registrar"},
    )


def _require_rfq_management(request: HttpRequest) -> Any | None:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    if user and getattr(user, "is_superuser", False):
        return None
    if _user_in_any_group(user, ROLE_GROUPS["manager"]):
        return None
    if _user_in_any_group(user, ROLE_GROUPS["accountant"]):
        return None
    if _user_in_any_group(user, ROLE_GROUPS["registrar"]):
        return None
    return _require_projects_management(request)


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

    allowed = ROLE_GROUPS["manager"]
    return any(name in allowed for name in group_names)


def _require_restricted_tools(request: HttpRequest) -> Any | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_error("unauthorized", status=401)
    if not getattr(user, "is_staff", False):
        return _api_error("forbidden", status=403)
    if getattr(user, "is_superuser", False):
        return None

    try:
        group_names = set(user.groups.values_list("name", flat=True))
    except Exception:
        return _api_error("forbidden", status=403)

    allowed = ROLE_GROUPS["manager"]
    if any(name in allowed for name in group_names):
        return None
    return _api_error("forbidden", status=403)


def _require_staff(request: HttpRequest) -> Any | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_error("unauthorized", status=401)
    if not getattr(user, "is_staff", False):
        return _api_error("forbidden", status=403)
    return None


def _require_superuser(request: HttpRequest) -> Any | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_error("unauthorized", status=401)
    if not getattr(user, "is_superuser", False):
        return _api_error("forbidden", status=403)
    return None


def _require_projects_management(request: HttpRequest) -> Any | None:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if site:
        v = SiteVisibilitySettings.for_site(site)
        if not getattr(v, "show_control_projects_management", True):
            return _api_error("forbidden", status=403)
    user = getattr(request, "user", None)
    if user and getattr(user, "is_superuser", False):
        return None
    try:
        group_names = {
            "Project Managers",
            "PMO",
            "مدراء المشاريع",
            "مدير مشروع",
            "مدير المشاريع",
        } | ROLE_GROUPS["manager"]
        if user and user.groups.filter(name__in=group_names).exists():
            return None
    except Exception:
        pass
    return _api_error("forbidden", status=403)


def _default_calculator_items(
    settings_obj: CalculatorSettings | None,
) -> list[dict[str, Any]]:
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
    return (
        root.get_children()
        .filter(slug__in=["blog", "blogs", "articles", "news"])
        .first()
    )


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


def _streamfield_to_html(body: Any) -> str:
    """Serialise all textual StreamField blocks, not just the first HTML one."""
    try:
        data = getattr(body, "raw_data", None)
        if data is None:
            data = getattr(body, "stream_data", None)
    except Exception:
        data = None
    if not isinstance(data, list):
        return ""
    parts: list[str] = []
    for block in data:
        if not isinstance(block, dict):
            continue
        value = block.get("value")
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, dict) and isinstance(value.get("text"), str):
            parts.append(value["text"])
    return "\n".join(parts)


def _replace_streamfield_html(body: Any, new_html: str) -> list[dict[str, Any]]:
    """Update only HTML blocks, preserving every other StreamField block.

    The SPA editor sends a single HTML string. Replacing the whole body used
    to silently delete hero/row/cardgrid blocks and later HTML blocks.
    """
    try:
        data = getattr(body, "raw_data", None)
        if data is None:
            data = getattr(body, "stream_data", None)
    except Exception:
        data = None
    blocks: list[dict[str, Any]] = (
        [dict(block) for block in data if isinstance(block, dict)]
        if isinstance(data, list)
        else []
    )
    replaced = False
    for block in blocks:
        if block.get("type") == "html":
            if not replaced:
                block["value"] = new_html
                replaced = True
    if not replaced:
        blocks.insert(0, {"type": "html", "value": new_html})
    return blocks


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
        return str(
            getattr(cls._meta, "verbose_name", "")
            or getattr(cls, "__name__", "")
        )
    except Exception:
        return ""


def _rfq_number() -> str:
    ts = time.strftime("%Y%m%d")
    suffix = secrets.token_hex(2).upper()
    return f"RFQ-{ts}-{suffix}"


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


def _arabic_pdf_from_lines(
    lines: list[str],
    *,
    logo_jpeg: bytes | None = None,
    logo_px: tuple[int, int] | None = None,
) -> bytes:
    """Render UTF-8 (including Arabic/RTL) text into a real PDF."""
    import arabic_reshaper
    from bidi.algorithm import get_display
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    font_name = "NotoSansArabic"
    if font_name not in pdfmetrics.getRegisteredFontNames():
        font_path = (
            Path(__file__).resolve().parents[1]
            / "static"
            / "website"
            / "fonts"
            / "NotoSansArabic.ttf"
        )
        pdfmetrics.registerFont(TTFont(font_name, str(font_path)))

    buf = BytesIO()
    pdf = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4
    y = page_h - 50
    if logo_jpeg:
        try:
            pdf.drawImage(
                ImageReader(BytesIO(logo_jpeg)),
                page_w - 160,
                page_h - 90,
                width=110,
                height=50,
                mask="auto",
            )
            y -= 60
        except Exception:
            pass

    for raw in lines:
        text = str(raw or "")
        shaped = get_display(arabic_reshaper.reshape(text))
        if y < 50:
            pdf.showPage()
            pdf.setFont(font_name, 11)
            y = page_h - 50
        pdf.setFont(font_name, 11)
        pdf.drawRightString(page_w - 45, y, shaped)
        y -= 16
    pdf.save()
    return buf.getvalue()


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


def _image_url(request: HttpRequest, image: Any | None) -> str:
    if not image or not getattr(image, "file", None):
        return ""
    return _abs_url(request, image.file.url)


def _project_cover_url(request: HttpRequest, project: Any) -> str:
    cover = getattr(project, "cover_image", None)
    cover_url = _image_url(request, cover)
    if cover_url:
        return cover_url
    try:
        # Use the prefetched relation (already ordered by the caller). Calling
        # .order_by() here would discard the prefetch and issue one query per
        # project.
        for gi in project.gallery_images.all():
            img = getattr(gi, "image", None)
            url = _image_url(request, img)
            if url:
                return url
    except Exception:
        return ""
    return ""


def _image_rendition_url(
    request: HttpRequest, image: Any | None, spec: str
) -> str:
    if not image:
        return ""
    try:
        rendition = image.get_rendition(spec)
        return _abs_url(request, str(getattr(rendition, "url", "") or ""))
    except Exception:
        return ""


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(max(12, length)))


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


def _gemini_generate_text(
    prompt: str, *, ai_settings: AISettings | None
) -> str | None:
    if ai_settings and not ai_settings.gemini_enabled:
        return None

    key_env = (
        ai_settings.gemini_api_key_env_var if ai_settings else "GEMINI_API_KEY"
    )
    api_key = os.environ.get(key_env) or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    import urllib.request

    model = ai_settings.gemini_model if ai_settings else "gemini-1.5-flash"
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + model
        + ":generateContent"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": ai_settings.temperature if ai_settings else 0.7,
            "maxOutputTokens": (
                ai_settings.max_output_tokens if ai_settings else 1024
            ),
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        # Send the credential in a header so it never lands in URLs, proxy
        # logs or browser history.
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
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


def _design_analysis_fallback(
    project_type: str, area_m2: float, description: str
) -> dict[str, Any]:
    base_rate = 1550.0
    if "فيلا" in project_type:
        base_rate = 1850.0
    elif "تجاري" in project_type:
        base_rate = 2050.0
    elif "مستودع" in project_type:
        base_rate = 1200.0

    complexity = 1.0
    for kw in [
        "3D",
        "تكييف",
        "مصعد",
        "واجهة حجر",
        "زجاج",
        "طابقين",
        "ثلاثة طوابق",
    ]:
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
    items = (
        s.items
        if s and isinstance(s.items, list) and len(s.items)
        else _default_calculator_items(s)
    )

    usd_to_ils = float(s.usd_to_ils_rate) if s else 3.65
    if usd_to_ils <= 0:
        usd_to_ils = 3.65

    currency = (
        (currency or (s.currency_default if s else "ILS")).strip().upper()
    )
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

    materials_cost = float(
        round(sum((float(it.get("total") or 0.0) for it in all_items), 0.0), 2)
    )
    labor_cost = float(round(materials_cost * labor_percent, 2))
    subtotal_before_overheads = float(round(materials_cost + labor_cost, 2))
    overhead_cost = float(
        round(subtotal_before_overheads * overhead_percent, 2)
    )
    contingency_cost = float(
        round(subtotal_before_overheads * contingency_percent, 2)
    )
    profit_base = float(
        round(subtotal_before_overheads + overhead_cost + contingency_cost, 2)
    )
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
        notes.append(
            "مشاريع المستودعات قد تتطلب حلول هيكلية مختلفة حسب الاستخدام."
        )
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


def _parse_aspect_ratio(value: str) -> tuple[int, int]:
    if value == "1:1":
        return (1024, 1024)
    if value == "9:16":
        return (768, 1366)
    if value == "4:3":
        return (1024, 768)
    return (1366, 768)


def _hex_to_rgb(
    value: str, fallback: tuple[int, int, int]
) -> tuple[int, int, int]:
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


def _site_root(request: HttpRequest) -> Page | None:
    site = _get_site(request)
    if not site:
        return None
    return site.root_page


def _to_iso(val: Any) -> str:
    if not val:
        return ""
    try:
        return val.isoformat()
    except Exception:
        return str(val)


def _to_date(raw: Any) -> Any:
    if raw in {"", None}:
        return None
    from datetime import date

    val = str(raw).strip()
    if not val:
        return None
    return date.fromisoformat(val)


def _to_dec(raw: Any, *, allow_none: bool = True) -> Decimal | None:
    if raw in {"", None}:
        return None if allow_none else Decimal("0")
    try:
        return Decimal(str(raw))
    except Exception:
        return None if allow_none else Decimal("0")


def _process_timeclock_items(
    items: list[Any],
    *,
    dry_run: bool,
    default_project: Any,
) -> tuple[int, int, list[dict[str, Any]], list[dict[str, Any]]]:
    from datetime import datetime as _dt

    created_count = 0
    updated_count = 0
    errors: list[dict[str, Any]] = []
    item_results: list[dict[str, Any]] = []

    if dry_run:
        for idx, raw in enumerate(items):
            if not isinstance(raw, dict):
                errors.append({"index": idx, "error": "invalid_item"})
                continue

            worker_id = int(raw.get("workerId") or 0) or 0
            time_clock_id = str(raw.get("timeClockId") or "").strip()
            w = None
            if worker_id:
                w = Worker.objects.filter(pk=worker_id).first()
            elif time_clock_id:
                w = Worker.objects.filter(time_clock_id=time_clock_id).first()
            if not w:
                errors.append(
                    {
                        "index": idx,
                        "error": "worker_not_found",
                        "workerId": worker_id or None,
                        "timeClockId": time_clock_id or None,
                    }
                )
                continue

            try:
                att_date = _to_date(raw.get("date"))
            except Exception:
                errors.append({"index": idx, "error": "invalid_date"})
                continue
            if not att_date:
                errors.append({"index": idx, "error": "missing_date"})
                continue

            item_project = default_project
            if raw.get("projectId") is not None:
                pid = int(raw.get("projectId") or 0) or None
                if pid:
                    item_project = (
                        ProjectPage.objects.filter(pk=pid).specific().first()
                    )
                    if not item_project:
                        errors.append(
                            {
                                "index": idx,
                                "error": "project_not_found",
                                "projectId": pid,
                            }
                        )
                        continue
                else:
                    item_project = None

            hours = None
            if raw.get("hours") is not None:
                hours = _to_dec(raw.get("hours"), allow_none=True)
            else:
                check_in = str(raw.get("checkIn") or "").strip()
                check_out = str(raw.get("checkOut") or "").strip()
                if check_in and check_out:
                    try:
                        t1 = _dt.strptime(check_in, "%H:%M")
                        t2 = _dt.strptime(check_out, "%H:%M")
                        minutes = int((t2 - t1).total_seconds() // 60)
                        if minutes < 0:
                            minutes += 24 * 60
                        hours = _to_dec(round(minutes / 60, 2), allow_none=True)
                    except Exception:
                        errors.append(
                            {"index": idx, "error": "invalid_time_range"}
                        )
                        continue
                else:
                    check_in_at = str(raw.get("checkInAt") or "").strip()
                    check_out_at = str(raw.get("checkOutAt") or "").strip()
                    if check_in_at and check_out_at:
                        try:
                            t1s = check_in_at.replace("Z", "+00:00")
                            t2s = check_out_at.replace("Z", "+00:00")
                            t1 = _dt.fromisoformat(t1s)
                            t2 = _dt.fromisoformat(t2s)
                            minutes = int((t2 - t1).total_seconds() // 60)
                            if minutes < 0:
                                errors.append(
                                    {
                                        "index": idx,
                                        "error": "invalid_time_range",
                                    }
                                )
                                continue
                            hours = _to_dec(
                                round(minutes / 60, 2), allow_none=True
                            )
                        except Exception:
                            errors.append(
                                {"index": idx, "error": "invalid_time_range"}
                            )
                            continue

            status = str(raw.get("status") or "").strip()
            if not status and hours is None:
                errors.append({"index": idx, "error": "missing_status_or_time"})
                continue
            if not status:
                status = (
                    WorkerAttendance.STATUS_PRESENT
                    if (hours is not None and hours > 0)
                    else WorkerAttendance.STATUS_ABSENT
                )
            allowed_status = {
                WorkerAttendance.STATUS_PRESENT,
                WorkerAttendance.STATUS_ABSENT,
                WorkerAttendance.STATUS_HALF_DAY,
                WorkerAttendance.STATUS_LEAVE,
            }
            if status not in allowed_status:
                errors.append({"index": idx, "error": "invalid_status"})
                continue

            existing = WorkerAttendance.objects.filter(
                worker=w, date=att_date
            ).first()
            if (
                existing
                and getattr(existing, "state", "")
                == WorkerAttendance.STATE_LOCKED
            ):
                errors.append(
                    {
                        "index": idx,
                        "error": "attendance_locked",
                        "id": existing.id,
                    }
                )
                continue
            created = existing is None
            if created:
                created_count += 1
            else:
                updated_count += 1
            item_results.append(
                {
                    "index": idx,
                    "id": getattr(existing, "id", None),
                    "workerId": w.id,
                    "workerName": w.name,
                    "date": _to_iso(att_date),
                    "created": created,
                    "dryRun": True,
                }
            )
    else:
        with transaction.atomic():
            for idx, raw in enumerate(items):
                if not isinstance(raw, dict):
                    errors.append({"index": idx, "error": "invalid_item"})
                    continue

                worker_id = int(raw.get("workerId") or 0) or 0
                time_clock_id = str(raw.get("timeClockId") or "").strip()
                w = None
                if worker_id:
                    w = Worker.objects.filter(pk=worker_id).first()
                elif time_clock_id:
                    w = Worker.objects.filter(
                        time_clock_id=time_clock_id
                    ).first()
                if not w:
                    errors.append(
                        {
                            "index": idx,
                            "error": "worker_not_found",
                            "workerId": worker_id or None,
                            "timeClockId": time_clock_id or None,
                        }
                    )
                    continue

                try:
                    att_date = _to_date(raw.get("date"))
                except Exception:
                    errors.append({"index": idx, "error": "invalid_date"})
                    continue
                if not att_date:
                    errors.append({"index": idx, "error": "missing_date"})
                    continue

                item_project = default_project
                if raw.get("projectId") is not None:
                    pid = int(raw.get("projectId") or 0) or None
                    if pid:
                        item_project = (
                            ProjectPage.objects.filter(pk=pid)
                            .specific()
                            .first()
                        )
                        if not item_project:
                            errors.append(
                                {
                                    "index": idx,
                                    "error": "project_not_found",
                                    "projectId": pid,
                                }
                            )
                            continue
                    else:
                        item_project = None

                hours = None
                if raw.get("hours") is not None:
                    hours = _to_dec(raw.get("hours"), allow_none=True)
                else:
                    check_in = str(raw.get("checkIn") or "").strip()
                    check_out = str(raw.get("checkOut") or "").strip()
                    if check_in and check_out:
                        try:
                            t1 = _dt.strptime(check_in, "%H:%M")
                            t2 = _dt.strptime(check_out, "%H:%M")
                            minutes = int((t2 - t1).total_seconds() // 60)
                            if minutes < 0:
                                minutes += 24 * 60
                            hours = _to_dec(
                                round(minutes / 60, 2), allow_none=True
                            )
                        except Exception:
                            errors.append(
                                {"index": idx, "error": "invalid_time_range"}
                            )
                            continue
                    else:
                        check_in_at = str(raw.get("checkInAt") or "").strip()
                        check_out_at = str(raw.get("checkOutAt") or "").strip()
                        if check_in_at and check_out_at:
                            try:
                                t1s = check_in_at.replace("Z", "+00:00")
                                t2s = check_out_at.replace("Z", "+00:00")
                                t1 = _dt.fromisoformat(t1s)
                                t2 = _dt.fromisoformat(t2s)
                                minutes = int((t2 - t1).total_seconds() // 60)
                                if minutes < 0:
                                    errors.append(
                                        {
                                            "index": idx,
                                            "error": "invalid_time_range",
                                        }
                                    )
                                    continue
                                hours = _to_dec(
                                    round(minutes / 60, 2), allow_none=True
                                )
                            except Exception:
                                errors.append(
                                    {
                                        "index": idx,
                                        "error": "invalid_time_range",
                                    }
                                )
                                continue

                status = str(raw.get("status") or "").strip()
                if not status and hours is None:
                    errors.append(
                        {"index": idx, "error": "missing_status_or_time"}
                    )
                    continue
                if not status:
                    status = (
                        WorkerAttendance.STATUS_PRESENT
                        if (hours is not None and hours > 0)
                        else WorkerAttendance.STATUS_ABSENT
                    )
                allowed_status = {
                    WorkerAttendance.STATUS_PRESENT,
                    WorkerAttendance.STATUS_ABSENT,
                    WorkerAttendance.STATUS_HALF_DAY,
                    WorkerAttendance.STATUS_LEAVE,
                }
                if status not in allowed_status:
                    errors.append({"index": idx, "error": "invalid_status"})
                    continue

                notes = str(raw.get("notes") or "").strip()
                import_note = "Imported from time clock"

                a = (
                    WorkerAttendance.objects.select_for_update()
                    .filter(worker=w, date=att_date)
                    .first()
                )
                if (
                    a
                    and getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED
                ):
                    errors.append(
                        {"index": idx, "error": "attendance_locked", "id": a.id}
                    )
                    continue
                created = a is None
                if not a:
                    a = WorkerAttendance(worker=w, date=att_date)
                    created_count += 1
                else:
                    updated_count += 1
                a.status = status
                a.hours = hours
                a.project = item_project
                if notes:
                    a.notes = notes
                else:
                    if not a.notes:
                        a.notes = import_note
                a.save()
                item_results.append(
                    {
                        "index": idx,
                        "id": a.id,
                        "workerId": w.id,
                        "workerName": w.name,
                        "date": _to_iso(att_date),
                        "created": created,
                    }
                )

    return created_count, updated_count, errors, item_results


__all__ = [
    "_fail",
    "AIContentGeneratorPage",
    "AIDesignAnalyzerPage",
    "AISettings",
    "Any",
    "ArchitecturalVisualizerPage",
    "ArticleIndexPage",
    "ArticlePage",
    "BytesIO",
    "CalculatorSettings",
    "CertificationIndexPage",
    "CertificationPage",
    "ConstructionCalculatorPage",
    "ContactPage",
    "Decimal",
    "HttpRequest",
    "Image",
    "ImageDraw",
    "ImageFont",
    "JsonResponse",
    "LocationIndexPage",
    "LocationPage",
    "OpsAuditLog",
    "OpsPermissionRule",
    "Page",
    "Path",
    "ProjectIndexPage",
    "ProjectPage",
    "QuoteRequestPage",
    "ROLE_GROUPS",
    "ServiceIndexPage",
    "ServicePage",
    "Site",
    "SiteVisibilitySettings",
    "ToolsIndexPage",
    "WebPage",
    "Worker",
    "WorkerAttendance",
    "_abs_url",
    "_allowed_page_models",
    "_api_error",
    "_api_ok",
    "_articles_index",
    "_audit_ops",
    "_calculator_response",
    "_can_use_restricted_tools",
    "_chat_reply",
    "_check_rate_limit",
    "_company_logo_as_jpeg",
    "_create_placeholder_visual",
    "_default_calculator_items",
    "_design_analysis_fallback",
    "_fmt_ils",
    "_gemini_generate_text",
    "_generate_content_fallback",
    "_generate_password",
    "_get_ai_settings",
    "_get_calc_settings",
    "_get_site",
    "_hex_to_rgb",
    "_image_rendition_url",
    "_image_url",
    "_ops_rule_allowed_roles",
    "_page_type_label",
    "_page_type_name",
    "_parse_aspect_ratio",
    "_pdf_sanitize_text",
    "_process_timeclock_items",
    "_project_cover_url",
    "_projects_index",
    "_rate_limit_key",
    "_read_json",
    "_require_accounting",
    "_require_manager",
    "_require_ops_assignments_read",
    "_require_ops_assignments_write",
    "_require_ops_attendance_read",
    "_require_ops_attendance_write",
    "_require_ops_contracts_read",
    "_require_ops_contracts_write",
    "_require_ops_crm_read",
    "_require_ops_crm_write",
    "_require_ops_equipment_read",
    "_require_ops_equipment_write",
    "_require_ops_management",
    "_require_ops_procurement_read",
    "_require_ops_procurement_write",
    "_require_ops_rule",
    "_require_ops_timeclock_import",
    "_require_ops_workers_read",
    "_require_ops_workers_write",
    "_require_projects_management",
    "_require_registration",
    "_require_restricted_tools",
    "_require_rfq_management",
    "_require_staff",
    "_require_superuser",
    "_rfq_extract_items",
    "_rfq_number",
    "_rfq_totals",
    "_safe_uploaded_filename",
    "_services_index",
    "_site_root",
    "_streamfield_first_html",
    "_to_date",
    "_to_dec",
    "_to_iso",
    "_unique_child_slug",
    "_user_group_names",
    "_user_in_any_group",
    "_user_role",
    "annotations",
    "cache",
    "json",
    "logger",
    "logging",
    "os",
    "random",
    "secrets",
    "string",
    "time",
    "transaction",
]
