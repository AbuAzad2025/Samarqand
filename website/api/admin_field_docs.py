"""Field documentation API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from functools import wraps
from pathlib import Path
from typing import Any

from django.conf import settings
from django.db.models import Count
from django.http import HttpRequest
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import NCR
from website.models import RFI
from website.models import CorrespondenceRegister
from website.models import DailySiteReport
from website.models import InventoryItem
from website.models import MaterialDeliveryNote
from website.models import MaterialDeliveryNoteItem
from website.models import MeetingActionItem
from website.models import MeetingMinutes
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import Submittal

logger = logging.getLogger(__name__)

from .common import *


class _InvalidInput(Exception):
    """A safe, user-facing validation failure (no internals leaked)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _validated(view: Any) -> Any:
    """Turn _InvalidInput into a uniform Arabic JSON error."""

    @wraps(view)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return view(*args, **kwargs)
        except _InvalidInput as exc:
            return _api_error(exc.code, status=400, message=exc.message)

    return wrapper


def _parse_date(raw: Any) -> date | None:
    if raw in {"", None}:
        return None
    try:
        return date.fromisoformat(str(raw).strip())
    except Exception:
        raise _InvalidInput(
            "invalid_date", "تاريخ غير صالح؛ استخدم الصيغة YYYY-MM-DD."
        )


def _parse_int(
    raw: Any, *, default: int = 0, minimum: int | None = None
) -> int:
    if raw in {"", None}:
        return default
    try:
        value = int(str(raw))
    except Exception:
        raise _InvalidInput("invalid_number", "قيمة رقمية غير صالحة.")
    if minimum is not None and value < minimum:
        raise _InvalidInput(
            "invalid_number", "القيمة الرقمية لا يمكن أن تكون سالبة."
        )
    return value


def _parse_decimal(
    raw: Any,
    *,
    default: Decimal | None = None,
    allow_negative: bool = True,
) -> Decimal | None:
    if raw in {"", None}:
        return default
    try:
        value = Decimal(str(raw))
    except Exception:
        raise _InvalidInput("invalid_amount", "مبلغ غير صالح.")
    if not value.is_finite() or (value < 0 and not allow_negative):
        raise _InvalidInput("invalid_amount", "مبلغ غير صالح.")
    return value


def _parse_choice(
    raw: Any, choices: Any, *, default: str, code: str, message: str
) -> str:
    value = str(raw).strip() if raw not in {"", None} else default
    if value not in dict(choices):
        raise _InvalidInput(code, message)
    return value


def _json_object(raw: Any, default: dict[str, Any]) -> dict[str, Any]:
    if raw in {"", None}:
        return default
    if not isinstance(raw, dict):
        raise _InvalidInput(
            "invalid_json", "القيمة يجب أن تكون كائناً (JSON object)."
        )
    return raw


def _upload_max_bytes(setting_name: str, default: int) -> int:
    try:
        return max(1, int(getattr(settings, setting_name, default)))
    except (TypeError, ValueError):
        return int(default)


def _validate_uploaded_file(
    uploaded: Any, *, max_bytes: int, allowed_exts: set[str]
) -> JsonResponse | None:
    """Consistent, explicit size/type checks with safe Arabic messages."""
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
    ext = Path(str(getattr(uploaded, "name", "") or "").lower()).suffix.lower()
    if ext not in allowed_exts:
        return _api_error(
            "invalid_file_type",
            status=400,
            message="امتداد الملف غير مسموح به.",
            details={"allowedExtensions": sorted(allowed_exts)},
        )
    return None


def _document_file_value(data: dict[str, Any]) -> tuple[str | None, Any]:
    """Validate a document link and return (file_name, legacy_id).

    A missing key means "leave unchanged"; an empty value means "clear".
    """
    if data.get("documentFileId") is None:
        return (None, None)
    raw = str(data.get("documentFileId") or "").strip()
    if not raw:
        return ("", None)
    if not raw.isdigit():
        raise _InvalidInput(
            "invalid_document_file", "رقم المرفق غير صالح؛ يجب أن يكون رقماً."
        )
    try:
        from wagtail.documents import get_document_model

        doc = get_document_model().objects.filter(pk=int(raw)).first()
    except Exception:
        doc = None
    if not doc:
        raise _InvalidInput(
            "document_file_not_found", "المرفق المحدد غير موجود."
        )
    file_obj = getattr(doc, "file", None)
    name = str(getattr(file_obj, "name", "") or "")
    if name:
        try:
            media_root = Path(settings.MEDIA_ROOT).resolve()
            (media_root / name).resolve().relative_to(media_root)
        except Exception:
            logger.warning("Refusing media link outside MEDIA_ROOT: %s", name)
            raise _InvalidInput(
                "unsafe_media_path", "مسار المرفق غير آمن؛ لم يتم حفظ الرابط."
            )
    return (name, doc.id)


@require_POST
def admin_field_docs_upload_file(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request,
        scope="admin_field_docs_upload",
        limit=24,
        window_seconds=300,
    )
    if limited:
        return limited
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    uploaded = request.FILES.get("file")
    if not uploaded:
        return _api_error(
            "missing_file", status=400, message="لم يتم اختيار ملف للرفع."
        )
    max_bytes = _upload_max_bytes(
        "ADMIN_FIELD_DOCUMENT_UPLOAD_MAX_BYTES", 20 * 1024 * 1024
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
    invalid = _validate_uploaded_file(
        uploaded, max_bytes=max_bytes, allowed_exts=allowed_exts
    )
    if invalid:
        return invalid
    original_name = str(getattr(uploaded, "name", "") or "")
    try:
        uploaded.name = _safe_uploaded_filename(
            original_name, allowed_exts=allowed_exts
        )
    except Exception:
        logger.exception("Field-docs filename sanitization failed")
        return _api_error(
            "invalid_file_name", status=400, message="اسم الملف غير صالح."
        )
    try:
        from wagtail.documents.models import Document
        from wagtail.models import Collection

        document = Document(
            title=original_name or "document",
            file=uploaded,
            collection=Collection.get_first_root_node(),
        )
        document.save()
    except Exception:
        logger.exception("Field-docs upload failed")
        return _api_error(
            "upload_failed", status=400, message="تعذّر حفظ المرفق."
        )
    return _api_ok(
        {
            "id": document.id,
            "url": document.url,
            "filename": original_name,
        }
    )


@require_GET
def admin_field_docs_projects(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items = [
        {"id": p["id"], "title": p["title"]}
        for p in ProjectPage.objects.live().values("id", "title")
    ]
    return _api_ok({"items": items})


@require_GET
def admin_field_docs_correspondence(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for c in CorrespondenceRegister.objects.filter(project_id=project_id):
        items.append(
            {
                "id": c.id,
                "direction": c.direction,
                "referenceNumber": c.reference_number,
                "date": _to_iso(c.date),
                "fromEntity": c.from_entity,
                "toEntity": c.to_entity,
                "subject": c.subject,
                "description": c.description,
                "documentFileId": getattr(c, "document_file_id", None),
                "documentFile": (
                    c.document_file.url if c.document_file else None
                ),
                "responseDueDate": _to_iso(c.response_due_date),
                "status": c.status,
                "respondedAt": _to_iso(c.responded_at),
                "responseRef": c.response_ref,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_correspondence_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    direction = _parse_choice(
        data.get("direction"),
        CorrespondenceRegister.DIRECTION_CHOICES,
        default="",
        code="invalid_direction",
        message="اتجاه المراسلة غير صالح.",
    )
    reference = str(data.get("referenceNumber") or "").strip()[:64]
    subject = str(data.get("subject") or "").strip()[:255]
    if not reference or not subject:
        return _api_error(
            "missing_reference_or_subject",
            status=400,
            message="رقم المرجع والموضوع مطلوبان.",
        )
    doc_name, doc_id = _document_file_value(data)
    c = CorrespondenceRegister.objects.create(
        project_id=project_id,
        direction=direction,
        reference_number=reference,
        date=_parse_date(data.get("date")) or timezone.now().date(),
        from_entity=str(data.get("fromEntity") or "").strip()[:255],
        to_entity=str(data.get("toEntity") or "").strip()[:255],
        subject=subject,
        description=str(data.get("description") or "").strip(),
        response_due_date=_parse_date(data.get("responseDueDate")),
        status=_parse_choice(
            data.get("status"),
            CorrespondenceRegister.STATUS_CHOICES,
            default=CorrespondenceRegister.STATUS_PENDING_REPLY,
            code="invalid_status",
            message="حالة المراسلة غير صالحة.",
        ),
        response_ref=str(data.get("responseRef") or "").strip()[:64],
        received_by=request.user if request.user.is_authenticated else None,
        document_file=doc_name or "",
    )
    c.document_file_id = doc_id
    _audit_ops(
        request,
        action="correspondence_create",
        entity_type="correspondence",
        entity_id=str(
            c.id,
        ),
        after={"ref": c.reference_number},
    )
    return _api_ok({"id": c.id})


@require_POST
@_validated
def admin_field_docs_correspondence_update(
    request: HttpRequest, project_id: int, correspondence_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    c = CorrespondenceRegister.objects.filter(
        pk=correspondence_id, project_id=project_id
    ).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    doc_name, doc_id = _document_file_value(data)
    c.reference_number = str(
        data.get("referenceNumber") or c.reference_number
    ).strip()[:64]
    c.date = _parse_date(data.get("date")) or c.date
    c.from_entity = str(data.get("fromEntity") or c.from_entity).strip()[:255]
    c.to_entity = str(data.get("toEntity") or c.to_entity).strip()[:255]
    c.subject = str(data.get("subject") or c.subject).strip()[:255]
    c.description = str(data.get("description") or "").strip()
    c.response_due_date = (
        _parse_date(data.get("responseDueDate")) or c.response_due_date
    )
    c.status = _parse_choice(
        data.get("status"),
        CorrespondenceRegister.STATUS_CHOICES,
        default=c.status,
        code="invalid_status",
        message="حالة المراسلة غير صالحة.",
    )
    c.response_ref = str(data.get("responseRef") or "").strip()[:64]
    if c.status == CorrespondenceRegister.STATUS_REPLIED and not c.responded_at:
        c.responded_at = timezone.now()
    if doc_name is not None:
        c.document_file = doc_name
        c.document_file_id = doc_id
    c.save()
    _audit_ops(
        request,
        action="correspondence_update",
        entity_type="correspondence",
        entity_id=str(
            c.id,
        ),
        after={"ref": c.reference_number},
    )
    return _api_ok({"id": c.id})


@require_POST
def admin_field_docs_correspondence_delete(
    request: HttpRequest, project_id: int, correspondence_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    c = CorrespondenceRegister.objects.filter(
        pk=correspondence_id, project_id=project_id
    ).first()
    if not c:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="correspondence_delete",
        entity_type="correspondence",
        entity_id=str(
            c.id,
        ),
        before={"ref": c.reference_number},
    )
    c.delete()
    return _api_ok()


@require_GET
def admin_field_docs_meetings(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in MeetingMinutes.objects.filter(project_id=project_id).annotate(
        _action_items_count=Count("action_items")
    ):
        items.append(
            {
                "id": m.id,
                "meetingNumber": m.meeting_number,
                "meetingDate": _to_iso(m.meeting_date),
                "meetingType": m.meeting_type,
                "location": m.location,
                "chairperson": m.chairperson,
                "attendees": m.attendees,
                "minutesBy": m.minutes_by,
                "summary": m.summary,
                "status": m.status,
                "documentFileId": getattr(m, "document_file_id", None),
                "documentFile": (
                    m.document_file.url if m.document_file else None
                ),
                "actionItemsCount": int(m._action_items_count or 0),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_meetings_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    number = str(data.get("meetingNumber") or "").strip()[:32]
    if not number:
        return _api_error(
            "missing_number", status=400, message="رقم الاجتماع مطلوب."
        )
    doc_name, doc_id = _document_file_value(data)
    m = MeetingMinutes.objects.create(
        project_id=project_id,
        meeting_number=number,
        meeting_date=_parse_date(data.get("meetingDate"))
        or timezone.now().date(),
        meeting_type=_parse_choice(
            data.get("meetingType"),
            MeetingMinutes.MEETING_CHOICES,
            default=MeetingMinutes.MEETING_SITE,
            code="invalid_meeting_type",
            message="نوع الاجتماع غير صالح.",
        ),
        location=str(data.get("location") or "").strip()[:255],
        chairperson=str(data.get("chairperson") or "").strip()[:255],
        attendees=str(data.get("attendees") or "").strip(),
        apologies=str(data.get("apologies") or "").strip(),
        minutes_by=str(data.get("minutesBy") or "").strip()[:255],
        summary=str(data.get("summary") or "").strip(),
        status=_parse_choice(
            data.get("status"),
            MeetingMinutes.STATUS_CHOICES,
            default=MeetingMinutes.STATUS_DRAFT,
            code="invalid_status",
            message="حالة المحضر غير صالحة.",
        ),
        document_file=doc_name or "",
    )
    m.document_file_id = doc_id
    _audit_ops(
        request,
        action="meeting_create",
        entity_type="meeting",
        entity_id=str(
            m.id,
        ),
        after={"number": m.meeting_number},
    )
    return _api_ok({"id": m.id})


@require_POST
@_validated
def admin_field_docs_meetings_update(
    request: HttpRequest, project_id: int, meeting_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = MeetingMinutes.objects.filter(
        pk=meeting_id, project_id=project_id
    ).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    doc_name, doc_id = _document_file_value(data)
    m.meeting_number = str(
        data.get("meetingNumber") or m.meeting_number
    ).strip()[:32]
    m.meeting_date = _parse_date(data.get("meetingDate")) or m.meeting_date
    m.meeting_type = _parse_choice(
        data.get("meetingType"),
        MeetingMinutes.MEETING_CHOICES,
        default=m.meeting_type,
        code="invalid_meeting_type",
        message="نوع الاجتماع غير صالح.",
    )
    m.location = str(data.get("location") or "").strip()[:255]
    m.chairperson = str(data.get("chairperson") or m.chairperson).strip()[:255]
    m.attendees = str(data.get("attendees") or m.attendees).strip()
    m.apologies = str(data.get("apologies") or "").strip()
    m.minutes_by = str(data.get("minutesBy") or m.minutes_by).strip()[:255]
    m.summary = str(data.get("summary") or "").strip()
    m.status = _parse_choice(
        data.get("status"),
        MeetingMinutes.STATUS_CHOICES,
        default=m.status,
        code="invalid_status",
        message="حالة المحضر غير صالحة.",
    )
    if doc_name is not None:
        m.document_file = doc_name
        m.document_file_id = doc_id
    m.save()
    _audit_ops(
        request,
        action="meeting_update",
        entity_type="meeting",
        entity_id=str(
            m.id,
        ),
        after={"number": m.meeting_number},
    )
    return _api_ok({"id": m.id})


@require_POST
def admin_field_docs_meetings_delete(
    request: HttpRequest, project_id: int, meeting_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = MeetingMinutes.objects.filter(
        pk=meeting_id, project_id=project_id
    ).first()
    if not m:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="meeting_delete",
        entity_type="meeting",
        entity_id=str(
            m.id,
        ),
        before={"number": m.meeting_number},
    )
    m.delete()
    return _api_ok()


@require_GET
def admin_field_docs_meetings_action_items(
    request: HttpRequest, project_id: int, meeting_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = MeetingMinutes.objects.filter(
        pk=meeting_id, project_id=project_id
    ).first()
    if not m:
        return _api_error("not_found", status=404)
    items = [
        {
            "id": ai.id,
            "itemNumber": ai.item_number,
            "description": ai.description,
            "responsible": ai.responsible,
            "dueDate": _to_iso(ai.due_date),
            "status": ai.status,
            "completedAt": _to_iso(ai.completed_at),
        }
        for ai in m.action_items.all()
    ]
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_meetings_action_items_create(
    request: HttpRequest, project_id: int, meeting_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = MeetingMinutes.objects.filter(
        pk=meeting_id, project_id=project_id
    ).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    ai = MeetingActionItem.objects.create(
        meeting=m,
        item_number=str(data.get("itemNumber") or "").strip()[:16],
        description=str(data.get("description") or "").strip(),
        responsible=str(data.get("responsible") or "").strip()[:255],
        due_date=_parse_date(data.get("dueDate")),
        status=_parse_choice(
            data.get("status"),
            MeetingActionItem.STATUS_CHOICES,
            default=MeetingActionItem.STATUS_OPEN,
            code="invalid_status",
            message="حالة بند الإجراء غير صالحة.",
        ),
    )
    _audit_ops(
        request,
        action="action_item_create",
        entity_type="action_item",
        entity_id=str(
            ai.id,
        ),
    )
    return _api_ok({"id": ai.id})


@require_POST
@_validated
def admin_field_docs_meetings_action_items_update(
    request: HttpRequest, project_id: int, meeting_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    ai = MeetingActionItem.objects.filter(
        pk=item_id, meeting_id=meeting_id, meeting__project_id=project_id
    ).first()
    if not ai:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    ai.item_number = str(data.get("itemNumber") or ai.item_number).strip()[:16]
    ai.description = str(data.get("description") or ai.description).strip()
    ai.responsible = str(data.get("responsible") or ai.responsible).strip()[
        :255
    ]
    ai.due_date = _parse_date(data.get("dueDate")) or ai.due_date
    ai.status = _parse_choice(
        data.get("status"),
        MeetingActionItem.STATUS_CHOICES,
        default=ai.status,
        code="invalid_status",
        message="حالة بند الإجراء غير صالحة.",
    )
    if ai.status == MeetingActionItem.STATUS_COMPLETED and not ai.completed_at:
        ai.completed_at = timezone.now()
    ai.save()
    _audit_ops(
        request,
        action="action_item_update",
        entity_type="action_item",
        entity_id=str(
            ai.id,
        ),
    )
    return _api_ok({"id": ai.id})


@require_POST
def admin_field_docs_meetings_action_items_delete(
    request: HttpRequest, project_id: int, meeting_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    ai = MeetingActionItem.objects.filter(
        pk=item_id, meeting_id=meeting_id, meeting__project_id=project_id
    ).first()
    if not ai:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="action_item_delete",
        entity_type="action_item",
        entity_id=str(
            ai.id,
        ),
    )
    ai.delete()
    return _api_ok()


@require_GET
def admin_field_docs_daily_reports(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for r in DailySiteReport.objects.filter(project_id=project_id):
        items.append(
            {
                "id": r.id,
                "date": _to_iso(r.date),
                "weather": r.weather,
                "temperature": r.temperature,
                "totalWorkers": r.total_workers,
                "workersBreakdown": r.workers_breakdown,
                "equipmentUsed": r.equipment_used,
                "equipmentHours": r.equipment_hours,
                "workDoneSummary": r.work_done_summary,
                "quantitiesExecuted": r.quantities_executed,
                "materialsReceived": r.materials_received,
                "issuesEncountered": r.issues_encountered,
                "delays": r.delays,
                "safetyObservations": r.safety_observations,
                "planForNextDay": r.plan_for_next_day,
                "documentFileId": getattr(r, "document_file_id", None),
                "documentFile": (
                    r.document_file.url
                    if getattr(r, "document_file", None)
                    else None
                ),
                "submittedBy": r.submitted_by_id,
                "submittedAt": _to_iso(r.submitted_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_daily_reports_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    # DailySiteReport has no document_file field; validate a supplied link but
    # never pass a nonexistent field to the ORM.
    if data.get("documentFileId") is not None:
        _document_file_value(data)
    r = DailySiteReport.objects.create(
        project_id=project_id,
        date=_parse_date(data.get("date")) or timezone.now().date(),
        weather=str(data.get("weather") or "").strip()[:64],
        temperature=str(data.get("temperature") or "").strip()[:16],
        total_workers=_parse_int(data.get("totalWorkers"), minimum=0),
        workers_breakdown=_json_object(data.get("workersBreakdown"), {}),
        equipment_used=str(data.get("equipmentUsed") or "").strip(),
        equipment_hours=_json_object(data.get("equipmentHours"), {}),
        work_done_summary=str(data.get("workDoneSummary") or "").strip(),
        quantities_executed=str(data.get("quantitiesExecuted") or "").strip(),
        materials_received=str(data.get("materialsReceived") or "").strip(),
        issues_encountered=str(data.get("issuesEncountered") or "").strip(),
        delays=str(data.get("delays") or "").strip(),
        safety_observations=str(data.get("safetyObservations") or "").strip(),
        plan_for_next_day=str(data.get("planForNextDay") or "").strip(),
        submitted_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="daily_report_create",
        entity_type="daily_report",
        entity_id=str(
            r.id,
        ),
        after={"date": str(r.date)},
    )
    return _api_ok({"id": r.id})


@require_POST
@_validated
def admin_field_docs_daily_reports_update(
    request: HttpRequest, project_id: int, report_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    r = DailySiteReport.objects.filter(
        pk=report_id, project_id=project_id
    ).first()
    if not r:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("documentFileId") is not None:
        _document_file_value(data)
    r.date = _parse_date(data.get("date")) or r.date
    r.weather = str(data.get("weather") or "").strip()[:64]
    r.temperature = str(data.get("temperature") or "").strip()[:16]
    if data.get("totalWorkers") is not None:
        r.total_workers = _parse_int(data.get("totalWorkers"), minimum=0)
    if data.get("workersBreakdown") is not None:
        r.workers_breakdown = _json_object(
            data.get("workersBreakdown"), r.workers_breakdown
        )
    r.equipment_used = str(
        data.get("equipmentUsed") or r.equipment_used or ""
    ).strip()
    if data.get("equipmentHours") is not None:
        r.equipment_hours = _json_object(
            data.get("equipmentHours"), r.equipment_hours
        )
    r.work_done_summary = str(
        data.get("workDoneSummary") or r.work_done_summary or ""
    ).strip()
    r.quantities_executed = str(
        data.get("quantitiesExecuted") or r.quantities_executed or ""
    ).strip()
    r.materials_received = str(
        data.get("materialsReceived") or r.materials_received or ""
    ).strip()
    r.issues_encountered = str(
        data.get("issuesEncountered") or r.issues_encountered or ""
    ).strip()
    r.delays = str(data.get("delays") or r.delays or "").strip()
    r.safety_observations = str(
        data.get("safetyObservations") or r.safety_observations or ""
    ).strip()
    r.plan_for_next_day = str(
        data.get("planForNextDay") or r.plan_for_next_day or ""
    ).strip()
    r.save()
    _audit_ops(
        request,
        action="daily_report_update",
        entity_type="daily_report",
        entity_id=str(
            r.id,
        ),
        after={"date": str(r.date)},
    )
    return _api_ok({"id": r.id})


@require_POST
def admin_field_docs_daily_reports_delete(
    request: HttpRequest, project_id: int, report_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    r = DailySiteReport.objects.filter(
        pk=report_id, project_id=project_id
    ).first()
    if not r:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="daily_report_delete",
        entity_type="daily_report",
        entity_id=str(
            r.id,
        ),
        before={"date": str(r.date)},
    )
    r.delete()
    return _api_ok()


@require_GET
def admin_field_docs_delivery_notes(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for n in MaterialDeliveryNote.objects.filter(
        project_id=project_id
    ).annotate(_items_count=Count("items")):
        items.append(
            {
                "id": n.id,
                "purchaseOrderId": n.purchase_order_id,
                "deliveryDate": _to_iso(n.delivery_date),
                "supplierName": n.supplier_name,
                "vehiclePlate": n.vehicle_plate,
                "driverName": n.driver_name,
                "notes": n.notes,
                "itemsCount": int(n._items_count or 0),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_delivery_notes_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    po_pk = _parse_int(data.get("purchaseOrderId"), default=0)
    po = PurchaseOrder.objects.filter(pk=po_pk).first() if po_pk else None
    n = MaterialDeliveryNote.objects.create(
        project_id=project_id,
        purchase_order=po,
        delivery_date=_parse_date(data.get("deliveryDate"))
        or timezone.now().date(),
        supplier_name=str(data.get("supplierName") or "").strip()[:255],
        vehicle_plate=str(data.get("vehiclePlate") or "").strip()[:32],
        driver_name=str(data.get("driverName") or "").strip()[:255],
        notes=str(data.get("notes") or "").strip(),
        received_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="delivery_note_create",
        entity_type="delivery_note",
        entity_id=str(
            n.id,
        ),
    )
    return _api_ok({"id": n.id})


@require_POST
@_validated
def admin_field_docs_delivery_notes_update(
    request: HttpRequest, project_id: int, note_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    n = MaterialDeliveryNote.objects.filter(
        pk=note_id, project_id=project_id
    ).first()
    if not n:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    po_pk = _parse_int(data.get("purchaseOrderId"), default=0)
    n.purchase_order = (
        PurchaseOrder.objects.filter(pk=po_pk).first() if po_pk else None
    )
    n.delivery_date = _parse_date(data.get("deliveryDate")) or n.delivery_date
    n.supplier_name = str(data.get("supplierName") or n.supplier_name).strip()[
        :255
    ]
    n.vehicle_plate = str(data.get("vehiclePlate") or "").strip()[:32]
    n.driver_name = str(data.get("driverName") or "").strip()[:255]
    n.notes = str(data.get("notes") or "").strip()
    n.save()
    _audit_ops(
        request,
        action="delivery_note_update",
        entity_type="delivery_note",
        entity_id=str(
            n.id,
        ),
    )
    return _api_ok({"id": n.id})


@require_POST
def admin_field_docs_delivery_notes_delete(
    request: HttpRequest, project_id: int, note_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    n = MaterialDeliveryNote.objects.filter(
        pk=note_id, project_id=project_id
    ).first()
    if not n:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="delivery_note_delete",
        entity_type="delivery_note",
        entity_id=str(
            n.id,
        ),
    )
    n.delete()
    return _api_ok()


@require_POST
@_validated
def admin_field_docs_delivery_notes_add_item(
    request: HttpRequest, project_id: int, note_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    n = MaterialDeliveryNote.objects.filter(
        pk=note_id, project_id=project_id
    ).first()
    if not n:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    inv_pk = _parse_int(data.get("inventoryItemId"), default=0)
    inventory_item = (
        InventoryItem.objects.filter(pk=inv_pk).first() if inv_pk else None
    )
    quantity = _parse_decimal(
        data.get("quantity"), default=Decimal("0"), allow_negative=False
    )
    unit_price = _parse_decimal(
        data.get("unitPrice"), default=Decimal("0"), allow_negative=False
    )
    description = str(data.get("description") or "").strip()
    unit = str(data.get("unit") or "").strip()
    if not description or not unit:
        raise _InvalidInput(
            "missing_description_or_unit", "الوصف والوحدة مطلوبان."
        )
    MaterialDeliveryNoteItem.objects.create(
        note=n,
        inventory_item=inventory_item,
        description=description[:255],
        unit=unit[:32],
        quantity=quantity,
        unit_price=unit_price,
    )
    _audit_ops(
        request,
        action="delivery_note_add_item",
        entity_type="delivery_note",
        entity_id=str(
            n.id,
        ),
    )
    return _api_ok({"id": n.id})


@require_POST
@_validated
def admin_field_docs_delivery_notes_update_item(
    request: HttpRequest, project_id: int, note_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    item = MaterialDeliveryNoteItem.objects.filter(
        pk=item_id, note_id=note_id, note__project_id=project_id
    ).first()
    if not item:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    inv_pk = _parse_int(data.get("inventoryItemId"), default=0)
    item.inventory_item = (
        InventoryItem.objects.filter(pk=inv_pk).first() if inv_pk else None
    )
    item.description = str(data.get("description") or item.description).strip()[
        :255
    ]
    item.unit = str(data.get("unit") or item.unit).strip()[:32]
    item.quantity = _parse_decimal(
        data.get("quantity"),
        default=item.quantity,
        allow_negative=False,
    )
    item.unit_price = _parse_decimal(
        data.get("unitPrice"),
        default=item.unit_price,
        allow_negative=False,
    )
    item.save()
    _audit_ops(
        request,
        action="delivery_note_update_item",
        entity_type="delivery_note",
        entity_id=str(
            item.note_id,
        ),
    )
    return _api_ok({"id": item.id})


@require_POST
def admin_field_docs_delivery_notes_remove_item(
    request: HttpRequest, project_id: int, note_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    item = MaterialDeliveryNoteItem.objects.filter(
        pk=item_id, note_id=note_id, note__project_id=project_id
    ).first()
    if not item:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="delivery_note_remove_item",
        entity_type="delivery_note",
        entity_id=str(
            item.note_id,
        ),
    )
    item.delete()
    return _api_ok()


@require_GET
def admin_field_docs_rfi(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for r in RFI.objects.filter(project_id=project_id):
        items.append(
            {
                "id": r.id,
                "rfiNumber": r.rfi_number,
                "subject": r.subject,
                "question": r.question,
                "category": r.category,
                "priority": r.priority,
                "status": r.status,
                "submittedTo": r.submitted_to,
                "submittedAt": _to_iso(r.submitted_at),
                "response": r.response,
                "respondedBy": r.responded_by,
                "respondedAt": _to_iso(r.responded_at),
                "daysToRespond": r.days_to_respond,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_rfi_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    rfi_number = str(data.get("rfiNumber") or "").strip()[:32]
    subject = str(data.get("subject") or "").strip()[:255]
    if not rfi_number or not subject:
        return _api_error(
            "missing_number_or_subject",
            status=400,
            message="الرقم والموضوع مطلوبان.",
        )
    r = RFI.objects.create(
        project_id=project_id,
        rfi_number=rfi_number,
        subject=subject,
        question=str(data.get("question") or "").strip(),
        category=_parse_choice(
            data.get("category"),
            RFI.CATEGORY_CHOICES,
            default=RFI.CATEGORY_OTHER,
            code="invalid_category",
            message="تصنيف RFI غير صالح.",
        ),
        priority=_parse_choice(
            data.get("priority"),
            RFI.PRIORITY_CHOICES,
            default=RFI.PRIORITY_MEDIUM,
            code="invalid_priority",
            message="أولوية RFI غير صالحة.",
        ),
        status=_parse_choice(
            data.get("status"),
            RFI.STATUS_CHOICES,
            default=RFI.STATUS_OPEN,
            code="invalid_status",
            message="حالة RFI غير صالحة.",
        ),
        submitted_to=str(data.get("submittedTo") or "").strip()[:255],
        days_to_respond=_parse_int(data.get("daysToRespond"), minimum=0),
        submitted_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="rfi_create",
        entity_type="rfi",
        entity_id=str(
            r.id,
        ),
        after={"number": r.rfi_number},
    )
    return _api_ok({"id": r.id})


@require_POST
@_validated
def admin_field_docs_rfi_update(
    request: HttpRequest, project_id: int, rfi_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    r = RFI.objects.filter(pk=rfi_id, project_id=project_id).first()
    if not r:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    r.rfi_number = str(data.get("rfiNumber") or r.rfi_number).strip()[:32]
    r.subject = str(data.get("subject") or r.subject).strip()[:255]
    r.question = str(data.get("question") or "").strip()
    r.category = _parse_choice(
        data.get("category"),
        RFI.CATEGORY_CHOICES,
        default=r.category,
        code="invalid_category",
        message="تصنيف RFI غير صالح.",
    )
    r.priority = _parse_choice(
        data.get("priority"),
        RFI.PRIORITY_CHOICES,
        default=r.priority,
        code="invalid_priority",
        message="أولوية RFI غير صالحة.",
    )
    r.status = _parse_choice(
        data.get("status"),
        RFI.STATUS_CHOICES,
        default=r.status,
        code="invalid_status",
        message="حالة RFI غير صالحة.",
    )
    r.submitted_to = str(data.get("submittedTo") or "").strip()[:255]
    r.response = str(data.get("response") or "").strip()
    r.responded_by = str(data.get("respondedBy") or "").strip()[:255]
    if data.get("daysToRespond") is not None:
        r.days_to_respond = _parse_int(data.get("daysToRespond"), minimum=0)
    if r.status == RFI.STATUS_ANSWERED and not r.responded_at:
        r.responded_at = timezone.now()
    r.save()
    _audit_ops(
        request,
        action="rfi_update",
        entity_type="rfi",
        entity_id=str(
            r.id,
        ),
        after={"number": r.rfi_number},
    )
    return _api_ok({"id": r.id})


@require_POST
def admin_field_docs_rfi_delete(
    request: HttpRequest, project_id: int, rfi_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    r = RFI.objects.filter(pk=rfi_id, project_id=project_id).first()
    if not r:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="rfi_delete",
        entity_type="rfi",
        entity_id=str(
            r.id,
        ),
        before={"number": r.rfi_number},
    )
    r.delete()
    return _api_ok()


@require_GET
def admin_field_docs_ncr(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for n in NCR.objects.filter(project_id=project_id):
        items.append(
            {
                "id": n.id,
                "ncrNumber": n.ncr_number,
                "date": _to_iso(n.date),
                "location": n.location,
                "severity": n.severity,
                "description": n.description,
                "clauseRef": n.clause_ref,
                "status": n.status,
                "correctiveAction": n.corrective_action,
                "actionDeadline": _to_iso(n.action_deadline),
                "closedAt": _to_iso(n.closed_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_ncr_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ncr_number = str(data.get("ncrNumber") or "").strip()[:32]
    if not ncr_number:
        return _api_error(
            "missing_number", status=400, message="رقم NCR مطلوب."
        )
    n = NCR.objects.create(
        project_id=project_id,
        ncr_number=ncr_number,
        date=_parse_date(data.get("date")) or timezone.now().date(),
        location=str(data.get("location") or "").strip()[:255],
        severity=_parse_choice(
            data.get("severity"),
            NCR.SEVERITY_CHOICES,
            default=NCR.SEVERITY_MINOR,
            code="invalid_severity",
            message="درجة خطورة NCR غير صالحة.",
        ),
        description=str(data.get("description") or "").strip(),
        clause_ref=str(data.get("clauseRef") or "").strip()[:64],
        status=_parse_choice(
            data.get("status"),
            NCR.STATUS_CHOICES,
            default=NCR.STATUS_OPEN,
            code="invalid_status",
            message="حالة NCR غير صالحة.",
        ),
        corrective_action=str(data.get("correctiveAction") or "").strip(),
        action_deadline=_parse_date(data.get("actionDeadline")),
        raised_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="ncr_create",
        entity_type="ncr",
        entity_id=str(
            n.id,
        ),
        after={"number": n.ncr_number},
    )
    return _api_ok({"id": n.id})


@require_POST
@_validated
def admin_field_docs_ncr_update(
    request: HttpRequest, project_id: int, ncr_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    n = NCR.objects.filter(pk=ncr_id, project_id=project_id).first()
    if not n:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    n.ncr_number = str(data.get("ncrNumber") or n.ncr_number).strip()[:32]
    n.date = _parse_date(data.get("date")) or n.date
    n.location = str(data.get("location") or "").strip()[:255]
    n.severity = _parse_choice(
        data.get("severity"),
        NCR.SEVERITY_CHOICES,
        default=n.severity,
        code="invalid_severity",
        message="درجة خطورة NCR غير صالحة.",
    )
    n.description = str(data.get("description") or "").strip()
    n.clause_ref = str(data.get("clauseRef") or "").strip()[:64]
    n.status = _parse_choice(
        data.get("status"),
        NCR.STATUS_CHOICES,
        default=n.status,
        code="invalid_status",
        message="حالة NCR غير صالحة.",
    )
    n.corrective_action = str(data.get("correctiveAction") or "").strip()
    n.action_deadline = (
        _parse_date(data.get("actionDeadline")) or n.action_deadline
    )
    if n.status == NCR.STATUS_CLOSED and not n.closed_at:
        n.closed_at = timezone.now()
        n.closed_by = request.user if request.user.is_authenticated else None
    n.save()
    _audit_ops(
        request,
        action="ncr_update",
        entity_type="ncr",
        entity_id=str(
            n.id,
        ),
        after={"number": n.ncr_number},
    )
    return _api_ok({"id": n.id})


@require_POST
def admin_field_docs_ncr_delete(
    request: HttpRequest, project_id: int, ncr_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    n = NCR.objects.filter(pk=ncr_id, project_id=project_id).first()
    if not n:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="ncr_delete",
        entity_type="ncr",
        entity_id=str(
            n.id,
        ),
        before={"number": n.ncr_number},
    )
    n.delete()
    return _api_ok()


@require_GET
def admin_field_docs_submittals(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for s in Submittal.objects.filter(project_id=project_id):
        items.append(
            {
                "id": s.id,
                "submittalNumber": s.submittal_number,
                "title": s.title,
                "category": s.category,
                "status": s.status,
                "submittedTo": s.submitted_to,
                "submittedAt": _to_iso(s.submitted_at),
                "response": s.response,
                "respondedAt": _to_iso(s.responded_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_field_docs_submittals_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    number = str(data.get("submittalNumber") or "").strip()[:32]
    title = str(data.get("title") or "").strip()[:255]
    if not number or not title:
        return _api_error(
            "missing_number_or_title",
            status=400,
            message="الرقم والعنوان مطلوبان.",
        )
    s = Submittal.objects.create(
        project_id=project_id,
        submittal_number=number,
        title=title,
        category=_parse_choice(
            data.get("category"),
            Submittal.CATEGORY_CHOICES,
            default=Submittal.CATEGORY_MATERIAL_SAMPLE,
            code="invalid_category",
            message="تصنيف Submittal غير صالح.",
        ),
        status=_parse_choice(
            data.get("status"),
            Submittal.STATUS_CHOICES,
            default=Submittal.STATUS_SUBMITTED,
            code="invalid_status",
            message="حالة Submittal غير صالحة.",
        ),
        submitted_to=str(data.get("submittedTo") or "").strip()[:255],
        response=str(data.get("response") or "").strip(),
        submitted_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="submittal_create",
        entity_type="submittal",
        entity_id=str(
            s.id,
        ),
        after={"number": s.submittal_number},
    )
    return _api_ok({"id": s.id})


@require_POST
@_validated
def admin_field_docs_submittals_update(
    request: HttpRequest, project_id: int, submittal_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = Submittal.objects.filter(pk=submittal_id, project_id=project_id).first()
    if not s:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    s.submittal_number = str(
        data.get("submittalNumber") or s.submittal_number
    ).strip()[:32]
    s.title = str(data.get("title") or s.title).strip()[:255]
    s.category = _parse_choice(
        data.get("category"),
        Submittal.CATEGORY_CHOICES,
        default=s.category,
        code="invalid_category",
        message="تصنيف Submittal غير صالح.",
    )
    s.status = _parse_choice(
        data.get("status"),
        Submittal.STATUS_CHOICES,
        default=s.status,
        code="invalid_status",
        message="حالة Submittal غير صالحة.",
    )
    s.submitted_to = str(data.get("submittedTo") or "").strip()[:255]
    s.response = str(data.get("response") or "").strip()
    if (
        s.status
        in (
            Submittal.STATUS_APPROVED,
            Submittal.STATUS_APPROVED_WITH_COMMENTS,
            Submittal.STATUS_REJECTED,
        )
        and not s.responded_at
    ):
        s.responded_at = timezone.now()
    s.save()
    _audit_ops(
        request,
        action="submittal_update",
        entity_type="submittal",
        entity_id=str(
            s.id,
        ),
        after={"number": s.submittal_number},
    )
    return _api_ok({"id": s.id})


@require_POST
def admin_field_docs_submittals_delete(
    request: HttpRequest, project_id: int, submittal_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = Submittal.objects.filter(pk=submittal_id, project_id=project_id).first()
    if not s:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="submittal_delete",
        entity_type="submittal",
        entity_id=str(
            s.id,
        ),
        before={"number": s.submittal_number},
    )
    s.delete()
    return _api_ok()


@require_GET
def admin_field_docs_delivery_note_items(
    request: HttpRequest, project_id: int, note_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    note = MaterialDeliveryNote.objects.filter(
        pk=note_id, project_id=project_id
    ).first()
    if not note:
        return _api_error("not_found", status=404)
    items = [
        {
            "id": item.id,
            "inventoryItemId": item.inventory_item_id,
            "description": item.description,
            "quantity": float(item.quantity or 0),
            "unit": item.unit,
            "unitPrice": float(item.unit_price or 0),
            "total": float(item.total or 0),
        }
        for item in note.items.select_related("inventory_item").order_by("id")
    ]
    return _api_ok({"items": items})
