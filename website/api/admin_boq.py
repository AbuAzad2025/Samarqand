"""BOQ API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.http import HttpRequest
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import FinalAccount
from website.models import PaymentApplication
from website.models import PaymentApplicationItem
from website.models import ProjectBOQItem
from website.models import ProjectPage
from website.models import VariationOrder
from website.models import VariationOrderItem

logger = logging.getLogger(__name__)

from .common import *


@require_GET
def admin_boq_projects(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for p in ProjectPage.objects.live().values("id", "title"):
        items.append({"id": p["id"], "title": p["title"]})
    return _api_ok({"items": items})


@require_GET
def admin_boq_items(request: HttpRequest, project_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    items: list[dict[str, Any]] = []
    for it in ProjectBOQItem.objects.filter(project=project).select_related(
        "account"
    ):
        items.append(
            {
                "id": it.id,
                "sortOrder": it.sort_order,
                "itemCode": it.item_code,
                "description": it.description,
                "unit": it.unit,
                "quantity": float(it.quantity),
                "unitPrice": float(it.unit_price),
                "totalPrice": float(it.total_price),
                "accountId": it.account_id,
                "executedQuantity": float(it.executed_quantity()),
                "remainingQuantity": float(it.remaining_quantity()),
                "notes": it.notes,
            }
        )
    return _api_ok(
        {"projectId": project.id, "projectTitle": project.title, "items": items}
    )


@require_POST
def admin_boq_items_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    data = _read_json(request)
    description = str(data.get("description") or "").strip()
    unit = str(data.get("unit") or "").strip()
    if not description or not unit:
        return _api_error("missing_description_or_unit", status=400)
    quantity = _to_dec(data.get("quantity"))
    unit_price = _to_dec(data.get("unitPrice"))
    if quantity is None or quantity < 0 or unit_price is None or unit_price < 0:
        return _api_error("invalid_quantity_or_price", status=400)
    account_id = data.get("accountId")
    account = None
    if account_id:
        from website.models import Account

        account = Account.objects.filter(pk=int(account_id)).first()
    it = ProjectBOQItem.objects.create(
        project=project,
        sort_order=int(data.get("sortOrder") or 0),
        item_code=str(data.get("itemCode") or "").strip(),
        description=description,
        unit=unit,
        quantity=quantity,
        unit_price=unit_price,
        account=account,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="boq_item_create",
        entity_type="boq_item",
        entity_id=str(it.id),
        after={"project": project.title, "description": it.description},
    )
    return _api_ok({"id": it.id})


@require_POST
def admin_boq_items_update(
    request: HttpRequest, project_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    it = ProjectBOQItem.objects.filter(pk=item_id, project=project).first()
    if not it:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    description = str(data.get("description") or "").strip()
    unit = str(data.get("unit") or "").strip()
    if not description or not unit:
        return _api_error("missing_description_or_unit", status=400)
    quantity = _to_dec(data.get("quantity"))
    unit_price = _to_dec(data.get("unitPrice"))
    if quantity is None or quantity < 0 or unit_price is None or unit_price < 0:
        return _api_error("invalid_quantity_or_price", status=400)
    it.sort_order = int(data.get("sortOrder") or it.sort_order)
    it.item_code = str(data.get("itemCode") or "").strip()
    it.description = description
    it.unit = unit
    it.quantity = quantity
    it.unit_price = unit_price
    account_id = data.get("accountId")
    if account_id is not None:
        from website.models import Account

        it.account = (
            Account.objects.filter(pk=int(account_id)).first()
            if account_id
            else None
        )
    it.notes = str(data.get("notes") or "").strip()
    it.save()
    _audit_ops(
        request,
        action="boq_item_update",
        entity_type="boq_item",
        entity_id=str(it.id),
        after={"description": it.description},
    )
    return _api_ok({"id": it.id})


@require_POST
def admin_boq_items_delete(
    request: HttpRequest, project_id: int, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    it = ProjectBOQItem.objects.filter(pk=item_id, project=project).first()
    if not it:
        return _api_error("not_found", status=404)
    if it.payment_items.exists():
        return _api_error("has_payment_items", status=400)
    _audit_ops(
        request,
        action="boq_item_delete",
        entity_type="boq_item",
        entity_id=str(it.id),
        before={"description": it.description},
    )
    it.delete()
    return _api_ok()


@require_GET
def admin_boq_payment_applications(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    items: list[dict[str, Any]] = []
    for pa in PaymentApplication.objects.filter(project=project):
        items.append(
            {
                "id": pa.id,
                "applicationNumber": pa.application_number,
                "applicationDate": _to_iso(pa.application_date),
                "periodFrom": _to_iso(pa.period_from),
                "periodTo": _to_iso(pa.period_to),
                "totalWorksDone": float(pa.total_works_done),
                "previousApplicationsTotal": float(
                    pa.previous_applications_total
                ),
                "currentDue": float(pa.current_due),
                "retentionPercent": float(pa.retention_percent),
                "retentionAmount": float(pa.retention_amount),
                "withholdingTaxPercent": float(pa.withholding_tax_percent),
                "withholdingTaxAmount": float(pa.withholding_tax_amount),
                "previousDeductions": float(pa.previous_deductions),
                "netAmount": float(pa.net_amount),
                "status": pa.status,
                "submittedToConsultant": pa.submitted_to_consultant,
                "consultantApproved": pa.consultant_approved,
                "consultantNotes": pa.consultant_notes,
                "journalEntryId": pa.journal_entry_id,
            }
        )
    return _api_ok(
        {"projectId": project.id, "projectTitle": project.title, "items": items}
    )


@require_GET
def admin_boq_payment_applications_detail(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    lines: list[dict[str, Any]] = []
    for item in pa.items.select_related("boq_item"):
        lines.append(
            {
                "id": item.id,
                "boqItemId": item.boq_item_id,
                "boqItemDescription": item.boq_item.description,
                "contractedQuantity": float(item.contracted_quantity),
                "previouslyDoneQuantity": float(item.previously_done_quantity),
                "currentQuantity": float(item.current_quantity),
                "totalDoneQuantity": float(item.total_done_quantity),
                "donePercent": float(item.done_percent),
                "unitPrice": float(item.unit_price),
                "totalAmount": float(item.total_amount),
                "previouslyCertified": float(item.previously_certified),
                "currentAmount": float(item.current_amount),
            }
        )
    return _api_ok(
        {
            "id": pa.id,
            "applicationNumber": pa.application_number,
            "applicationDate": _to_iso(pa.application_date),
            "periodFrom": _to_iso(pa.period_from),
            "periodTo": _to_iso(pa.period_to),
            "totalWorksDone": float(pa.total_works_done),
            "previousApplicationsTotal": float(pa.previous_applications_total),
            "currentDue": float(pa.current_due),
            "retentionPercent": float(pa.retention_percent),
            "retentionAmount": float(pa.retention_amount),
            "withholdingTaxPercent": float(pa.withholding_tax_percent),
            "withholdingTaxAmount": float(pa.withholding_tax_amount),
            "previousDeductions": float(pa.previous_deductions),
            "netAmount": float(pa.net_amount),
            "status": pa.status,
            "submittedToConsultant": pa.submitted_to_consultant,
            "consultantApproved": pa.consultant_approved,
            "consultantNotes": pa.consultant_notes,
            "journalEntryId": pa.journal_entry_id,
            "items": lines,
        }
    )


@require_POST
def admin_boq_payment_applications_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    data = _read_json(request)
    app_number = str(data.get("applicationNumber") or "").strip()
    app_date = _to_date(data.get("applicationDate"))
    if not app_number or not app_date:
        return _api_error("missing_number_or_date", status=400)
    pa = PaymentApplication.objects.create(
        project=project,
        application_number=app_number,
        application_date=app_date,
        period_from=_to_date(data.get("periodFrom")),
        period_to=_to_date(data.get("periodTo")),
        previous_applications_total=_to_dec(
            data.get("previousApplicationsTotal")
        )
        or Decimal("0"),
        retention_percent=_to_dec(data.get("retentionPercent"))
        or Decimal("10"),
        withholding_tax_percent=_to_dec(data.get("withholdingTaxPercent"))
        or Decimal("10"),
        previous_deductions=_to_dec(data.get("previousDeductions"))
        or Decimal("0"),
        created_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="payment_application_create",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"number": pa.application_number},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_update(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_locked", status=400)
    data = _read_json(request)
    pa.application_number = str(
        data.get("applicationNumber") or pa.application_number
    ).strip()
    app_date = _to_date(data.get("applicationDate"))
    if app_date:
        pa.application_date = app_date
    pa.period_from = _to_date(data.get("periodFrom")) or pa.period_from
    pa.period_to = _to_date(data.get("periodTo")) or pa.period_to
    pa.previous_applications_total = (
        _to_dec(data.get("previousApplicationsTotal"))
        or pa.previous_applications_total
    )
    pa.retention_percent = (
        _to_dec(data.get("retentionPercent")) or pa.retention_percent
    )
    pa.withholding_tax_percent = (
        _to_dec(data.get("withholdingTaxPercent")) or pa.withholding_tax_percent
    )
    pa.previous_deductions = (
        _to_dec(data.get("previousDeductions")) or pa.previous_deductions
    )
    pa.consultant_notes = str(data.get("consultantNotes") or "").strip()
    pa.save()
    _audit_ops(
        request,
        action="payment_application_update",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"number": pa.application_number},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_delete(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_cannot_delete", status=400)
    _audit_ops(
        request,
        action="payment_application_delete",
        entity_type="payment_application",
        entity_id=str(pa.id),
        before={"number": pa.application_number},
    )
    pa.delete()
    return _api_ok()


@require_POST
def admin_boq_payment_applications_add_item(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_locked", status=400)
    data = _read_json(request)
    boq_item_id = data.get("boqItemId")
    if not boq_item_id:
        return _api_error("missing_boq_item", status=400)
    boq_item = ProjectBOQItem.objects.filter(
        pk=int(boq_item_id), project_id=project_id
    ).first()
    if not boq_item:
        return _api_error("boq_item_not_found", status=404)
    current_quantity = _to_dec(data.get("currentQuantity")) or Decimal("0")
    if current_quantity < 0:
        return _api_error("invalid_quantity", status=400)
    previously_done = _to_dec(data.get("previouslyDoneQuantity")) or Decimal(
        "0"
    )
    previously_certified = _to_dec(data.get("previouslyCertified")) or Decimal(
        "0"
    )
    PaymentApplicationItem.objects.create(
        payment=pa,
        boq_item=boq_item,
        contracted_quantity=boq_item.quantity,
        previously_done_quantity=previously_done,
        current_quantity=current_quantity,
        unit_price=boq_item.unit_price,
        previously_certified=previously_certified,
    )
    pa.save()
    _audit_ops(
        request,
        action="payment_application_add_item",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"boqItemId": boq_item.id},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_update_item(
    request: HttpRequest,
    project_id: int,
    application_id: int,
    item_id: int,
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_locked", status=400)
    item = PaymentApplicationItem.objects.filter(pk=item_id, payment=pa).first()
    if not item:
        return _api_error("item_not_found", status=404)
    data = _read_json(request)
    current_quantity = _to_dec(data.get("currentQuantity"))
    if current_quantity is not None:
        if current_quantity < 0:
            return _api_error("invalid_quantity", status=400)
        item.current_quantity = current_quantity
    previously_done = _to_dec(data.get("previouslyDoneQuantity"))
    if previously_done is not None:
        item.previously_done_quantity = previously_done
    previously_certified = _to_dec(data.get("previouslyCertified"))
    if previously_certified is not None:
        item.previously_certified = previously_certified
    item.save()
    pa.save()
    _audit_ops(
        request,
        action="payment_application_update_item",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"itemId": item.id},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_remove_item(
    request: HttpRequest,
    project_id: int,
    application_id: int,
    item_id: int,
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_locked", status=400)
    item = PaymentApplicationItem.objects.filter(pk=item_id, payment=pa).first()
    if not item:
        return _api_error("item_not_found", status=404)
    item.delete()
    pa.save()
    _audit_ops(
        request,
        action="payment_application_remove_item",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"itemId": item_id},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_submit(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status != PaymentApplication.STATUS_DRAFT:
        return _api_error("only_draft_can_submit", status=400)
    pa.status = PaymentApplication.STATUS_SUBMITTED
    pa.submitted_to_consultant = True
    pa.save()
    _audit_ops(
        request,
        action="payment_application_submit",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"status": pa.status},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_approve(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status not in (
        PaymentApplication.STATUS_DRAFT,
        PaymentApplication.STATUS_SUBMITTED,
    ):
        return _api_error("invalid_status_for_approve", status=400)
    pa.status = PaymentApplication.STATUS_APPROVED
    pa.consultant_approved = True
    pa.save()
    _audit_ops(
        request,
        action="payment_application_approve",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"status": pa.status},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_reject(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status == PaymentApplication.STATUS_PAID:
        return _api_error("paid_application_locked", status=400)
    data = _read_json(request)
    pa.status = PaymentApplication.STATUS_REJECTED
    pa.consultant_notes = str(data.get("consultantNotes") or "").strip()
    pa.save()
    _audit_ops(
        request,
        action="payment_application_reject",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"status": pa.status},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_pay(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    if pa.status not in (
        PaymentApplication.STATUS_APPROVED,
        PaymentApplication.STATUS_SUBMITTED,
    ):
        return _api_error("invalid_status_for_pay", status=400)
    pa.status = PaymentApplication.STATUS_PAID
    pa.save()
    _audit_ops(
        request,
        action="payment_application_pay",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"status": pa.status},
    )
    return _api_ok({"id": pa.id})


@require_POST
def admin_boq_payment_applications_generate_entry(
    request: HttpRequest, project_id: int, application_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    pa = PaymentApplication.objects.filter(
        pk=application_id, project_id=project_id
    ).first()
    if not pa:
        return _api_error("not_found", status=404)
    try:
        entry = pa.generate_journal_entry()
    except Exception:
        # Never expose internal exception text (SQL, model internals) to API
        # clients; keep the detail in the server log instead.
        logger.exception("Failed to generate journal entry for payment %s", pa.id)
        return _api_error(
            "journal_entry_generation_failed",
            status=400,
            message="تعذّر إنشاء القيد المحاسبي للمستخلص. راجع سجلات الخادم.",
        )
    _audit_ops(
        request,
        action="payment_application_generate_entry",
        entity_type="payment_application",
        entity_id=str(pa.id),
        after={"journalEntryId": entry.id, "number": entry.number},
    )
    return _api_ok({"journalEntryId": entry.id, "number": entry.number})


@require_GET
def admin_boq_variation_orders(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    items: list[dict[str, Any]] = []
    for vo in VariationOrder.objects.filter(project=project):
        items.append(
            {
                "id": vo.id,
                "variationNumber": vo.variation_number,
                "title": vo.title,
                "reason": vo.reason,
                "description": vo.description,
                "status": vo.status,
                "costImpact": float(vo.cost_impact),
                "scheduleImpactDays": vo.schedule_impact_days,
                "submittedAt": _to_iso(vo.submitted_at),
                "approvedAt": _to_iso(vo.approved_at),
            }
        )
    return _api_ok(
        {"projectId": project.id, "projectTitle": project.title, "items": items}
    )


@require_POST
def admin_boq_variation_orders_create(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    data = _read_json(request)
    number = str(data.get("variationNumber") or "").strip()
    title = str(data.get("title") or "").strip()
    if not number or not title:
        return _api_error("missing_number_or_title", status=400)
    reason = str(data.get("reason") or VariationOrder.REASON_OTHER).strip()
    if reason not in dict(VariationOrder.REASON_CHOICES):
        return _api_error("invalid_reason", status=400)
    vo = VariationOrder.objects.create(
        project=project,
        variation_number=number,
        title=title,
        reason=reason,
        description=str(data.get("description") or "").strip(),
        cost_impact=_to_dec(data.get("costImpact")) or Decimal("0"),
        schedule_impact_days=int(data.get("scheduleImpactDays") or 0),
        submitted_by=request.user if request.user.is_authenticated else None,
    )
    _audit_ops(
        request,
        action="variation_order_create",
        entity_type="variation_order",
        entity_id=str(vo.id),
        after={"number": vo.variation_number},
    )
    return _api_ok({"id": vo.id})


@require_POST
def admin_boq_variation_orders_update(
    request: HttpRequest, project_id: int, variation_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    vo = VariationOrder.objects.filter(
        pk=variation_id, project_id=project_id
    ).first()
    if not vo:
        return _api_error("not_found", status=404)
    if vo.status == VariationOrder.STATUS_IMPLEMENTED:
        return _api_error("implemented_variation_locked", status=400)
    data = _read_json(request)
    vo.variation_number = str(
        data.get("variationNumber") or vo.variation_number
    ).strip()
    vo.title = str(data.get("title") or vo.title).strip()
    reason = str(data.get("reason") or vo.reason).strip()
    if reason not in dict(VariationOrder.REASON_CHOICES):
        return _api_error("invalid_reason", status=400)
    vo.reason = reason
    vo.description = str(data.get("description") or "").strip()
    vo.cost_impact = _to_dec(data.get("costImpact")) or vo.cost_impact
    vo.schedule_impact_days = int(
        data.get("scheduleImpactDays") or vo.schedule_impact_days
    )
    vo.save()
    _audit_ops(
        request,
        action="variation_order_update",
        entity_type="variation_order",
        entity_id=str(vo.id),
        after={"number": vo.variation_number},
    )
    return _api_ok({"id": vo.id})


@require_POST
def admin_boq_variation_orders_delete(
    request: HttpRequest, project_id: int, variation_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    vo = VariationOrder.objects.filter(
        pk=variation_id, project_id=project_id
    ).first()
    if not vo:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="variation_order_delete",
        entity_type="variation_order",
        entity_id=str(vo.id),
        before={"number": vo.variation_number},
    )
    vo.delete()
    return _api_ok()


@require_POST
def admin_boq_variation_orders_set_status(
    request: HttpRequest, project_id: int, variation_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    vo = VariationOrder.objects.filter(
        pk=variation_id, project_id=project_id
    ).first()
    if not vo:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    status = str(data.get("status") or "").strip()
    if status not in dict(VariationOrder.STATUS_CHOICES):
        return _api_error("invalid_status", status=400)
    vo.status = status
    if status == VariationOrder.STATUS_APPROVED:
        vo.approved_by = request.user if request.user.is_authenticated else None
        vo.approved_at = timezone.now()
    vo.save()
    _audit_ops(
        request,
        action="variation_order_set_status",
        entity_type="variation_order",
        entity_id=str(vo.id),
        after={"status": vo.status},
    )
    return _api_ok({"id": vo.id})


@require_POST
def admin_boq_variation_orders_add_item(
    request: HttpRequest, project_id: int, variation_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    vo = VariationOrder.objects.filter(
        pk=variation_id, project_id=project_id
    ).first()
    if not vo:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    boq_item_id = data.get("boqItemId")
    boq_item = None
    if boq_item_id:
        boq_item = ProjectBOQItem.objects.filter(
            pk=int(boq_item_id), project_id=project_id
        ).first()
    description = str(data.get("description") or "").strip()
    unit = str(data.get("unit") or "").strip()
    quantity_change = _to_dec(data.get("quantityChange")) or Decimal("0")
    unit_price = _to_dec(data.get("unitPrice")) or Decimal("0")
    if not description or not unit:
        return _api_error("missing_description_or_unit", status=400)
    VariationOrderItem.objects.create(
        variation=vo,
        boq_item=boq_item,
        description=description,
        unit=unit,
        quantity_change=quantity_change,
        unit_price=unit_price,
    )
    _audit_ops(
        request,
        action="variation_order_add_item",
        entity_type="variation_order",
        entity_id=str(vo.id),
    )
    return _api_ok({"id": vo.id})


@require_POST
def admin_boq_variation_orders_update_item(
    request: HttpRequest,
    project_id: int,
    variation_id: int,
    item_id: int,
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    item = VariationOrderItem.objects.filter(
        pk=item_id, variation_id=variation_id, variation__project_id=project_id
    ).first()
    if not item:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    item.description = str(data.get("description") or item.description).strip()
    item.unit = str(data.get("unit") or item.unit).strip()
    quantity_change = _to_dec(data.get("quantityChange"))
    if quantity_change is not None:
        item.quantity_change = quantity_change
    unit_price = _to_dec(data.get("unitPrice"))
    if unit_price is not None:
        item.unit_price = unit_price
    item.save()
    _audit_ops(
        request,
        action="variation_order_update_item",
        entity_type="variation_order",
        entity_id=str(item.variation_id),
        after={"itemId": item.id},
    )
    return _api_ok({"id": item.id})


@require_POST
def admin_boq_variation_orders_remove_item(
    request: HttpRequest,
    project_id: int,
    variation_id: int,
    item_id: int,
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    item = VariationOrderItem.objects.filter(
        pk=item_id, variation_id=variation_id, variation__project_id=project_id
    ).first()
    if not item:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="variation_order_remove_item",
        entity_type="variation_order",
        entity_id=str(item.variation_id),
        after={"itemId": item.id},
    )
    item.delete()
    return _api_ok()


@require_GET
def admin_boq_final_account(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    fa = FinalAccount.objects.filter(project=project).first()
    if not fa:
        return _api_ok(
            {
                "projectId": project.id,
                "projectTitle": project.title,
                "exists": False,
            }
        )
    return _api_ok(
        {
            "exists": True,
            "id": fa.id,
            "contractAmount": float(fa.contract_amount),
            "totalVariations": float(fa.total_variations),
            "revisedContractAmount": float(fa.revised_contract_amount),
            "totalPreviousApplications": float(fa.total_previous_applications),
            "totalRetentionReleased": float(fa.total_retention_released),
            "totalWithholdingTax": float(fa.total_withholding_tax),
            "netDue": float(fa.net_due),
            "status": fa.status,
            "closedAt": _to_iso(fa.closed_at),
            "notes": fa.notes,
        }
    )


@require_POST
def admin_boq_final_account_create_or_update(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    data = _read_json(request)
    fa, _ = FinalAccount.objects.get_or_create(project=project)
    fa.contract_amount = (
        _to_dec(data.get("contractAmount")) or fa.contract_amount
    )
    fa.total_variations = (
        _to_dec(data.get("totalVariations")) or fa.total_variations
    )
    fa.total_retention_released = (
        _to_dec(data.get("totalRetentionReleased"))
        or fa.total_retention_released
    )
    fa.total_withholding_tax = (
        _to_dec(data.get("totalWithholdingTax")) or fa.total_withholding_tax
    )
    fa.notes = str(data.get("notes") or "").strip()
    status = str(data.get("status") or "").strip()
    if status in dict(FinalAccount.STATUS_CHOICES):
        fa.status = status
    if status == FinalAccount.STATUS_CLOSED:
        fa.closed_at = timezone.now()
    fa.save()
    _audit_ops(
        request,
        action="final_account_update",
        entity_type="final_account",
        entity_id=str(fa.id),
        after={"status": fa.status, "netDue": float(fa.net_due)},
    )
    return _api_ok({"id": fa.id})
