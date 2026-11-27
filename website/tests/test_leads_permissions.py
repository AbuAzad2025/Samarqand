import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase

from website.models import Lead

User = get_user_model()


def post_json(client, url, payload):
    return client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
    )


class LeadCaptureTests(TestCase):
    def test_public_lead_is_saved(self):
        response = post_json(
            self.client,
            "/api/site/leads",
            {
                "name": "أحمد",
                "phone": "0591234567",
                "email": "a@example.com",
                "projectType": "فيلا",
                "message": "نرغب بعرض سعر",
                "source": "quote",
            },
        )
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get()
        self.assertEqual(lead.name, "أحمد")
        self.assertEqual(lead.status, Lead.STATUS_NEW)
        self.assertEqual(lead.source, Lead.SOURCE_QUOTE)

    def test_invalid_phone_is_rejected(self):
        response = post_json(
            self.client,
            "/api/site/leads",
            {"name": "أحمد", "phone": "123"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Lead.objects.count(), 0)


class ErpPermissionTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="manager", password="pass1234", is_staff=True
        )
        self.manager.groups.add(Group.objects.get_or_create(name="Managers")[0])
        self.employee = User.objects.create_user(
            username="employee", password="pass1234", is_staff=True
        )
        self.employee.groups.add(
            Group.objects.get_or_create(name="Employees")[0]
        )

    def test_employee_cannot_read_hr_salary_records(self):
        self.client.force_login(self.employee)
        self.assertEqual(
            self.client.get("/api/admin/hr/leave").status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/admin/hr/contracts").status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/admin/hr/social-security").status_code, 403
        )

    def test_manager_can_read_hr_salary_records(self):
        self.client.force_login(self.manager)
        self.assertEqual(
            self.client.get("/api/admin/hr/leave").status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/admin/hr/contracts").status_code, 200
        )

    def test_employee_cannot_read_fleet_costs(self):
        self.client.force_login(self.employee)
        self.assertEqual(
            self.client.get("/api/admin/fleet/fuel-logs").status_code, 403
        )

    def test_employee_cannot_read_leads(self):
        self.client.force_login(self.employee)
        self.assertEqual(self.client.get("/api/admin/leads").status_code, 403)

    def test_manager_can_update_lead(self):
        lead = Lead.objects.create(name="عميل", phone="0591111111")
        self.client.force_login(self.manager)
        response = post_json(
            self.client,
            f"/api/admin/leads/{lead.id}/update",
            {"status": "contacted", "notes": "تم الاتصال"},
        )
        self.assertEqual(response.status_code, 200)
        lead.refresh_from_db()
        self.assertEqual(lead.status, "contacted")
        self.assertEqual(lead.notes, "تم الاتصال")
