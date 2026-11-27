import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

User = get_user_model()


class BackupValidationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="root", email="root@test.com", password="pass1234"
        )
        self.client.force_login(self.admin)

    def upload(self, content):
        return self.client.post(
            "/api/admin/backup/validate",
            {"file": StringIO(content)},
        )

    def test_valid_dump_is_accepted_without_writing(self):
        out = StringIO()
        call_command("dumpdata", "website", indent=2, stdout=out)
        before = User.objects.count()
        response = self.upload(out.getvalue())
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)["result"]
        self.assertTrue(data["okToRestore"])
        self.assertGreater(data["total"], 0)
        self.assertEqual(User.objects.count(), before)

    def test_invalid_json_is_rejected(self):
        response = self.upload("not json")
        self.assertEqual(response.status_code, 400)

    def test_employee_cannot_validate(self):
        employee = User.objects.create_user(
            username="emp", password="pass1234", is_staff=True
        )
        self.client.force_login(employee)
        response = self.upload("[]")
        self.assertEqual(response.status_code, 403)
