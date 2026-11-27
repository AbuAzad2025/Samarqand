"""API views for fleet management."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.http import HttpRequest
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import FuelLog
from website.models import ProjectPage
from website.models import Vehicle
from website.models import VehicleMaintenance
from website.models import Worker

from .admin_accounts import _clean_text
from .admin_accounts import _safe_date
from .admin_accounts import _safe_int
from .common import *


def _sync_vehicle_expiry(maintenance: VehicleMaintenance) -> None:
    next_due = maintenance.next_due_date
    if not next_due:
        return
    field = None
    if maintenance.maintenance_type == VehicleMaintenance.MAINTENANCE_INSURANCE:
        field = "insurance_expiry"
    elif (
        maintenance.maintenance_type
        == VehicleMaintenance.MAINTENANCE_REGISTRATION
    ):
        field = "registration_expiry"
    if field:
        Vehicle.objects.filter(pk=maintenance.vehicle_id).update(
            **{field: next_due}
        )


def _validate_odometer(
    vehicle: Vehicle,
    odometer: int | None,
    *,
    exclude_pk: int | None = None,
) -> JsonResponse | None:
    """Reject odometer readings that go backwards for the same vehicle."""
    if odometer is None:
        return None
    if odometer <= 0:
        return _api_error("invalid_odometer", status=400)
    qs = FuelLog.objects.filter(vehicle=vehicle)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    last = qs.exclude(odometer_km__isnull=True).order_by("-date", "-id").first()
    if last and last.odometer_km is not None and odometer < last.odometer_km:
        return _api_error("odometer_decreasing", status=400)
    return None


def _vehicle_to_dict(v: Vehicle) -> dict[str, Any]:
    return {
        "id": v.id,
        "name": v.name,
        "plateNumber": v.plate_number,
        "vehicleType": v.vehicle_type,
        "brand": v.brand,
        "modelName": v.model_name,
        "year": v.year,
        "color": v.color,
        "chassisNumber": v.chassis_number,
        "engineNumber": v.engine_number,
        "status": v.status,
        "assignedToId": v.assigned_to_id or 0,
        "assignedToName": (
            getattr(v.assigned_to, "name", "") if v.assigned_to else ""
        ),
        "currentProjectId": v.current_project_id or 0,
        "currentProjectTitle": (
            getattr(v.current_project, "title", "") if v.current_project else ""
        ),
        "insuranceExpiry": _to_iso(v.insurance_expiry),
        "registrationExpiry": _to_iso(v.registration_expiry),
        "fuelType": v.fuel_type,
        "tankCapacityLiters": (
            float(v.tank_capacity_liters)
            if v.tank_capacity_liters is not None
            else None
        ),
        "notes": v.notes,
    }


@require_GET
def admin_fleet_vehicles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_fleet_read(request)
    if forbidden:
        return forbidden
    qs = Vehicle.objects.select_related("assigned_to", "current_project")
    status = str(request.GET.get("status") or "").strip()
    if status:
        qs = qs.filter(status=status)
    vehicle_type = str(request.GET.get("vehicleType") or "").strip()
    if vehicle_type:
        qs = qs.filter(vehicle_type=vehicle_type)
    items = [_vehicle_to_dict(v) for v in qs.order_by("name", "id")]
    return _api_ok({"items": items})


@require_POST
def admin_fleet_vehicles_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_vehicles_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = _clean_text(data.get("name"), 255, required=True)
    plate_number = _clean_text(data.get("plateNumber"), 64, required=True)
    if not name:
        return _api_error(
            "missing_name", status=400, message="اسم المركبة مطلوب."
        )
    if not plate_number:
        return _api_error(
            "missing_plate_number", status=400, message="رقم اللوحة مطلوب."
        )
    if Vehicle.objects.filter(plate_number=plate_number).exists():
        return _api_error("duplicate_plate_number", status=409)
    vehicle_type = str(data.get("vehicleType") or Vehicle.VEHICLE_TRUCK).strip()
    if vehicle_type not in dict(Vehicle.VEHICLE_CHOICES):
        return _api_error("invalid_vehicle_type", status=400)
    status = str(data.get("status") or Vehicle.STATUS_AVAILABLE).strip()
    if status not in dict(Vehicle.STATUS_CHOICES):
        return _api_error("invalid_status", status=400)
    assigned_to = _resolve_worker(data.get("assignedToId"))
    current_project = _resolve_project(data.get("currentProjectId"))
    tank_capacity = _to_dec(data.get("tankCapacityLiters"), allow_none=True)
    if tank_capacity is not None and tank_capacity < 0:
        return _api_error(
            "invalid_tank_capacity", status=400, message="سعة الخزان غير صالحة."
        )
    v = Vehicle.objects.create(
        name=name,
        plate_number=plate_number,
        vehicle_type=vehicle_type,
        brand=_clean_text(data.get("brand"), 128) or "",
        model_name=_clean_text(data.get("modelName"), 128) or "",
        year=_safe_int(data.get("year"), 0) or None,
        color=_clean_text(data.get("color"), 64) or "",
        chassis_number=_clean_text(data.get("chassisNumber"), 128) or "",
        engine_number=_clean_text(data.get("engineNumber"), 128) or "",
        status=status,
        assigned_to=assigned_to,
        current_project=current_project,
        insurance_expiry=_safe_date(data.get("insuranceExpiry")),
        registration_expiry=_safe_date(data.get("registrationExpiry")),
        fuel_type=_clean_text(data.get("fuelType"), 32) or "",
        tank_capacity_liters=tank_capacity,
        notes=_clean_text(data.get("notes"), 4000) or "",
    )
    _audit_ops(
        request,
        action="fleet_vehicle_create",
        entity_type="vehicle",
        entity_id=str(v.id),
        after={"name": v.name, "plateNumber": v.plate_number},
    )
    return _api_ok({"id": v.id})


@require_POST
def admin_fleet_vehicles_update(
    request: HttpRequest, vehicle_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_vehicles_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    v = Vehicle.objects.filter(pk=vehicle_id).first()
    if not v:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("name") is not None:
        v.name = _clean_text(data.get("name"), 255) or ""
    if data.get("plateNumber") is not None:
        plate_number = _clean_text(data.get("plateNumber"), 64) or ""
        if (
            plate_number
            and Vehicle.objects.exclude(pk=v.id)
            .filter(plate_number=plate_number)
            .exists()
        ):
            return _api_error("duplicate_plate_number", status=409)
        v.plate_number = plate_number
    if data.get("vehicleType") is not None:
        vehicle_type = str(data.get("vehicleType") or "").strip()
        if vehicle_type not in dict(Vehicle.VEHICLE_CHOICES):
            return _api_error("invalid_vehicle_type", status=400)
        v.vehicle_type = vehicle_type
    if data.get("status") is not None:
        status = str(data.get("status") or "").strip()
        if status not in dict(Vehicle.STATUS_CHOICES):
            return _api_error("invalid_status", status=400)
        v.status = status
    if data.get("brand") is not None:
        v.brand = _clean_text(data.get("brand"), 128) or ""
    if data.get("modelName") is not None:
        v.model_name = _clean_text(data.get("modelName"), 128) or ""
    if data.get("year") is not None:
        v.year = _safe_int(data.get("year"), 0) or None
    if data.get("color") is not None:
        v.color = _clean_text(data.get("color"), 64) or ""
    if data.get("chassisNumber") is not None:
        v.chassis_number = _clean_text(data.get("chassisNumber"), 128) or ""
    if data.get("engineNumber") is not None:
        v.engine_number = _clean_text(data.get("engineNumber"), 128) or ""
    if data.get("assignedToId") is not None:
        v.assigned_to = _resolve_worker(data.get("assignedToId"))
    if data.get("currentProjectId") is not None:
        v.current_project = _resolve_project(data.get("currentProjectId"))
    if data.get("insuranceExpiry") is not None:
        v.insurance_expiry = _safe_date(data.get("insuranceExpiry"))
    if data.get("registrationExpiry") is not None:
        v.registration_expiry = _safe_date(data.get("registrationExpiry"))
    if data.get("fuelType") is not None:
        v.fuel_type = _clean_text(data.get("fuelType"), 32) or ""
    if data.get("tankCapacityLiters") is not None:
        v.tank_capacity_liters = _to_dec(
            data.get("tankCapacityLiters"), allow_none=True
        )
        if v.tank_capacity_liters is not None and v.tank_capacity_liters < 0:
            return _api_error(
                "invalid_tank_capacity",
                status=400,
                message="سعة الخزان غير صالحة.",
            )
    if data.get("notes") is not None:
        v.notes = _clean_text(data.get("notes"), 4000) or ""
    if not v.name or not v.plate_number:
        return _api_error("missing_name_or_plate", status=400)
    v.save()
    _audit_ops(
        request,
        action="fleet_vehicle_update",
        entity_type="vehicle",
        entity_id=str(v.id),
        after={"name": v.name, "plateNumber": v.plate_number},
    )
    return _api_ok()


@require_POST
def admin_fleet_vehicles_delete(
    request: HttpRequest, vehicle_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_vehicles_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    v = Vehicle.objects.filter(pk=vehicle_id).first()
    if not v:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="fleet_vehicle_delete",
        entity_type="vehicle",
        entity_id=str(v.id),
        before={"name": v.name, "plateNumber": v.plate_number},
    )
    v.delete()
    return _api_ok()


@require_GET
def admin_fleet_fuel_logs(request: HttpRequest) -> JsonResponse:
    forbidden = _require_fleet_read(request)
    if forbidden:
        return forbidden
    qs = FuelLog.objects.select_related("vehicle", "filled_by")
    vehicle_id = _safe_int(request.GET.get("vehicleId"), 0) or None
    if vehicle_id:
        qs = qs.filter(vehicle_id=vehicle_id)
    year = _safe_int(request.GET.get("year"), 0) or None
    month = _safe_int(request.GET.get("month"), 0) or None
    if year:
        qs = qs.filter(date__year=year)
    if month and 1 <= month <= 12:
        qs = qs.filter(date__month=month)
    items: list[dict[str, Any]] = []
    for fl in qs.order_by("-date", "-id"):
        items.append(
            {
                "id": fl.id,
                "vehicleId": fl.vehicle_id,
                "vehicleName": fl.vehicle.name if fl.vehicle else "",
                "plateNumber": (
                    getattr(fl.vehicle, "plate_number", "")
                    if fl.vehicle
                    else ""
                ),
                "date": _to_iso(fl.date),
                "liters": float(fl.liters or 0),
                "cost": float(fl.cost or 0),
                "odometerKm": fl.odometer_km,
                "station": fl.station,
                "filledById": fl.filled_by_id or 0,
                "filledByName": (
                    getattr(fl.filled_by, "name", "") if fl.filled_by else ""
                ),
                "notes": fl.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_fleet_fuel_logs_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_fuel_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    data = _read_json(request)
    vehicle_id = _safe_int(data.get("vehicleId"), 0) or 0
    vehicle = Vehicle.objects.filter(pk=vehicle_id).first()
    if not vehicle:
        return _api_error("vehicle_not_found", status=404)
    date = _safe_date(data.get("date"))
    if not date:
        return _api_error("missing_date", status=400)
    liters = _to_dec(data.get("liters"), allow_none=False) or Decimal("0")
    if liters <= 0:
        return _api_error("invalid_liters", status=400)
    cost = _to_dec(data.get("cost"), allow_none=False) or Decimal("0")
    if cost < 0:
        return _api_error(
            "invalid_cost", status=400, message="التكلفة غير صالحة."
        )
    odometer = _safe_int(data.get("odometerKm"), 0) or None
    invalid = _validate_odometer(vehicle, odometer)
    if invalid:
        return invalid
    fl = FuelLog.objects.create(
        vehicle=vehicle,
        date=date,
        liters=liters,
        cost=cost,
        odometer_km=odometer,
        station=_clean_text(data.get("station"), 128) or "",
        filled_by=_resolve_worker(data.get("filledById")),
        notes=_clean_text(data.get("notes"), 4000) or "",
    )
    _audit_ops(
        request,
        action="fleet_fuel_create",
        entity_type="fuel_log",
        entity_id=str(fl.id),
        after={"vehicleId": vehicle.id, "cost": float(cost)},
    )
    return _api_ok({"id": fl.id})


@require_POST
def admin_fleet_fuel_logs_update(
    request: HttpRequest, log_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_fuel_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    fl = FuelLog.objects.filter(pk=log_id).first()
    if not fl:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("vehicleId") is not None:
        vehicle_id = _safe_int(data.get("vehicleId"), 0) or 0
        vehicle = Vehicle.objects.filter(pk=vehicle_id).first()
        if not vehicle:
            return _api_error("vehicle_not_found", status=404)
        fl.vehicle = vehicle
    if data.get("date") is not None:
        date = _safe_date(data.get("date"))
        if not date:
            return _api_error("missing_date", status=400)
        fl.date = date
    if data.get("liters") is not None:
        liters = _to_dec(data.get("liters"), allow_none=False) or Decimal("0")
        if liters <= 0:
            return _api_error("invalid_liters", status=400)
        fl.liters = liters
    if data.get("cost") is not None:
        fl.cost = _to_dec(data.get("cost"), allow_none=False) or Decimal("0")
        if fl.cost < 0:
            return _api_error(
                "invalid_cost", status=400, message="التكلفة غير صالحة."
            )
    if data.get("odometerKm") is not None:
        fl.odometer_km = _safe_int(data.get("odometerKm"), 0) or None
    if data.get("station") is not None:
        fl.station = _clean_text(data.get("station"), 128) or ""
    if data.get("filledById") is not None:
        fl.filled_by = _resolve_worker(data.get("filledById"))
    if data.get("notes") is not None:
        fl.notes = _clean_text(data.get("notes"), 4000) or ""
    invalid = _validate_odometer(fl.vehicle, fl.odometer_km, exclude_pk=fl.pk)
    if invalid:
        return invalid
    fl.save()
    _audit_ops(
        request,
        action="fleet_fuel_update",
        entity_type="fuel_log",
        entity_id=str(fl.id),
        after={"vehicleId": fl.vehicle_id, "cost": float(fl.cost or 0)},
    )
    return _api_ok()


@require_POST
def admin_fleet_fuel_logs_delete(
    request: HttpRequest, log_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_fuel_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    fl = FuelLog.objects.filter(pk=log_id).first()
    if not fl:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="fleet_fuel_delete",
        entity_type="fuel_log",
        entity_id=str(fl.id),
        before={"vehicleId": fl.vehicle_id, "cost": float(fl.cost or 0)},
    )
    fl.delete()
    return _api_ok()


@require_GET
def admin_fleet_maintenance(request: HttpRequest) -> JsonResponse:
    forbidden = _require_fleet_read(request)
    if forbidden:
        return forbidden
    qs = VehicleMaintenance.objects.select_related("vehicle")
    vehicle_id = _safe_int(request.GET.get("vehicleId"), 0) or None
    if vehicle_id:
        qs = qs.filter(vehicle_id=vehicle_id)
    maintenance_type = str(request.GET.get("maintenanceType") or "").strip()
    if maintenance_type:
        qs = qs.filter(maintenance_type=maintenance_type)
    year = _safe_int(request.GET.get("year"), 0) or None
    month = _safe_int(request.GET.get("month"), 0) or None
    if year:
        qs = qs.filter(date__year=year)
    if month and 1 <= month <= 12:
        qs = qs.filter(date__month=month)
    items: list[dict[str, Any]] = []
    for m in qs.order_by("-date", "-id"):
        items.append(
            {
                "id": m.id,
                "vehicleId": m.vehicle_id,
                "vehicleName": m.vehicle.name if m.vehicle else "",
                "plateNumber": (
                    getattr(m.vehicle, "plate_number", "") if m.vehicle else ""
                ),
                "date": _to_iso(m.date),
                "maintenanceType": m.maintenance_type,
                "description": m.description,
                "cost": float(m.cost or 0),
                "odometerKm": m.odometer_km,
                "nextDueDate": _to_iso(m.next_due_date),
                "garage": m.garage,
                "notes": m.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_fleet_maintenance_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_maintenance_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    data = _read_json(request)
    vehicle_id = _safe_int(data.get("vehicleId"), 0) or 0
    vehicle = Vehicle.objects.filter(pk=vehicle_id).first()
    if not vehicle:
        return _api_error("vehicle_not_found", status=404)
    date = _safe_date(data.get("date"))
    if not date:
        return _api_error("missing_date", status=400)
    maintenance_type = str(
        data.get("maintenanceType") or VehicleMaintenance.MAINTENANCE_OTHER
    ).strip()
    if maintenance_type not in dict(VehicleMaintenance.MAINTENANCE_CHOICES):
        return _api_error("invalid_maintenance_type", status=400)
    cost = _to_dec(data.get("cost"), allow_none=False) or Decimal("0")
    if cost < 0:
        return _api_error(
            "invalid_cost", status=400, message="التكلفة غير صالحة."
        )
    odometer = _safe_int(data.get("odometerKm"), 0) or None
    if odometer is not None and odometer < 0:
        return _api_error(
            "invalid_odometer", status=400, message="قراءة العداد غير صالحة."
        )
    m = VehicleMaintenance.objects.create(
        vehicle=vehicle,
        date=date,
        maintenance_type=maintenance_type,
        description=_clean_text(data.get("description"), 2000) or "",
        cost=cost,
        odometer_km=odometer,
        next_due_date=_safe_date(data.get("nextDueDate")),
        garage=_clean_text(data.get("garage"), 128) or "",
        notes=_clean_text(data.get("notes"), 4000) or "",
    )
    _sync_vehicle_expiry(m)
    _audit_ops(
        request,
        action="fleet_maintenance_create",
        entity_type="vehicle_maintenance",
        entity_id=str(m.id),
        after={"vehicleId": vehicle.id, "cost": float(cost)},
    )
    return _api_ok({"id": m.id})


@require_POST
def admin_fleet_maintenance_update(
    request: HttpRequest, record_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_maintenance_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    m = VehicleMaintenance.objects.filter(pk=record_id).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if data.get("vehicleId") is not None:
        vehicle_id = _safe_int(data.get("vehicleId"), 0) or 0
        vehicle = Vehicle.objects.filter(pk=vehicle_id).first()
        if not vehicle:
            return _api_error("vehicle_not_found", status=404)
        m.vehicle = vehicle
    if data.get("date") is not None:
        date = _safe_date(data.get("date"))
        if not date:
            return _api_error("missing_date", status=400)
        m.date = date
    if data.get("maintenanceType") is not None:
        maintenance_type = str(data.get("maintenanceType") or "").strip()
        if maintenance_type not in dict(VehicleMaintenance.MAINTENANCE_CHOICES):
            return _api_error("invalid_maintenance_type", status=400)
        m.maintenance_type = maintenance_type
    if data.get("description") is not None:
        m.description = _clean_text(data.get("description"), 2000) or ""
    if data.get("cost") is not None:
        m.cost = _to_dec(data.get("cost"), allow_none=False) or Decimal("0")
        if m.cost < 0:
            return _api_error(
                "invalid_cost", status=400, message="التكلفة غير صالحة."
            )
    if data.get("odometerKm") is not None:
        m.odometer_km = _safe_int(data.get("odometerKm"), 0) or None
        if m.odometer_km is not None and m.odometer_km < 0:
            return _api_error(
                "invalid_odometer",
                status=400,
                message="قراءة العداد غير صالحة.",
            )
    if data.get("nextDueDate") is not None:
        m.next_due_date = _safe_date(data.get("nextDueDate"))
    if data.get("garage") is not None:
        m.garage = _clean_text(data.get("garage"), 128) or ""
    if data.get("notes") is not None:
        m.notes = _clean_text(data.get("notes"), 4000) or ""
    m.save()
    _sync_vehicle_expiry(m)
    _audit_ops(
        request,
        action="fleet_maintenance_update",
        entity_type="vehicle_maintenance",
        entity_id=str(m.id),
        after={"vehicleId": m.vehicle_id, "cost": float(m.cost or 0)},
    )
    return _api_ok()


@require_POST
def admin_fleet_maintenance_delete(
    request: HttpRequest, record_id: int
) -> JsonResponse:
    forbidden = _require_ops_rule(
        request,
        "fleet_maintenance_write",
        default_allowed_roles={"manager", "registrar"},
    )
    if forbidden:
        return forbidden
    m = VehicleMaintenance.objects.filter(pk=record_id).first()
    if not m:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="fleet_maintenance_delete",
        entity_type="vehicle_maintenance",
        entity_id=str(m.id),
        before={"vehicleId": m.vehicle_id, "cost": float(m.cost or 0)},
    )
    m.delete()
    return _api_ok()


def _resolve_worker(raw: Any) -> Worker | None:
    worker_id = _safe_int(raw, 0) or 0
    if not worker_id:
        return None
    return Worker.objects.filter(pk=worker_id).first()


def _resolve_project(raw: Any) -> ProjectPage | None:
    project_id = _safe_int(raw, 0) or 0
    if not project_id:
        return None
    return (
        ProjectPage.objects.filter(pk=project_id).specific().first()
        if project_id
        else None
    )
