"""Admin API for website enquiries (sales leads)."""

from __future__ import annotations

from typing import Any

from django.http import HttpRequest
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import Lead

from .admin_accounts import _bounded_search
from .common import *


def _require_leads_read(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "leads_read",
        default_allowed_roles={"manager"},
    )


def _require_leads_write(request: HttpRequest) -> Any | None:
    return _require_ops_rule(
        request,
        "leads_write",
        default_allowed_roles={"manager"},
    )


@require_GET
def admin_leads_assignees(request: HttpRequest) -> JsonResponse:
    forbidden = _require_leads_read(request)
    if forbidden:
        return forbidden
    from django.contrib.auth import get_user_model

    users = get_user_model().objects.filter(is_staff=True, is_active=True)
    return _api_ok(
        {
            "items": [
                {"id": u.id, "username": u.username}
                for u in users.order_by("username")[:200]
            ]
        }
    )


@require_GET
def admin_leads(request: HttpRequest) -> JsonResponse:
    forbidden = _require_leads_read(request)
    if forbidden:
        return forbidden

    qs = Lead.objects.select_related("assigned_to")
    status = _bounded_search(request.GET.get("status"), 32)
    if status in {key for key, _ in Lead.STATUS_CHOICES}:
        qs = qs.filter(status=status)
    search = _bounded_search(request.GET.get("search"), 120)
    if search:
        from django.db.models import Q

        qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
    qs = qs[:200]

    items = [
        {
            "id": row.id,
            "name": row.name,
            "phone": row.phone,
            "email": row.email,
            "projectType": row.project_type,
            "message": row.message,
            "source": row.source,
            "status": row.status,
            "assignedToId": row.assigned_to_id or 0,
            "assignedToName": (
                getattr(row.assigned_to, "username", "")
                if row.assigned_to
                else ""
            ),
            "notes": row.notes,
            "createdAt": _to_iso(row.created_at),
            "updatedAt": _to_iso(row.updated_at),
        }
        for row in qs
    ]
    return _api_ok({"items": items})


@require_POST
def admin_leads_update(request: HttpRequest, lead_id: int) -> JsonResponse:
    forbidden = _require_leads_write(request)
    if forbidden:
        return forbidden
    lead = Lead.objects.filter(pk=lead_id).first()
    if not lead:
        return _api_error("not_found", status=404)

    data = _read_json(request)
    before = {
        "status": lead.status,
        "assignedTo": lead.assigned_to_id,
        "notes": lead.notes,
    }
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        if status not in {key for key, _ in Lead.STATUS_CHOICES}:
            return _api_error("invalid_status", status=400)
        lead.status = status
    if data.get("assignedTo") is not None:
        raw = data.get("assignedTo")
        if raw in (None, "", 0, "0"):
            lead.assigned_to = None
        else:
            try:
                user_id = int(raw)
            except (TypeError, ValueError):
                return _api_error("invalid_assigned_to", status=400)
            from django.contrib.auth import get_user_model

            user = (
                get_user_model()
                .objects.filter(pk=user_id, is_staff=True)
                .first()
            )
            if not user:
                return _api_error("invalid_assigned_to", status=400)
            lead.assigned_to = user
    if data.get("notes") is not None:
        lead.notes = str(data.get("notes") or "")[:4000]
    lead.save()

    _audit_ops(
        request,
        action="lead_update",
        entity_type="lead",
        entity_id=str(lead.id),
        before=before,
        after={
            "status": lead.status,
            "assignedTo": lead.assigned_to_id,
            "notes": lead.notes,
        },
    )
    return _api_ok()
