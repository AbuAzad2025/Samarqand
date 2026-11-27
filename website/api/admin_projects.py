"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import mimetypes
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.http import HttpRequest
from django.http import JsonResponse
from django.utils.text import slugify
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST
from PIL import Image

from website.models import CompanyDocument
from website.models import ProjectDocument
from website.models import ProjectGalleryImage
from website.models import ProjectPage

logger = logging.getLogger(__name__)


from .common import *

_PROJECT_YEAR_MIN = 1900
_PROJECT_YEAR_MAX = 2100


def _upload_max_bytes(setting_name: str, default: int) -> int:
    """Read an explicit server-side cap; never trust a malformed setting."""
    try:
        return max(1, int(getattr(settings, setting_name, default)))
    except (TypeError, ValueError):
        return int(default)


def _validate_uploaded_file(
    uploaded: Any,
    *,
    max_bytes: int,
    allowed_exts: set[str],
    allowed_mimes: set[str] | None = None,
) -> JsonResponse | None:
    """Check size/type before saving; errors carry safe Arabic messages."""
    try:
        size = int(getattr(uploaded, "size", 0) or 0)
    except (TypeError, ValueError):
        size = 0
    if size <= 0:
        return _api_error(
            "empty_file", status=400, message="الملف فارغ أو غير صالح."
        )
    if size > max_bytes:
        return _api_error(
            "file_too_large",
            status=413,
            message=(
                "حجم الملف يتجاوز الحد المسموح "
                f"({max_bytes / (1024 * 1024):g} ميغابايت)."
            ),
            details={"maxBytes": max_bytes},
        )
    original_name = str(getattr(uploaded, "name", "") or "")
    ext = Path(original_name.lower()).suffix.lower()
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            message="امتداد الملف غير مسموح به.",
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    if allowed_mimes:
        content_type = str(getattr(uploaded, "content_type", "") or "").lower()
        if content_type and content_type not in allowed_mimes:
            return _api_error(
                "invalid_file_type",
                status=400,
                message="نوع محتوى الملف غير مسموح به.",
                details={"allowedMimeTypes": sorted(allowed_mimes)},
            )
    return None


def _clean_uploaded_name(
    uploaded: Any, allowed_exts: set[str]
) -> JsonResponse | None:
    """Never keep an attacker-controlled filename if sanitising fails."""
    try:
        uploaded.name = _safe_uploaded_filename(
            str(getattr(uploaded, "name", "") or ""), allowed_exts=allowed_exts
        )
    except Exception:
        logger.exception("Failed to sanitize uploaded filename")
        return _api_error(
            "invalid_file_name", status=400, message="اسم الملف غير صالح."
        )
    return None


def _unsafe_media_path_error(file_obj: Any) -> JsonResponse | None:
    """Guard deletions: the resolved path must stay inside MEDIA_ROOT."""
    name = str(getattr(file_obj, "name", "") or "")
    if not name:
        return None
    try:
        media_root = Path(settings.MEDIA_ROOT).resolve()
        candidate = (media_root / name).resolve()
        candidate.relative_to(media_root)
    except Exception:
        logger.warning("Refusing media operation outside MEDIA_ROOT: %s", name)
        return _api_error(
            "unsafe_media_path",
            status=400,
            message="مسار المرفق غير آمن؛ لم يتم تنفيذ العملية.",
        )
    return None


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
                "firstPublishedAt": str(
                    getattr(p, "first_published_at", "") or ""
                ),
                "coverUrl": cover_url,
                "shortDescription": getattr(p, "short_description", "") or "",
                "status": getattr(p, "status", ProjectPage.STATUS_COMPLETED)
                or ProjectPage.STATUS_COMPLETED,
                "pmpPhase": getattr(p, "pmp_phase", ProjectPage.PHASE_PLANNING)
                or ProjectPage.PHASE_PLANNING,
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
    page = (
        ProjectPage.objects.filter(pk=project_id)
        .specific()
        .prefetch_related("gallery_images__image")
        .first()
    )
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
            "status": getattr(page, "status", ProjectPage.STATUS_COMPLETED)
            or ProjectPage.STATUS_COMPLETED,
            "pmpPhase": getattr(page, "pmp_phase", ProjectPage.PHASE_PLANNING)
            or ProjectPage.PHASE_PLANNING,
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
    title = str(data.get("title") or "").strip() or "Ù…Ø´Ø±ÙˆØ¹"
    base_slug = slugify(str(data.get("slug") or title)) or "project"
    completion_year: int | None = None
    cy = data.get("completionYear")
    if cy not in {None, ""}:
        try:
            completion_year = int(str(cy))
            if not (_PROJECT_YEAR_MIN <= completion_year <= _PROJECT_YEAR_MAX):
                raise ValueError
        except Exception:
            return _api_error(
                "invalid_completion_year",
                status=400,
                message="سنة الإنجاز غير صالحة.",
            )
    status = (
        str(data.get("status") or "").strip() or ProjectPage.STATUS_COMPLETED
    )
    if status not in {
        ProjectPage.STATUS_ONGOING,
        ProjectPage.STATUS_COMPLETED,
        ProjectPage.STATUS_ARCHIVED,
    }:
        return _api_error(
            "invalid_project_status",
            status=400,
            message="حالة المشروع غير صالحة.",
        )

    pmp_phase = (
        str(data.get("pmpPhase") or "").strip() or ProjectPage.PHASE_PLANNING
    )
    if pmp_phase not in {
        ProjectPage.PHASE_INITIATING,
        ProjectPage.PHASE_PLANNING,
        ProjectPage.PHASE_EXECUTING,
        ProjectPage.PHASE_MONITORING,
        ProjectPage.PHASE_CLOSING,
    }:
        return _api_error(
            "invalid_pmp_phase", status=400, message="مرحلة المشروع غير صالحة."
        )
    progress_percent_raw = data.get("progressPercent")
    progress_percent = 0
    if progress_percent_raw not in {None, ""}:
        try:
            progress_percent = int(str(progress_percent_raw))
        except Exception:
            return _api_error(
                "invalid_progress_percent",
                status=400,
                message="نسبة الإنجاز غير صالحة.",
            )
    if not 0 <= progress_percent <= 100:
        return _api_error(
            "invalid_progress_percent",
            status=400,
            message="نسبة الإنجاز يجب أن تكون بين 0 و 100.",
        )

    start_date_raw = str(data.get("startDate") or "").strip()
    target_end_date_raw = str(data.get("targetEndDate") or "").strip()
    start_date = None
    target_end_date = None
    if start_date_raw:
        try:
            start_date = date.fromisoformat(start_date_raw)
        except Exception:
            return _api_error(
                "invalid_start_date",
                status=400,
                message="تاريخ البداية غير صالح؛ استخدم الصيغة YYYY-MM-DD.",
            )
    if target_end_date_raw:
        try:
            target_end_date = date.fromisoformat(target_end_date_raw)
        except Exception:
            return _api_error(
                "invalid_target_end_date",
                status=400,
                message="تاريخ الانتهاء غير صالح؛ استخدم الصيغة YYYY-MM-DD.",
            )
    if start_date and target_end_date and target_end_date < start_date:
        return _api_error(
            "invalid_date_range",
            status=400,
            message="تاريخ الانتهاء يجب ألا يسبق تاريخ البداية.",
        )

    budget_amount_raw = data.get("budgetAmount")
    budget_amount = None
    if budget_amount_raw not in {None, ""}:
        try:
            budget_amount = Decimal(str(budget_amount_raw))
            if not budget_amount.is_finite() or budget_amount < 0:
                raise ValueError
        except Exception:
            return _api_error(
                "invalid_budget_amount",
                status=400,
                message="الميزانية غير صالحة؛ يجب أن تكون رقماً غير سالب.",
            )
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
            return _api_error(
                "invalid_project_status",
                status=400,
                message="حالة المشروع غير صالحة.",
            )
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
            return _api_error(
                "invalid_pmp_phase",
                status=400,
                message="مرحلة المشروع غير صالحة.",
            )
        page.pmp_phase = pmp_phase
    if data.get("progressPercent") is not None:
        progress_val = data.get("progressPercent")
        try:
            progress_percent = int(str(progress_val))
            if not 0 <= progress_percent <= 100:
                raise ValueError
        except Exception:
            return _api_error(
                "invalid_progress_percent",
                status=400,
                message="نسبة الإنجاز يجب أن تكون بين 0 و 100.",
            )
        page.progress_percent = progress_percent
    if data.get("startDate") is not None:
        start_date_raw = str(data.get("startDate") or "").strip()
        if not start_date_raw:
            page.start_date = None
        else:
            try:
                page.start_date = date.fromisoformat(start_date_raw)
            except Exception:
                return _api_error(
                    "invalid_start_date",
                    status=400,
                    message="تاريخ البداية غير صالح؛ استخدم الصيغة YYYY-MM-DD.",
                )
    if data.get("targetEndDate") is not None:
        target_end_date_raw = str(data.get("targetEndDate") or "").strip()
        if not target_end_date_raw:
            page.target_end_date = None
        else:
            try:
                page.target_end_date = date.fromisoformat(target_end_date_raw)
            except Exception:
                return _api_error(
                    "invalid_target_end_date",
                    status=400,
                    message="تاريخ الانتهاء غير صالح؛ استخدم الصيغة YYYY-MM-DD.",
                )
    if (
        page.start_date
        and page.target_end_date
        and page.target_end_date < page.start_date
    ):
        return _api_error(
            "invalid_date_range",
            status=400,
            message="تاريخ الانتهاء يجب ألا يسبق تاريخ البداية.",
        )
    if data.get("budgetAmount") is not None:
        budget_amount_raw = data.get("budgetAmount")
        if budget_amount_raw in {"", None}:
            page.budget_amount = None
        else:
            try:
                page.budget_amount = Decimal(str(budget_amount_raw))
                if not page.budget_amount.is_finite() or page.budget_amount < 0:
                    raise ValueError
            except Exception:
                return _api_error(
                    "invalid_budget_amount",
                    status=400,
                    message="الميزانية غير صالحة؛ يجب أن تكون رقماً غير سالب.",
                )
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
                completion_year = int(str(val))
                if not (
                    _PROJECT_YEAR_MIN <= completion_year <= _PROJECT_YEAR_MAX
                ):
                    raise ValueError
                page.completion_year = completion_year
            except Exception:
                return _api_error(
                    "invalid_completion_year",
                    status=400,
                    message="سنة الإنجاز غير صالحة.",
                )
    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60].strip("-")
        if not new_slug:
            return _api_error(
                "invalid_slug", status=400, message="الرابط (Slug) غير صالح."
            )
        parent = page.get_parent()
        page.slug = _unique_child_slug(parent, new_slug)
    rev = page.save_revision()
    should_publish = (
        bool(page.live) and new_status != ProjectPage.STATUS_ARCHIVED
    )
    rev.publish() if should_publish else rev.save()
    if new_status == ProjectPage.STATUS_ARCHIVED:
        try:
            page.unpublish()
        except Exception:
            page.live = False
            page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_project_publish(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_project_unpublish(
    request: HttpRequest, project_id: int
) -> JsonResponse:
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
def admin_project_gallery_add(
    request: HttpRequest, project_id: int
) -> JsonResponse:
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
        (
            page.save_revision().publish()
            if page.live
            else page.save_revision().save()
        )
    return _api_ok(
        {"id": item.id, "url": _image_url(request, img), "imageId": img.id}
    )


@require_POST
def admin_project_gallery_remove(
    request: HttpRequest, project_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    ProjectGalleryImage.objects.filter(pk=item_id, page=page).delete()
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if page:
        (
            page.save_revision().publish()
            if page.live
            else page.save_revision().save()
        )
    return _api_ok()


@require_GET
def admin_project_documents(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_projects_management(request)
    if forbidden:
        return forbidden
    page = ProjectPage.objects.filter(pk=project_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for row in page.project_documents.select_related("document").order_by(
        "sort_order", "id"
    ):
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
            url = (
                _abs_url(request, f.url)
                if f and getattr(f, "url", None)
                else ""
            )
            file_size = int(getattr(f, "size", 0) or 0)
        except Exception:
            url = ""
            file_size = 0
        try:
            created_at = (
                str(getattr(doc, "created_at", "") or "") if doc else ""
            )
        except Exception:
            created_at = ""
        items.append(
            {
                "id": row.id,
                "title": str(
                    getattr(row, "title", "") or getattr(doc, "title", "") or ""
                ),
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
    base = str(
        getattr(row, "title", "") or getattr(doc, "title", "") or ""
    ).strip()
    if not base:
        base = Path(original_name).stem or "document"
    for ch in ["\\", "/", ":", "*", "?", '"', "<", ">", "|"]:
        base = base.replace(ch, "-")
    download_name = f"{base}{ext}" if ext else base

    content_type = mimetypes.guess_type(download_name)[0] or ""
    resp = FileResponse(fh, as_attachment=True, filename=download_name)
    if content_type:
        resp["Content-Type"] = content_type
    return resp


@require_POST
def admin_project_documents_upload(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    limited = _check_rate_limit(
        request,
        scope="admin_project_document_upload",
        limit=24,
        window_seconds=300,
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
        return _api_error(
            "missing_file", status=400, message="لم يتم اختيار ملف للرفع."
        )
    max_bytes = _upload_max_bytes(
        "ADMIN_PROJECT_DOCUMENT_UPLOAD_MAX_BYTES", 25 * 1024 * 1024
    )
    allowed_exts = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    allowed_mimes = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
    }
    invalid = _validate_uploaded_file(
        f,
        max_bytes=max_bytes,
        allowed_exts=allowed_exts,
        allowed_mimes=allowed_mimes,
    )
    if invalid:
        return invalid
    invalid = _clean_uploaded_name(f, allowed_exts)
    if invalid:
        return invalid

    title = str(
        request.POST.get("title") or getattr(f, "name", "") or "document"
    )
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
        (
            page.save_revision().publish()
            if page.live
            else page.save_revision().save()
        )
        url = ""
        try:
            url = (
                _abs_url(request, doc.file.url)
                if getattr(doc, "file", None)
                else ""
            )
        except Exception:
            url = ""
        return _api_ok(
            {"id": row.id, "documentId": doc.id, "url": url, "title": row.title}
        )
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
        (
            page.save_revision().publish()
            if page.live
            else page.save_revision().save()
        )
    return _api_ok()


@require_POST
def admin_project_documents_reorder(
    request: HttpRequest, project_id: int
) -> JsonResponse:
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
            url = (
                _abs_url(request, f.url)
                if f and getattr(f, "url", None)
                else ""
            )
            file_size = int(getattr(f, "size", 0) or 0)
        except Exception:
            url = ""
            file_size = 0
        try:
            created_at = (
                str(getattr(doc, "created_at", "") or "") if doc else ""
            )
        except Exception:
            created_at = ""
        items.append(
            {
                "id": row.id,
                "category": row.category,
                "sortOrder": int(getattr(row, "sort_order", 0) or 0),
                "title": str(
                    getattr(row, "title", "") or getattr(doc, "title", "") or ""
                ),
                "documentId": document_id,
                "url": url,
                "downloadUrl": _abs_url(
                    request, f"/api/admin/company-documents/{row.id}/download"
                ),
                "fileSize": file_size,
                "createdAt": created_at,
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_company_documents_download(
    request: HttpRequest, item_id: int
) -> FileResponse | JsonResponse:
    row = (
        CompanyDocument.objects.filter(pk=item_id)
        .select_related("document")
        .first()
    )
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
    base = str(
        getattr(row, "title", "") or getattr(doc, "title", "") or ""
    ).strip()
    if not base:
        base = Path(original_name).stem or "document"
    for ch in ["\\", "/", ":", "*", "?", '"', "<", ">", "|"]:
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
        request,
        scope="admin_company_document_upload",
        limit=24,
        window_seconds=300,
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
        return _api_error(
            "missing_file", status=400, message="لم يتم اختيار ملف للرفع."
        )
    max_bytes = _upload_max_bytes(
        "ADMIN_COMPANY_DOCUMENT_UPLOAD_MAX_BYTES", 25 * 1024 * 1024
    )
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
    invalid = _validate_uploaded_file(
        f,
        max_bytes=max_bytes,
        allowed_exts=allowed_exts,
        allowed_mimes=allowed_mimes,
    )
    if invalid:
        return invalid
    invalid = _clean_uploaded_name(f, allowed_exts)
    if invalid:
        return invalid

    title = str(
        request.POST.get("title") or getattr(f, "name", "") or "document"
    )
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
            url = (
                _abs_url(request, doc.file.url)
                if getattr(doc, "file", None)
                else ""
            )
        except Exception:
            url = ""
        return _api_ok(
            {
                "id": row.id,
                "documentId": doc.id,
                "url": url,
                "title": row.title,
                "category": row.category,
            }
        )
    except Exception:
        return _api_error("upload_failed", status=400)


@require_POST
def admin_company_documents_remove(
    request: HttpRequest, item_id: int
) -> JsonResponse:
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
def admin_company_documents_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
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


def admin_image_upload(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_image_upload", limit=24, window_seconds=300
    )
    if limited:
        return limited
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return _api_error(
            "missing_file", status=400, message="لم يتم اختيار صورة للرفع."
        )
    max_bytes = _upload_max_bytes(
        "ADMIN_IMAGE_UPLOAD_MAX_BYTES", 5 * 1024 * 1024
    )
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    allowed_mimes = {"image/jpeg", "image/png", "image/webp"}
    invalid = _validate_uploaded_file(
        f,
        max_bytes=max_bytes,
        allowed_exts=allowed_exts,
        allowed_mimes=allowed_mimes,
    )
    if invalid:
        return invalid
    invalid = _clean_uploaded_name(f, allowed_exts)
    if invalid:
        return invalid

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
        return _api_error(
            "invalid_image", status=400, message="الصورة غير صالحة أو تالفة."
        )
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
                "thumbUrl": _image_rendition_url(
                    request, img, "fill-320x240|jpegquality-70"
                ),
                "mediumUrl": _image_rendition_url(
                    request, img, "fill-960x720|jpegquality-80"
                ),
                "largeUrl": _image_rendition_url(
                    request, img, "max-1920x1920|jpegquality-85"
                ),
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
                "thumbUrl": _image_rendition_url(
                    request, img, "fill-320x240|jpegquality-70"
                ),
                "mediumUrl": _image_rendition_url(
                    request, img, "fill-960x720|jpegquality-80"
                ),
                "largeUrl": _image_rendition_url(
                    request, img, "max-1920x1920|jpegquality-85"
                ),
                "width": int(getattr(img, "width", 0) or 0),
                "height": int(getattr(img, "height", 0) or 0),
                "createdAt": str(getattr(img, "created_at", "") or ""),
            }
        )
    return _api_ok(
        {"items": items, "total": total, "limit": limit, "offset": offset}
    )


@require_POST
def admin_media_images_delete(
    request: HttpRequest, image_id: int
) -> JsonResponse:
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
    unsafe = _unsafe_media_path_error(getattr(img, "file", None))
    if unsafe:
        return unsafe
    try:
        img.delete()
    except Exception:
        return _api_error(
            "delete_failed", status=400, message="تعذّر حذف الصورة."
        )
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
            url = (
                _abs_url(request, f.url)
                if f and getattr(f, "url", None)
                else ""
            )
        except Exception:
            url = ""
        items.append(
            {
                "id": d.id,
                "title": str(getattr(d, "title", "") or ""),
                "url": url,
                "fileSize": int(
                    getattr(getattr(d, "file", None), "size", 0) or 0
                ),
                "createdAt": str(getattr(d, "created_at", "") or ""),
            }
        )
    return _api_ok(
        {"items": items, "total": total, "limit": limit, "offset": offset}
    )


@require_POST
def admin_media_documents_upload(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_document_upload", limit=24, window_seconds=300
    )
    if limited:
        return limited
    forbidden = _require_registration(request)
    if forbidden:
        return forbidden
    f = request.FILES.get("file")
    if not f:
        return _api_error(
            "missing_file", status=400, message="لم يتم اختيار ملف للرفع."
        )
    max_bytes = _upload_max_bytes(
        "ADMIN_DOCUMENT_UPLOAD_MAX_BYTES", 20 * 1024 * 1024
    )
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
    invalid = _validate_uploaded_file(
        f,
        max_bytes=max_bytes,
        allowed_exts=allowed_exts,
        allowed_mimes=allowed_mimes,
    )
    if invalid:
        return invalid
    invalid = _clean_uploaded_name(f, allowed_exts)
    if invalid:
        return invalid

    title = str(
        request.POST.get("title") or getattr(f, "name", "") or "document"
    )
    try:
        from wagtail.documents import get_document_model
        from wagtail.models import Collection

        DocumentModel = get_document_model()
        root_collection = Collection.get_first_root_node()
        doc = DocumentModel(title=title, file=f, collection=root_collection)
        doc.save()
        url = ""
        try:
            url = (
                _abs_url(request, doc.file.url)
                if getattr(doc, "file", None)
                else ""
            )
        except Exception:
            url = ""
        return _api_ok({"id": doc.id, "url": url, "title": doc.title})
    except Exception:
        return _api_error("upload_failed", status=400)


@require_POST
def admin_media_documents_delete(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
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
    unsafe = _unsafe_media_path_error(getattr(doc, "file", None))
    if unsafe:
        return unsafe
    try:
        doc.delete()
    except Exception:
        return _api_error(
            "delete_failed", status=400, message="تعذّر حذف المرفق."
        )
    return _api_ok()
