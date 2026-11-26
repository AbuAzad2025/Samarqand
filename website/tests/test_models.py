from django.test import TestCase

from website.models import FuelLog
from website.models import Vehicle
from website.models import VehicleMaintenance
from website.models import Worker


class VehicleModelTests(TestCase):
    def test_create_vehicle(self):
        v = Vehicle.objects.create(
            name="Test Truck",
            plate_number="TEST-123",
            vehicle_type=Vehicle.VEHICLE_TRUCK,
            status=Vehicle.STATUS_AVAILABLE,
        )
        self.assertEqual(str(v), "Test Truck (TEST-123)")
        self.assertEqual(v.status, Vehicle.STATUS_AVAILABLE)

    def test_plate_number_unique(self):
        Vehicle.objects.create(
            name="First",
            plate_number="UNIQUE-1",
        )
        with self.assertRaises(Exception):
            Vehicle.objects.create(
                name="Second",
                plate_number="UNIQUE-1",
            )


class FuelLogModelTests(TestCase):
    def test_create_fuel_log(self):
        v = Vehicle.objects.create(
            name="Truck",
            plate_number="FUEL-1",
        )
        fl = FuelLog.objects.create(
            vehicle=v,
            date="2026-06-30",
            liters=50,
            cost=200,
        )
        self.assertEqual(fl.vehicle, v)
        self.assertEqual(float(fl.liters), 50.0)


class MaintenanceModelTests(TestCase):
    def test_create_maintenance(self):
        v = Vehicle.objects.create(
            name="Truck",
            plate_number="MAINT-1",
        )
        m = VehicleMaintenance.objects.create(
            vehicle=v,
            date="2026-06-30",
            maintenance_type=VehicleMaintenance.MAINTENANCE_OIL,
            cost=150,
        )
        self.assertEqual(m.maintenance_type, VehicleMaintenance.MAINTENANCE_OIL)


class WorkerModelTests(TestCase):
    def test_create_worker(self):
        w = Worker.objects.create(
            name="Ali",
            kind=Worker.KIND_WORKER,
        )
        self.assertEqual(str(w), "Ali")
        self.assertTrue(w.active)
