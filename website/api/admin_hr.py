"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db import transaction
from django.db.models import Sum
from django.http import HttpRequest
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import EmployeeContract
from website.models import LeaveRequest
from website.models import OpsTimeclockImportRun
from website.models import OvertimeRecord
from website.models import ProjectPage
from website.models import SocialSecurityRecord
from website.models import Worker
from website.models import WorkerAttendance
from website.models import WorkerPayrollEntry

logger = logging.getLogger(__name__)


from .common import *


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
            linked_id = int(
                Worker.objects.filter(user=user)
                .values_list("id", flat=True)
                .first()
                or 0
            )
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
                "userUsername": (
                    getattr(getattr(w, "user", None), "username", "")
                    if getattr(w, "user_id", None)
                    else ""
                ),
                "name": w.name,
                "role": w.role,
                "phone": w.phone,
                "timeClockId": w.time_clock_id or "",
                "kind": w.kind,
                "active": bool(w.active),
                "dailyCost": (
                    float(w.daily_cost or 0)
                    if w.daily_cost is not None
                    else None
                ),
                "monthlySalary": (
                    float(w.monthly_salary or 0)
                    if w.monthly_salary is not None
                    else None
                ),
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
    kind = (
        str(data.get("kind") or Worker.KIND_WORKER).strip()
        or Worker.KIND_WORKER
    )
    if kind not in {Worker.KIND_WORKER, Worker.KIND_EMPLOYEE}:
        return _api_error("invalid_kind", status=400)
    time_clock_id = None
    if data.get("timeClockId") is not None:
        raw = str(data.get("timeClockId") or "").strip()
        time_clock_id = raw or None
        if (
            time_clock_id
            and Worker.objects.filter(time_clock_id=time_clock_id).exists()
        ):
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
def admin_ops_workers_update(
    request: HttpRequest, worker_id: int
) -> JsonResponse:
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
        "dailyCost": (
            float(w.daily_cost or 0) if w.daily_cost is not None else None
        ),
        "monthlySalary": (
            float(w.monthly_salary or 0)
            if w.monthly_salary is not None
            else None
        ),
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
        if (
            time_clock_id
            and Worker.objects.exclude(pk=w.id)
            .filter(time_clock_id=time_clock_id)
            .exists()
        ):
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
        "dailyCost": (
            float(w.daily_cost or 0) if w.daily_cost is not None else None
        ),
        "monthlySalary": (
            float(w.monthly_salary or 0)
            if w.monthly_salary is not None
            else None
        ),
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
def admin_ops_workers_delete(
    request: HttpRequest, worker_id: int
) -> JsonResponse:
    forbidden = _require_ops_workers_write(request)
    if forbidden:
        return forbidden
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("not_found", status=404)
    w.delete()
    return _api_ok()


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
            linked_id = int(
                Worker.objects.filter(user=user)
                .values_list("id", flat=True)
                .first()
                or 0
            )
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
                "projectTitle": (
                    getattr(a.project, "title", "") if a.project else ""
                ),
                "date": _to_iso(a.date),
                "status": a.status,
                "hours": float(a.hours or 0) if a.hours is not None else None,
                "notes": a.notes,
                "state": getattr(a, "state", WorkerAttendance.STATE_DRAFT),
                "approvedById": getattr(a, "approved_by_id", None) or 0,
                "approvedAt": (
                    a.approved_at.isoformat()
                    if getattr(a, "approved_at", None)
                    else ""
                ),
                "lockedById": getattr(a, "locked_by_id", None) or 0,
                "lockedAt": (
                    a.locked_at.isoformat()
                    if getattr(a, "locked_at", None)
                    else ""
                ),
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
            linked_id = int(
                Worker.objects.filter(user=user)
                .values_list("id", flat=True)
                .first()
                or 0
            )
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
    status = (
        str(data.get("status") or WorkerAttendance.STATUS_PRESENT).strip()
        or WorkerAttendance.STATUS_PRESENT
    )
    allowed_status = {
        WorkerAttendance.STATUS_PRESENT,
        WorkerAttendance.STATUS_ABSENT,
        WorkerAttendance.STATUS_HALF_DAY,
        WorkerAttendance.STATUS_LEAVE,
    }
    if status not in allowed_status:
        return _api_error("invalid_status", status=400)
    project_id = int(data.get("projectId") or 0) or None
    project = (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
    defaults = {
        "status": status,
        "hours": _to_dec(data.get("hours"), allow_none=True),
        "project": project,
        "notes": str(data.get("notes") or "").strip(),
    }
    existing = WorkerAttendance.objects.filter(worker=w, date=att_date).first()
    if (
        existing
        and getattr(existing, "state", "") == WorkerAttendance.STATE_LOCKED
    ):
        return _api_error("attendance_locked", status=409)

    a, created = WorkerAttendance.objects.update_or_create(
        worker=w, date=att_date, defaults=defaults
    )
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

    created_count, updated_count, errors, item_results = (
        _process_timeclock_items(
            raw_items, dry_run=dry_run, default_project=default_project
        )
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
        actor=(
            user if user and getattr(user, "is_authenticated", False) else None
        ),
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
def admin_ops_timeclock_import_from_folder(
    request: HttpRequest,
) -> JsonResponse:
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
        if p.is_file()
        and p.suffix.lower() == ".json"
        and not p.name.startswith(".")
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

    created_count, updated_count, errors, item_results = (
        _process_timeclock_items(
            all_items, dry_run=dry_run, default_project=default_project
        )
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
        actor=(
            user if user and getattr(user, "is_authenticated", False) else None
        ),
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
def admin_ops_attendance_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_ops_attendance_write(request)
    if forbidden:
        return forbidden
    a = (
        WorkerAttendance.objects.select_related("worker")
        .filter(pk=item_id)
        .first()
    )
    if not a:
        return _api_error("not_found", status=404)
    user = getattr(request, "user", None)
    role = _user_role(user)
    if role == "employee":
        linked_id = 0
        try:
            linked_id = int(
                Worker.objects.filter(user=user)
                .values_list("id", flat=True)
                .first()
                or 0
            )
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
    if (
        WorkerAttendance.objects.exclude(pk=a.id)
        .filter(worker=a.worker, date=a.date)
        .exists()
    ):
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
        a.project = (
            ProjectPage.objects.filter(pk=project_id).specific().first()
            if project_id
            else None
        )
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
def admin_ops_attendance_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
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
            linked_id = int(
                Worker.objects.filter(user=user)
                .values_list("id", flat=True)
                .first()
                or 0
            )
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
def admin_ops_attendance_submit(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_submit",
        default_allowed_roles={"employee", "manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = (
            WorkerAttendance.objects.select_for_update()
            .filter(pk=item_id)
            .first()
        )
        if not a:
            return _api_error("not_found", status=404)
        if _user_role(user) == "employee":
            linked_id = 0
            try:
                linked_id = int(
                    Worker.objects.filter(user=user)
                    .values_list("id", flat=True)
                    .first()
                    or 0
                )
            except Exception:
                linked_id = 0
            if (
                not linked_id
                or int(getattr(a, "worker_id", 0) or 0) != linked_id
            ):
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
def admin_ops_attendance_approve(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_approve",
        default_allowed_roles={"manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = (
            WorkerAttendance.objects.select_for_update()
            .filter(pk=item_id)
            .first()
        )
        if not a:
            return _api_error("not_found", status=404)
        if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
            return _api_error("attendance_locked", status=409)
        before = {
            "state": getattr(a, "state", ""),
            "approvedById": getattr(a, "approved_by_id", None),
            "approvedAt": (
                a.approved_at.isoformat()
                if getattr(a, "approved_at", None)
                else ""
            ),
        }
        a.state = WorkerAttendance.STATE_APPROVED
        a.approved_by = (
            user if user and getattr(user, "is_authenticated", False) else None
        )
        a.approved_at = timezone.now()
        a.save(
            update_fields=["state", "approved_by", "approved_at", "updated_at"]
        )
        after = {
            "state": getattr(a, "state", ""),
            "approvedById": getattr(a, "approved_by_id", None),
            "approvedAt": (
                a.approved_at.isoformat()
                if getattr(a, "approved_at", None)
                else ""
            ),
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
def admin_ops_attendance_lock(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_attendance_lock",
        default_allowed_roles={"manager", "accountant"},
    )
    if forbidden:
        return forbidden
    user = getattr(request, "user", None)
    with transaction.atomic():
        a = (
            WorkerAttendance.objects.select_for_update()
            .filter(pk=item_id)
            .first()
        )
        if not a:
            return _api_error("not_found", status=404)
        if getattr(a, "state", "") == WorkerAttendance.STATE_LOCKED:
            return _api_ok({"state": getattr(a, "state", "")})
        if getattr(a, "state", "") != WorkerAttendance.STATE_APPROVED:
            return _api_error("attendance_not_approved", status=409)
        before = {
            "state": getattr(a, "state", ""),
            "lockedById": getattr(a, "locked_by_id", None),
            "lockedAt": (
                a.locked_at.isoformat() if getattr(a, "locked_at", None) else ""
            ),
        }
        a.state = WorkerAttendance.STATE_LOCKED
        a.locked_by = (
            user if user and getattr(user, "is_authenticated", False) else None
        )
        a.locked_at = timezone.now()
        a.save(update_fields=["state", "locked_by", "locked_at", "updated_at"])
        after = {
            "state": getattr(a, "state", ""),
            "lockedById": getattr(a, "locked_by_id", None),
            "lockedAt": (
                a.locked_at.isoformat() if getattr(a, "locked_at", None) else ""
            ),
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


def admin_ops_payroll_generate_from_attendance(
    request: HttpRequest,
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "ops_payroll_generate",
        default_allowed_roles={"manager", "accountant"},
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
        WorkerAttendance.objects.filter(
            worker__in=workers, date__year=year, date__month=month
        )
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
            existing = (
                WorkerPayrollEntry.objects.select_for_update()
                .filter(
                    worker=w,
                    year=year,
                    month=month,
                    kind=WorkerPayrollEntry.KIND_SALARY,
                    source=WorkerPayrollEntry.SOURCE_AUTO_ATTENDANCE,
                )
                .first()
            )
            if (
                existing
                and getattr(existing, "status", "")
                != WorkerPayrollEntry.STATUS_DRAFT
            ):
                skipped_count += 1
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": "skipped",
                        "reason": "not_draft",
                        "entryId": existing.id,
                        "amount": (
                            float(existing.amount or 0)
                            if existing.amount is not None
                            else None
                        ),
                    }
                )
                continue

            if dry_run:
                results.append(
                    {
                        "workerId": w.id,
                        "workerName": w.name,
                        "status": (
                            "would_update" if existing else "would_create"
                        ),
                        "entryId": existing.id if existing else 0,
                        "amount": float(amount),
                        "attendance": counts,
                    }
                )
                continue

            if existing:
                existing.amount = amount
                existing.date = existing.date or timezone.localdate()
                existing.notes = (
                    str(existing.notes or "") or "Generated from attendance"
                )
                existing.source_meta = {"attendance": counts}
                existing.net_salary = existing.calculate_net_salary()
                existing.save(
                    update_fields=[
                        "amount",
                        "date",
                        "notes",
                        "source_meta",
                        "net_salary",
                        "updated_at",
                    ]
                )
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
                net_salary = amount
                entry = WorkerPayrollEntry.objects.create(
                    worker=w,
                    year=year,
                    month=month,
                    kind=WorkerPayrollEntry.KIND_SALARY,
                    amount=amount,
                    overtime_amount=Decimal("0"),
                    allowances={},
                    deductions={},
                    net_salary=net_salary,
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
                "amount": (
                    float(p.amount or 0) if p.amount is not None else None
                ),
                "overtimeAmount": (
                    float(p.overtime_amount or 0)
                    if p.overtime_amount is not None
                    else None
                ),
                "allowances": (
                    p.allowances if isinstance(p.allowances, dict) else {}
                ),
                "deductions": (
                    p.deductions if isinstance(p.deductions, dict) else {}
                ),
                "netSalary": (
                    float(p.net_salary or 0)
                    if p.net_salary is not None
                    else None
                ),
                "status": p.status,
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
    kind = (
        str(data.get("kind") or WorkerPayrollEntry.KIND_SALARY).strip()
        or WorkerPayrollEntry.KIND_SALARY
    )
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
    overtime_amount = _to_dec(data.get("overtimeAmount"), allow_none=True)
    allowances = (
        data.get("allowances")
        if isinstance(data.get("allowances"), dict)
        else {}
    )
    deductions = (
        data.get("deductions")
        if isinstance(data.get("deductions"), dict)
        else {}
    )
    p = WorkerPayrollEntry.objects.create(
        worker=w,
        year=year,
        month=month,
        kind=kind,
        amount=amount,
        overtime_amount=overtime_amount,
        allowances=allowances,
        deductions=deductions,
        date=pay_date,
        notes=str(data.get("notes") or "").strip(),
    )
    p.net_salary = p.calculate_net_salary()
    p.save(update_fields=["net_salary"])
    return _api_ok({"id": p.id})


@require_POST
def admin_ops_payroll_update(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = (
        WorkerPayrollEntry.objects.select_related("worker")
        .filter(pk=entry_id)
        .first()
    )
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
    if data.get("overtimeAmount") is not None:
        p.overtime_amount = _to_dec(data.get("overtimeAmount"), allow_none=True)
    if data.get("allowances") is not None:
        p.allowances = (
            data.get("allowances")
            if isinstance(data.get("allowances"), dict)
            else {}
        )
    if data.get("deductions") is not None:
        p.deductions = (
            data.get("deductions")
            if isinstance(data.get("deductions"), dict)
            else {}
        )
    if data.get("date") is not None:
        try:
            pay_date = _to_date(data.get("date"))
        except Exception:
            return _api_error("invalid_date", status=400)
        p.date = pay_date
    if data.get("notes") is not None:
        p.notes = str(data.get("notes") or "").strip()
    p.net_salary = p.calculate_net_salary()
    p.save()
    return _api_ok()


@require_POST
def admin_ops_payroll_delete(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    p = WorkerPayrollEntry.objects.filter(pk=entry_id).first()
    if not p:
        return _api_error("not_found", status=404)
    p.delete()
    return _api_ok()


@require_GET
def admin_hr_leave_requests(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    qs = LeaveRequest.objects.select_related("worker")
    worker_id = int(request.GET.get("workerId") or 0) or None
    if worker_id:
        qs = qs.filter(worker_id=worker_id)
    status = str(request.GET.get("status") or "").strip()
    if status:
        qs = qs.filter(status=status)
    items: list[dict[str, Any]] = []
    for lr in qs.order_by("-start_date", "-id"):
        items.append(
            {
                "id": lr.id,
                "workerId": lr.worker_id,
                "workerName": lr.worker.name if lr.worker else "",
                "leaveType": lr.leave_type,
                "startDate": _to_iso(lr.start_date),
                "endDate": _to_iso(lr.end_date),
                "totalDays": lr.total_days,
                "reason": lr.reason,
                "status": lr.status,
                "approvedById": getattr(lr, "approved_by_id", None) or 0,
                "approvedAt": _to_iso(lr.approved_at),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_hr_leave_requests_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    worker_id = int(data.get("workerId") or 0) or 0
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("worker_not_found", status=404)
    start_date = _to_date(data.get("startDate"))
    end_date = _to_date(data.get("endDate"))
    if not start_date or not end_date:
        return _api_error("missing_dates", status=400)
    if end_date < start_date:
        return _api_error("invalid_date_range", status=400)
    leave_type = str(data.get("leaveType") or LeaveRequest.LEAVE_ANNUAL).strip()
    if leave_type not in dict(LeaveRequest.LEAVE_CHOICES):
        return _api_error("invalid_leave_type", status=400)
    user = getattr(request, "user", None)
    lr = LeaveRequest.objects.create(
        worker=w,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        total_days=0,
        reason=str(data.get("reason") or "").strip(),
        created_by=(
            user if user and getattr(user, "is_authenticated", False) else None
        ),
    )
    _audit_ops(
        request,
        action="hr_leave_create",
        entity_type="leave_request",
        entity_id=str(lr.id),
        after={"workerId": w.id, "totalDays": lr.total_days},
    )
    return _api_ok({"id": lr.id})


@require_POST
def admin_hr_leave_requests_update(
    request: HttpRequest, leave_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    lr = LeaveRequest.objects.filter(pk=leave_id).first()
    if not lr:
        return _api_error("not_found", status=404)
    if lr.status == LeaveRequest.STATUS_APPROVED:
        return _api_error("approved_leave_locked", status=409)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        lr.worker = w
    if data.get("leaveType") is not None:
        leave_type = str(data.get("leaveType") or "").strip()
        if leave_type not in dict(LeaveRequest.LEAVE_CHOICES):
            return _api_error("invalid_leave_type", status=400)
        lr.leave_type = leave_type
    if data.get("startDate") is not None:
        start_date = _to_date(data.get("startDate"))
        if not start_date:
            return _api_error("missing_dates", status=400)
        lr.start_date = start_date
    if data.get("endDate") is not None:
        end_date = _to_date(data.get("endDate"))
        if not end_date:
            return _api_error("missing_dates", status=400)
        lr.end_date = end_date
    if lr.end_date < lr.start_date:
        return _api_error("invalid_date_range", status=400)
    if data.get("reason") is not None:
        lr.reason = str(data.get("reason") or "").strip()
    lr.total_days = 0
    lr.save()
    _audit_ops(
        request,
        action="hr_leave_update",
        entity_type="leave_request",
        entity_id=str(lr.id),
        after={"workerId": lr.worker_id, "totalDays": lr.total_days},
    )
    return _api_ok()


@require_POST
def admin_hr_leave_requests_delete(
    request: HttpRequest, leave_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    lr = LeaveRequest.objects.filter(pk=leave_id).first()
    if not lr:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="hr_leave_delete",
        entity_type="leave_request",
        entity_id=str(lr.id),
        before={"workerId": lr.worker_id, "totalDays": lr.total_days},
    )
    lr.delete()
    return _api_ok()


@require_POST
def admin_hr_leave_requests_approve(
    request: HttpRequest, leave_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "hr_leave_approve",
        default_allowed_roles={"manager"},
    )
    if forbidden:
        return forbidden
    lr = LeaveRequest.objects.filter(pk=leave_id).first()
    if not lr:
        return _api_error("not_found", status=404)
    user = getattr(request, "user", None)
    lr.status = LeaveRequest.STATUS_APPROVED
    lr.approved_by = (
        user if user and getattr(user, "is_authenticated", False) else None
    )
    lr.approved_at = timezone.now()
    lr.save()
    _audit_ops(
        request,
        action="hr_leave_approve",
        entity_type="leave_request",
        entity_id=str(lr.id),
        after={"status": lr.status},
    )
    return _api_ok()


@require_POST
def admin_hr_leave_requests_reject(
    request: HttpRequest, leave_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "hr_leave_reject",
        default_allowed_roles={"manager"},
    )
    if forbidden:
        return forbidden
    lr = LeaveRequest.objects.filter(pk=leave_id).first()
    if not lr:
        return _api_error("not_found", status=404)
    lr.status = LeaveRequest.STATUS_REJECTED
    lr.approved_by = None
    lr.approved_at = None
    lr.save()
    _audit_ops(
        request,
        action="hr_leave_reject",
        entity_type="leave_request",
        entity_id=str(lr.id),
        after={"status": lr.status},
    )
    return _api_ok()


@require_GET
def admin_hr_leave_balance(
    request: HttpRequest, worker_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    year = int(request.GET.get("year") or 0) or timezone.now().year
    approved_days = (
        LeaveRequest.objects.filter(
            worker_id=worker_id,
            leave_type=LeaveRequest.LEAVE_ANNUAL,
            status=LeaveRequest.STATUS_APPROVED,
            start_date__year=year,
        ).aggregate(total=Sum("total_days"))["total"]
        or 0
    )
    return _api_ok(
        {
            "year": year,
            "workerId": worker_id,
            "approvedAnnualDays": int(approved_days),
        }
    )


@require_GET
def admin_hr_contracts(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    qs = EmployeeContract.objects.select_related("worker")
    worker_id = int(request.GET.get("workerId") or 0) or None
    if worker_id:
        qs = qs.filter(worker_id=worker_id)
    items: list[dict[str, Any]] = []
    for c in qs.order_by("-start_date", "-id"):
        items.append(
            {
                "id": c.id,
                "workerId": c.worker_id,
                "workerName": c.worker.name if c.worker else "",
                "contractNumber": c.contract_number,
                "contractType": c.contract_type,
                "startDate": _to_iso(c.start_date),
                "endDate": _to_iso(c.end_date),
                "basicSalary": float(c.basic_salary or 0),
                "transportationAllowance": float(
                    c.transportation_allowance or 0
                ),
                "housingAllowance": float(c.housing_allowance or 0),
                "position": c.position,
                "department": c.department,
                "probationPeriodDays": c.probation_period_days,
                "isActive": bool(c.is_active),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_hr_contracts_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    worker_id = int(data.get("workerId") or 0) or 0
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("worker_not_found", status=404)
    start_date = _to_date(data.get("startDate"))
    if not start_date:
        return _api_error("missing_start_date", status=400)
    contract_type = str(
        data.get("contractType") or EmployeeContract.CONTRACT_FULL_TIME
    ).strip()
    if contract_type not in dict(EmployeeContract.CONTRACT_CHOICES):
        return _api_error("invalid_contract_type", status=400)
    c = EmployeeContract.objects.create(
        worker=w,
        contract_number=str(data.get("contractNumber") or "").strip(),
        contract_type=contract_type,
        start_date=start_date,
        end_date=_to_date(data.get("endDate")),
        basic_salary=_to_dec(data.get("basicSalary"), allow_none=False)
        or Decimal("0"),
        transportation_allowance=_to_dec(
            data.get("transportationAllowance"), allow_none=True
        )
        or Decimal("0"),
        housing_allowance=_to_dec(data.get("housingAllowance"), allow_none=True)
        or Decimal("0"),
        position=str(data.get("position") or "").strip(),
        department=str(data.get("department") or "").strip(),
        probation_period_days=int(data.get("probationPeriodDays") or 90),
        is_active=(
            bool(data.get("isActive"))
            if data.get("isActive") is not None
            else True
        ),
    )
    _audit_ops(
        request,
        action="hr_contract_create",
        entity_type="employee_contract",
        entity_id=str(c.id),
        after={"workerId": w.id, "contractNumber": c.contract_number},
    )
    return _api_ok({"id": c.id})


@require_POST
def admin_hr_contracts_update(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    c = EmployeeContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        c.worker = w
    if data.get("contractNumber") is not None:
        c.contract_number = str(data.get("contractNumber") or "").strip()
    if data.get("contractType") is not None:
        contract_type = str(data.get("contractType") or "").strip()
        if contract_type not in dict(EmployeeContract.CONTRACT_CHOICES):
            return _api_error("invalid_contract_type", status=400)
        c.contract_type = contract_type
    if data.get("startDate") is not None:
        start_date = _to_date(data.get("startDate"))
        if not start_date:
            return _api_error("missing_start_date", status=400)
        c.start_date = start_date
    if data.get("endDate") is not None:
        c.end_date = _to_date(data.get("endDate"))
    if data.get("basicSalary") is not None:
        c.basic_salary = _to_dec(
            data.get("basicSalary"), allow_none=False
        ) or Decimal("0")
    if data.get("transportationAllowance") is not None:
        c.transportation_allowance = _to_dec(
            data.get("transportationAllowance"), allow_none=True
        ) or Decimal("0")
    if data.get("housingAllowance") is not None:
        c.housing_allowance = _to_dec(
            data.get("housingAllowance"), allow_none=True
        ) or Decimal("0")
    if data.get("position") is not None:
        c.position = str(data.get("position") or "").strip()
    if data.get("department") is not None:
        c.department = str(data.get("department") or "").strip()
    if data.get("probationPeriodDays") is not None:
        c.probation_period_days = int(data.get("probationPeriodDays") or 90)
    if data.get("isActive") is not None:
        c.is_active = bool(data.get("isActive"))
    c.save()
    _audit_ops(
        request,
        action="hr_contract_update",
        entity_type="employee_contract",
        entity_id=str(c.id),
        after={"workerId": c.worker_id, "contractNumber": c.contract_number},
    )
    return _api_ok()


@require_POST
def admin_hr_contracts_delete(
    request: HttpRequest, contract_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    c = EmployeeContract.objects.filter(pk=contract_id).first()
    if not c:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="hr_contract_delete",
        entity_type="employee_contract",
        entity_id=str(c.id),
        before={"workerId": c.worker_id, "contractNumber": c.contract_number},
    )
    c.delete()
    return _api_ok()


@require_GET
def admin_hr_overtime(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    qs = OvertimeRecord.objects.select_related("worker", "project")
    worker_id = int(request.GET.get("workerId") or 0) or None
    if worker_id:
        qs = qs.filter(worker_id=worker_id)
    year = int(request.GET.get("year") or 0) or None
    month = int(request.GET.get("month") or 0) or None
    if year:
        qs = qs.filter(date__year=year)
    if month and 1 <= month <= 12:
        qs = qs.filter(date__month=month)
    items: list[dict[str, Any]] = []
    for ot in qs.order_by("-date", "-id"):
        items.append(
            {
                "id": ot.id,
                "workerId": ot.worker_id,
                "workerName": ot.worker.name if ot.worker else "",
                "projectId": ot.project_id or 0,
                "projectTitle": (
                    getattr(ot.project, "title", "") if ot.project else ""
                ),
                "date": _to_iso(ot.date),
                "hours": float(ot.hours or 0),
                "multiplier": float(ot.multiplier or 0),
                "hourlyRate": (
                    float(ot.hourly_rate or 0)
                    if ot.hourly_rate is not None
                    else None
                ),
                "amount": (
                    float(ot.amount or 0) if ot.amount is not None else None
                ),
                "approved": bool(ot.approved),
                "approvedById": getattr(ot, "approved_by_id", None) or 0,
                "approvedAt": _to_iso(ot.approved_at),
                "notes": ot.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_hr_overtime_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    worker_id = int(data.get("workerId") or 0) or 0
    w = Worker.objects.filter(pk=worker_id).first()
    if not w:
        return _api_error("worker_not_found", status=404)
    date = _to_date(data.get("date"))
    if not date:
        return _api_error("missing_date", status=400)
    project_id = int(data.get("projectId") or 0) or None
    project = (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
    hours = _to_dec(data.get("hours"), allow_none=False) or Decimal("0")
    if hours <= 0:
        return _api_error("invalid_hours", status=400)
    multiplier = _to_dec(data.get("multiplier"), allow_none=True) or Decimal(
        "1.5"
    )
    hourly_rate = _to_dec(data.get("hourlyRate"), allow_none=True)
    if hourly_rate is None and w.monthly_salary:
        monthly = Decimal(str(w.monthly_salary))
        hourly_rate = (monthly / Decimal("30") / Decimal("8")).quantize(
            Decimal("0.01")
        )
    ot = OvertimeRecord.objects.create(
        worker=w,
        project=project,
        date=date,
        hours=hours,
        multiplier=multiplier,
        hourly_rate=hourly_rate,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="hr_overtime_create",
        entity_type="overtime",
        entity_id=str(ot.id),
        after={"workerId": w.id, "amount": float(ot.amount or 0)},
    )
    return _api_ok({"id": ot.id})


@require_POST
def admin_hr_overtime_update(
    request: HttpRequest, overtime_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    ot = OvertimeRecord.objects.filter(pk=overtime_id).first()
    if not ot:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        ot.worker = w
    if data.get("projectId") is not None:
        project_id = int(data.get("projectId") or 0) or None
        ot.project = (
            ProjectPage.objects.filter(pk=project_id).specific().first()
            if project_id
            else None
        )
    if data.get("date") is not None:
        date = _to_date(data.get("date"))
        if not date:
            return _api_error("missing_date", status=400)
        ot.date = date
    if data.get("hours") is not None:
        hours = _to_dec(data.get("hours"), allow_none=False) or Decimal("0")
        if hours <= 0:
            return _api_error("invalid_hours", status=400)
        ot.hours = hours
    if data.get("multiplier") is not None:
        ot.multiplier = _to_dec(
            data.get("multiplier"), allow_none=True
        ) or Decimal("1.5")
    if data.get("hourlyRate") is not None:
        ot.hourly_rate = _to_dec(data.get("hourlyRate"), allow_none=True)
    if data.get("notes") is not None:
        ot.notes = str(data.get("notes") or "").strip()
    ot.save()
    _audit_ops(
        request,
        action="hr_overtime_update",
        entity_type="overtime",
        entity_id=str(ot.id),
        after={"workerId": ot.worker_id, "amount": float(ot.amount or 0)},
    )
    return _api_ok()


@require_POST
def admin_hr_overtime_delete(
    request: HttpRequest, overtime_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    ot = OvertimeRecord.objects.filter(pk=overtime_id).first()
    if not ot:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="hr_overtime_delete",
        entity_type="overtime",
        entity_id=str(ot.id),
        before={"workerId": ot.worker_id, "amount": float(ot.amount or 0)},
    )
    ot.delete()
    return _api_ok()


@require_POST
def admin_hr_overtime_approve(
    request: HttpRequest, overtime_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "hr_overtime_approve",
        default_allowed_roles={"manager"},
    )
    if forbidden:
        return forbidden
    ot = OvertimeRecord.objects.filter(pk=overtime_id).first()
    if not ot:
        return _api_error("not_found", status=404)
    user = getattr(request, "user", None)
    ot.approved = True
    ot.approved_by = (
        user if user and getattr(user, "is_authenticated", False) else None
    )
    ot.approved_at = timezone.now()
    ot.save()
    _audit_ops(
        request,
        action="hr_overtime_approve",
        entity_type="overtime",
        entity_id=str(ot.id),
        after={"approved": True},
    )
    return _api_ok()


@require_GET
def admin_hr_social_security(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    qs = SocialSecurityRecord.objects.select_related("worker")
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
    for ss in qs.order_by("-year", "-month", "-id"):
        items.append(
            {
                "id": ss.id,
                "workerId": ss.worker_id,
                "workerName": ss.worker.name if ss.worker else "",
                "year": ss.year,
                "month": ss.month,
                "grossSalary": float(ss.gross_salary or 0),
                "employeeShare": float(ss.employee_share or 0),
                "employerShare": float(ss.employer_share or 0),
                "total": float(ss.total or 0),
                "paid": bool(ss.paid),
                "paidDate": _to_iso(ss.paid_date),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_hr_social_security_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
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
    gross_salary = _to_dec(
        data.get("grossSalary"), allow_none=False
    ) or Decimal("0")
    employee_share = _to_dec(
        data.get("employeeShare"), allow_none=False
    ) or Decimal("0")
    employer_share = _to_dec(
        data.get("employerShare"), allow_none=False
    ) or Decimal("0")
    ss = SocialSecurityRecord.objects.create(
        worker=w,
        year=year,
        month=month,
        gross_salary=gross_salary,
        employee_share=employee_share,
        employer_share=employer_share,
        paid=bool(data.get("paid")),
        paid_date=_to_date(data.get("paidDate")),
    )
    _audit_ops(
        request,
        action="hr_social_security_create",
        entity_type="social_security",
        entity_id=str(ss.id),
        after={"workerId": w.id, "total": float(ss.total or 0)},
    )
    return _api_ok({"id": ss.id})


@require_POST
def admin_hr_social_security_update(
    request: HttpRequest, record_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    ss = SocialSecurityRecord.objects.filter(pk=record_id).first()
    if not ss:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("workerId") is not None:
        worker_id = int(data.get("workerId") or 0) or 0
        w = Worker.objects.filter(pk=worker_id).first()
        if not w:
            return _api_error("worker_not_found", status=404)
        ss.worker = w
    if data.get("year") is not None:
        year = int(data.get("year") or 0) or 0
        if not (1900 <= year <= 2200):
            return _api_error("invalid_year", status=400)
        ss.year = year
    if data.get("month") is not None:
        month = int(data.get("month") or 0) or 0
        if not (1 <= month <= 12):
            return _api_error("invalid_month", status=400)
        ss.month = month
    if data.get("grossSalary") is not None:
        ss.gross_salary = _to_dec(
            data.get("grossSalary"), allow_none=False
        ) or Decimal("0")
    if data.get("employeeShare") is not None:
        ss.employee_share = _to_dec(
            data.get("employeeShare"), allow_none=False
        ) or Decimal("0")
    if data.get("employerShare") is not None:
        ss.employer_share = _to_dec(
            data.get("employerShare"), allow_none=False
        ) or Decimal("0")
    if data.get("paid") is not None:
        ss.paid = bool(data.get("paid"))
    if data.get("paidDate") is not None:
        ss.paid_date = _to_date(data.get("paidDate"))
    ss.save()
    _audit_ops(
        request,
        action="hr_social_security_update",
        entity_type="social_security",
        entity_id=str(ss.id),
        after={"workerId": ss.worker_id, "total": float(ss.total or 0)},
    )
    return _api_ok()


@require_POST
def admin_hr_social_security_delete(
    request: HttpRequest, record_id: int
) -> JsonResponse:
    forbidden = _require_ops_management(request)
    if forbidden:
        return forbidden
    ss = SocialSecurityRecord.objects.filter(pk=record_id).first()
    if not ss:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="hr_social_security_delete",
        entity_type="social_security",
        entity_id=str(ss.id),
        before={"workerId": ss.worker_id, "total": float(ss.total or 0)},
    )
    ss.delete()
    return _api_ok()


@require_POST
def admin_hr_social_security_mark_paid(
    request: HttpRequest, record_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "hr_social_security_mark_paid",
        default_allowed_roles={"manager", "accountant"},
    )
    if forbidden:
        return forbidden
    ss = SocialSecurityRecord.objects.filter(pk=record_id).first()
    if not ss:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    ss.paid = True
    ss.paid_date = _to_date(data.get("paidDate")) or timezone.localdate()
    ss.save()
    _audit_ops(
        request,
        action="hr_social_security_mark_paid",
        entity_type="social_security",
        entity_id=str(ss.id),
        after={"paid": True, "paidDate": _to_iso(ss.paid_date)},
    )
    return _api_ok()
