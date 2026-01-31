import base64
import json
import logging
import mimetypes
import os
import random
import secrets
import string
import tempfile
import time
import zipfile
from decimal import Decimal
from io import BytesIO
from io import StringIO
from pathlib import Path
from typing import Any
from typing import Iterator

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError
from django.db import transaction
from django.db.models import Sum
from django.http import FileResponse
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import JsonResponse
from django.http import StreamingHttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
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
from website.models import Client
from website.models import ClientContactLog
from website.models import CompanyDocument
from website.models import CompanySettings
from website.models import ConstructionCalculatorPage
from website.models import ContactPage
from website.models import ContractAddendum
from website.models import ContractPayment
from website.models import Equipment
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomePageSettings
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import InventoryItem
from website.models import InventoryTransaction
from website.models import LocationIndexPage
from website.models import LocationPage
from website.models import OpsAuditLog
from website.models import OpsPermissionRule
from website.models import OpsTimeclockImportRun
from website.models import ProjectContract
from website.models import ProjectDocument
from website.models import ProjectGalleryImage
from website.models import ProjectIndexPage
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import QuoteRequestPage
from website.models import ResourceAssignment
from website.models import RFQDocument
from website.models import ServiceIndexPage
from website.models import ServicePage
from website.models import SiteVisibilitySettings
from website.models import Subcontractor
from website.models import Supplier
from website.models import TeamMember
from website.models import Testimonial
from website.models import ToolsIndexPage
from website.models import WebPage
from website.models import Worker
from website.models import WorkerAttendance
from website.models import WorkerPayrollEntry


logger = logging.getLogger(__name__)


def _read_json(request: HttpRequest) -> dict[str, Any]:
    try:
        raw = request.body.decode("utf-8") if request.body else "{}"
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _api_ok(payload: dict[str, Any] | None = None, *, status: int = 200) -> JsonResponse:
    result: dict[str, Any] = payload or {}
    return JsonResponse({"ok": True, "result": result, "data": result}, status=status)


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
    return JsonResponse({"ok": False, "error": error_obj, "errorCode": code}, status=status)


def _rate_limit_key(request: HttpRequest, *, scope: str, window_seconds: int) -> str:
    user = getattr(request, "user", None)
    user_id = getattr(user, "id", None) if user and getattr(user, "is_authenticated", False) else None
    ip = str(request.META.get("REMOTE_ADDR") or "").strip() or "unknown"
    ident = f"u:{user_id}" if user_id else f"ip:{ip}"
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
        return None

    now = int(time.time())
    retry_after = win - (now % win)
    return _api_error(
        "rate_limited",
        status=429,
        message="تم تجاوز الحد المسموح من المحاولات. يرجى المحاولة لاحقاً.",
        details={"retryAfterSeconds": retry_after},
    )


def _safe_uploaded_filename(original_name: str, *, allowed_exts: set[str]) -> str:
    suffix = Path(original_name or "").suffix.lower()
    ext = suffix if suffix in allowed_exts else ""
    token = secrets.token_urlsafe(12).replace("-", "").replace("_", "")
    return f"{token}{ext}" if ext else token


ROLE_GROUPS: dict[str, set[str]] = {
    "guest": {"Guests", "Guest", "ضيف"},
    "registered_guest": {"Registered Guests", "Registered Guest", "ضيف مسجل", "ضيف مُسجل"},
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


def _require_ops_rule(request: HttpRequest, code: str, *, default_allowed_roles: set[str]) -> Any | None:
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
        actor = user if user and getattr(user, "is_authenticated", False) else None
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
        default_allowed_roles={"manager", "accountant", "registrar", "employee"},
    )


def _require_ops_crm_read(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "ops_crm_read",
        default_allowed_roles={"manager", "accountant", "registrar"},
    )


def _require_ops_crm_write(request: HttpRequest) -> Any | None:
    return _require_ops_crm_read(request)


def _require_ops_contracts_read(request: HttpRequest) -> Any | None:
    return _require_accounting(request)


def _require_ops_contracts_write(request: HttpRequest) -> Any | None:
    return _require_ops_contracts_read(request)


def _require_ops_procurement_read(request: HttpRequest) -> Any | None:
    return _require_accounting(request)


def _require_ops_procurement_write(request: HttpRequest) -> Any | None:
    return _require_ops_procurement_read(request)


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


def _require_ops_payroll_read(request: HttpRequest) -> Any | None:
    return _require_accounting(request)


def _require_ops_payroll_write(request: HttpRequest) -> Any | None:
    return _require_ops_payroll_read(request)


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


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse | HttpResponse:
    if str(getattr(request, "path", "") or "").startswith("/api/"):
        msg = "فشل التحقق الأمني. حدّث الصفحة ثم أعد المحاولة."
        if reason:
            return _api_error("csrf_failed", status=403, message=msg, details={"reason": reason})
        return _api_error("csrf_failed", status=403, message=msg)
    return HttpResponse("CSRF Failed", status=403, content_type="text/plain; charset=utf-8")


def auth_access(request: HttpRequest) -> JsonResponse:
    return _api_ok({"canUseRestrictedTools": _can_use_restricted_tools(request)})


@require_POST
def auth_login(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="auth_login", limit=12, window_seconds=300)
    if limited:
        return limited
    data = _read_json(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    user = authenticate(request, username=username, password=password)
    if not user:
        return _api_error("invalid_credentials", status=401)
    if not getattr(user, "is_active", False):
        return _api_error("inactive", status=403)
    if not getattr(user, "is_staff", False):
        return _api_error("forbidden", status=403)
    django_login(request, user)
    return _api_ok()


@ensure_csrf_cookie
def auth_me(request: HttpRequest) -> JsonResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_ok(
            {
                "authenticated": False,
                "username": "",
                "isStaff": False,
                "isSuperuser": False,
                "role": "anonymous",
                "groups": [],
                "workerId": 0,
            }
        )
    try:
        groups = list(user.groups.values_list("name", flat=True))
    except Exception:
        groups = []
    worker_id = 0
    try:
        linked = Worker.objects.filter(user=user).values_list("id", flat=True).first()
        worker_id = int(linked or 0)
    except Exception:
        worker_id = 0
    return _api_ok(
        {
            "authenticated": True,
            "username": getattr(user, "username", "") or "",
            "isStaff": bool(getattr(user, "is_staff", False)),
            "isSuperuser": bool(getattr(user, "is_superuser", False)),
            "role": _user_role(user),
            "groups": groups,
            "workerId": worker_id,
        }
    )


@require_POST
def auth_logout(request: HttpRequest) -> JsonResponse:
    django_logout(request)
    return _api_ok()


@require_POST
def auth_change_password(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="auth_change_password", limit=12, window_seconds=600)
    if limited:
        return limited
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_error("unauthorized", status=401)
    if not getattr(user, "is_staff", False):
        return _api_error("forbidden", status=403)

    data = _read_json(request)
    old_password = str(data.get("oldPassword") or "")
    new_password = str(data.get("newPassword") or "")

    if not old_password or not new_password:
        return _api_error("missing_fields", status=400)

    if not user.check_password(old_password):
        return _api_error("invalid_old_password", status=400)

    user.set_password(new_password)
    user.save()
    django_login(request, user)
    return _api_ok()


@require_POST
def admin_client_errors(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_client_errors", limit=60, window_seconds=300
    )
    if limited:
        return limited
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    message = str(data.get("message") or "").strip()
    if not message:
        return _api_error("missing_fields", status=400)
    route = str(data.get("route") or "").strip()
    stack = str(data.get("stack") or "").strip()
    component_stack = str(data.get("componentStack") or "").strip()
    ua = str(request.META.get("HTTP_USER_AGENT") or "").strip()

    user = getattr(request, "user", None)
    logger.error(
        "Client runtime error",
        extra={
            "path": str(getattr(request, "path", "") or ""),
            "route": route,
            "message": message,
            "stack": stack,
            "componentStack": component_stack,
            "userAgent": ua,
            "userId": getattr(user, "id", None)
            if user and getattr(user, "is_authenticated", False)
            else None,
            "username": getattr(user, "username", None)
            if user and getattr(user, "is_authenticated", False)
            else None,
        },
    )
    return _api_ok()


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


@require_GET
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
                "djangoAdmin": "/django-admin/",
                "publicSite": "/",
                "tools": "/tools",
            },
        }
    )


@require_GET
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
            "logoThumbUrl": _image_rendition_url(request, company.logo_image, "max-320x320|jpegquality-70"),
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
                return _api_error("invalid_image", status=400)
            company.logo_image = img

    company.save()
    return _api_ok()


@require_GET
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
            "heroBackgroundThumbUrl": _image_rendition_url(request, home.hero_background_image, "fill-640x360|jpegquality-70"),
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
                return _api_error("invalid_image", status=400)
            home.hero_background_image = img

    home.save()
    return _api_ok()


@require_GET
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
            return _api_error("invalid_temperature", status=400)
    max_val = data.get("maxOutputTokens")
    if max_val is not None:
        try:
            s.max_output_tokens = int(max_val)
        except Exception:
            return _api_error("invalid_max_output_tokens", status=400)
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
    return _api_ok()


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


@require_GET
def admin_calculator_settings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    s = CalculatorSettings.for_site(site)
    items = s.items if isinstance(s.items, list) and len(s.items) else _default_calculator_items(s)
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
            return _api_error(f"invalid_{key}", status=400)
    s.save()
    return _api_ok()


@require_GET
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


@require_GET
def admin_team(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
                "imageThumbUrl": _image_rendition_url(request, m.image, "fill-256x256|jpegquality-70"),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_team_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)

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
    return _api_ok({"id": m.id})


@require_POST
def admin_team_update(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return _api_error("missing_name", status=400)
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
                return _api_error("invalid_image", status=400)
            m.image = img

    m.save()
    return _api_ok(
        {
            "imageUrl": _image_url(request, m.image),
            "imageId": getattr(m.image, "id", None),
        }
    )


@require_POST
def admin_team_delete(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _api_error("not_found", status=404)
    m.delete()
    return _api_ok()


@require_POST
def admin_team_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue

    if not cleaned:
        return _api_error("invalid_ids", status=400)

    members = TeamMember.objects.filter(pk__in=cleaned)
    by_id = {m.id: m for m in members}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            m = by_id.get(mid)
            if not m:
                continue
            m.sort_order = idx
            m.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_testimonials(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_testimonials_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    text = str(data.get("text") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    if not text:
        return _api_error("missing_text", status=400)

    rating_raw = data.get("rating")
    rating = 5
    if rating_raw is not None and rating_raw != "":
        try:
            rating = int(rating_raw)
        except Exception:
            return _api_error("invalid_rating", status=400)
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
    return _api_ok({"id": t.id})


@require_POST
def admin_testimonials_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            t.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return _api_error("missing_name", status=400)
        t.name = name

    if data.get("text") is not None:
        text = str(data.get("text") or "").strip()
        if not text:
            return _api_error("missing_text", status=400)
        t.text = text

    if data.get("project") is not None:
        t.project = str(data.get("project") or "")

    rating_raw = data.get("rating")
    if rating_raw is not None:
        try:
            rating = int(rating_raw)
        except Exception:
            return _api_error("invalid_rating", status=400)
        t.rating = max(1, min(5, rating))

    t.save()
    return _api_ok()


@require_POST
def admin_testimonials_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _api_error("not_found", status=404)
    t.delete()
    return _api_ok()


@require_POST
def admin_testimonials_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = Testimonial.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_trust_badges(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_home_trust_badges_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeTrustBadge.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    b = HomeTrustBadge.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-shield-alt") or "fas fa-shield-alt",
    )
    return _api_ok({"id": b.id}, status=201)


@require_POST
def admin_home_trust_badges_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            b.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        b.title = title
    if data.get("description") is not None:
        b.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        b.icon_class = str(data.get("iconClass") or "")
    b.save()
    return _api_ok()


@require_POST
def admin_home_trust_badges_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _api_error("not_found", status=404)
    b.delete()
    return _api_ok()


@require_POST
def admin_home_trust_badges_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = HomeTrustBadge.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_stats(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_home_stats_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    label = str(data.get("label") or "").strip()
    value = str(data.get("value") or "").strip()
    if not label:
        return _api_error("missing_label", status=400)
    if not value:
        return _api_error("missing_value", status=400)
    last = HomeStat.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    s = HomeStat.objects.create(
        sort_order=sort_order,
        label=label,
        value=value,
        icon_class=str(data.get("iconClass") or "fas fa-building") or "fas fa-building",
    )
    return _api_ok({"id": s.id})


@require_POST
def admin_home_stats_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            s.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return _api_error("missing_label", status=400)
        s.label = label
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return _api_error("missing_value", status=400)
        s.value = value
    if data.get("iconClass") is not None:
        s.icon_class = str(data.get("iconClass") or "")
    s.save()
    return _api_ok()


@require_POST
def admin_home_stats_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _api_error("not_found", status=404)
    s.delete()
    return _api_ok()


@require_POST
def admin_home_stats_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = HomeStat.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_timeline(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_home_timeline_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeTimelineStep.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    st = HomeTimelineStep.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-file-search") or "fas fa-file-search",
    )
    return _api_ok({"id": st.id})


@require_POST
def admin_home_timeline_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            st.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        st.title = title
    if data.get("description") is not None:
        st.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        st.icon_class = str(data.get("iconClass") or "")
    st.save()
    return _api_ok()


@require_POST
def admin_home_timeline_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _api_error("not_found", status=404)
    st.delete()
    return _api_ok()


@require_POST
def admin_home_timeline_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = HomeTimelineStep.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_ai_features(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_home_ai_features_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeAIFeature.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    f = HomeAIFeature.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        badge_text=str(data.get("badgeText") or "AI") or "AI",
    )
    return _api_ok({"id": f.id})


@require_POST
def admin_home_ai_features_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            f.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        f.title = title
    if data.get("description") is not None:
        f.description = str(data.get("description") or "")
    if data.get("badgeText") is not None:
        f.badge_text = str(data.get("badgeText") or "")
    f.save()
    return _api_ok()


@require_POST
def admin_home_ai_features_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _api_error("not_found", status=404)
    f.delete()
    return _api_ok()


@require_POST
def admin_home_ai_features_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = HomeAIFeature.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_ai_metrics(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
    return _api_ok({"items": items})


@require_POST
def admin_home_ai_metrics_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    value = str(data.get("value") or "").strip()
    label = str(data.get("label") or "").strip()
    if not value:
        return _api_error("missing_value", status=400)
    if not label:
        return _api_error("missing_label", status=400)
    last = HomeAIMetric.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    m = HomeAIMetric.objects.create(sort_order=sort_order, value=value, label=label)
    return _api_ok({"id": m.id})


@require_POST
def admin_home_ai_metrics_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return _api_error("missing_value", status=400)
        m.value = value
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return _api_error("missing_label", status=400)
        m.label = label
    m.save()
    return _api_ok()


@require_POST
def admin_home_ai_metrics_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _api_error("not_found", status=404)
    m.delete()
    return _api_ok()


@require_POST
def admin_home_ai_metrics_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    items = HomeAIMetric.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


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


@require_GET
def admin_services(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return _api_ok({"items": []})
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
                "coverThumbUrl": _image_rendition_url(request, cover, "fill-640x360|jpegquality-70"),
                "shortDescription": getattr(p, "short_description", "") or "",
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_service_detail(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    cover = getattr(page, "cover_image", None)
    return _api_ok(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "firstPublishedAt": str(getattr(page, "first_published_at", "") or ""),
            "shortDescription": getattr(page, "short_description", "") or "",
            "coverImageId": getattr(cover, "id", None),
            "coverUrl": _image_url(request, cover),
            "coverThumbUrl": _image_rendition_url(request, cover, "fill-640x360|jpegquality-70"),
            "bodyHtml": _streamfield_first_html(getattr(page, "body", None)),
        }
    )


@require_POST
def admin_service_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return _api_error("services_index_missing", status=400)
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
    return _api_ok({"id": page.id})


@require_POST
def admin_service_update(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
                return _api_error("invalid_image", status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_service_publish(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_service_unpublish(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_service_delete(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.delete()
    return _api_ok()


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


@require_GET
def admin_pages_tree(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
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
        return _api_error("site_not_found", status=400)

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
    return _api_ok(
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


@require_GET
def admin_pages_allowed_types(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    parent_id_raw = request.GET.get("parentId")
    if not parent_id_raw:
        return _api_error("missing_parentId", status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return _api_error("invalid_parentId", status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _api_error("not_found", status=404)

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
    return _api_ok({"items": items})


@require_GET
def admin_page_detail(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)

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
        data["coverThumbUrl"] = _image_rendition_url(request, cover, "fill-640x360|jpegquality-70")

    if isinstance(page, ProjectPage):
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)
        data["coverThumbUrl"] = _image_rendition_url(request, cover, "fill-640x360|jpegquality-70")
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
        data["coverThumbUrl"] = _image_rendition_url(request, cover, "fill-640x360|jpegquality-70")

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        data["toAddress"] = str(getattr(page, "to_address", "") or "")
        data["subject"] = str(getattr(page, "subject", "") or "")
        data["replyAddress"] = str(getattr(page, "reply_address", "") or "")

    return _api_ok(data)


@require_POST
def admin_page_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    parent_id_raw = data.get("parentId")
    type_raw = str(data.get("type") or "").strip()
    title = str(data.get("title") or "").strip() or "صفحة"
    slug_raw = str(data.get("slug") or title).strip()
    live = bool(data.get("live", True))

    if parent_id_raw in {None, ""}:
        return _api_error("invalid_parentId", status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return _api_error("invalid_parentId", status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _api_error("parent_not_found", status=404)

    allowed = _allowed_page_models()
    Model = allowed.get(type_raw)
    if not Model:
        return _api_error("invalid_type", status=400)

    try:
        allowed_models = parent.get_allowed_subpage_models()
    except Exception:
        allowed_models = []
    if Model not in allowed_models:
        return _api_error("type_not_allowed_here", status=400)

    base_slug = slugify(slug_raw) or "page"
    page = Model(title=title, slug=_unique_child_slug(parent, base_slug))

    parent.add_child(instance=page)
    if live:
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
def admin_page_update(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
                    return _api_error("invalid_image", status=400)
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
                    return _api_error("invalid_issuedYear", status=400)

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        if data.get("toAddress") is not None:
            setattr(page, "to_address", str(data.get("toAddress") or ""))
        if data.get("subject") is not None:
            setattr(page, "subject", str(data.get("subject") or ""))
        if data.get("replyAddress") is not None:
            setattr(page, "reply_address", str(data.get("replyAddress") or ""))

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_page_publish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_page_unpublish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_page_delete(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.delete()
    return _api_ok()


@require_GET
def admin_articles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _api_ok({"items": []})
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
    return _api_ok({"items": items})


@require_GET
def admin_article_detail(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    cover = getattr(page, "cover_image", None)
    return _api_ok(
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
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _api_error("articles_index_missing", status=400)
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
    return _api_ok({"id": page.id})


@require_POST
def admin_article_update(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
                return _api_error("invalid_image", status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_article_publish(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_article_unpublish(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return _api_ok()


@require_POST
def admin_article_delete(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).first()
    if not page:
        return _api_error("not_found", status=404)
    page.delete()
    return _api_ok()


def _rfq_number() -> str:
    ts = time.strftime("%Y%m%d")
    suffix = secrets.token_hex(2).upper()
    return f"RFQ-{ts}-{suffix}"


@require_GET
def admin_rfq_documents(request: HttpRequest) -> JsonResponse:
    forbidden = _require_rfq_management(request)
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
    return _api_ok({"items": items})


@require_GET
def admin_rfq_document_detail(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)
    return _api_ok(
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
    forbidden = _require_rfq_management(request)
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
    return _api_ok({"id": d.id})


@require_POST
def admin_rfq_document_update(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)

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
    return _api_ok()


@require_POST
def admin_rfq_document_delete(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)
    d.delete()
    return _api_ok()


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
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)
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


def _project_cover_url(request: HttpRequest, project: Any) -> str:
    cover = getattr(project, "cover_image", None)
    cover_url = _image_url(request, cover)
    if cover_url:
        return cover_url
    try:
        qs = project.gallery_images.all().select_related("image").order_by("sort_order", "id")
        for gi in qs:
            img = getattr(gi, "image", None)
            url = _image_url(request, img)
            if url:
                return url
    except Exception:
        return ""
    return ""


def _image_rendition_url(request: HttpRequest, image: Any | None, spec: str) -> str:
    if not image:
        return ""
    try:
        rendition = image.get_rendition(spec)
        return _abs_url(request, str(getattr(rendition, "url", "") or ""))
    except Exception:
        return ""


@require_GET
def admin_projects(request: HttpRequest) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    idx = _projects_index(request)
    if not idx:
        return _api_ok({"items": []})
    status = str(request.GET.get("status") or "").strip()
    if status and status not in {
        ProjectPage.STATUS_ONGOING,
        ProjectPage.STATUS_COMPLETED,
        ProjectPage.STATUS_ARCHIVED,
    }:
        return _api_error("invalid_project_status", status=400)
    pages = ProjectPage.objects.child_of(idx).specific().order_by("path")
    if status:
        pages = pages.filter(status=status)
    pages = pages.prefetch_related("gallery_images__image")
    items: list[dict[str, Any]] = []
    for p in pages:
        cover_url = _project_cover_url(request, p)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(getattr(p, "first_published_at", "") or ""),
                "coverUrl": cover_url,
                "shortDescription": getattr(p, "short_description", "") or "",
                "status": getattr(p, "status", ProjectPage.STATUS_COMPLETED) or ProjectPage.STATUS_COMPLETED,
                "pmpPhase": getattr(p, "pmp_phase", ProjectPage.PHASE_PLANNING) or ProjectPage.PHASE_PLANNING,
                "progressPercent": int(getattr(p, "progress_percent", 0) or 0),
                "clientName": getattr(p, "client_name", "") or "",
                "projectLocation": getattr(p, "project_location", "") or "",
                "completionYear": getattr(p, "completion_year", None),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_projects_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    idx = _projects_index(request)
    if not idx:
        return _api_error("projects_index_missing", status=400)
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    pages = ProjectPage.objects.child_of(idx).filter(pk__in=cleaned).specific()
    by_id = {p.id: p for p in pages}
    if not by_id:
        return _api_error("invalid_ids", status=400)
    with transaction.atomic():
        prev = None
        for pid in cleaned:
            p = by_id.get(pid)
            if not p:
                continue
            if prev is None:
                p.move(idx, pos="first-child")
            else:
                p.move(prev, pos="right")
            prev = p
    return _api_ok()


@require_GET
def admin_project_detail(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
    return _api_ok(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "shortDescription": page.short_description,
            "status": getattr(page, "status", ProjectPage.STATUS_COMPLETED) or ProjectPage.STATUS_COMPLETED,
            "pmpPhase": getattr(page, "pmp_phase", ProjectPage.PHASE_PLANNING) or ProjectPage.PHASE_PLANNING,
            "progressPercent": int(getattr(page, "progress_percent", 0) or 0),
            "startDate": str(getattr(page, "start_date", "") or ""),
            "targetEndDate": str(getattr(page, "target_end_date", "") or ""),
            "budgetAmount": str(getattr(page, "budget_amount", "") or ""),
            "scopeStatement": getattr(page, "scope_statement", "") or "",
            "keyDeliverables": getattr(page, "key_deliverables", "") or "",
            "keyStakeholders": getattr(page, "key_stakeholders", "") or "",
            "keyRisks": getattr(page, "key_risks", "") or "",
            "managementNotes": getattr(page, "management_notes", "") or "",
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
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    idx = _projects_index(request)
    if not idx:
        return _api_error("projects_index_missing", status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "مشروع"
    base_slug = slugify(str(data.get("slug") or title)) or "project"
    completion_year: int | None = None
    cy = data.get("completionYear")
    if cy not in {None, ""}:
        try:
            completion_year = int(str(cy))
        except Exception:
            return _api_error("invalid_completion_year", status=400)
    status = str(data.get("status") or "").strip() or ProjectPage.STATUS_COMPLETED
    if status not in {
        ProjectPage.STATUS_ONGOING,
        ProjectPage.STATUS_COMPLETED,
        ProjectPage.STATUS_ARCHIVED,
    }:
        return _api_error("invalid_project_status", status=400)

    pmp_phase = str(data.get("pmpPhase") or "").strip() or ProjectPage.PHASE_PLANNING
    if pmp_phase not in {
        ProjectPage.PHASE_INITIATING,
        ProjectPage.PHASE_PLANNING,
        ProjectPage.PHASE_EXECUTING,
        ProjectPage.PHASE_MONITORING,
        ProjectPage.PHASE_CLOSING,
    }:
        return _api_error("invalid_pmp_phase", status=400)
    progress_percent_raw = data.get("progressPercent")
    progress_percent = 0
    if progress_percent_raw not in {None, ""}:
        try:
            progress_percent = int(str(progress_percent_raw))
        except Exception:
            return _api_error("invalid_progress_percent", status=400)
    if progress_percent < 0 or progress_percent > 100:
        return _api_error("invalid_progress_percent", status=400)

    start_date_raw = str(data.get("startDate") or "").strip()
    target_end_date_raw = str(data.get("targetEndDate") or "").strip()
    start_date = None
    target_end_date = None
    if start_date_raw:
        try:
            from datetime import date

            start_date = date.fromisoformat(start_date_raw)
        except Exception:
            return _api_error("invalid_start_date", status=400)
    if target_end_date_raw:
        try:
            from datetime import date

            target_end_date = date.fromisoformat(target_end_date_raw)
        except Exception:
            return _api_error("invalid_target_end_date", status=400)

    budget_amount_raw = data.get("budgetAmount")
    budget_amount = None
    if budget_amount_raw not in {None, ""}:
        try:
            from decimal import Decimal

            budget_amount = Decimal(str(budget_amount_raw))
        except Exception:
            return _api_error("invalid_budget_amount", status=400)
    page = ProjectPage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        short_description=str(data.get("shortDescription") or ""),
        status=status,
        client_name=str(data.get("clientName") or ""),
        pmp_phase=pmp_phase,
        progress_percent=progress_percent,
        start_date=start_date,
        target_end_date=target_end_date,
        budget_amount=budget_amount,
        scope_statement=str(data.get("scopeStatement") or ""),
        key_deliverables=str(data.get("keyDeliverables") or ""),
        key_stakeholders=str(data.get("keyStakeholders") or ""),
        key_risks=str(data.get("keyRisks") or ""),
        management_notes=str(data.get("managementNotes") or ""),
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
    if status == ProjectPage.STATUS_ARCHIVED:
        rev = page.save_revision()
        rev.save()
        try:
            page.unpublish()
        except Exception:
            page.live = False
            page.save(update_fields=["live"])
    else:
        page.save_revision().publish()
    return _api_ok({"id": page.id})


@require_POST
def admin_project_update(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
    new_status = None
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        if status not in {
            ProjectPage.STATUS_ONGOING,
            ProjectPage.STATUS_COMPLETED,
            ProjectPage.STATUS_ARCHIVED,
        }:
            return _api_error("invalid_project_status", status=400)
        page.status = status
        new_status = status
    if data.get("pmpPhase") is not None:
        pmp_phase = str(data.get("pmpPhase") or "").strip()
        if pmp_phase not in {
            ProjectPage.PHASE_INITIATING,
            ProjectPage.PHASE_PLANNING,
            ProjectPage.PHASE_EXECUTING,
            ProjectPage.PHASE_MONITORING,
            ProjectPage.PHASE_CLOSING,
        }:
            return _api_error("invalid_pmp_phase", status=400)
        page.pmp_phase = pmp_phase
    if data.get("progressPercent") is not None:
        progress_val = data.get("progressPercent")
        try:
            progress_percent = int(str(progress_val))
        except Exception:
            return _api_error("invalid_progress_percent", status=400)
        if progress_percent < 0 or progress_percent > 100:
            return _api_error("invalid_progress_percent", status=400)
        page.progress_percent = progress_percent
    if data.get("startDate") is not None:
        start_date_raw = str(data.get("startDate") or "").strip()
        if not start_date_raw:
            page.start_date = None
        else:
            try:
                from datetime import date

                page.start_date = date.fromisoformat(start_date_raw)
            except Exception:
                return _api_error("invalid_start_date", status=400)
    if data.get("targetEndDate") is not None:
        target_end_date_raw = str(data.get("targetEndDate") or "").strip()
        if not target_end_date_raw:
            page.target_end_date = None
        else:
            try:
                from datetime import date

                page.target_end_date = date.fromisoformat(target_end_date_raw)
            except Exception:
                return _api_error("invalid_target_end_date", status=400)
    if data.get("budgetAmount") is not None:
        budget_amount_raw = data.get("budgetAmount")
        if budget_amount_raw in {"", None}:
            page.budget_amount = None
        else:
            try:
                from decimal import Decimal

                page.budget_amount = Decimal(str(budget_amount_raw))
            except Exception:
                return _api_error("invalid_budget_amount", status=400)
    for key, attr in [
        ("scopeStatement", "scope_statement"),
        ("keyDeliverables", "key_deliverables"),
        ("keyStakeholders", "key_stakeholders"),
        ("keyRisks", "key_risks"),
        ("managementNotes", "management_notes"),
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
                return _api_error("invalid_completion_year", status=400)
    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)
    rev = page.save_revision()
    should_publish = bool(page.live) and new_status != ProjectPage.STATUS_ARCHIVED
    rev.publish() if should_publish else rev.save()
    if new_status == ProjectPage.STATUS_ARCHIVED:
        try:
            page.unpublish()
        except Exception:
            page.live = False
            page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_project_publish(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_project_unpublish(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return _api_ok()


@require_POST
def admin_project_delete(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).first()
    if not page:
        return _api_error("not_found", status=404)
    page.delete()
    return _api_ok()


@require_POST
def admin_project_gallery_add(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    image_id = data.get("imageId")
    caption = str(data.get("caption") or "")
    if not image_id:
        return _api_error("missing_image", status=400)
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=int(image_id)).first()
    except Exception:
        img = None
    if not img:
        return _api_error("invalid_image", status=400)
    last = (
        ProjectGalleryImage.objects.filter(page=page, sort_order__isnull=False)
        .order_by("-sort_order", "-id")
        .first()
    )
    sort_order = int(getattr(last, "sort_order", -1) or -1) + 1
    item = ProjectGalleryImage.objects.create(
        page=page,
        image=img,
        caption=caption,
        sort_order=sort_order,
    )
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if page:
        page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok({"id": item.id, "url": _image_url(request, img), "imageId": img.id})


@require_POST
def admin_project_gallery_remove(request: HttpRequest, project_id: int, item_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    ProjectGalleryImage.objects.filter(pk=item_id, page=page).delete()
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if page:
        page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_GET
def admin_project_documents(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for row in page.project_documents.all().order_by("sort_order", "id"):
        doc = getattr(row, "document", None)
        url = ""
        download_url = _abs_url(
            request,
            f"/api/admin/projects/{page.id}/documents/{row.id}/download",
        )
        file_size = 0
        created_at = ""
        document_id = getattr(doc, "id", None)
        try:
            f = getattr(doc, "file", None) if doc else None
            url = _abs_url(request, f.url) if f and getattr(f, "url", None) else ""
            file_size = int(getattr(f, "size", 0) or 0)
        except Exception:
            url = ""
            file_size = 0
        try:
            created_at = str(getattr(doc, "created_at", "") or "") if doc else ""
        except Exception:
            created_at = ""
        items.append(
            {
                "id": row.id,
                "title": str(getattr(row, "title", "") or getattr(doc, "title", "") or ""),
                "documentId": document_id,
                "url": url,
                "downloadUrl": download_url,
                "fileSize": file_size,
                "createdAt": created_at,
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_project_documents_download(
    request: HttpRequest, project_id: int, item_id: int
) -> FileResponse | JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    row = (
        ProjectDocument.objects.filter(pk=item_id, page=page)
        .select_related("document")
        .first()
    )
    doc = getattr(row, "document", None) if row else None
    f = getattr(doc, "file", None) if doc else None
    if not f:
        return _api_error("not_found", status=404)

    try:
        fh = f.open("rb")
    except Exception:
        return _api_error("not_found", status=404)

    original_name = ""
    try:
        original_name = Path(str(getattr(f, "name", "") or "")).name
    except Exception:
        original_name = ""

    ext = Path(original_name).suffix
    base = str(getattr(row, "title", "") or getattr(doc, "title", "") or "").strip()
    if not base:
        base = Path(original_name).stem or "document"
    for ch in ['\\', '/', ':', '*', '?', '"', "<", ">", "|"]:
        base = base.replace(ch, "-")
    download_name = f"{base}{ext}" if ext else base

    content_type = mimetypes.guess_type(download_name)[0] or ""
    resp = FileResponse(fh, as_attachment=True, filename=download_name)
    if content_type:
        resp["Content-Type"] = content_type
    return resp


@require_POST
def admin_project_documents_upload(request: HttpRequest, project_id: int) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_project_document_upload", limit=24, window_seconds=300
    )
    if limited:
        return limited
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    f = request.FILES.get("file")
    if not f:
        return _api_error("missing_file", status=400)
    max_bytes = int(
        getattr(settings, "ADMIN_PROJECT_DOCUMENT_UPLOAD_MAX_BYTES", 25 * 1024 * 1024)
    )
    if int(getattr(f, "size", 0) or 0) <= 0:
        return _api_error("empty_file", status=400)
    if int(getattr(f, "size", 0) or 0) > max_bytes:
        return _api_error("file_too_large", status=413, details={"maxBytes": max_bytes})

    original_name = str(getattr(f, "name", "") or "")
    filename = original_name.lower()
    blocked_exts = {
        ".exe",
        ".bat",
        ".cmd",
        ".ps1",
        ".psm1",
        ".sh",
        ".php",
        ".py",
        ".js",
        ".html",
        ".htm",
        ".vbs",
        ".wsf",
        ".jar",
        ".dll",
        ".com",
        ".scr",
    }
    ext = Path(filename).suffix.lower()
    if ext in blocked_exts:
        return _api_error("invalid_file_type", status=400)
    allowed_exts = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    allowed_mimes = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
    }
    content_type = str(getattr(f, "content_type", "") or "").lower()
    if content_type and content_type not in allowed_mimes:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedMimeTypes": sorted(allowed_mimes)},
        )

    try:
        f.name = _safe_uploaded_filename(original_name, allowed_exts=allowed_exts)
    except Exception:
        pass

    title = str(request.POST.get("title") or getattr(f, "name", "") or "document")
    try:
        from wagtail.documents import get_document_model
        from wagtail.models import Collection

        DocumentModel = get_document_model()
        root_collection = Collection.get_first_root_node()
        doc = DocumentModel(title=title, file=f, collection=root_collection)
        doc.save()
        last = (
            ProjectDocument.objects.filter(page=page, sort_order__isnull=False)
            .order_by("-sort_order", "-id")
            .first()
        )
        sort_order = int(getattr(last, "sort_order", -1) or -1) + 1
        row = ProjectDocument.objects.create(
            page=page,
            title=str(request.POST.get("rowTitle") or title or ""),
            document=doc,
            uploaded_by=getattr(request, "user", None),
            sort_order=sort_order,
        )
        page.save_revision().publish() if page.live else page.save_revision().save()
        url = ""
        try:
            url = _abs_url(request, doc.file.url) if getattr(doc, "file", None) else ""
        except Exception:
            url = ""
        return _api_ok({"id": row.id, "documentId": doc.id, "url": url, "title": row.title})
    except Exception:
        return _api_error("upload_failed", status=400)


@require_POST
def admin_project_documents_remove(
    request: HttpRequest, project_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    ProjectDocument.objects.filter(pk=item_id, page=page).delete()
    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_project_documents_update(
    request: HttpRequest, project_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    row = ProjectDocument.objects.filter(pk=item_id, page=page).first()
    if not row:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    updated_fields: list[str] = []
    if data.get("title") is not None:
        row.title = str(data.get("title") or "")
        updated_fields.append("title")
    if data.get("sortOrder") is not None:
        sort_order_raw = data.get("sortOrder")
        try:
            row.sort_order = int(str(sort_order_raw))
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
        updated_fields.append("sort_order")
    if updated_fields:
        row.save(update_fields=updated_fields)
        page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_project_documents_reorder(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    rows = ProjectDocument.objects.filter(page=page, pk__in=cleaned)
    by_id = {r.id: r for r in rows}
    with transaction.atomic():
        for idx, rid in enumerate(cleaned):
            r = by_id.get(rid)
            if not r:
                continue
            r.sort_order = idx
            r.save(update_fields=["sort_order"])
    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_GET
def admin_company_documents(request: HttpRequest) -> JsonResponse:
    category = str(request.GET.get("category") or "").strip()
    allowed = {
        CompanyDocument.CATEGORY_TEMPLATE,
        CompanyDocument.CATEGORY_LETTERHEAD,
        CompanyDocument.CATEGORY_INVOICE,
        CompanyDocument.CATEGORY_RECEIPT,
        CompanyDocument.CATEGORY_COMPANY_DOCUMENT,
        CompanyDocument.CATEGORY_COMPANY_CERTIFICATE,
    }
    if category not in allowed:
        return _api_error("invalid_category", status=400)
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden

    items: list[dict[str, Any]] = []
    for row in (
        CompanyDocument.objects.filter(category=category)
        .select_related("document")
        .order_by("sort_order", "id")
    ):
        doc = getattr(row, "document", None)
        url = ""
        file_size = 0
        created_at = ""
        document_id = getattr(doc, "id", None)
        try:
            f = getattr(doc, "file", None) if doc else None
            url = _abs_url(request, f.url) if f and getattr(f, "url", None) else ""
            file_size = int(getattr(f, "size", 0) or 0)
        except Exception:
            url = ""
            file_size = 0
        try:
            created_at = str(getattr(doc, "created_at", "") or "") if doc else ""
        except Exception:
            created_at = ""
        items.append(
            {
                "id": row.id,
                "category": row.category,
                "sortOrder": int(getattr(row, "sort_order", 0) or 0),
                "title": str(getattr(row, "title", "") or getattr(doc, "title", "") or ""),
                "documentId": document_id,
                "url": url,
                "downloadUrl": _abs_url(request, f"/api/admin/company-documents/{row.id}/download"),
                "fileSize": file_size,
                "createdAt": created_at,
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_company_documents_download(request: HttpRequest, item_id: int) -> FileResponse | JsonResponse:
    row = CompanyDocument.objects.filter(pk=item_id).select_related("document").first()
    if not row:
        return _api_error("not_found", status=404)
    category = str(getattr(row, "category", "") or "").strip()
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden
    doc = getattr(row, "document", None) if row else None
    f = getattr(doc, "file", None) if doc else None
    if not f:
        return _api_error("not_found", status=404)

    try:
        fh = f.open("rb")
    except Exception:
        return _api_error("not_found", status=404)

    original_name = ""
    try:
        original_name = Path(str(getattr(f, "name", "") or "")).name
    except Exception:
        original_name = ""

    ext = Path(original_name).suffix
    base = str(getattr(row, "title", "") or getattr(doc, "title", "") or "").strip()
    if not base:
        base = Path(original_name).stem or "document"
    for ch in ['\\', '/', ':', '*', '?', '"', "<", ">", "|"]:
        base = base.replace(ch, "-")
    download_name = f"{base}{ext}" if ext else base

    content_type = mimetypes.guess_type(download_name)[0] or ""
    resp = FileResponse(fh, as_attachment=True, filename=download_name)
    if content_type:
        resp["Content-Type"] = content_type
    return resp


@require_POST
def admin_company_documents_upload(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_company_document_upload", limit=24, window_seconds=300
    )
    if limited:
        return limited
    category = str(request.POST.get("category") or "").strip()
    allowed = {
        CompanyDocument.CATEGORY_TEMPLATE,
        CompanyDocument.CATEGORY_LETTERHEAD,
        CompanyDocument.CATEGORY_INVOICE,
        CompanyDocument.CATEGORY_RECEIPT,
        CompanyDocument.CATEGORY_COMPANY_DOCUMENT,
        CompanyDocument.CATEGORY_COMPANY_CERTIFICATE,
    }
    if category not in allowed:
        return _api_error("invalid_category", status=400)
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden

    f = request.FILES.get("file")
    if not f:
        return _api_error("missing_file", status=400)
    max_bytes = int(
        getattr(settings, "ADMIN_COMPANY_DOCUMENT_UPLOAD_MAX_BYTES", 25 * 1024 * 1024)
    )
    if int(getattr(f, "size", 0) or 0) <= 0:
        return _api_error("empty_file", status=400)
    if int(getattr(f, "size", 0) or 0) > max_bytes:
        return _api_error("file_too_large", status=413, details={"maxBytes": max_bytes})

    original_name = str(getattr(f, "name", "") or "")
    filename = original_name.lower()
    blocked_exts = {
        ".exe",
        ".bat",
        ".cmd",
        ".ps1",
        ".psm1",
        ".sh",
        ".php",
        ".py",
        ".js",
        ".html",
        ".htm",
        ".vbs",
        ".wsf",
        ".jar",
        ".dll",
        ".com",
        ".scr",
    }
    ext = Path(filename).suffix.lower()
    if ext in blocked_exts:
        return _api_error("invalid_file_type", status=400)
    allowed_exts = {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
        ".rtf",
        ".odt",
        ".ods",
        ".odp",
        ".zip",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }
    allowed_mimes = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        "application/rtf",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.presentation",
        "application/zip",
        "image/jpeg",
        "image/png",
        "image/webp",
    }
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    content_type = str(getattr(f, "content_type", "") or "").lower()
    if content_type and content_type not in allowed_mimes:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedMimeTypes": sorted(allowed_mimes)},
        )

    try:
        f.name = _safe_uploaded_filename(original_name, allowed_exts=allowed_exts)
    except Exception:
        pass

    title = str(request.POST.get("title") or getattr(f, "name", "") or "document")
    try:
        from wagtail.documents import get_document_model
        from wagtail.models import Collection

        DocumentModel = get_document_model()
        root_collection = Collection.get_first_root_node()
        doc = DocumentModel(title=title, file=f, collection=root_collection)
        doc.save()

        last = (
            CompanyDocument.objects.filter(category=category)
            .order_by("-sort_order", "-id")
            .first()
        )
        sort_order = int(getattr(last, "sort_order", -1) or -1) + 1
        row = CompanyDocument.objects.create(
            category=category,
            title=str(request.POST.get("rowTitle") or title or ""),
            document=doc,
            uploaded_by=getattr(request, "user", None),
            sort_order=sort_order,
        )
        url = ""
        try:
            url = _abs_url(request, doc.file.url) if getattr(doc, "file", None) else ""
        except Exception:
            url = ""
        return _api_ok(
            {"id": row.id, "documentId": doc.id, "url": url, "title": row.title, "category": row.category}
        )
    except Exception:
        return _api_error("upload_failed", status=400)


@require_POST
def admin_company_documents_remove(request: HttpRequest, item_id: int) -> JsonResponse:
    row = CompanyDocument.objects.filter(pk=item_id).first()
    if not row:
        return _api_error("not_found", status=404)
    category = str(getattr(row, "category", "") or "").strip()
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden
    row.delete()
    return _api_ok()


@require_POST
def admin_company_documents_update(request: HttpRequest, item_id: int) -> JsonResponse:
    row = CompanyDocument.objects.filter(pk=item_id).first()
    if not row:
        return _api_error("not_found", status=404)
    category = str(getattr(row, "category", "") or "").strip()
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden
    data = _read_json(request)
    updated_fields: list[str] = []
    if data.get("title") is not None:
        row.title = str(data.get("title") or "")
        updated_fields.append("title")
    if data.get("sortOrder") is not None:
        sort_order_raw = data.get("sortOrder")
        try:
            row.sort_order = int(str(sort_order_raw))
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
        updated_fields.append("sort_order")
    if updated_fields:
        row.save(update_fields=updated_fields)
    return _api_ok()


@require_POST
def admin_company_documents_reorder(request: HttpRequest) -> JsonResponse:
    data = _read_json(request)
    category = str(data.get("category") or "").strip()
    allowed = {
        CompanyDocument.CATEGORY_TEMPLATE,
        CompanyDocument.CATEGORY_LETTERHEAD,
        CompanyDocument.CATEGORY_INVOICE,
        CompanyDocument.CATEGORY_RECEIPT,
        CompanyDocument.CATEGORY_COMPANY_DOCUMENT,
        CompanyDocument.CATEGORY_COMPANY_CERTIFICATE,
    }
    if category not in allowed:
        return _api_error("invalid_category", status=400)
    forbidden = (
        _require_accounting(request)
        if category
        in {
            CompanyDocument.CATEGORY_INVOICE,
            CompanyDocument.CATEGORY_RECEIPT,
        }
        else _require_registration(request)
    )
    if forbidden:
        return forbidden
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
    rows = CompanyDocument.objects.filter(category=category, pk__in=cleaned)
    by_id = {r.id: r for r in rows}
    with transaction.atomic():
        for idx, rid in enumerate(cleaned):
            r = by_id.get(rid)
            if not r:
                continue
            r.sort_order = idx
            r.save(update_fields=["sort_order"])
    return _api_ok()


@require_POST
def admin_image_upload(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="admin_image_upload", limit=24, window_seconds=300)
    if limited:
        return limited
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return _api_error("missing_file", status=400)
    max_bytes = int(getattr(settings, "ADMIN_IMAGE_UPLOAD_MAX_BYTES", 5 * 1024 * 1024))
    if int(getattr(f, "size", 0) or 0) <= 0:
        return _api_error("empty_file", status=400)
    if int(getattr(f, "size", 0) or 0) > max_bytes:
        return _api_error("file_too_large", status=413, details={"maxBytes": max_bytes})

    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    allowed_mimes = {"image/jpeg", "image/png", "image/webp"}
    original_name = str(getattr(f, "name", "") or "")
    ext = Path(original_name).suffix.lower()
    content_type = str(getattr(f, "content_type", "") or "").lower()
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    if content_type and content_type not in allowed_mimes:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedMimeTypes": sorted(allowed_mimes)},
        )

    try:
        f.name = _safe_uploaded_filename(original_name, allowed_exts=allowed_exts)
    except Exception:
        pass

    title = str(request.POST.get("title") or getattr(f, "name", "") or "image")
    try:
        try:
            f.seek(0)
        except Exception:
            pass
        img_probe = Image.open(f)
        img_probe.verify()
        try:
            f.seek(0)
        except Exception:
            pass
    except Exception:
        return _api_error("invalid_image", status=400)
    try:
        from wagtail.images import get_image_model
        from wagtail.models import Collection

        ImageModel = get_image_model()
        root_collection = Collection.get_first_root_node()
        img = ImageModel(title=title, file=f, collection=root_collection)
        img.save()
        return _api_ok(
            {
                "id": img.id,
                "url": _image_url(request, img),
                "thumbUrl": _image_rendition_url(request, img, "fill-320x240|jpegquality-70"),
                "mediumUrl": _image_rendition_url(request, img, "fill-960x720|jpegquality-80"),
                "largeUrl": _image_rendition_url(request, img, "max-1920x1920|jpegquality-85"),
                "title": img.title,
            }
        )
    except Exception:
        return _api_error("upload_failed", status=400)


@require_GET
def admin_media_images(request: HttpRequest) -> JsonResponse:
    forbidden = _require_registration(request)
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
        return _api_error("images_unavailable", status=400)

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
                "thumbUrl": _image_rendition_url(request, img, "fill-320x240|jpegquality-70"),
                "mediumUrl": _image_rendition_url(request, img, "fill-960x720|jpegquality-80"),
                "largeUrl": _image_rendition_url(request, img, "max-1920x1920|jpegquality-85"),
                "width": int(getattr(img, "width", 0) or 0),
                "height": int(getattr(img, "height", 0) or 0),
                "createdAt": str(getattr(img, "created_at", "") or ""),
            }
        )
    return _api_ok({"items": items, "total": total, "limit": limit, "offset": offset})


@require_POST
def admin_media_images_delete(request: HttpRequest, image_id: int) -> JsonResponse:
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=image_id).first()
    except Exception:
        img = None
    if not img:
        return _api_error("not_found", status=404)
    try:
        img.delete()
    except Exception:
        return _api_error("delete_failed", status=400)
    return _api_ok()


@require_GET
def admin_media_documents(request: HttpRequest) -> JsonResponse:
    forbidden = _require_registration(request)
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
        return _api_error("documents_unavailable", status=400)

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
    return _api_ok({"items": items, "total": total, "limit": limit, "offset": offset})


@require_POST
def admin_media_documents_upload(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="admin_document_upload", limit=24, window_seconds=300)
    if limited:
        return limited
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return _api_error("missing_file", status=400)
    max_bytes = int(getattr(settings, "ADMIN_DOCUMENT_UPLOAD_MAX_BYTES", 20 * 1024 * 1024))
    if int(getattr(f, "size", 0) or 0) <= 0:
        return _api_error("empty_file", status=400)
    if int(getattr(f, "size", 0) or 0) > max_bytes:
        return _api_error("file_too_large", status=413, details={"maxBytes": max_bytes})
    original_name = str(getattr(f, "name", "") or "")
    filename = original_name.lower()
    blocked_exts = {
        ".exe",
        ".bat",
        ".cmd",
        ".ps1",
        ".psm1",
        ".sh",
        ".php",
        ".py",
        ".js",
        ".html",
        ".htm",
        ".vbs",
        ".wsf",
        ".jar",
        ".dll",
        ".com",
        ".scr",
    }
    ext = Path(filename).suffix.lower()
    if ext in blocked_exts:
        return _api_error("invalid_file_type", status=400)

    allowed_exts = {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
        ".rtf",
        ".odt",
        ".ods",
        ".odp",
        ".zip",
    }
    allowed_mimes = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        "application/rtf",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.presentation",
        "application/zip",
    }
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    content_type = str(getattr(f, "content_type", "") or "").lower()
    if content_type and content_type not in allowed_mimes:
        return _api_error(
            "invalid_file_type",
            status=400,
            details={"allowedMimeTypes": sorted(allowed_mimes)},
        )

    try:
        f.name = _safe_uploaded_filename(original_name, allowed_exts=allowed_exts)
    except Exception:
        pass

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
        return _api_ok({"id": doc.id, "url": url, "title": doc.title})
    except Exception:
        return _api_error("upload_failed", status=400)


@require_POST
def admin_media_documents_delete(request: HttpRequest, doc_id: int) -> JsonResponse:
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    try:
        from wagtail.documents import get_document_model

        DocumentModel = get_document_model()
        doc = DocumentModel.objects.filter(pk=doc_id).first()
    except Exception:
        doc = None
    if not doc:
        return _api_error("not_found", status=404)
    try:
        doc.delete()
    except Exception:
        return _api_error("delete_failed", status=400)
    return _api_ok()


@require_POST
def admin_backup_export(request: HttpRequest) -> HttpResponse | JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(request, scope="admin_backup_export", limit=3, window_seconds=600)
    if limited:
        return limited

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
        return _api_error("export_failed", status=400)

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
    limited = _check_rate_limit(request, scope="admin_backup_import", limit=3, window_seconds=600)
    if limited:
        return limited
    f = request.FILES.get("file")
    if not f:
        return _api_error("missing_file", status=400)

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
            tmp.write(f.read())
            tmp_path = tmp.name
    except Exception:
        return _api_error("invalid_file", status=400)

    try:
        with transaction.atomic():
            call_command("loaddata", tmp_path, verbosity=0)
    except Exception:
        return _api_error("import_failed", status=400)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    return _api_ok()


def admin_backup_portal(request: HttpRequest) -> HttpResponse | StreamingHttpResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False) or not getattr(user, "is_superuser", False):
        return HttpResponse("forbidden", status=403, content_type="text/plain; charset=utf-8")

    if request.method == "GET" and str(request.GET.get("export") or "") == "1":
        out = StringIO()
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
        payload = out.getvalue()
        ts = time.strftime("%Y%m%d-%H%M%S")
        resp = HttpResponse(payload, content_type="application/json; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="backup-{ts}.json"'
        return resp

    if request.method == "GET" and str(request.GET.get("export_media") or "") == "1":
        media_root = Path(settings.MEDIA_ROOT).resolve()
        ts = time.strftime("%Y%m%d-%H%M%S")

        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
                tmp_path = tmp.name

            with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                if media_root.exists():
                    for root, _dirs, files in os.walk(str(media_root)):
                        for filename in files:
                            full_path = Path(root) / filename
                            try:
                                rel = full_path.resolve().relative_to(media_root)
                            except Exception:
                                continue
                            zf.write(str(full_path), arcname=str(rel).replace("\\", "/"))

            def _stream() -> Iterator[bytes]:
                try:
                    with open(tmp_path, "rb") as f:
                        while True:
                            chunk = f.read(1024 * 1024)
                            if not chunk:
                                break
                            yield chunk
                finally:
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

            stream_resp = StreamingHttpResponse(_stream(), content_type="application/zip")
            stream_resp["Content-Disposition"] = f'attachment; filename="media-{ts}.zip"'
            return stream_resp
        except Exception:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            return HttpResponse(
                "export_failed",
                status=400,
                content_type="text/plain; charset=utf-8",
            )

    status_msg = ""
    if request.method == "POST":
        backup_file = request.FILES.get("backup_file")
        if backup_file:
            tmp_path = ""
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
                    tmp.write(backup_file.read())
                    tmp_path = tmp.name
                with transaction.atomic():
                    call_command("loaddata", tmp_path, verbosity=0)
                status_msg = "تمت استعادة بيانات قاعدة البيانات بنجاح."
            except Exception:
                status_msg = "فشلت استعادة قاعدة البيانات."
            finally:
                if tmp_path:
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

        media_zip = request.FILES.get("media_zip")
        if media_zip:
            try:
                media_root = Path(settings.MEDIA_ROOT).resolve()
                media_root.mkdir(parents=True, exist_ok=True)
                extracted = 0
                with zipfile.ZipFile(media_zip) as zf:
                    for info in zf.infolist():
                        if info.is_dir():
                            continue
                        name = str(info.filename or "")
                        if not name or name.endswith("/"):
                            continue
                        dest = (media_root / name).resolve()
                        if media_root not in dest.parents and dest != media_root:
                            continue
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(info) as src, open(dest, "wb") as out_f:
                            out_f.write(src.read())
                        extracted += 1
                status_msg = (
                    status_msg + " " if status_msg else ""
                ) + f"تم رفع ملفات media: {extracted} ملف."
            except Exception:
                status_msg = (status_msg + " " if status_msg else "") + "فشل رفع ملفات media."

    csrf_token = get_token(request)
    html = f"""<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>استعادة/نسخ احتياطي</title>
    <style>
      body {{ font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; padding: 32px; }}
      .box {{ max-width: 840px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }}
      h1 {{ margin: 0 0 12px; font-size: 18px; }}
      h2 {{ margin: 18px 0 10px; font-size: 16px; }}
      p {{ margin: 0 0 10px; color: #374151; line-height: 1.6; }}
      .row {{ display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }}
      input[type=file] {{ max-width: 100%; }}
      button, a.btn {{ display: inline-block; border: 1px solid #d1d5db; background: #fff; padding: 8px 12px; border-radius: 10px; text-decoration: none; color: #111827; cursor: pointer; }}
      .msg {{ margin-top: 12px; padding: 10px 12px; background: #f3f4f6; border-radius: 10px; }}
      code {{ background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }}
    </style>
  </head>
  <body>
    <div class="box">
      <h1>نسخ احتياطي / استعادة (سوبر أدمن)</h1>
      <p>هذه الصفحة تعمل بدون واجهة React. استخدمها إذا كانت صفحات <code>/</code> أو <code>/control</code> تظهر فارغة.</p>
      <div class="row">
        <a class="btn" href="/admin-backup/?export=1">تنزيل نسخة احتياطية (JSON)</a>
        <a class="btn" href="/admin-backup/?export_media=1">تنزيل ملفات media (ZIP)</a>
        <a class="btn" href="/django-admin/">فتح Django Admin</a>
      </div>

      <h2>استعادة قاعدة البيانات</h2>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrfmiddlewaretoken" value="{csrf_token}">
        <div class="row">
          <input type="file" name="backup_file" accept=".json,application/json" required>
          <button type="submit">استعادة</button>
        </div>
      </form>

      <h2>رفع ملفات الصور/المرفقات (media.zip)</h2>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrfmiddlewaretoken" value="{csrf_token}">
        <div class="row">
          <input type="file" name="media_zip" accept=".zip,application/zip" required>
          <button type="submit">رفع</button>
        </div>
        <p>ارفع ملف ZIP يحتوي نفس بنية مجلد <code>media/</code> من جهازك.</p>
      </form>

      {f'<div class="msg">{status_msg}</div>' if status_msg else ''}
    </div>
  </body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(max(12, length)))


@require_POST
def admin_users(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(request, scope="admin_users", limit=12, window_seconds=600)
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
    qs = User.objects.filter(is_staff=True).prefetch_related("groups").order_by("username", "id")[:limit]
    user_ids = [int(u.id) for u in qs]
    worker_map: dict[int, int] = {}
    try:
        for row in Worker.objects.filter(user_id__in=user_ids).values("user_id", "id"):
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


@require_POST
def analyze_design(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="ai_analyze_design", limit=30, window_seconds=900)
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
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
                return _api_ok(parsed)
        except Exception:
            pass

    return _api_ok(_design_analysis_fallback(project_type, area_m2, description))


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


@require_POST
def generate_content(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="ai_generate_content", limit=30, window_seconds=900)
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
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

    return _api_ok({"content": text})


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


@require_POST
def calculate(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="calculate", limit=90, window_seconds=300)
    if limited:
        return limited
    data = _read_json(request)
    project_type = str(data.get("projectType") or "").strip()
    try:
        area = float(data.get("area") or 0.0)
    except Exception:
        area = 0.0
    try:
        floors = int(data.get("floors") or 1)
    except Exception:
        floors = 1
    currency = str(data.get("currency") or "").strip().upper()
    settings_obj = _get_calc_settings(request)
    try:
        return _api_ok(_calculator_response(project_type, area, floors, settings_obj, currency=currency))
    except Exception:
        return _api_error("calculation_failed", status=400)


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


@require_POST
def generate_visualization(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(request, scope="ai_generate_visualization", limit=30, window_seconds=900)
    if limited:
        return limited
    forbidden = _require_restricted_tools(request)
    if forbidden:
        return forbidden
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
    return _api_ok({"image": encoded, "mimeType": "image/png"})


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


@require_POST
def chat(request: HttpRequest) -> StreamingHttpResponse | JsonResponse:
    limited = _check_rate_limit(request, scope="ai_chat", limit=90, window_seconds=900)
    if limited:
        return limited
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
        return _api_error("site_not_found", status=400)
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


def site_config(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
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


def site_home(request: HttpRequest) -> JsonResponse:
    site = _get_site(request)
    if not site:
        return _api_error("site_not_found", status=400)
    home = HomePageSettings.for_site(site)
    bg_url = ""
    if home.hero_background_image and getattr(home.hero_background_image, "file", None):
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


def _site_root(request: HttpRequest) -> Page | None:
    site = _get_site(request)
    if not site:
        return None
    return site.root_page


def site_services(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return _api_error("site_not_found", status=400)
    services_index = root.get_children().live().filter(slug="services").first()
    if not services_index:
        return _api_ok({"items": []})
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
    return _api_ok({"items": items})


def site_projects(request: HttpRequest) -> JsonResponse:
    root = _site_root(request)
    if not root:
        return _api_error("site_not_found", status=400)
    projects_index = root.get_children().live().filter(slug="projects").first()
    if not projects_index:
        return _api_ok({"items": []})
    status = str(request.GET.get("status") or "").strip()
    if status and status not in {ProjectPage.STATUS_ONGOING, ProjectPage.STATUS_COMPLETED}:
        return _api_error("invalid_project_status", status=400)
    pages = (
        ProjectPage.objects.child_of(projects_index)
        .live()
        .exclude(status=ProjectPage.STATUS_ARCHIVED)
        .specific()
    )
    if status:
        pages = pages.filter(status=status)
    pages = pages.order_by("path")
    pages = pages.prefetch_related("gallery_images__image")
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
                "status": getattr(p, "status", ProjectPage.STATUS_COMPLETED) or ProjectPage.STATUS_COMPLETED,
                "location": getattr(p, "project_location", "") or "",
                "year": str(getattr(p, "completion_year", "") or ""),
                "imageUrl": cover_url,
            }
        )
    return _api_ok({"items": items})


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
    return _api_ok({"items": items})


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


@require_GET
def admin_ops_clients(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_crm_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for c in Client.objects.all():
        items.append(
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "email": c.email,
                "address": c.address,
                "notes": c.notes,
                "createdAt": _to_iso(c.created_at),
                "updatedAt": _to_iso(c.updated_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_clients_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_crm_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    c = Client.objects.create(
        name=name,
        phone=str(data.get("phone") or "").strip(),
        email=str(data.get("email") or "").strip(),
        address=str(data.get("address") or "").strip(),
        notes=str(data.get("notes") or "").strip(),
    )
    return _api_ok({"id": c.id})


@require_POST
def admin_ops_clients_update(request: HttpRequest, client_id: int) -> JsonResponse:
    forbidden = _require_ops_crm_write(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("name") is not None:
        c.name = str(data.get("name") or "").strip()
    if data.get("phone") is not None:
        c.phone = str(data.get("phone") or "").strip()
    if data.get("email") is not None:
        c.email = str(data.get("email") or "").strip()
    if data.get("address") is not None:
        c.address = str(data.get("address") or "").strip()
    if data.get("notes") is not None:
        c.notes = str(data.get("notes") or "").strip()
    if not c.name:
        return _api_error("missing_name", status=400)
    c.save()
    return _api_ok()


@require_POST
def admin_ops_clients_delete(request: HttpRequest, client_id: int) -> JsonResponse:
    forbidden = _require_ops_crm_write(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    c.delete()
    return _api_ok()


@require_GET
def admin_ops_client_contacts(request: HttpRequest, client_id: int) -> JsonResponse:
    forbidden = _require_ops_crm_read(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for row in ClientContactLog.objects.filter(client=c).select_related("created_by"):
        items.append(
            {
                "id": row.id,
                "kind": row.kind,
                "subject": row.subject,
                "body": row.body,
                "createdAt": _to_iso(row.created_at),
                "createdBy": getattr(row.created_by, "username", "") if row.created_by else "",
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_client_contacts_create(request: HttpRequest, client_id: int) -> JsonResponse:
    forbidden = _require_ops_crm_write(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    kind = str(data.get("kind") or ClientContactLog.KIND_CALL).strip()
    allowed = {k for k, _ in ClientContactLog.KIND_CHOICES}
    if kind not in allowed:
        return _api_error("invalid_kind", status=400)
    row = ClientContactLog.objects.create(
        client=c,
        kind=kind,
        subject=str(data.get("subject") or "").strip(),
        body=str(data.get("body") or "").strip(),
        created_by=getattr(request, "user", None)
        if getattr(getattr(request, "user", None), "is_authenticated", False)
        else None,
    )
    return _api_ok({"id": row.id})


@require_GET
def admin_ops_suppliers(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_procurement_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for s in Supplier.objects.all():
        items.append(
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "phone": s.phone,
                "email": s.email,
                "address": s.address,
                "notes": s.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_suppliers_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    s = Supplier.objects.create(
        name=name,
        category=str(data.get("category") or "").strip(),
        phone=str(data.get("phone") or "").strip(),
        email=str(data.get("email") or "").strip(),
        address=str(data.get("address") or "").strip(),
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_supplier_create",
        entity_type="supplier",
        entity_id=str(s.id),
        after={"id": s.id, "name": s.name},
    )
    return _api_ok({"id": s.id})


@require_POST
def admin_ops_suppliers_update(request: HttpRequest, supplier_id: int) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    s = Supplier.objects.filter(pk=supplier_id).first()
    if not s:
        return _api_error("not_found", status=404)
    before = {
        "name": s.name,
        "category": s.category,
        "phone": s.phone,
        "email": s.email,
        "address": s.address,
        "notes": s.notes,
    }
    data = _read_json(request)
    if data.get("name") is not None:
        s.name = str(data.get("name") or "").strip()
    if data.get("category") is not None:
        s.category = str(data.get("category") or "").strip()
    if data.get("phone") is not None:
        s.phone = str(data.get("phone") or "").strip()
    if data.get("email") is not None:
        s.email = str(data.get("email") or "").strip()
    if data.get("address") is not None:
        s.address = str(data.get("address") or "").strip()
    if data.get("notes") is not None:
        s.notes = str(data.get("notes") or "").strip()
    if not s.name:
        return _api_error("missing_name", status=400)
    s.save()
    after = {
        "name": s.name,
        "category": s.category,
        "phone": s.phone,
        "email": s.email,
        "address": s.address,
        "notes": s.notes,
    }
    _audit_ops(
        request,
        action="ops_supplier_update",
        entity_type="supplier",
        entity_id=str(s.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_suppliers_delete(request: HttpRequest, supplier_id: int) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    s = Supplier.objects.filter(pk=supplier_id).first()
    if not s:
        return _api_error("not_found", status=404)
    before = {"id": s.id, "name": s.name}
    s.delete()
    _audit_ops(
        request,
        action="ops_supplier_delete",
        entity_type="supplier",
        entity_id=str(supplier_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_subcontractors(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_procurement_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for s in Subcontractor.objects.all():
        items.append(
            {
                "id": s.id,
                "name": s.name,
                "specialty": s.specialty,
                "phone": s.phone,
                "email": s.email,
                "address": s.address,
                "notes": s.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_subcontractors_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    s = Subcontractor.objects.create(
        name=name,
        specialty=str(data.get("specialty") or "").strip(),
        phone=str(data.get("phone") or "").strip(),
        email=str(data.get("email") or "").strip(),
        address=str(data.get("address") or "").strip(),
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_subcontractor_create",
        entity_type="subcontractor",
        entity_id=str(s.id),
        after={"id": s.id, "name": s.name},
    )
    return _api_ok({"id": s.id})


@require_POST
def admin_ops_subcontractors_update(
    request: HttpRequest, subcontractor_id: int
) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    s = Subcontractor.objects.filter(pk=subcontractor_id).first()
    if not s:
        return _api_error("not_found", status=404)
    before = {
        "name": s.name,
        "specialty": s.specialty,
        "phone": s.phone,
        "email": s.email,
        "address": s.address,
        "notes": s.notes,
    }
    data = _read_json(request)
    if data.get("name") is not None:
        s.name = str(data.get("name") or "").strip()
    if data.get("specialty") is not None:
        s.specialty = str(data.get("specialty") or "").strip()
    if data.get("phone") is not None:
        s.phone = str(data.get("phone") or "").strip()
    if data.get("email") is not None:
        s.email = str(data.get("email") or "").strip()
    if data.get("address") is not None:
        s.address = str(data.get("address") or "").strip()
    if data.get("notes") is not None:
        s.notes = str(data.get("notes") or "").strip()
    if not s.name:
        return _api_error("missing_name", status=400)
    s.save()
    after = {
        "name": s.name,
        "specialty": s.specialty,
        "phone": s.phone,
        "email": s.email,
        "address": s.address,
        "notes": s.notes,
    }
    _audit_ops(
        request,
        action="ops_subcontractor_update",
        entity_type="subcontractor",
        entity_id=str(s.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_subcontractors_delete(
    request: HttpRequest, subcontractor_id: int
) -> JsonResponse:
    forbidden = _require_ops_procurement_write(request)
    if forbidden:
        return forbidden
    s = Subcontractor.objects.filter(pk=subcontractor_id).first()
    if not s:
        return _api_error("not_found", status=404)
    before = {"id": s.id, "name": s.name}
    s.delete()
    _audit_ops(
        request,
        action="ops_subcontractor_delete",
        entity_type="subcontractor",
        entity_id=str(subcontractor_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_contracts(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_contracts_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    qs = ProjectContract.objects.select_related("client", "project")
    for c in qs:
        items.append(
            {
                "id": c.id,
                "projectId": c.project_id or 0,
                "projectTitle": getattr(c.project, "title", "") if c.project else "",
                "clientId": c.client_id or 0,
                "clientName": c.client.name if c.client else "",
                "title": c.title,
                "number": c.number,
                "status": c.status,
                "startDate": _to_iso(c.start_date),
                "endDate": _to_iso(c.end_date),
                "amount": float(c.amount or 0),
                "notes": c.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_contracts_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_contracts_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    project_id = int(data.get("projectId") or 0) or None
    client_id = int(data.get("clientId") or 0) or None
    project = None
    if project_id:
        project = ProjectPage.objects.filter(pk=project_id).specific().first()
    client = Client.objects.filter(pk=client_id).first() if client_id else None
    try:
        start_date = _to_date(data.get("startDate"))
    except Exception:
        return _api_error("invalid_start_date", status=400)
    try:
        end_date = _to_date(data.get("endDate"))
    except Exception:
        return _api_error("invalid_end_date", status=400)
    status = str(data.get("status") or ProjectContract.STATUS_ACTIVE).strip()
    allowed_status = {k for k, _ in ProjectContract.STATUS_CHOICES}
    if status not in allowed_status:
        return _api_error("invalid_status", status=400)
    if start_date and end_date and end_date < start_date:
        return _api_error("invalid_date_range", status=400)
    amount = _to_dec(data.get("amount"), allow_none=True)
    if amount is not None and amount < 0:
        return _api_error("invalid_amount", status=400)

    row = ProjectContract.objects.create(
        project=project,
        client=client,
        title=str(data.get("title") or "").strip(),
        number=str(data.get("number") or "").strip(),
        status=status,
        start_date=start_date,
        end_date=end_date,
        amount=amount,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_contract_create",
        entity_type="contract",
        entity_id=str(row.id),
        after={
            "id": row.id,
            "projectId": row.project_id,
            "clientId": row.client_id,
            "number": row.number,
            "status": row.status,
            "amount": float(row.amount or 0) if row.amount is not None else None,
        },
    )
    return _api_ok({"id": row.id})


@require_POST
def admin_ops_contracts_update(request: HttpRequest, contract_id: int) -> JsonResponse:
    forbidden = _require_ops_contracts_write(request)
    if forbidden:
        return forbidden
    row = ProjectContract.objects.filter(pk=contract_id).first()
    if not row:
        return _api_error("not_found", status=404)
    before = {
        "projectId": row.project_id,
        "clientId": row.client_id,
        "title": row.title,
        "number": row.number,
        "status": row.status,
        "startDate": _to_iso(row.start_date),
        "endDate": _to_iso(row.end_date),
        "amount": float(row.amount or 0) if row.amount is not None else None,
        "notes": row.notes,
    }
    data = _read_json(request)
    if data.get("projectId") is not None:
        pid = int(data.get("projectId") or 0) or None
        row.project = ProjectPage.objects.filter(pk=pid).specific().first() if pid else None
    if data.get("clientId") is not None:
        cid = int(data.get("clientId") or 0) or None
        row.client = Client.objects.filter(pk=cid).first() if cid else None
    if data.get("title") is not None:
        row.title = str(data.get("title") or "").strip()
    if data.get("number") is not None:
        row.number = str(data.get("number") or "").strip()
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        allowed_status = {k for k, _ in ProjectContract.STATUS_CHOICES}
        if status not in allowed_status:
            return _api_error("invalid_status", status=400)
        row.status = status
    if data.get("startDate") is not None:
        try:
            row.start_date = _to_date(data.get("startDate"))
        except Exception:
            return _api_error("invalid_start_date", status=400)
    if data.get("endDate") is not None:
        try:
            row.end_date = _to_date(data.get("endDate"))
        except Exception:
            return _api_error("invalid_end_date", status=400)
    if data.get("amount") is not None:
        amount = _to_dec(data.get("amount"), allow_none=True)
        if amount is not None and amount < 0:
            return _api_error("invalid_amount", status=400)
        row.amount = amount
    if data.get("notes") is not None:
        row.notes = str(data.get("notes") or "").strip()
    if row.start_date and row.end_date and row.end_date < row.start_date:
        return _api_error("invalid_date_range", status=400)
    row.save()
    after = {
        "projectId": row.project_id,
        "clientId": row.client_id,
        "title": row.title,
        "number": row.number,
        "status": row.status,
        "startDate": _to_iso(row.start_date),
        "endDate": _to_iso(row.end_date),
        "amount": float(row.amount or 0) if row.amount is not None else None,
        "notes": row.notes,
    }
    _audit_ops(
        request,
        action="ops_contract_update",
        entity_type="contract",
        entity_id=str(row.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_contracts_delete(request: HttpRequest, contract_id: int) -> JsonResponse:
    forbidden = _require_ops_contracts_write(request)
    if forbidden:
        return forbidden
    row = ProjectContract.objects.filter(pk=contract_id).first()
    if not row:
        return _api_error("not_found", status=404)
    before = {
        "id": row.id,
        "projectId": row.project_id,
        "clientId": row.client_id,
        "number": row.number,
        "status": row.status,
        "amount": float(row.amount or 0) if row.amount is not None else None,
    }
    row.delete()
    _audit_ops(
        request,
        action="ops_contract_delete",
        entity_type="contract",
        entity_id=str(contract_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_contract_addendums(request: HttpRequest, contract_id: int) -> JsonResponse:
    forbidden = _require_ops_contracts_read(request)
    if forbidden:
        return forbidden
    c = ProjectContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for a in ContractAddendum.objects.filter(contract=c):
        items.append(
            {
                "id": a.id,
                "title": a.title,
                "amountDelta": float(a.amount_delta or 0),
                "startDate": _to_iso(a.start_date),
                "endDate": _to_iso(a.end_date),
                "notes": a.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_contract_addendums_create(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
    forbidden = _require_ops_contracts_write(request)
    if forbidden:
        return forbidden
    c = ProjectContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    try:
        start_date = _to_date(data.get("startDate"))
    except Exception:
        return _api_error("invalid_start_date", status=400)
    try:
        end_date = _to_date(data.get("endDate"))
    except Exception:
        return _api_error("invalid_end_date", status=400)
    a = ContractAddendum.objects.create(
        contract=c,
        title=str(data.get("title") or "").strip(),
        amount_delta=_to_dec(data.get("amountDelta"), allow_none=True),
        start_date=start_date,
        end_date=end_date,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_contract_addendum_create",
        entity_type="contract_addendum",
        entity_id=str(a.id),
        after={
            "id": a.id,
            "contractId": c.id,
            "amountDelta": float(a.amount_delta or 0) if a.amount_delta is not None else None,
            "startDate": _to_iso(a.start_date),
            "endDate": _to_iso(a.end_date),
        },
    )
    return _api_ok({"id": a.id})


@require_GET
def admin_ops_contract_payments(request: HttpRequest, contract_id: int) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    c = ProjectContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for p in ContractPayment.objects.filter(contract=c):
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "dueDate": _to_iso(p.due_date),
                "amount": float(p.amount or 0),
                "paidAmount": float(p.paid_amount or 0),
                "paidDate": _to_iso(p.paid_date),
                "status": p.status,
                "notes": p.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_contract_payments_create(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    c = ProjectContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    try:
        due_date = _to_date(data.get("dueDate"))
    except Exception:
        return _api_error("invalid_due_date", status=400)
    try:
        paid_date = _to_date(data.get("paidDate"))
    except Exception:
        return _api_error("invalid_paid_date", status=400)
    status = str(data.get("status") or ContractPayment.STATUS_PENDING).strip()
    allowed_status = {k for k, _ in ContractPayment.STATUS_CHOICES}
    if status not in allowed_status:
        return _api_error("invalid_status", status=400)
    amount = _to_dec(data.get("amount"), allow_none=True)
    if amount is not None and amount < 0:
        return _api_error("invalid_amount", status=400)
    paid_amount = _to_dec(data.get("paidAmount"), allow_none=True)
    if paid_amount is not None and paid_amount < 0:
        return _api_error("invalid_paid_amount", status=400)
    if paid_amount and paid_amount > 0 and not paid_date:
        return _api_error("invalid_paid_date", status=400)
    if amount is not None and paid_amount is not None and paid_amount > amount:
        return _api_error("invalid_paid_amount", status=400)
    if status == ContractPayment.STATUS_PAID and (paid_amount is None or paid_amount <= 0):
        return _api_error("invalid_paid_amount", status=400)
    p = ContractPayment.objects.create(
        contract=c,
        title=str(data.get("title") or "").strip(),
        due_date=due_date,
        amount=amount,
        paid_amount=paid_amount,
        paid_date=paid_date,
        status=status,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_contract_payment_create",
        entity_type="contract_payment",
        entity_id=str(p.id),
        after={
            "id": p.id,
            "contractId": c.id,
            "dueDate": _to_iso(p.due_date),
            "amount": float(p.amount or 0) if p.amount is not None else None,
            "paidAmount": float(p.paid_amount or 0) if p.paid_amount is not None else None,
            "paidDate": _to_iso(p.paid_date),
            "status": p.status,
        },
    )
    return _api_ok({"id": p.id})


@require_POST
def admin_ops_contract_payments_update(
    request: HttpRequest, payment_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = ContractPayment.objects.filter(pk=payment_id).first()
    if not p:
        return _api_error("not_found", status=404)
    before = {
        "contractId": p.contract_id,
        "title": p.title,
        "dueDate": _to_iso(p.due_date),
        "amount": float(p.amount or 0) if p.amount is not None else None,
        "paidAmount": float(p.paid_amount or 0) if p.paid_amount is not None else None,
        "paidDate": _to_iso(p.paid_date),
        "status": p.status,
        "notes": p.notes,
    }
    data = _read_json(request)
    if data.get("title") is not None:
        p.title = str(data.get("title") or "").strip()
    if data.get("dueDate") is not None:
        try:
            p.due_date = _to_date(data.get("dueDate"))
        except Exception:
            return _api_error("invalid_due_date", status=400)
    if data.get("amount") is not None:
        amount = _to_dec(data.get("amount"), allow_none=True)
        if amount is not None and amount < 0:
            return _api_error("invalid_amount", status=400)
        p.amount = amount
    if data.get("paidAmount") is not None:
        paid_amount = _to_dec(data.get("paidAmount"), allow_none=True)
        if paid_amount is not None and paid_amount < 0:
            return _api_error("invalid_paid_amount", status=400)
        p.paid_amount = paid_amount
    if data.get("paidDate") is not None:
        try:
            p.paid_date = _to_date(data.get("paidDate"))
        except Exception:
            return _api_error("invalid_paid_date", status=400)
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        allowed_status = {k for k, _ in ContractPayment.STATUS_CHOICES}
        if status not in allowed_status:
            return _api_error("invalid_status", status=400)
        p.status = status
    if data.get("notes") is not None:
        p.notes = str(data.get("notes") or "").strip()
    if p.paid_amount is not None and p.paid_amount > 0 and not p.paid_date:
        return _api_error("invalid_paid_date", status=400)
    if p.amount is not None and p.paid_amount is not None and p.paid_amount > p.amount:
        return _api_error("invalid_paid_amount", status=400)
    if p.status == ContractPayment.STATUS_PAID and (p.paid_amount is None or p.paid_amount <= 0):
        return _api_error("invalid_paid_amount", status=400)
    p.save()
    after = {
        "contractId": p.contract_id,
        "title": p.title,
        "dueDate": _to_iso(p.due_date),
        "amount": float(p.amount or 0) if p.amount is not None else None,
        "paidAmount": float(p.paid_amount or 0) if p.paid_amount is not None else None,
        "paidDate": _to_iso(p.paid_date),
        "status": p.status,
        "notes": p.notes,
    }
    _audit_ops(
        request,
        action="ops_contract_payment_update",
        entity_type="contract_payment",
        entity_id=str(p.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_contract_payments_delete(
    request: HttpRequest, payment_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = ContractPayment.objects.filter(pk=payment_id).first()
    if not p:
        return _api_error("not_found", status=404)
    before = {
        "id": p.id,
        "contractId": p.contract_id,
        "amount": float(p.amount or 0) if p.amount is not None else None,
        "paidAmount": float(p.paid_amount or 0) if p.paid_amount is not None else None,
        "status": p.status,
    }
    p.delete()
    _audit_ops(
        request,
        action="ops_contract_payment_delete",
        entity_type="contract_payment",
        entity_id=str(payment_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_purchase_orders(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    qs = PurchaseOrder.objects.select_related("supplier", "project")
    for po in qs:
        items.append(
            {
                "id": po.id,
                "supplierId": po.supplier_id or 0,
                "supplierName": po.supplier.name if po.supplier else "",
                "projectId": po.project_id or 0,
                "projectTitle": getattr(po.project, "title", "") if po.project else "",
                "number": po.number,
                "date": _to_iso(po.date),
                "status": po.status,
                "totalAmount": float(po.total_amount or 0),
                "notes": po.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_purchase_orders_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    supplier_id = int(data.get("supplierId") or 0) or None
    project_id = int(data.get("projectId") or 0) or None
    supplier = Supplier.objects.filter(pk=supplier_id).first() if supplier_id else None
    project = ProjectPage.objects.filter(pk=project_id).specific().first() if project_id else None
    try:
        po_date = _to_date(data.get("date"))
    except Exception:
        return _api_error("invalid_date", status=400)
    status = str(data.get("status") or PurchaseOrder.STATUS_DRAFT).strip()
    allowed_status = {k for k, _ in PurchaseOrder.STATUS_CHOICES}
    if status not in allowed_status:
        return _api_error("invalid_status", status=400)
    total_amount = _to_dec(data.get("totalAmount"), allow_none=True)
    if total_amount is not None and total_amount < 0:
        return _api_error("invalid_total_amount", status=400)
    po = PurchaseOrder.objects.create(
        supplier=supplier,
        project=project,
        number=str(data.get("number") or "").strip(),
        date=po_date,
        status=status,
        total_amount=total_amount,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="ops_purchase_order_create",
        entity_type="purchase_order",
        entity_id=str(po.id),
        after={
            "id": po.id,
            "supplierId": po.supplier_id,
            "projectId": po.project_id,
            "number": po.number,
            "date": _to_iso(po.date),
            "status": po.status,
            "totalAmount": float(po.total_amount or 0) if po.total_amount is not None else None,
        },
    )
    return _api_ok({"id": po.id})


@require_POST
def admin_ops_purchase_orders_update(
    request: HttpRequest, purchase_order_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    po = PurchaseOrder.objects.filter(pk=purchase_order_id).first()
    if not po:
        return _api_error("not_found", status=404)
    before = {
        "supplierId": po.supplier_id,
        "projectId": po.project_id,
        "number": po.number,
        "date": _to_iso(po.date),
        "status": po.status,
        "totalAmount": float(po.total_amount or 0) if po.total_amount is not None else None,
        "notes": po.notes,
    }
    data = _read_json(request)
    if data.get("supplierId") is not None:
        sid = int(data.get("supplierId") or 0) or None
        po.supplier = Supplier.objects.filter(pk=sid).first() if sid else None
    if data.get("projectId") is not None:
        pid = int(data.get("projectId") or 0) or None
        po.project = ProjectPage.objects.filter(pk=pid).specific().first() if pid else None
    if data.get("number") is not None:
        po.number = str(data.get("number") or "").strip()
    if data.get("date") is not None:
        try:
            po.date = _to_date(data.get("date"))
        except Exception:
            return _api_error("invalid_date", status=400)
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        allowed_status = {k for k, _ in PurchaseOrder.STATUS_CHOICES}
        if status not in allowed_status:
            return _api_error("invalid_status", status=400)
        po.status = status
    if data.get("totalAmount") is not None:
        total_amount = _to_dec(data.get("totalAmount"), allow_none=True)
        if total_amount is not None and total_amount < 0:
            return _api_error("invalid_total_amount", status=400)
        po.total_amount = total_amount
    if data.get("notes") is not None:
        po.notes = str(data.get("notes") or "").strip()
    po.save()
    after = {
        "supplierId": po.supplier_id,
        "projectId": po.project_id,
        "number": po.number,
        "date": _to_iso(po.date),
        "status": po.status,
        "totalAmount": float(po.total_amount or 0) if po.total_amount is not None else None,
        "notes": po.notes,
    }
    _audit_ops(
        request,
        action="ops_purchase_order_update",
        entity_type="purchase_order",
        entity_id=str(po.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_purchase_orders_delete(
    request: HttpRequest, purchase_order_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    po = PurchaseOrder.objects.filter(pk=purchase_order_id).first()
    if not po:
        return _api_error("not_found", status=404)
    before = {
        "id": po.id,
        "supplierId": po.supplier_id,
        "projectId": po.project_id,
        "number": po.number,
        "status": po.status,
        "totalAmount": float(po.total_amount or 0) if po.total_amount is not None else None,
    }
    po.delete()
    _audit_ops(
        request,
        action="ops_purchase_order_delete",
        entity_type="purchase_order",
        entity_id=str(purchase_order_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_inventory_items(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for it in InventoryItem.objects.all():
        items.append(
            {
                "id": it.id,
                "sku": it.sku,
                "name": it.name,
                "unit": it.unit,
                "currentQty": float(it.current_qty or 0),
                "reorderLevel": float(it.reorder_level or 0) if it.reorder_level is not None else None,
                "notes": it.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_inventory_items_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    it = InventoryItem.objects.create(
        sku=str(data.get("sku") or "").strip(),
        name=name,
        unit=str(data.get("unit") or "").strip(),
        current_qty=_to_dec(data.get("currentQty"), allow_none=False) or Decimal("0"),
        reorder_level=_to_dec(data.get("reorderLevel"), allow_none=True),
        notes=str(data.get("notes") or "").strip(),
    )
    if it.current_qty is not None and it.current_qty < 0:
        it.delete()
        return _api_error("invalid_quantity", status=400)
    if it.reorder_level is not None and it.reorder_level < 0:
        it.delete()
        return _api_error("invalid_quantity", status=400)
    _audit_ops(
        request,
        action="ops_inventory_item_create",
        entity_type="inventory_item",
        entity_id=str(it.id),
        after={"id": it.id, "name": it.name, "currentQty": float(it.current_qty or 0)},
    )
    return _api_ok({"id": it.id})


@require_POST
def admin_ops_inventory_items_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    it = InventoryItem.objects.filter(pk=item_id).first()
    if not it:
        return _api_error("not_found", status=404)
    before = {
        "sku": it.sku,
        "name": it.name,
        "unit": it.unit,
        "currentQty": float(it.current_qty or 0),
        "reorderLevel": float(it.reorder_level or 0) if it.reorder_level is not None else None,
        "notes": it.notes,
    }
    data = _read_json(request)
    if data.get("sku") is not None:
        it.sku = str(data.get("sku") or "").strip()
    if data.get("name") is not None:
        it.name = str(data.get("name") or "").strip()
    if data.get("unit") is not None:
        it.unit = str(data.get("unit") or "").strip()
    if data.get("currentQty") is not None:
        it.current_qty = _to_dec(data.get("currentQty"), allow_none=False) or Decimal("0")
    if data.get("reorderLevel") is not None:
        it.reorder_level = _to_dec(data.get("reorderLevel"), allow_none=True)
    if data.get("notes") is not None:
        it.notes = str(data.get("notes") or "").strip()
    if not it.name:
        return _api_error("missing_name", status=400)
    if it.current_qty is not None and it.current_qty < 0:
        return _api_error("invalid_quantity", status=400)
    if it.reorder_level is not None and it.reorder_level < 0:
        return _api_error("invalid_quantity", status=400)
    it.save()
    after = {
        "sku": it.sku,
        "name": it.name,
        "unit": it.unit,
        "currentQty": float(it.current_qty or 0),
        "reorderLevel": float(it.reorder_level or 0) if it.reorder_level is not None else None,
        "notes": it.notes,
    }
    _audit_ops(
        request,
        action="ops_inventory_item_update",
        entity_type="inventory_item",
        entity_id=str(it.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_inventory_items_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    it = InventoryItem.objects.filter(pk=item_id).first()
    if not it:
        return _api_error("not_found", status=404)
    before = {"id": it.id, "name": it.name, "currentQty": float(it.current_qty or 0)}
    it.delete()
    _audit_ops(
        request,
        action="ops_inventory_item_delete",
        entity_type="inventory_item",
        entity_id=str(item_id),
        before=before,
    )
    return _api_ok()


@require_GET
def admin_ops_inventory_transactions(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    item_id = int(request.GET.get("itemId") or 0) or None
    qs = InventoryTransaction.objects.select_related("item", "project")
    if item_id:
        qs = qs.filter(item_id=item_id)
    items: list[dict[str, Any]] = []
    for t in qs:
        items.append(
            {
                "id": t.id,
                "itemId": t.item_id,
                "itemName": t.item.name if t.item else "",
                "projectId": t.project_id or 0,
                "projectTitle": getattr(t.project, "title", "") if t.project else "",
                "kind": t.kind,
                "quantity": float(t.quantity or 0),
                "unitCost": float(t.unit_cost or 0) if t.unit_cost is not None else None,
                "date": _to_iso(t.date),
                "reference": t.reference,
                "notes": t.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_inventory_transactions_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    item_id = int(data.get("itemId") or 0) or 0
    it = InventoryItem.objects.filter(pk=item_id).first()
    if not it:
        return _api_error("invalid_item", status=400)
    kind = str(data.get("kind") or InventoryTransaction.KIND_IN).strip()
    allowed = {k for k, _ in InventoryTransaction.KIND_CHOICES}
    if kind not in allowed:
        return _api_error("invalid_kind", status=400)
    qty = _to_dec(data.get("quantity"), allow_none=False)
    if qty is None:
        return _api_error("invalid_quantity", status=400)
    if qty <= 0:
        return _api_error("invalid_quantity", status=400)
    unit_cost = _to_dec(data.get("unitCost"), allow_none=True)
    if unit_cost is not None and unit_cost < 0:
        return _api_error("invalid_unit_cost", status=400)
    project_id = int(data.get("projectId") or 0) or None
    project = ProjectPage.objects.filter(pk=project_id).specific().first() if project_id else None
    user = getattr(request, "user", None)
    created_by = user if user and getattr(user, "is_authenticated", False) else None
    try:
        tx_date = _to_date(data.get("date"))
    except Exception:
        return _api_error("invalid_date", status=400)

    with transaction.atomic():
        it = InventoryItem.objects.select_for_update().filter(pk=it.id).first() or it
        if kind == InventoryTransaction.KIND_OUT:
            current = it.current_qty or Decimal("0")
            if (current - qty) < 0:
                return _api_error("insufficient_stock", status=400)
        if kind == InventoryTransaction.KIND_ADJUST and qty < 0:
            return _api_error("invalid_quantity", status=400)
        t = InventoryTransaction.objects.create(
            item=it,
            project=project,
            kind=kind,
            quantity=qty,
            unit_cost=unit_cost,
            date=tx_date,
            reference=str(data.get("reference") or "").strip(),
            notes=str(data.get("notes") or "").strip(),
            created_by=created_by,
        )
        if kind == InventoryTransaction.KIND_IN:
            it.current_qty = (it.current_qty or Decimal("0")) + qty
        elif kind == InventoryTransaction.KIND_OUT:
            it.current_qty = (it.current_qty or Decimal("0")) - qty
        else:
            it.current_qty = qty
        it.save(update_fields=["current_qty", "updated_at"])
    _audit_ops(
        request,
        action="ops_inventory_tx_create",
        entity_type="inventory_transaction",
        entity_id=str(t.id),
        after={
            "id": t.id,
            "itemId": it.id,
            "projectId": project.id if project else 0,
            "kind": t.kind,
            "quantity": float(t.quantity or 0),
            "unitCost": float(t.unit_cost or 0) if t.unit_cost is not None else None,
            "date": _to_iso(t.date),
            "reference": t.reference,
            "resultingQty": float(it.current_qty or 0),
        },
    )
    return _api_ok({"id": t.id})


@require_GET
def admin_ops_workers(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_workers_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    user = getattr(request, "user", None)
    role = _user_role(user)
    qs = Worker.objects.select_related("user")
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
        except Exception:
            linked_id = 0
        if linked_id:
            qs = qs.filter(pk=linked_id)
        else:
            qs = qs.none()
    for w in qs.all():
        items.append(
            {
                "id": w.id,
                "userId": int(getattr(w, "user_id", None) or 0),
                "userUsername": getattr(getattr(w, "user", None), "username", "") if getattr(w, "user_id", None) else "",
                "name": w.name,
                "role": w.role,
                "phone": w.phone,
                "timeClockId": w.time_clock_id or "",
                "kind": w.kind,
                "active": bool(w.active),
                "dailyCost": float(w.daily_cost or 0) if w.daily_cost is not None else None,
                "monthlySalary": float(w.monthly_salary or 0) if w.monthly_salary is not None else None,
                "notes": w.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_workers_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_workers_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    kind = str(data.get("kind") or Worker.KIND_WORKER).strip() or Worker.KIND_WORKER
    if kind not in {Worker.KIND_WORKER, Worker.KIND_EMPLOYEE}:
        return _api_error("invalid_kind", status=400)
    time_clock_id = None
    if data.get("timeClockId") is not None:
        raw = str(data.get("timeClockId") or "").strip()
        time_clock_id = raw or None
        if time_clock_id and Worker.objects.filter(time_clock_id=time_clock_id).exists():
            return _api_error("duplicate_time_clock_id", status=409)
    active_raw = data.get("active")
    active = bool(active_raw) if active_raw is not None else True
    user_obj = None
    if data.get("userId") is not None:
        try:
            user_id = int(data.get("userId") or 0) or 0
        except Exception:
            user_id = 0
        if user_id:
            User = get_user_model()
            user_obj = User.objects.filter(pk=user_id, is_staff=True).first()
            if not user_obj:
                return _api_error("user_not_found", status=404)
            if Worker.objects.filter(user=user_obj).exists():
                return _api_error("user_already_linked", status=409)
    try:
        w = Worker.objects.create(
            user=user_obj,
            name=name,
            role=str(data.get("role") or "").strip(),
            phone=str(data.get("phone") or "").strip(),
            time_clock_id=time_clock_id,
            kind=kind,
            active=active,
            daily_cost=_to_dec(data.get("dailyCost"), allow_none=True),
            monthly_salary=_to_dec(data.get("monthlySalary"), allow_none=True),
            notes=str(data.get("notes") or "").strip(),
        )
    except IntegrityError:
        return _api_error("duplicate_time_clock_id", status=409)
    _audit_ops(
        request,
        action="ops_worker_create",
        entity_type="worker",
        entity_id=str(w.id),
        after={
            "id": w.id,
            "userId": int(getattr(w, "user_id", None) or 0),
            "timeClockId": w.time_clock_id or "",
        },
    )
    return _api_ok({"id": w.id})


@require_POST
def admin_ops_workers_update(request: HttpRequest, worker_id: int) -> JsonResponse:
    forbidden = _require_ops_workers_write(request)
    if forbidden:
        return forbidden
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("not_found", status=404)
    before = {
        "userId": int(getattr(w, "user_id", None) or 0),
        "name": w.name,
        "role": w.role,
        "phone": w.phone,
        "timeClockId": w.time_clock_id or "",
        "kind": w.kind,
        "active": bool(w.active),
        "dailyCost": float(w.daily_cost or 0) if w.daily_cost is not None else None,
        "monthlySalary": float(w.monthly_salary or 0) if w.monthly_salary is not None else None,
        "notes": w.notes,
    }
    data = _read_json(request)
    if data.get("name") is not None:
        w.name = str(data.get("name") or "").strip()
    if data.get("role") is not None:
        w.role = str(data.get("role") or "").strip()
    if data.get("phone") is not None:
        w.phone = str(data.get("phone") or "").strip()
    if data.get("timeClockId") is not None:
        raw = str(data.get("timeClockId") or "").strip()
        time_clock_id = raw or None
        if time_clock_id and Worker.objects.exclude(pk=w.id).filter(time_clock_id=time_clock_id).exists():
            return _api_error("duplicate_time_clock_id", status=409)
        w.time_clock_id = time_clock_id
    if data.get("userId") is not None:
        try:
            user_id = int(data.get("userId") or 0) or 0
        except Exception:
            user_id = 0
        if not user_id:
            w.user = None
        else:
            User = get_user_model()
            user_obj = User.objects.filter(pk=user_id, is_staff=True).first()
            if not user_obj:
                return _api_error("user_not_found", status=404)
            if Worker.objects.exclude(pk=w.id).filter(user=user_obj).exists():
                return _api_error("user_already_linked", status=409)
            w.user = user_obj
    if data.get("kind") is not None:
        kind = str(data.get("kind") or "").strip()
        if kind not in {Worker.KIND_WORKER, Worker.KIND_EMPLOYEE}:
            return _api_error("invalid_kind", status=400)
        w.kind = kind
    if data.get("active") is not None:
        w.active = bool(data.get("active"))
    if data.get("dailyCost") is not None:
        w.daily_cost = _to_dec(data.get("dailyCost"), allow_none=True)
    if data.get("monthlySalary") is not None:
        w.monthly_salary = _to_dec(data.get("monthlySalary"), allow_none=True)
    if data.get("notes") is not None:
        w.notes = str(data.get("notes") or "").strip()
    if not w.name:
        return _api_error("missing_name", status=400)
    try:
        w.save()
    except IntegrityError:
        return _api_error("duplicate_time_clock_id", status=409)
    after = {
        "userId": int(getattr(w, "user_id", None) or 0),
        "name": w.name,
        "role": w.role,
        "phone": w.phone,
        "timeClockId": w.time_clock_id or "",
        "kind": w.kind,
        "active": bool(w.active),
        "dailyCost": float(w.daily_cost or 0) if w.daily_cost is not None else None,
        "monthlySalary": float(w.monthly_salary or 0) if w.monthly_salary is not None else None,
        "notes": w.notes,
    }
    _audit_ops(
        request,
        action="ops_worker_update",
        entity_type="worker",
        entity_id=str(w.id),
        before=before,
        after=after,
    )
    return _api_ok()


@require_POST
def admin_ops_workers_delete(request: HttpRequest, worker_id: int) -> JsonResponse:
    forbidden = _require_ops_workers_write(request)
    if forbidden:
        return forbidden
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("not_found", status=404)
    w.delete()
    return _api_ok()


@require_GET
def admin_ops_attendance(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_attendance_read(request)
    if forbidden:
        return forbidden
    qs = WorkerAttendance.objects.select_related("worker", "project")
    user = getattr(request, "user", None)
    role = _user_role(user)
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
        except Exception:
            linked_id = 0
        if not linked_id:
            return _api_ok({"items": []})
        qs = qs.filter(worker_id=linked_id)
    else:
        worker_id = int(request.GET.get("workerId") or 0) or None
        if worker_id:
            qs = qs.filter(worker_id=worker_id)
    year = int(request.GET.get("year") or 0) or None
    month = int(request.GET.get("month") or 0) or None
    if year and month and 1 <= month <= 12:
        qs = qs.filter(date__year=year, date__month=month)
    items: list[dict[str, Any]] = []
    for a in qs.order_by("-date", "-id"):
        items.append(
            {
                "id": a.id,
                "workerId": a.worker_id,
                "workerName": a.worker.name if a.worker else "",
                "projectId": a.project_id or 0,
                "projectTitle": getattr(a.project, "title", "") if a.project else "",
                "date": _to_iso(a.date),
                "status": a.status,
                "hours": float(a.hours or 0) if a.hours is not None else None,
                "notes": a.notes,
                "state": getattr(a, "state", WorkerAttendance.STATE_DRAFT),
                "approvedById": getattr(a, "approved_by_id", None) or 0,
                "approvedAt": a.approved_at.isoformat() if getattr(a, "approved_at", None) else "",
                "lockedById": getattr(a, "locked_by_id", None) or 0,
                "lockedAt": a.locked_at.isoformat() if getattr(a, "locked_at", None) else "",
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_attendance_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_attendance_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    user = getattr(request, "user", None)
    role = _user_role(user)
    worker_id = int(data.get("workerId") or 0) or 0
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
        except Exception:
            linked_id = 0
        if not linked_id:
            return _api_error("forbidden", status=403)
        worker_id = linked_id
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("worker_not_found", status=404)
    try:
        att_date = _to_date(data.get("date"))
    except Exception:
        return _api_error("invalid_date", status=400)
    if not att_date:
        return _api_error("missing_date", status=400)
    status = str(data.get("status") or WorkerAttendance.STATUS_PRESENT).strip() or WorkerAttendance.STATUS_PRESENT
    allowed_status = {
        WorkerAttendance.STATUS_PRESENT,
        WorkerAttendance.STATUS_ABSENT,
        WorkerAttendance.STATUS_HALF_DAY,
        WorkerAttendance.STATUS_LEAVE,
    }
    if status not in allowed_status:
        return _api_error("invalid_status", status=400)
    project_id = int(data.get("projectId") or 0) or None
    project = ProjectPage.objects.filter(pk=project_id).specific().first() if project_id else None
    defaults = {
        "status": status,
        "hours": _to_dec(data.get("hours"), allow_none=True),
        "project": project,
        "notes": str(data.get("notes") or "").strip(),
    }
    existing = WorkerAttendance.objects.filter(worker=w, date=att_date).first()
    if existing and getattr(existing, "state", "") == WorkerAttendance.STATE_LOCKED:
        return _api_error("attendance_locked", status=409)

    a, created = WorkerAttendance.objects.update_or_create(worker=w, date=att_date, defaults=defaults)
    if created:
        try:
            if getattr(a, "state", "") in {"", None}:
                a.state = WorkerAttendance.STATE_DRAFT
                a.save(update_fields=["state"])
        except Exception:
            pass

    _audit_ops(
        request,
        action="ops_attendance_upsert",
        entity_type="attendance",
        entity_id=str(a.id),
        meta={"created": created},
    )
    return _api_ok({"id": a.id, "created": created})


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
                    item_project = ProjectPage.objects.filter(pk=pid).specific().first()
                    if not item_project:
                        errors.append({"index": idx, "error": "project_not_found", "projectId": pid})
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
                        errors.append({"index": idx, "error": "invalid_time_range"})
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
                                errors.append({"index": idx, "error": "invalid_time_range"})
                                continue
                            hours = _to_dec(round(minutes / 60, 2), allow_none=True)
                        except Exception:
                            errors.append({"index": idx, "error": "invalid_time_range"})
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

            existing = WorkerAttendance.objects.filter(worker=w, date=att_date).first()
            if existing and getattr(existing, "state", "") == WorkerAttendance.STATE_LOCKED:
                errors.append({"index": idx, "error": "attendance_locked", "id": existing.id})
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
                        item_project = ProjectPage.objects.filter(pk=pid).specific().first()
                        if not item_project:
                            errors.append({"index": idx, "error": "project_not_found", "projectId": pid})
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
                            errors.append({"index": idx, "error": "invalid_time_range"})
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
                                    errors.append({"index": idx, "error": "invalid_time_range"})
                                    continue
                                hours = _to_dec(round(minutes / 60, 2), allow_none=True)
                            except Exception:
                                errors.append({"index": idx, "error": "invalid_time_range"})
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

                notes = str(raw.get("notes") or "").strip()
                import_note = "Imported from time clock"

                a = WorkerAttendance.objects.select_for_update().filter(worker=w, date=att_date).first()
                if a and getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
                    errors.append({"index": idx, "error": "attendance_locked", "id": a.id})
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


@require_POST
def admin_ops_timeclock_import(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_timeclock_import(request)
    if forbidden:
        return forbidden

    data = _read_json(request)
    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        return _api_error("missing_items", status=400)
    dry_run = bool(data.get("dryRun"))
    default_project_id = int(data.get("defaultProjectId") or 0) or None
    default_project = (
        ProjectPage.objects.filter(pk=default_project_id).specific().first()
        if default_project_id
        else None
    )
    if default_project_id and not default_project:
        return _api_error("default_project_not_found", status=404)

    created_count, updated_count, errors, item_results = _process_timeclock_items(
        raw_items, dry_run=dry_run, default_project=default_project
    )

    payload = {
        "dryRun": dry_run,
        "createdCount": created_count,
        "updatedCount": updated_count,
        "errors": errors,
        "results": item_results,
    }
    user = getattr(request, "user", None)
    OpsTimeclockImportRun.objects.create(
        actor=user if user and getattr(user, "is_authenticated", False) else None,
        role=_user_role(user),
        source=OpsTimeclockImportRun.SOURCE_MANUAL,
        dry_run=dry_run,
        default_project=default_project,
        items_count=len(raw_items),
        created_count=created_count,
        updated_count=updated_count,
        error_count=len(errors),
        errors=errors[:200],
        results=item_results[:200],
    )
    _audit_ops(
        request,
        action="ops_timeclock_import",
        entity_type="timeclock",
        entity_id="import",
        meta={
            "dryRun": dry_run,
            "defaultProjectId": default_project_id,
            "itemsCount": len(raw_items),
            "createdCount": created_count,
            "updatedCount": updated_count,
            "errorCount": len(errors),
        },
    )
    return _api_ok(payload)


@require_POST
def admin_ops_timeclock_import_from_folder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_timeclock_import(request)
    if forbidden:
        return forbidden

    data = _read_json(request)
    dry_run = bool(data.get("dryRun"))
    default_project_id = int(data.get("defaultProjectId") or 0) or None
    default_project = (
        ProjectPage.objects.filter(pk=default_project_id).specific().first()
        if default_project_id
        else None
    )
    if default_project_id and not default_project:
        return _api_error("default_project_not_found", status=404)

    limit_files = int(data.get("limitFiles") or 5) or 5
    limit_files = max(1, min(limit_files, 50))

    dir_raw = str(os.environ.get("TIME_CLOCK_IMPORT_DIR") or "").strip()
    if not dir_raw:
        return _api_error("timeclock_import_dir_not_set", status=400)
    base_dir = Path(dir_raw)
    if not base_dir.exists() or not base_dir.is_dir():
        return _api_error("timeclock_import_dir_not_found", status=404)

    candidates = [
        p
        for p in base_dir.iterdir()
        if p.is_file() and p.suffix.lower() == ".json" and not p.name.startswith(".")
    ]
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=False)
    selected = candidates[:limit_files]
    if not selected:
        return _api_ok(
            {
                "dryRun": dry_run,
                "files": [],
                "createdCount": 0,
                "updatedCount": 0,
                "errors": [],
                "results": [],
            }
        )

    all_items: list[Any] = []
    file_errors: list[dict[str, Any]] = []
    files: list[str] = []
    for p in selected:
        files.append(p.name)
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            file_errors.append({"file": p.name, "error": "invalid_json"})
            continue
        items = None
        if isinstance(raw, list):
            items = raw
        elif isinstance(raw, dict) and isinstance(raw.get("items"), list):
            items = raw.get("items")
        if not isinstance(items, list) or not items:
            file_errors.append({"file": p.name, "error": "missing_items"})
            continue
        for it in items:
            if isinstance(it, dict) and it.get("sourceFile") is None:
                it = {**it, "sourceFile": p.name}
            all_items.append(it)

    if not all_items and file_errors:
        return _api_ok(
            {
                "dryRun": dry_run,
                "files": files,
                "createdCount": 0,
                "updatedCount": 0,
                "errors": file_errors,
                "results": [],
            }
        )

    created_count, updated_count, errors, item_results = _process_timeclock_items(
        all_items, dry_run=dry_run, default_project=default_project
    )
    combined_errors = file_errors + errors

    payload = {
        "dryRun": dry_run,
        "files": files,
        "createdCount": created_count,
        "updatedCount": updated_count,
        "errors": combined_errors,
        "results": item_results,
    }

    user = getattr(request, "user", None)
    OpsTimeclockImportRun.objects.create(
        actor=user if user and getattr(user, "is_authenticated", False) else None,
        role=_user_role(user),
        source=OpsTimeclockImportRun.SOURCE_FOLDER,
        dry_run=dry_run,
        default_project=default_project,
        items_count=len(all_items),
        created_count=created_count,
        updated_count=updated_count,
        error_count=len(combined_errors),
        errors=combined_errors[:200],
        results=item_results[:200],
    )
    _audit_ops(
        request,
        action="ops_timeclock_import_folder",
        entity_type="timeclock",
        entity_id="import_from_folder",
        meta={
            "dryRun": dry_run,
            "defaultProjectId": default_project_id,
            "files": files,
            "itemsCount": len(all_items),
            "createdCount": created_count,
            "updatedCount": updated_count,
            "errorCount": len(combined_errors),
        },
    )
    return _api_ok(payload)


@require_POST
def admin_ops_attendance_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_ops_attendance_write(request)
    if forbidden:
        return forbidden
    a = WorkerAttendance.objects.select_related("worker").filter(pk=item_id).first()
    if not a:
        return _api_error("not_found", status=404)
    user = getattr(request, "user", None)
    role = _user_role(user)
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
        except Exception:
            linked_id = 0
        if not linked_id or int(getattr(a, "worker_id", 0) or 0) != linked_id:
            return _api_error("forbidden", status=403)
    if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
        return _api_error("attendance_locked", status=409)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        if role == "employee":
            return _api_error("forbidden", status=403)
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        a.worker = w
    if data.get("date") is not None:
        try:
            att_date = _to_date(data.get("date"))
        except Exception:
            return _api_error("invalid_date", status=400)
        if not att_date:
            return _api_error("missing_date", status=400)
        a.date = att_date
    if WorkerAttendance.objects.exclude(pk=a.id).filter(worker=a.worker, date=a.date).exists():
        return _api_error("duplicate_attendance", status=409)
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        allowed_status = {
            WorkerAttendance.STATUS_PRESENT,
            WorkerAttendance.STATUS_ABSENT,
            WorkerAttendance.STATUS_HALF_DAY,
            WorkerAttendance.STATUS_LEAVE,
        }
        if status not in allowed_status:
            return _api_error("invalid_status", status=400)
        a.status = status
    if data.get("hours") is not None:
        a.hours = _to_dec(data.get("hours"), allow_none=True)
    if data.get("projectId") is not None:
        project_id = int(data.get("projectId") or 0) or None
        a.project = ProjectPage.objects.filter(pk=project_id).specific().first() if project_id else None
    if data.get("notes") is not None:
        a.notes = str(data.get("notes") or "").strip()
    a.save()
    _audit_ops(
        request,
        action="ops_attendance_update",
        entity_type="attendance",
        entity_id=str(item_id),
    )
    return _api_ok()


@require_POST
def admin_ops_attendance_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_ops_attendance_write(request)
    if forbidden:
        return forbidden
    a = WorkerAttendance.objects.filter(pk=item_id).first()
    if not a:
        return _api_error("not_found", status=404)
    user = getattr(request, "user", None)
    role = _user_role(user)
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
        except Exception:
            linked_id = 0
        if not linked_id or int(getattr(a, "worker_id", 0) or 0) != linked_id:
            return _api_error("forbidden", status=403)
    if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
        return _api_error("attendance_locked", status=409)
    a.delete()
    _audit_ops(
        request,
        action="ops_attendance_delete",
        entity_type="attendance",
        entity_id=str(item_id),
    )
    return _api_ok()


@require_POST
def admin_ops_attendance_submit(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_submit",
        default_allowed_roles={"employee", "manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = WorkerAttendance.objects.select_for_update().filter(pk=item_id).first()
        if not a:
            return _api_error("not_found", status=404)
        if _user_role(user) == "employee":
            linked_id = 0
            try:
                linked_id = int(Worker.objects.filter(user=user).values_list("id", flat=True).first() or 0)
            except Exception:
                linked_id = 0
            if not linked_id or int(getattr(a, "worker_id", 0) or 0) != linked_id:
                return _api_error("forbidden", status=403)
        if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
            return _api_error("attendance_locked", status=409)
        before = {"state": getattr(a, "state", "")}
        if getattr(a, "state", "") in {"", None, WorkerAttendance.STATE_DRAFT}:
            a.state = WorkerAttendance.STATE_REVIEW
            a.save(update_fields=["state", "updated_at"])
        after = {"state": getattr(a, "state", "")}
    _audit_ops(
        request,
        action="ops_attendance_submit",
        entity_type="attendance",
        entity_id=str(item_id),
        before=before,
        after=after,
        meta={"actorId": getattr(user, "id", None)},
    )
    return _api_ok({"state": getattr(a, "state", "")})


@require_POST
def admin_ops_attendance_approve(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_approve",
        default_allowed_roles={"manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = WorkerAttendance.objects.select_for_update().filter(pk=item_id).first()
        if not a:
            return _api_error("not_found", status=404)
        if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
            return _api_error("attendance_locked", status=409)
        before = {
            "state": getattr(a, "state", ""),
            "approvedById": getattr(a, "approved_by_id", None),
            "approvedAt": a.approved_at.isoformat() if getattr(a, "approved_at", None) else "",
        }
        a.state = WorkerAttendance.STATE_APPROVED
        a.approved_by = user if user and getattr(user, "is_authenticated", False) else None
        a.approved_at = timezone.now()
        a.save(update_fields=["state", "approved_by", "approved_at", "updated_at"])
        after = {
            "state": getattr(a, "state", ""),
            "approvedById": getattr(a, "approved_by_id", None),
            "approvedAt": a.approved_at.isoformat() if getattr(a, "approved_at", None) else "",
        }
    _audit_ops(
        request,
        action="ops_attendance_approve",
        entity_type="attendance",
        entity_id=str(item_id),
        before=before,
        after=after,
    )
    return _api_ok({"state": getattr(a, "state", "")})


@require_POST
def admin_ops_attendance_lock(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_lock",
        default_allowed_roles={"manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = WorkerAttendance.objects.select_for_update().filter(pk=item_id).first()
        if not a:
            return _api_error("not_found", status=404)
        if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
            return _api_ok({"state": getattr(a, "state", "")})
        if getattr(a, "state", "") != WorkerAttendance.STATE_APPROVED:
            return _api_error("attendance_not_approved", status=409)
        before = {
            "state": getattr(a, "state", ""),
            "lockedById": getattr(a, "locked_by_id", None),
            "lockedAt": a.locked_at.isoformat() if getattr(a, "locked_at", None) else "",
        }
        a.state = WorkerAttendance.STATE_LOCKED
        a.locked_by = user if user and getattr(user, "is_authenticated", False) else None
        a.locked_at = timezone.now()
        a.save(update_fields=["state", "locked_by", "locked_at", "updated_at"])
        after = {
            "state": getattr(a, "state", ""),
            "lockedById": getattr(a, "locked_by_id", None),
            "lockedAt": a.locked_at.isoformat() if getattr(a, "locked_at", None) else "",
        }
    _audit_ops(
        request,
        action="ops_attendance_lock",
        entity_type="attendance",
        entity_id=str(item_id),
        before=before,
        after=after,
    )
    return _api_ok({"state": getattr(a, "state", "")})


@require_POST
def admin_ops_payroll_generate_from_attendance(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request, "ops_payroll_generate", default_allowed_roles={"manager", "accountant"}
    )
    if forbidden:
        return forbidden

    data = _read_json(request)
    dry_run = bool(data.get("dryRun"))
    year = int(data.get("year") or 0) or 0
    month = int(data.get("month") or 0) or 0
    if not (1900 <= year <= 2200):
        return _api_error("invalid_year", status=400)
    if not (1 <= month <= 12):
        return _api_error("invalid_month", status=400)

    worker_id = int(data.get("workerId") or 0) or None
    workers_qs = Worker.objects.filter(active=True)
    if worker_id:
        workers_qs = workers_qs.filter(pk=worker_id)
    workers = list(workers_qs.order_by("id"))
    if worker_id and not workers:
        return _api_error("worker_not_found", status=404)

    attendances = (
        WorkerAttendance.objects.filter(worker__in=workers, date__year=year, date__month=month)
        .exclude(state=WorkerAttendance.STATE_DRAFT)
        .values("worker_id", "status")
        .annotate(total=Sum(1))
    )
    att_counts: dict[int, dict[str, int]] = {}
    for r in attendances:
        wid = int(r.get("worker_id") or 0)
        status = str(r.get("status") or "")
        total = int(r.get("total") or 0)
        att_counts.setdefault(wid, {})[status] = total

    user = getattr(request, "user", None)
    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []

    def _calc_amount(w: Worker) -> Decimal | None:
        monthly = getattr(w, "monthly_salary", None)
        if monthly is not None:
            try:
                return Decimal(str(monthly))
            except Exception:
                return None
        daily = getattr(w, "daily_cost", None)
        if daily is None:
            return None
        try:
            daily_dec = Decimal(str(daily))
        except Exception:
            return None
        counts = att_counts.get(w.id, {})
        present = Decimal(str(counts.get(WorkerAttendance.STATUS_PRESENT, 0)))
        half = Decimal(str(counts.get(WorkerAttendance.STATUS_HALF_DAY, 0)))
        return daily_dec * (present + (half * Decimal("0.5")))

    with transaction.atomic():
        for w in workers:
            amount = _calc_amount(w)
            counts = att_counts.get(w.id, {})
            if amount is None:
                errors.append({"workerId": w.id, "error": "missing_rate"})
                continue
            amount = max(Decimal("0"), amount)
            existing = WorkerPayrollEntry.objects.select_for_update().filter(
                worker=w,
                year=year,
                month=month,
                kind=WorkerPayrollEntry.KIND_SALARY,
                source=WorkerPayrollEntry.SOURCE_AUTO_ATTENDANCE,
            ).first()
            if existing and getattr(existing, "status", "") != WorkerPayrollEntry.STATUS_DRAFT:
                skipped_count += 1
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": "skipped",
                        "reason": "not_draft",
                        "entryId": existing.id,
                        "amount": float(existing.amount or 0) if existing.amount is not None else None,
                    }
                )
                continue

            if dry_run:
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": "would_update" if existing else "would_create",
                        "entryId": existing.id if existing else 0,
                        "amount": float(amount),
                        "attendance": counts,
                    }
                )
                continue

            if existing:
                existing.amount = amount
                existing.date = existing.date or timezone.localdate()
                existing.notes = str(existing.notes or "") or "Generated from attendance"
                existing.source_meta = {"attendance": counts}
                existing.save(update_fields=["amount", "date", "notes", "source_meta", "updated_at"])
                updated_count += 1
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": "updated",
                        "entryId": existing.id,
                        "amount": float(amount),
                        "attendance": counts,
                    }
                )
            else:
                entry = WorkerPayrollEntry.objects.create(
                    worker=w,
                    year=year,
                    month=month,
                    kind=WorkerPayrollEntry.KIND_SALARY,
                    amount=amount,
                    date=timezone.localdate(),
                    notes="Generated from attendance",
                    source=WorkerPayrollEntry.SOURCE_AUTO_ATTENDANCE,
                    source_meta={"attendance": counts},
                    status=WorkerPayrollEntry.STATUS_DRAFT,
                )
                created_count += 1
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": "created",
                        "entryId": entry.id,
                        "amount": float(amount),
                        "attendance": counts,
                    }
                )

    _audit_ops(
        request,
        action="ops_payroll_generate_from_attendance",
        entity_type="payroll",
        entity_id=f"{year}-{month}",
        meta={
            "dryRun": dry_run,
            "workerId": worker_id or 0,
            "createdCount": created_count,
            "updatedCount": updated_count,
            "skippedCount": skipped_count,
            "errorCount": len(errors),
            "actorId": getattr(user, "id", None),
        },
    )
    return _api_ok(
        {
            "dryRun": dry_run,
            "year": year,
            "month": month,
            "workerId": worker_id or 0,
            "createdCount": created_count,
            "updatedCount": updated_count,
            "skippedCount": skipped_count,
            "errors": errors,
            "results": results,
        }
    )


@require_GET
def admin_ops_payroll(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    qs = WorkerPayrollEntry.objects.select_related("worker")
    worker_id = int(request.GET.get("workerId") or 0) or None
    if worker_id:
        qs = qs.filter(worker_id=worker_id)
    year = int(request.GET.get("year") or 0) or None
    if year:
        qs = qs.filter(year=year)
    month = int(request.GET.get("month") or 0) or None
    if month and 1 <= month <= 12:
        qs = qs.filter(month=month)
    items: list[dict[str, Any]] = []
    for p in qs.order_by("-year", "-month", "-id"):
        items.append(
            {
                "id": p.id,
                "workerId": p.worker_id,
                "workerName": p.worker.name if p.worker else "",
                "year": p.year,
                "month": p.month,
                "kind": p.kind,
                "amount": float(p.amount or 0) if p.amount is not None else None,
                "date": _to_iso(p.date),
                "notes": p.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_payroll_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    from datetime import date as _date

    data = _read_json(request)
    worker_id = int(data.get("workerId") or 0) or 0
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("worker_not_found", status=404)
    year = int(data.get("year") or 0) or 0
    month = int(data.get("month") or 0) or 0
    if not (1900 <= year <= 2200):
        return _api_error("invalid_year", status=400)
    if not (1 <= month <= 12):
        return _api_error("invalid_month", status=400)
    kind = str(data.get("kind") or WorkerPayrollEntry.KIND_SALARY).strip() or WorkerPayrollEntry.KIND_SALARY
    allowed_kind = {
        WorkerPayrollEntry.KIND_SALARY,
        WorkerPayrollEntry.KIND_ADVANCE,
        WorkerPayrollEntry.KIND_BONUS,
        WorkerPayrollEntry.KIND_DEDUCTION,
    }
    if kind not in allowed_kind:
        return _api_error("invalid_kind", status=400)
    amount = _to_dec(data.get("amount"), allow_none=True)
    if amount is None:
        return _api_error("missing_amount", status=400)
    pay_date = None
    if data.get("date") is not None:
        try:
            pay_date = _to_date(data.get("date"))
        except Exception:
            return _api_error("invalid_date", status=400)
    if not pay_date:
        pay_date = _date.today()
    p = WorkerPayrollEntry.objects.create(
        worker=w,
        year=year,
        month=month,
        kind=kind,
        amount=amount,
        date=pay_date,
        notes=str(data.get("notes") or "").strip(),
    )
    return _api_ok({"id": p.id})


@require_POST
def admin_ops_payroll_update(request: HttpRequest, entry_id: int) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = WorkerPayrollEntry.objects.select_related("worker").filter(pk=entry_id).first()
    if not p:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        p.worker = w
    if data.get("year") is not None:
        year = int(data.get("year") or 0) or 0
        if not (1900 <= year <= 2200):
            return _api_error("invalid_year", status=400)
        p.year = year
    if data.get("month") is not None:
        month = int(data.get("month") or 0) or 0
        if not (1 <= month <= 12):
            return _api_error("invalid_month", status=400)
        p.month = month
    if data.get("kind") is not None:
        kind = str(data.get("kind") or "").strip()
        allowed_kind = {
            WorkerPayrollEntry.KIND_SALARY,
            WorkerPayrollEntry.KIND_ADVANCE,
            WorkerPayrollEntry.KIND_BONUS,
            WorkerPayrollEntry.KIND_DEDUCTION,
        }
        if kind not in allowed_kind:
            return _api_error("invalid_kind", status=400)
        p.kind = kind
    if data.get("amount") is not None:
        amount = _to_dec(data.get("amount"), allow_none=True)
        if amount is None:
            return _api_error("missing_amount", status=400)
        p.amount = amount
    if data.get("date") is not None:
        try:
            pay_date = _to_date(data.get("date"))
        except Exception:
            return _api_error("invalid_date", status=400)
        p.date = pay_date
    if data.get("notes") is not None:
        p.notes = str(data.get("notes") or "").strip()
    p.save()
    return _api_ok()


@require_POST
def admin_ops_payroll_delete(request: HttpRequest, entry_id: int) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = WorkerPayrollEntry.objects.filter(pk=entry_id).first()
    if not p:
        return _api_error("not_found", status=404)
    p.delete()
    return _api_ok()


@require_GET
def admin_ops_equipment(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_equipment_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for e in Equipment.objects.all():
        items.append(
            {
                "id": e.id,
                "name": e.name,
                "code": e.code,
                "status": e.status,
                "hourlyCost": float(e.hourly_cost or 0) if e.hourly_cost is not None else None,
                "notes": e.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_equipment_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_equipment_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    e = Equipment.objects.create(
        name=name,
        code=str(data.get("code") or "").strip(),
        status=str(data.get("status") or Equipment.STATUS_AVAILABLE).strip(),
        hourly_cost=_to_dec(data.get("hourlyCost"), allow_none=True),
        notes=str(data.get("notes") or "").strip(),
    )
    return _api_ok({"id": e.id})


@require_POST
def admin_ops_equipment_update(
    request: HttpRequest, equipment_id: int
) -> JsonResponse:
    forbidden = _require_ops_equipment_write(request)
    if forbidden:
        return forbidden
    e = Equipment.objects.filter(pk=equipment_id).first()
    if not e:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("name") is not None:
        e.name = str(data.get("name") or "").strip()
    if data.get("code") is not None:
        e.code = str(data.get("code") or "").strip()
    if data.get("status") is not None:
        e.status = str(data.get("status") or "").strip()
    if data.get("hourlyCost") is not None:
        e.hourly_cost = _to_dec(data.get("hourlyCost"), allow_none=True)
    if data.get("notes") is not None:
        e.notes = str(data.get("notes") or "").strip()
    if not e.name:
        return _api_error("missing_name", status=400)
    e.save()
    return _api_ok()


@require_POST
def admin_ops_equipment_delete(
    request: HttpRequest, equipment_id: int
) -> JsonResponse:
    forbidden = _require_ops_equipment_write(request)
    if forbidden:
        return forbidden
    e = Equipment.objects.filter(pk=equipment_id).first()
    if not e:
        return _api_error("not_found", status=404)
    e.delete()
    return _api_ok()


@require_GET
def admin_ops_assignments(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_assignments_read(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    qs = ResourceAssignment.objects.select_related(
        "project", "worker", "equipment"
    )
    for a in qs:
        items.append(
            {
                "id": a.id,
                "projectId": a.project_id or 0,
                "projectTitle": getattr(a.project, "title", "") if a.project else "",
                "resourceType": a.resource_type,
                "workerId": a.worker_id or 0,
                "workerName": a.worker.name if a.worker else "",
                "equipmentId": a.equipment_id or 0,
                "equipmentName": a.equipment.name if a.equipment else "",
                "startDate": _to_iso(a.start_date),
                "endDate": _to_iso(a.end_date),
                "hoursPerDay": float(a.hours_per_day or 0) if a.hours_per_day is not None else None,
                "costOverride": float(a.cost_override or 0) if a.cost_override is not None else None,
                "notes": a.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_assignments_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_assignments_write(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    project_id = int(data.get("projectId") or 0) or None
    project = ProjectPage.objects.filter(pk=project_id).specific().first() if project_id else None
    resource_type = str(data.get("resourceType") or ResourceAssignment.RESOURCE_WORKER).strip()
    if resource_type not in {k for k, _ in ResourceAssignment.RESOURCE_CHOICES}:
        return _api_error("invalid_resourceType", status=400)
    worker_id = int(data.get("workerId") or 0) or None
    equipment_id = int(data.get("equipmentId") or 0) or None
    worker = Worker.objects.filter(pk=worker_id).first() if worker_id else None
    equipment = Equipment.objects.filter(pk=equipment_id).first() if equipment_id else None
    if resource_type == ResourceAssignment.RESOURCE_WORKER and not worker:
        return _api_error("missing_worker", status=400)
    if resource_type == ResourceAssignment.RESOURCE_EQUIPMENT and not equipment:
        return _api_error("missing_equipment", status=400)
    try:
        start_date = _to_date(data.get("startDate"))
    except Exception:
        return _api_error("invalid_start_date", status=400)
    try:
        end_date = _to_date(data.get("endDate"))
    except Exception:
        return _api_error("invalid_end_date", status=400)
    a = ResourceAssignment.objects.create(
        project=project,
        resource_type=resource_type,
        worker=worker if resource_type == ResourceAssignment.RESOURCE_WORKER else None,
        equipment=equipment if resource_type == ResourceAssignment.RESOURCE_EQUIPMENT else None,
        start_date=start_date,
        end_date=end_date,
        hours_per_day=_to_dec(data.get("hoursPerDay"), allow_none=True),
        cost_override=_to_dec(data.get("costOverride"), allow_none=True),
        notes=str(data.get("notes") or "").strip(),
    )
    return _api_ok({"id": a.id})


@require_POST
def admin_ops_assignments_update(
    request: HttpRequest, assignment_id: int
) -> JsonResponse:
    forbidden = _require_ops_assignments_write(request)
    if forbidden:
        return forbidden
    a = ResourceAssignment.objects.filter(pk=assignment_id).first()
    if not a:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("projectId") is not None:
        pid = int(data.get("projectId") or 0) or None
        a.project = ProjectPage.objects.filter(pk=pid).specific().first() if pid else None
    if data.get("resourceType") is not None:
        rt = str(data.get("resourceType") or "").strip()
        if rt not in {k for k, _ in ResourceAssignment.RESOURCE_CHOICES}:
            return _api_error("invalid_resourceType", status=400)
        a.resource_type = rt
    if data.get("workerId") is not None:
        wid = int(data.get("workerId") or 0) or None
        a.worker = Worker.objects.filter(pk=wid).first() if wid else None
    if data.get("equipmentId") is not None:
        eid = int(data.get("equipmentId") or 0) or None
        a.equipment = Equipment.objects.filter(pk=eid).first() if eid else None
    if a.resource_type == ResourceAssignment.RESOURCE_WORKER:
        a.equipment = None
        if not a.worker:
            return _api_error("missing_worker", status=400)
    else:
        a.worker = None
        if not a.equipment:
            return _api_error("missing_equipment", status=400)
    if data.get("startDate") is not None:
        try:
            a.start_date = _to_date(data.get("startDate"))
        except Exception:
            return _api_error("invalid_start_date", status=400)
    if data.get("endDate") is not None:
        try:
            a.end_date = _to_date(data.get("endDate"))
        except Exception:
            return _api_error("invalid_end_date", status=400)
    if data.get("hoursPerDay") is not None:
        a.hours_per_day = _to_dec(data.get("hoursPerDay"), allow_none=True)
    if data.get("costOverride") is not None:
        a.cost_override = _to_dec(data.get("costOverride"), allow_none=True)
    if data.get("notes") is not None:
        a.notes = str(data.get("notes") or "").strip()
    a.save()
    return _api_ok()


@require_POST
def admin_ops_assignments_delete(
    request: HttpRequest, assignment_id: int
) -> JsonResponse:
    forbidden = _require_ops_assignments_write(request)
    if forbidden:
        return forbidden
    a = ResourceAssignment.objects.filter(pk=assignment_id).first()
    if not a:
        return _api_error("not_found", status=404)
    a.delete()
    _audit_ops(
        request,
        action="ops_assignment_delete",
        entity_type="assignment",
        entity_id=str(assignment_id),
    )
    return _api_ok()


@require_GET
def admin_ops_audit_logs(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request, "ops_audit_read", default_allowed_roles={"manager"}
    )
    if forbidden:
        return forbidden
    qs = OpsAuditLog.objects.select_related("actor")
    action = str(request.GET.get("action") or "").strip()
    if action:
        qs = qs.filter(action=action)
    entity_type = str(request.GET.get("entityType") or "").strip()
    if entity_type:
        qs = qs.filter(entity_type=entity_type)
    entity_id = str(request.GET.get("entityId") or "").strip()
    if entity_id:
        qs = qs.filter(entity_id=entity_id)
    actor_id = int(request.GET.get("actorId") or 0) or None
    if actor_id:
        qs = qs.filter(actor_id=actor_id)
    since_id = int(request.GET.get("sinceId") or 0) or None
    if since_id:
        qs = qs.filter(id__gt=since_id)
    limit = int(request.GET.get("limit") or 200) or 200
    limit = max(1, min(limit, 500))
    items: list[dict[str, Any]] = []
    for r in qs.order_by("-id")[:limit]:
        items.append(
            {
                "id": r.id,
                "createdAt": r.created_at.isoformat() if r.created_at else "",
                "actorId": r.actor_id or 0,
                "actorUsername": getattr(r.actor, "username", "") if r.actor else "",
                "role": r.role,
                "action": r.action,
                "entityType": r.entity_type,
                "entityId": r.entity_id,
                "before": r.before,
                "after": r.after,
                "meta": r.meta,
                "ip": r.ip,
                "userAgent": r.user_agent,
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_ops_permission_rules(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request, "ops_permissions_read", default_allowed_roles={"manager"}
    )
    if forbidden:
        return forbidden
    codes = [
        "ops_management",
        "ops_crm_read",
        "ops_workers_write",
        "ops_attendance_write",
        "ops_timeclock_import",
        "ops_equipment_write",
        "ops_assignments_write",
        "accounting",
        "registration",
        "ops_audit_read",
        "ops_permissions_read",
        "ops_permissions_write",
    ]
    existing = {r.code: r for r in OpsPermissionRule.objects.filter(code__in=codes)}
    items: list[dict[str, Any]] = []
    for c in codes:
        r = existing.get(c)
        items.append(
            {
                "code": c,
                "allowedRoles": r.allowed_roles if r else None,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_permission_rules_update(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request, "ops_permissions_write", default_allowed_roles={"manager"}
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_superuser", False):
        return _api_error("forbidden", status=403)
    data = _read_json(request)
    code = str(data.get("code") or "").strip()
    if not code:
        return _api_error("missing_code", status=400)
    allowed_roles = data.get("allowedRoles")
    if allowed_roles is not None and not isinstance(allowed_roles, list):
        return _api_error("invalid_allowedRoles", status=400)
    cleaned: list[str] | None = None
    if isinstance(allowed_roles, list):
        cleaned = []
        for x in allowed_roles:
            v = str(x or "").strip()
            if not v:
                continue
            cleaned.append(v)
        cleaned = list(dict.fromkeys(cleaned))
    rule, _ = OpsPermissionRule.objects.update_or_create(
        code=code, defaults={"allowed_roles": cleaned}
    )
    cache.delete(f"ops_perm_rule:{code}")
    _audit_ops(
        request,
        action="ops_permissions_update",
        entity_type="permission_rule",
        entity_id=code,
        after={"allowedRoles": cleaned},
    )
    return _api_ok({"code": rule.code, "allowedRoles": rule.allowed_roles})


@require_GET
def admin_ops_timeclock_runs(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_timeclock_import(request)
    if forbidden:
        return forbidden
    limit = int(request.GET.get("limit") or 50) or 50
    limit = max(1, min(limit, 200))
    qs = OpsTimeclockImportRun.objects.select_related("actor", "default_project")
    items: list[dict[str, Any]] = []
    for r in qs.order_by("-id")[:limit]:
        items.append(
            {
                "id": r.id,
                "createdAt": r.created_at.isoformat() if r.created_at else "",
                "actorId": r.actor_id or 0,
                "actorUsername": getattr(r.actor, "username", "") if r.actor else "",
                "role": r.role,
                "source": r.source,
                "dryRun": bool(r.dry_run),
                "defaultProjectId": r.default_project_id or 0,
                "defaultProjectTitle": getattr(r.default_project, "title", "") if r.default_project else "",
                "itemsCount": int(r.items_count or 0),
                "createdCount": int(r.created_count or 0),
                "updatedCount": int(r.updated_count or 0),
                "errorCount": int(r.error_count or 0),
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_kpi_projects(request: HttpRequest) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    projects = ProjectPage.objects.all().specific()
    contract_sums = {
        int(r["project_id"]): r["total"] or Decimal("0")
        for r in ProjectContract.objects.exclude(project_id=None)
        .values("project_id")
        .annotate(total=Sum("amount"))
    }
    po_sums = {
        int(r["project_id"]): r["total"] or Decimal("0")
        for r in PurchaseOrder.objects.exclude(project_id=None)
        .values("project_id")
        .annotate(total=Sum("total_amount"))
    }
    paid_sums: dict[int, Decimal] = {}
    for r in ContractPayment.objects.values("contract__project_id").annotate(
        total=Sum("paid_amount")
    ):
        pid = r.get("contract__project_id")
        if not pid:
            continue
        paid_sums[int(pid)] = r["total"] or Decimal("0")
    items: list[dict[str, Any]] = []
    for p in projects:
        budget = getattr(p, "budget_amount", None)
        budget_val = Decimal(str(budget)) if budget is not None else Decimal("0")
        contracts_total = contract_sums.get(p.id, Decimal("0"))
        po_total = po_sums.get(p.id, Decimal("0"))
        paid_total = paid_sums.get(p.id, Decimal("0"))
        variance = budget_val - (po_total + paid_total)
        items.append(
            {
                "projectId": p.id,
                "title": p.title,
                "status": getattr(p, "status", "") or "",
                "progressPercent": int(getattr(p, "progress_percent", 0) or 0),
                "budgetAmount": float(budget_val),
                "contractsTotal": float(contracts_total),
                "purchaseOrdersTotal": float(po_total),
                "paidTotal": float(paid_total),
                "variance": float(variance),
            }
        )
    return _api_ok({"items": items})
