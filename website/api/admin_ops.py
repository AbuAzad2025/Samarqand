"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import os
import tempfile
import time
import zipfile
from decimal import Decimal
from io import StringIO
from pathlib import Path
from typing import Any
from typing import Iterator

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.db import transaction
from django.db.models import Sum
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import JsonResponse
from django.http import StreamingHttpResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import ContractPayment
from website.models import Equipment
from website.models import InventoryItem
from website.models import InventoryTransaction
from website.models import OpsAuditLog
from website.models import OpsPermissionRule
from website.models import OpsTimeclockImportRun
from website.models import ProjectContract
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import ResourceAssignment
from website.models import Worker

logger = logging.getLogger(__name__)


from .common import *


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
                "reorderLevel": (
                    float(it.reorder_level or 0)
                    if it.reorder_level is not None
                    else None
                ),
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
        current_qty=_to_dec(data.get("currentQty"), allow_none=False)
        or Decimal("0"),
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
        after={
            "id": it.id,
            "name": it.name,
            "currentQty": float(it.current_qty or 0),
        },
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
        "reorderLevel": (
            float(it.reorder_level or 0)
            if it.reorder_level is not None
            else None
        ),
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
        it.current_qty = _to_dec(
            data.get("currentQty"), allow_none=False
        ) or Decimal("0")
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
        "reorderLevel": (
            float(it.reorder_level or 0)
            if it.reorder_level is not None
            else None
        ),
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
    before = {
        "id": it.id,
        "name": it.name,
        "currentQty": float(it.current_qty or 0),
    }
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
                "projectTitle": (
                    getattr(t.project, "title", "") if t.project else ""
                ),
                "kind": t.kind,
                "quantity": float(t.quantity or 0),
                "unitCost": (
                    float(t.unit_cost or 0) if t.unit_cost is not None else None
                ),
                "date": _to_iso(t.date),
                "reference": t.reference,
                "notes": t.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_inventory_transactions_create(
    request: HttpRequest,
) -> JsonResponse:
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
    project = (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
    user = getattr(request, "user", None)
    created_by = (
        user if user and getattr(user, "is_authenticated", False) else None
    )
    try:
        tx_date = _to_date(data.get("date"))
    except Exception:
        return _api_error("invalid_date", status=400)

    with transaction.atomic():
        it = (
            InventoryItem.objects.select_for_update().filter(pk=it.id).first()
            or it
        )
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
            "unitCost": (
                float(t.unit_cost or 0) if t.unit_cost is not None else None
            ),
            "date": _to_iso(t.date),
            "reference": t.reference,
            "resultingQty": float(it.current_qty or 0),
        },
    )
    return _api_ok({"id": t.id})


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
                "hourlyCost": (
                    float(e.hourly_cost or 0)
                    if e.hourly_cost is not None
                    else None
                ),
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
                "projectTitle": (
                    getattr(a.project, "title", "") if a.project else ""
                ),
                "resourceType": a.resource_type,
                "workerId": a.worker_id or 0,
                "workerName": a.worker.name if a.worker else "",
                "equipmentId": a.equipment_id or 0,
                "equipmentName": a.equipment.name if a.equipment else "",
                "startDate": _to_iso(a.start_date),
                "endDate": _to_iso(a.end_date),
                "hoursPerDay": (
                    float(a.hours_per_day or 0)
                    if a.hours_per_day is not None
                    else None
                ),
                "costOverride": (
                    float(a.cost_override or 0)
                    if a.cost_override is not None
                    else None
                ),
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
    project = (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
    resource_type = str(
        data.get("resourceType") or ResourceAssignment.RESOURCE_WORKER
    ).strip()
    if resource_type not in {k for k, _ in ResourceAssignment.RESOURCE_CHOICES}:
        return _api_error("invalid_resourceType", status=400)
    worker_id = int(data.get("workerId") or 0) or None
    equipment_id = int(data.get("equipmentId") or 0) or None
    worker = Worker.objects.filter(pk=worker_id).first() if worker_id else None
    equipment = (
        Equipment.objects.filter(pk=equipment_id).first()
        if equipment_id
        else None
    )
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
        worker=(
            worker
            if resource_type == ResourceAssignment.RESOURCE_WORKER
            else None
        ),
        equipment=(
            equipment
            if resource_type == ResourceAssignment.RESOURCE_EQUIPMENT
            else None
        ),
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
        a.project = (
            ProjectPage.objects.filter(pk=pid).specific().first()
            if pid
            else None
        )
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
                "actorUsername": (
                    getattr(r.actor, "username", "") if r.actor else ""
                ),
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
    existing = {
        r.code: r for r in OpsPermissionRule.objects.filter(code__in=codes)
    }
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


def admin_ops_timeclock_runs(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_timeclock_import(request)
    if forbidden:
        return forbidden
    limit = int(request.GET.get("limit") or 50) or 50
    limit = max(1, min(limit, 200))
    qs = OpsTimeclockImportRun.objects.select_related(
        "actor", "default_project"
    )
    items: list[dict[str, Any]] = []
    for r in qs.order_by("-id")[:limit]:
        items.append(
            {
                "id": r.id,
                "createdAt": r.created_at.isoformat() if r.created_at else "",
                "actorId": r.actor_id or 0,
                "actorUsername": (
                    getattr(r.actor, "username", "") if r.actor else ""
                ),
                "role": r.role,
                "source": r.source,
                "dryRun": bool(r.dry_run),
                "defaultProjectId": r.default_project_id or 0,
                "defaultProjectTitle": (
                    getattr(r.default_project, "title", "")
                    if r.default_project
                    else ""
                ),
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
        budget_val = (
            Decimal(str(budget)) if budget is not None else Decimal("0")
        )
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


def admin_backup_export(request: HttpRequest) -> HttpResponse | JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(
        request, scope="admin_backup_export", limit=3, window_seconds=600
    )
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
    limited = _check_rate_limit(
        request, scope="admin_backup_import", limit=3, window_seconds=600
    )
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


def admin_backup_portal(
    request: HttpRequest,
) -> HttpResponse | StreamingHttpResponse:
    """Superuser-only backup portal with hard limits on imports/exports."""
    user = getattr(request, "user", None)
    if (
        not user
        or not getattr(user, "is_authenticated", False)
        or not getattr(user, "is_superuser", False)
    ):
        return HttpResponse(
            "forbidden", status=403, content_type="text/plain; charset=utf-8"
        )

    limited = _check_rate_limit(
        request, scope="admin_backup_portal", limit=12, window_seconds=600
    )
    if limited:
        return limited

    max_backup_bytes = 20 * 1024 * 1024
    max_media_zip_bytes = 50 * 1024 * 1024
    max_media_files = 200

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
        resp = HttpResponse(
            payload, content_type="application/json; charset=utf-8"
        )
        resp["Content-Disposition"] = f'attachment; filename="backup-{ts}.json"'
        return resp

    if (
        request.method == "GET"
        and str(request.GET.get("export_media") or "") == "1"
    ):
        media_root = Path(settings.MEDIA_ROOT).resolve()
        ts = time.strftime("%Y%m%d-%H%M%S")

        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".zip"
            ) as tmp:
                tmp_path = tmp.name

            total_bytes = 0
            with zipfile.ZipFile(
                tmp_path, "w", compression=zipfile.ZIP_DEFLATED
            ) as zf:
                if media_root.exists():
                    for root, _dirs, files in os.walk(str(media_root)):
                        for filename in files:
                            full_path = Path(root) / filename
                            try:
                                rel = full_path.resolve().relative_to(
                                    media_root
                                )
                            except Exception:
                                continue
                            try:
                                size = full_path.stat().st_size
                            except Exception:
                                continue
                            if total_bytes + size > max_media_zip_bytes:
                                break
                            zf.write(
                                str(full_path),
                                arcname=str(rel).replace("\\", "/"),
                            )
                            total_bytes += size

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

            stream_resp = StreamingHttpResponse(
                _stream(), content_type="application/zip"
            )
            stream_resp["Content-Disposition"] = (
                f'attachment; filename="media-{ts}.zip"'
            )
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

    def _add_msg(text: str) -> None:
        nonlocal status_msg
        status_msg = f"{status_msg} {text}".strip()

    if request.method == "POST":
        backup_file = request.FILES.get("backup_file")
        if backup_file:
            if backup_file.size > max_backup_bytes:
                _add_msg(
                    "ملف النسخة الاحتياطية كبير جداً (الحد الأقصى 20 ميغابايت)."
                )
            else:
                tmp_path = ""
                try:
                    with tempfile.NamedTemporaryFile(
                        delete=False, suffix=".json"
                    ) as tmp:
                        tmp.write(backup_file.read())
                        tmp_path = tmp.name
                    with transaction.atomic():
                        call_command("loaddata", tmp_path, verbosity=0)
                    _add_msg("تمت استعادة بيانات قاعدة البيانات بنجاح.")
                except Exception:
                    _add_msg("فشلت استعادة قاعدة البيانات.")
                finally:
                    if tmp_path:
                        try:
                            os.unlink(tmp_path)
                        except Exception:
                            pass

        media_zip = request.FILES.get("media_zip")
        if media_zip:
            if media_zip.size > max_media_zip_bytes:
                _add_msg("ملف media.zip كبير جداً (الحد الأقصى 50 ميغابايت).")
            else:
                try:
                    media_root = Path(settings.MEDIA_ROOT).resolve()
                    media_root.mkdir(parents=True, exist_ok=True)
                    extracted = 0
                    total_bytes = 0
                    with zipfile.ZipFile(media_zip) as zf:
                        for info in zf.infolist():
                            if info.is_dir():
                                continue
                            name = str(info.filename or "")
                            if not name or name.endswith("/"):
                                continue
                            if extracted >= max_media_files:
                                _add_msg(
                                    "تم تجاوز الحد الأقصى لعدد الملفات (200)."
                                )
                                break
                            if info.file_size > max_media_zip_bytes:
                                _add_msg("أحد الملفات داخل الأرشيف كبير جداً.")
                                break
                            total_bytes += info.file_size
                            if total_bytes > max_media_zip_bytes:
                                _add_msg(
                                    "حجم الملفات المستخرجة يتجاوز 50 ميغابايت."
                                )
                                break
                            dest = (media_root / name).resolve()
                            if (
                                media_root not in dest.parents
                                and dest != media_root
                            ):
                                continue
                            dest.parent.mkdir(parents=True, exist_ok=True)
                            with (
                                zf.open(info) as src,
                                open(dest, "wb") as out_f,
                            ):
                                out_f.write(src.read())
                            extracted += 1
                    _add_msg(f"تم رفع ملفات media: {extracted} ملف.")
                except Exception:
                    _add_msg("فشل رفع ملفات media.")

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
        <p>ارفع ملف ZIP يحتوي نفس بنية مجلد <code>media/</code> من جهازك. الحد الأقصى 50 ميغابايت و200 ملف.</p>
      </form>

      {f'<div class="msg">{status_msg}</div>' if status_msg else ""}
    </div>
  </body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")
