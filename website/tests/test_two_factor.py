import json
import time

from django.contrib.auth import get_user_model
from django.test import TestCase

from website.api.two_factor import _hotp

User = get_user_model()


class TwoFactorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="admin2fa", password="pass1234", is_staff=True
        )
        self.client.force_login(self.user)

    def post(self, url, payload=None):
        return self.client.post(
            url,
            data=json.dumps(payload or {}),
            content_type="application/json",
        )

    def current_code(self, secret):
        return _hotp(secret, int(time.time()) // 30)

    def test_setup_confirm_and_login_flow(self):
        setup = self.post("/api/auth/2fa/setup")
        self.assertEqual(setup.status_code, 200)
        secret = json.loads(setup.content)["result"]["secret"]
        self.assertTrue(secret)

        status = self.client.get("/api/auth/2fa/status")
        self.assertFalse(json.loads(status.content)["result"]["enabled"])

        bad = self.post("/api/auth/2fa/confirm", {"code": "000000"})
        self.assertEqual(bad.status_code, 400)

        good = self.post(
            "/api/auth/2fa/confirm", {"code": self.current_code(secret)}
        )
        self.assertEqual(good.status_code, 200)
        self.assertTrue(
            json.loads(self.client.get("/api/auth/2fa/status").content)[
                "result"
            ]["enabled"]
        )

        self.client.logout()
        no_code = self.post(
            "/api/auth/login", {"username": "admin2fa", "password": "pass1234"}
        )
        self.assertEqual(no_code.status_code, 401)
        self.assertEqual(
            json.loads(no_code.content)["errorCode"], "two_factor_required"
        )

        wrong = self.post(
            "/api/auth/login",
            {
                "username": "admin2fa",
                "password": "pass1234",
                "code": "000000",
            },
        )
        self.assertEqual(wrong.status_code, 401)

        right = self.post(
            "/api/auth/login",
            {
                "username": "admin2fa",
                "password": "pass1234",
                "code": self.current_code(secret),
            },
        )
        self.assertEqual(right.status_code, 200)

    def test_disable_requires_valid_code(self):
        secret = json.loads(self.post("/api/auth/2fa/setup").content)["result"][
            "secret"
        ]
        self.post("/api/auth/2fa/confirm", {"code": self.current_code(secret)})
        bad = self.post("/api/auth/2fa/disable", {"code": "000000"})
        self.assertEqual(bad.status_code, 400)
        good = self.post(
            "/api/auth/2fa/disable", {"code": self.current_code(secret)}
        )
        self.assertEqual(good.status_code, 200)
        self.assertFalse(
            json.loads(self.client.get("/api/auth/2fa/status").content)[
                "result"
            ]["enabled"]
        )
