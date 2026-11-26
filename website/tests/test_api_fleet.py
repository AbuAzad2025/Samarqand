import json

from django.contrib.auth import get_user_model
from django.test import TestCase

from website.models import Vehicle

User = get_user_model()


class FleetAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="pass1234"
        )
        self.client.force_login(self.user)

    def test_list_vehicles(self):
        Vehicle.objects.create(name="Truck", plate_number="API-1")
        response = self.client.get("/api/admin/fleet/vehicles")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data.get("ok"))
        self.assertEqual(len(data["result"]["items"]), 1)

    def test_create_vehicle(self):
        payload = {
            "name": "New Truck",
            "plateNumber": "API-NEW",
            "vehicleType": "truck",
            "status": "available",
        }
        response = self.client.post(
            "/api/admin/fleet/vehicles/create",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data.get("ok"))
        self.assertTrue(Vehicle.objects.filter(plate_number="API-NEW").exists())
