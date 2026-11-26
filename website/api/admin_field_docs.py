"""Field documentation API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

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
def admin_field_docs_correspondence_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    direction = str(data.get("direction") or "").strip()
    if direction not in dict(CorrespondenceRegister.DIRECTION_CHOICES):
        return _api_error("invalid_direction", status=400)
    reference = str(data.get("referenceNumber") or "").strip()
    subject = str(data.get("subject") or "").strip()
    if not reference or not subject:
        return _api_error("missing_reference_or_subject", status=400)
    c = CorrespondenceRegister.objects.create(
        project_id=project_id,
        direction=direction,
        reference_number=reference,
        date=_to_date(data.get("date")) or timezone.now().date(),
        from_entity=str(data.get("fromEntity") or "").strip(),
        to_entity=str(data.get("toEntity") or "").strip(),
        subject=subject,
        description=str(data.get("description") or "").strip(),
        response_due_date=_to_date(data.get("responseDueDate")),
        status=str(
            data.get("status") or CorrespondenceRegister.STATUS_PENDING_REPLY
        ).strip(),
        response_ref=str(data.get("responseRef") or "").strip(),
        received_by=request.user if request.user.is_authenticated else None,
    )
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
    c.reference_number = str(
        data.get("referenceNumber") or c.reference_number
    ).strip()
    c.date = _to_date(data.get("date")) or c.date
    c.from_entity = str(data.get("fromEntity") or c.from_entity).strip()
    c.to_entity = str(data.get("toEntity") or c.to_entity).strip()
    c.subject = str(data.get("subject") or c.subject).strip()
    c.description = str(data.get("description") or "").strip()
    c.response_due_date = (
        _to_date(data.get("responseDueDate")) or c.response_due_date
    )
    c.status = str(data.get("status") or c.status).strip()
    c.response_ref = str(data.get("responseRef") or "").strip()
    if c.status == CorrespondenceRegister.STATUS_REPLIED and not c.responded_at:
        c.responded_at = timezone.now()
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
    for m in MeetingMinutes.objects.filter(project_id=project_id):
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
                "documentFile": (
                    m.document_file.url if m.document_file else None
                ),
                "actionItemsCount": m.action_items.count(),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_field_docs_meetings_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    number = str(data.get("meetingNumber") or "").strip()
    if not number:
        return _api_error("missing_number", status=400)
    m = MeetingMinutes.objects.create(
        project_id=project_id,
        meeting_number=number,
        meeting_date=_to_date(data.get("meetingDate")) or timezone.now().date(),
        meeting_type=str(
            data.get("meetingType") or MeetingMinutes.MEETING_SITE
        ).strip(),
        location=str(data.get("location") or "").strip(),
        chairperson=str(data.get("chairperson") or "").strip(),
        attendees=str(data.get("attendees") or "").strip(),
        apologies=str(data.get("apologies") or "").strip(),
        minutes_by=str(data.get("minutesBy") or "").strip(),
        summary=str(data.get("summary") or "").strip(),
        status=str(data.get("status") or MeetingMinutes.STATUS_DRAFT).strip(),
    )
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
    m.meeting_number = str(
        data.get("meetingNumber") or m.meeting_number
    ).strip()
    m.meeting_date = _to_date(data.get("meetingDate")) or m.meeting_date
    m.meeting_type = str(data.get("meetingType") or m.meeting_type).strip()
    m.location = str(data.get("location") or "").strip()
    m.chairperson = str(data.get("chairperson") or m.chairperson).strip()
    m.attendees = str(data.get("attendees") or m.attendees).strip()
    m.apologies = str(data.get("apologies") or "").strip()
    m.minutes_by = str(data.get("minutesBy") or m.minutes_by).strip()
    m.summary = str(data.get("summary") or "").strip()
    m.status = str(data.get("status") or m.status).strip()
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
        item_number=str(data.get("itemNumber") or "").strip(),
        description=str(data.get("description") or "").strip(),
        responsible=str(data.get("responsible") or "").strip(),
        due_date=_to_date(data.get("dueDate")),
        status=str(data.get("status") or MeetingActionItem.STATUS_OPEN).strip(),
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
    ai.item_number = str(data.get("itemNumber") or ai.item_number).strip()
    ai.description = str(data.get("description") or ai.description).strip()
    ai.responsible = str(data.get("responsible") or ai.responsible).strip()
    ai.due_date = _to_date(data.get("dueDate")) or ai.due_date
    ai.status = str(data.get("status") or ai.status).strip()
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
                "submittedBy": r.submitted_by_id,
                "submittedAt": _to_iso(r.submitted_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_field_docs_daily_reports_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    r = DailySiteReport.objects.create(
        project_id=project_id,
        date=_to_date(data.get("date")) or timezone.now().date(),
        weather=str(data.get("weather") or "").strip(),
        temperature=str(data.get("temperature") or "").strip(),
        total_workers=int(data.get("totalWorkers") or 0),
        workers_breakdown=data.get("workersBreakdown") or {},
        equipment_used=str(data.get("equipmentUsed") or "").strip(),
        equipment_hours=data.get("equipmentHours") or {},
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
    r.date = _to_date(data.get("date")) or r.date
    r.weather = str(data.get("weather") or "").strip()
    r.temperature = str(data.get("temperature") or "").strip()
    r.total_workers = int(data.get("totalWorkers") or r.total_workers)
    r.workers_breakdown = data.get("workersBreakdown") or r.workers_breakdown
    r.equipment_used = str(data.get("equipmentUsed") or "").strip()
    r.equipment_hours = data.get("equipmentHours") or r.equipment_hours
    r.work_done_summary = str(data.get("workDoneSummary") or "").strip()
    r.quantities_executed = str(data.get("quantitiesExecuted") or "").strip()
    r.materials_received = str(data.get("materialsReceived") or "").strip()
    r.issues_encountered = str(data.get("issuesEncountered") or "").strip()
    r.delays = str(data.get("delays") or "").strip()
    r.safety_observations = str(data.get("safetyObservations") or "").strip()
    r.plan_for_next_day = str(data.get("planForNextDay") or "").strip()
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
    for n in MaterialDeliveryNote.objects.filter(project_id=project_id):
        items.append(
            {
                "id": n.id,
                "purchaseOrderId": n.purchase_order_id,
                "deliveryDate": _to_iso(n.delivery_date),
                "supplierName": n.supplier_name,
                "vehiclePlate": n.vehicle_plate,
                "driverName": n.driver_name,
                "notes": n.notes,
                "itemsCount": n.items.count(),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_field_docs_delivery_notes_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    purchase_order_id = data.get("purchaseOrderId")
    po = None
    if purchase_order_id:
        po = PurchaseOrder.objects.filter(pk=int(purchase_order_id)).first()
    n = MaterialDeliveryNote.objects.create(
        project_id=project_id,
        purchase_order=po,
        delivery_date=_to_date(data.get("deliveryDate"))
        or timezone.now().date(),
        supplier_name=str(data.get("supplierName") or "").strip(),
        vehicle_plate=str(data.get("vehiclePlate") or "").strip(),
        driver_name=str(data.get("driverName") or "").strip(),
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
    purchase_order_id = data.get("purchaseOrderId")
    n.purchase_order = (
        PurchaseOrder.objects.filter(pk=int(purchase_order_id)).first()
        if purchase_order_id
        else None
    )
    n.delivery_date = _to_date(data.get("deliveryDate")) or n.delivery_date
    n.supplier_name = str(data.get("supplierName") or n.supplier_name).strip()
    n.vehicle_plate = str(data.get("vehiclePlate") or "").strip()
    n.driver_name = str(data.get("driverName") or "").strip()
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
    inventory_item_id = data.get("inventoryItemId")
    inventory_item = None
    if inventory_item_id:
        inventory_item = InventoryItem.objects.filter(
            pk=int(inventory_item_id)
        ).first()
    quantity = _to_dec(data.get("quantity")) or Decimal("0")
    unit_price = _to_dec(data.get("unitPrice")) or Decimal("0")
    MaterialDeliveryNoteItem.objects.create(
        note=n,
        inventory_item=inventory_item,
        description=str(data.get("description") or "").strip(),
        unit=str(data.get("unit") or "").strip(),
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
    inventory_item_id = data.get("inventoryItemId")
    item.inventory_item = (
        InventoryItem.objects.filter(pk=int(inventory_item_id)).first()
        if inventory_item_id
        else None
    )
    item.description = str(data.get("description") or item.description).strip()
    item.unit = str(data.get("unit") or item.unit).strip()
    item.quantity = _to_dec(data.get("quantity")) or item.quantity
    item.unit_price = _to_dec(data.get("unitPrice")) or item.unit_price
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
def admin_field_docs_rfi_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    rfi_number = str(data.get("rfiNumber") or "").strip()
    subject = str(data.get("subject") or "").strip()
    if not rfi_number or not subject:
        return _api_error("missing_number_or_subject", status=400)
    r = RFI.objects.create(
        project_id=project_id,
        rfi_number=rfi_number,
        subject=subject,
        question=str(data.get("question") or "").strip(),
        category=str(data.get("category") or RFI.CATEGORY_OTHER).strip(),
        priority=str(data.get("priority") or RFI.PRIORITY_MEDIUM).strip(),
        status=str(data.get("status") or RFI.STATUS_OPEN).strip(),
        submitted_to=str(data.get("submittedTo") or "").strip(),
        days_to_respond=int(data.get("daysToRespond") or 0),
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
    r.rfi_number = str(data.get("rfiNumber") or r.rfi_number).strip()
    r.subject = str(data.get("subject") or r.subject).strip()
    r.question = str(data.get("question") or "").strip()
    r.category = str(data.get("category") or r.category).strip()
    r.priority = str(data.get("priority") or r.priority).strip()
    r.status = str(data.get("status") or r.status).strip()
    r.submitted_to = str(data.get("submittedTo") or "").strip()
    r.response = str(data.get("response") or "").strip()
    r.responded_by = str(data.get("respondedBy") or "").strip()
    r.days_to_respond = int(data.get("daysToRespond") or r.days_to_respond)
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
def admin_field_docs_ncr_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ncr_number = str(data.get("ncrNumber") or "").strip()
    if not ncr_number:
        return _api_error("missing_number", status=400)
    n = NCR.objects.create(
        project_id=project_id,
        ncr_number=ncr_number,
        date=_to_date(data.get("date")) or timezone.now().date(),
        location=str(data.get("location") or "").strip(),
        severity=str(data.get("severity") or NCR.SEVERITY_MINOR).strip(),
        description=str(data.get("description") or "").strip(),
        clause_ref=str(data.get("clauseRef") or "").strip(),
        status=str(data.get("status") or NCR.STATUS_OPEN).strip(),
        corrective_action=str(data.get("correctiveAction") or "").strip(),
        action_deadline=_to_date(data.get("actionDeadline")),
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
    n.ncr_number = str(data.get("ncrNumber") or n.ncr_number).strip()
    n.date = _to_date(data.get("date")) or n.date
    n.location = str(data.get("location") or "").strip()
    n.severity = str(data.get("severity") or n.severity).strip()
    n.description = str(data.get("description") or "").strip()
    n.clause_ref = str(data.get("clauseRef") or "").strip()
    n.status = str(data.get("status") or n.status).strip()
    n.corrective_action = str(data.get("correctiveAction") or "").strip()
    n.action_deadline = (
        _to_date(data.get("actionDeadline")) or n.action_deadline
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
def admin_field_docs_submittals_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    number = str(data.get("submittalNumber") or "").strip()
    title = str(data.get("title") or "").strip()
    if not number or not title:
        return _api_error("missing_number_or_title", status=400)
    s = Submittal.objects.create(
        project_id=project_id,
        submittal_number=number,
        title=title,
        category=str(
            data.get("category") or Submittal.CATEGORY_MATERIAL_SAMPLE
        ).strip(),
        status=str(data.get("status") or Submittal.STATUS_SUBMITTED).strip(),
        submitted_to=str(data.get("submittedTo") or "").strip(),
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
    ).strip()
    s.title = str(data.get("title") or s.title).strip()
    s.category = str(data.get("category") or s.category).strip()
    s.status = str(data.get("status") or s.status).strip()
    s.submitted_to = str(data.get("submittedTo") or "").strip()
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
