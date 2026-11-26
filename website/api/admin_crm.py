"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
from typing import Any

from django.http import HttpRequest
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import Client
from website.models import ClientContactLog
from website.models import ContractAddendum
from website.models import ContractPayment
from website.models import ProjectContract
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import Subcontractor
from website.models import Supplier

logger = logging.getLogger(__name__)


from .common import *


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
def admin_ops_clients_update(
    request: HttpRequest, client_id: int
) -> JsonResponse:
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
def admin_ops_clients_delete(
    request: HttpRequest, client_id: int
) -> JsonResponse:
    forbidden = _require_ops_crm_write(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    c.delete()
    return _api_ok()


@require_GET
def admin_ops_client_contacts(
    request: HttpRequest, client_id: int
) -> JsonResponse:
    forbidden = _require_ops_crm_read(request)
    if forbidden:
        return forbidden
    c = Client.objects.filter(pk=client_id).first()
    if not c:
        return _api_error("not_found", status=404)
    items: list[dict[str, Any]] = []
    for row in ClientContactLog.objects.filter(client=c).select_related(
        "created_by"
    ):
        items.append(
            {
                "id": row.id,
                "kind": row.kind,
                "subject": row.subject,
                "body": row.body,
                "createdAt": _to_iso(row.created_at),
                "createdBy": (
                    getattr(row.created_by, "username", "")
                    if row.created_by
                    else ""
                ),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_ops_client_contacts_create(
    request: HttpRequest, client_id: int
) -> JsonResponse:
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
        created_by=(
            getattr(request, "user", None)
            if getattr(
                getattr(request, "user", None), "is_authenticated", False
            )
            else None
        ),
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
def admin_ops_suppliers_update(
    request: HttpRequest, supplier_id: int
) -> JsonResponse:
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
def admin_ops_suppliers_delete(
    request: HttpRequest, supplier_id: int
) -> JsonResponse:
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
                "projectTitle": (
                    getattr(c.project, "title", "") if c.project else ""
                ),
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
            "amount": (
                float(row.amount or 0) if row.amount is not None else None
            ),
        },
    )
    return _api_ok({"id": row.id})


@require_POST
def admin_ops_contracts_update(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
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
        row.project = (
            ProjectPage.objects.filter(pk=pid).specific().first()
            if pid
            else None
        )
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
def admin_ops_contracts_delete(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
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
def admin_ops_contract_addendums(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
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
            "amountDelta": (
                float(a.amount_delta or 0)
                if a.amount_delta is not None
                else None
            ),
            "startDate": _to_iso(a.start_date),
            "endDate": _to_iso(a.end_date),
        },
    )
    return _api_ok({"id": a.id})


@require_GET
def admin_ops_contract_payments(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
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
    if status == ContractPayment.STATUS_PAID and (
        paid_amount is None or paid_amount <= 0
    ):
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
            "paidAmount": (
                float(p.paid_amount or 0) if p.paid_amount is not None else None
            ),
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
        "paidAmount": (
            float(p.paid_amount or 0) if p.paid_amount is not None else None
        ),
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
    if (
        p.amount is not None
        and p.paid_amount is not None
        and p.paid_amount > p.amount
    ):
        return _api_error("invalid_paid_amount", status=400)
    if p.status == ContractPayment.STATUS_PAID and (
        p.paid_amount is None or p.paid_amount <= 0
    ):
        return _api_error("invalid_paid_amount", status=400)
    p.save()
    after = {
        "contractId": p.contract_id,
        "title": p.title,
        "dueDate": _to_iso(p.due_date),
        "amount": float(p.amount or 0) if p.amount is not None else None,
        "paidAmount": (
            float(p.paid_amount or 0) if p.paid_amount is not None else None
        ),
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
        "paidAmount": (
            float(p.paid_amount or 0) if p.paid_amount is not None else None
        ),
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
                "projectTitle": (
                    getattr(po.project, "title", "") if po.project else ""
                ),
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
    supplier = (
        Supplier.objects.filter(pk=supplier_id).first() if supplier_id else None
    )
    project = (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
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
            "totalAmount": (
                float(po.total_amount or 0)
                if po.total_amount is not None
                else None
            ),
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
        "totalAmount": (
            float(po.total_amount or 0) if po.total_amount is not None else None
        ),
        "notes": po.notes,
    }
    data = _read_json(request)
    if data.get("supplierId") is not None:
        sid = int(data.get("supplierId") or 0) or None
        po.supplier = Supplier.objects.filter(pk=sid).first() if sid else None
    if data.get("projectId") is not None:
        pid = int(data.get("projectId") or 0) or None
        po.project = (
            ProjectPage.objects.filter(pk=pid).specific().first()
            if pid
            else None
        )
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
        "totalAmount": (
            float(po.total_amount or 0) if po.total_amount is not None else None
        ),
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
        "totalAmount": (
            float(po.total_amount or 0) if po.total_amount is not None else None
        ),
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
