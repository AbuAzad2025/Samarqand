"""Regression tests for the final performance/UX improvement batch."""

import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.test import TestCase

from website.api.admin_mail import _msg_to_dict
from website.models import EmailMessage
from website.models import FuelLog
from website.models import LeaveRequest
from website.models import Vehicle
from website.models import Worker


class ImprovementTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="improvement_admin",
            email="improvement@example.test",
            password="a-long-test-password",
        )
        self.client.force_login(self.user)

    def test_leave_balance_reports_entitlement_and_remaining(self):
        worker = Worker.objects.create(name="عامل اختبار", role="عامل")
        LeaveRequest.objects.create(
            worker=worker,
            leave_type=LeaveRequest.LEAVE_ANNUAL,
            start_date=date(date.today().year, 3, 1),
            end_date=date(date.today().year, 3, 3),
            total_days=3,
            status=LeaveRequest.STATUS_APPROVED,
        )
        response = self.client.get(
            f"/api/admin/hr/leave/balance/{worker.id}"
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)["result"]
        self.assertEqual(data["approvedAnnualDays"], 3)
        self.assertEqual(data["annualEntitlement"], 21)
        self.assertEqual(data["remainingAnnualDays"], 18)

    def test_approved_leave_cannot_be_deleted(self):
        worker = Worker.objects.create(name="عامل اختبار 2", role="عامل")
        leave = LeaveRequest.objects.create(
            worker=worker,
            leave_type=LeaveRequest.LEAVE_ANNUAL,
            start_date=date.today(),
            end_date=date.today(),
            total_days=1,
            status=LeaveRequest.STATUS_APPROVED,
        )
        response = self.client.post(
            f"/api/admin/hr/leave/{leave.id}/delete",
            data="{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(LeaveRequest.objects.filter(pk=leave.pk).exists())

    def test_fuel_log_odometer_cannot_go_backwards(self):
        vehicle = Vehicle.objects.create(
            name="شاحنة اختبار",
            plate_number="TEST-IMPROVE-1",
            vehicle_type="truck",
        )
        FuelLog.objects.create(
            vehicle=vehicle,
            date=date(2026, 1, 1),
            liters=Decimal("50"),
            cost=Decimal("100"),
            odometer_km=1000,
        )
        response = self.client.post(
            "/api/admin/fleet/fuel-logs/create",
            data=json.dumps(
                {
                    "vehicleId": vehicle.id,
                    "date": "2026-02-01",
                    "liters": 50,
                    "cost": 100,
                    "odometerKm": 900,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(FuelLog.objects.filter(vehicle=vehicle).count(), 1)

    def test_bcc_hidden_from_non_sender_recipients(self):
        other = get_user_model().objects.create_user(
            username="other_recipient", password="a-long-test-password"
        )
        msg = EmailMessage.objects.create(
            sender=self.user,
            recipients=[other.id],
            cc=[],
            bcc=[self.user.id],
            subject="test",
            body="body",
            folder=EmailMessage.FOLDER_SENT,
        )
        as_other = _msg_to_dict(msg, user_id=other.id)
        as_sender = _msg_to_dict(msg, user_id=self.user.id)
        self.assertEqual(as_other["bcc"], [])
        self.assertEqual(as_sender["bcc"], [self.user.id])
