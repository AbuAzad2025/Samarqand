"""Round-2 regression tests for deployment and API-security guarantees.

Pins the current, already-implemented behaviour for: the ``/health`` probe,
the disabled default Django admin, authorisation on ``/api/admin/*``, opaque
API errors, and the promise that no GA tag or unconfigured AI claim is
emitted. Fixtures are minimal real model rows created in ``setUpTestData``;
nothing here needs network access or external credentials.
"""

import json
import os
from datetime import date
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.management import call_command
from django.test import RequestFactory
from django.test import TestCase
from django.test import override_settings

from website.api.auth import csrf_failure
from website.api.common import _api_error
from website.api.common import _user_role
from website.models import HomeAIMetric
from website.models import JournalEntry
from website.templatetags.samarqand_spa import samarqand_spa_document

User = get_user_model()

PRIVILEGED_ENDPOINTS = (
    "/api/admin/users/list",
    "/api/admin/hr/leave",
    "/api/admin/fleet/vehicles",
    "/api/admin/leads",
    "/api/admin/accounts/accounts",
)

AI_ENDPOINTS = (
    "/api/ai/analyze-design",
    "/api/ai/generate-content",
    "/api/ai/chat",
    "/api/images/generate-visualization",
)


class HealthEndpointTests(TestCase):
    def test_health_reports_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            json.loads(response.content),
            {"status": "ok", "database": "ok"},
        )

    def test_health_database_failure_is_opaque(self):
        secret = "postgres://user:password@internal-db:5432/samarqand"
        with patch("contracting_site.urls._views.connection") as connection:
            connection.cursor.side_effect = RuntimeError(secret)
            response = self.client.get("/health")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body, {"status": "error", "database": "error"})
        self.assertNotIn(secret, response.content.decode())


class DjangoAdminDisabledTests(TestCase):
    def test_django_admin_root_is_not_found(self):
        response = self.client.get("/django-admin/")
        self.assertEqual(response.status_code, 404)
        html = response.content.decode("utf-8", "ignore").lower()
        self.assertNotIn("django administration", html)
        self.assertNotIn("csrfmiddlewaretoken", html)

    def test_django_admin_login_is_not_found(self):
        self.assertEqual(
            self.client.get("/django-admin/login/").status_code, 404
        )

    def test_control_panel_is_the_management_entry_point(self):
        self.assertEqual(self.client.get("/control/login").status_code, 200)


class AdminApiPermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser(
            username="r2_superuser",
            email="r2-superuser@example.test",
            password="a-long-test-password",
        )
        cls.manager = User.objects.create_user(
            username="r2_manager",
            password="a-long-test-password",
            is_staff=True,
        )
        cls.manager.groups.add(Group.objects.get_or_create(name="Managers")[0])
        cls.employee = User.objects.create_user(
            username="r2_employee",
            password="a-long-test-password",
            is_staff=True,
        )
        cls.employee.groups.add(
            Group.objects.get_or_create(name="Employees")[0]
        )
        cls.outsider = User.objects.create_user(
            username="r2_outsider", password="a-long-test-password"
        )

    def setUp(self):
        cache.clear()

    def assert_denied(self, response, status, code):
        self.assertEqual(response.status_code, status)
        body = json.loads(response.content)
        self.assertEqual(body.get("errorCode"), code)
        self.assertNotIn("result", body)
        self.assertNotIn("data", body)

    def test_anonymous_admin_requests_are_unauthorized(self):
        for url in PRIVILEGED_ENDPOINTS + ("/api/admin/summary",):
            with self.subTest(url=url):
                self.assert_denied(self.client.get(url), 401, "unauthorized")

    def test_non_staff_user_is_forbidden(self):
        self.client.force_login(self.outsider)
        for url in PRIVILEGED_ENDPOINTS + ("/api/admin/summary",):
            with self.subTest(url=url):
                self.assert_denied(self.client.get(url), 403, "forbidden")

    def test_employee_cannot_read_privileged_admin_endpoints(self):
        self.client.force_login(self.employee)
        for url in PRIVILEGED_ENDPOINTS:
            with self.subTest(url=url):
                self.assert_denied(self.client.get(url), 403, "forbidden")
        # Staff-only surfaces still work: this is a role restriction, not a
        # blanket 404 for every admin URL.
        self.assertEqual(self.client.get("/api/admin/summary").status_code, 200)

    def test_manager_reads_ops_data_but_not_user_management(self):
        self.client.force_login(self.manager)
        self.assert_denied(
            self.client.get("/api/admin/users/list"), 403, "forbidden"
        )
        for url in PRIVILEGED_ENDPOINTS[1:]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_superuser_can_read_every_admin_probe(self):
        self.client.force_login(self.superuser)
        for url in PRIVILEGED_ENDPOINTS + ("/api/admin/summary",):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)


class ApiErrorSanitizationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_superuser(
            username="r2_error_admin",
            email="r2-error@example.test",
            password="a-long-test-password",
        )
        cls.entry = JournalEntry.objects.create(
            number="R2-ERROR-1",
            date=date.today(),
            description="regression probe",
            entry_type=JournalEntry.TYPE_JOURNAL,
        )

    def setUp(self):
        cache.clear()

    def test_login_failure_does_not_reveal_account_existence(self):
        self.client.logout()
        unknown = self.client.post(
            "/api/auth/login",
            data=json.dumps(
                {
                    "username": "r2_no_such_user",
                    "password": "a-long-test-password",
                }
            ),
            content_type="application/json",
        )
        wrong = self.client.post(
            "/api/auth/login",
            data=json.dumps(
                {
                    "username": self.user.username,
                    "password": "definitely-wrong-password",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(wrong.status_code, 401)
        unknown_body = json.loads(unknown.content)
        wrong_body = json.loads(wrong.content)
        self.assertEqual(unknown_body, wrong_body)
        self.assertEqual(unknown_body["errorCode"], "invalid_credentials")
        text = unknown.content.decode().lower()
        for leak in ("does not exist", "unknown user", "invalid password"):
            self.assertNotIn(leak, text)

    def test_csrf_failure_does_not_echo_the_reason(self):
        reason = "Bad origin https://internal.example/?token=secret-token"
        response = csrf_failure(
            RequestFactory().post("/api/auth/login"), reason=reason
        )
        self.assertEqual(response.status_code, 403)
        body = json.loads(response.content)
        self.assertEqual(body["error"]["code"], "csrf_failed")
        text = response.content.decode()
        self.assertNotIn("secret-token", text)
        self.assertNotIn("internal.example", text)

    def test_operation_failure_returns_only_an_opaque_code(self):
        secret = "psycopg2 dsn postgres://u:p@db.internal/samarqand"
        self.client.force_login(self.user)
        with patch.object(
            JournalEntry, "post", side_effect=RuntimeError(secret)
        ):
            response = self.client.post(
                f"/api/admin/accounts/journal-entries/{self.entry.pk}/post",
                data="{}",
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 400)
        body = json.loads(response.content)
        self.assertEqual(body["errorCode"], "journal_post_failed")
        self.assertEqual(body["error"], {"code": "journal_post_failed"})
        text = response.content.decode()
        for leak in (secret, "RuntimeError", "Traceback", "psycopg2"):
            self.assertNotIn(leak, text)


class CommonApiHelperTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser(
            username="r2_helper_admin",
            email="r2-helper@example.test",
            password="a-long-test-password",
        )
        cls.manager = User.objects.create_user(
            username="r2_helper_manager",
            password="a-long-test-password",
            is_staff=True,
        )
        cls.manager.groups.add(Group.objects.get_or_create(name="Managers")[0])
        cls.employee = User.objects.create_user(
            username="r2_helper_employee",
            password="a-long-test-password",
            is_staff=True,
        )
        cls.employee.groups.add(
            Group.objects.get_or_create(name="Employees")[0]
        )

    def test_api_error_response_shape_is_stable(self):
        response = _api_error("opaque_code", status=409)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            json.loads(response.content),
            {
                "ok": False,
                "error": {"code": "opaque_code"},
                "errorCode": "opaque_code",
            },
        )

    def test_role_resolution_uses_real_groups_only(self):
        self.assertEqual(_user_role(None), "anonymous")
        self.assertEqual(_user_role(self.superuser), "superadmin")
        self.assertEqual(_user_role(self.manager), "manager")
        self.assertEqual(_user_role(self.employee), "employee")


class UnconfiguredFeatureTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_superuser(
            username="r2_feature_admin",
            email="r2-feature@example.test",
            password="a-long-test-password",
        )

    def setUp(self):
        cache.clear()
        self.client.force_login(self.user)

    def test_ai_endpoints_do_not_claim_success_without_a_key(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            for url in AI_ENDPOINTS:
                with self.subTest(url=url):
                    response = self.client.post(
                        url,
                        data=json.dumps({}),
                        content_type="application/json",
                    )
                    self.assertEqual(response.status_code, 503)
                    body = json.loads(response.content)
                    self.assertEqual(body.get("errorCode"), "ai_not_configured")
                    self.assertIs(body.get("ok"), False)
                    self.assertNotIn("result", body)
                    self.assertNotIn("data", body)

    def _rendered_document(self, measurement_id):
        context = {"request": RequestFactory().get("/")}
        with override_settings(GA_MEASUREMENT_ID=measurement_id):
            return str(samarqand_spa_document(context))

    def test_ga_tag_is_not_emitted_when_measurement_id_is_empty(self):
        html = self._rendered_document("")
        self.assertTrue(html, "SPA shell must render for this probe")
        self.assertNotIn("googletagmanager", html)
        self.assertNotIn("gtag(", html)

    def test_ga_tag_is_not_emitted_for_placeholder_or_malformed_id(self):
        for measurement_id in ("G-XXXXXXXXXX", "UA-12345<script>"):
            with self.subTest(measurement_id=measurement_id):
                html = self._rendered_document(measurement_id)
                self.assertNotIn("googletagmanager", html)
                self.assertNotIn("gtag(", html)

    def test_ga_tag_is_emitted_only_for_a_valid_measurement_id(self):
        html = self._rendered_document("G-ABCDEFGHIJ")
        self.assertIn("googletagmanager.com/gtag/js?id=G-ABCDEFGHIJ", html)
        self.assertIn("gtag(", html)


class TruthfulStatsCommandTests(TestCase):
    def test_unverified_ai_metrics_are_removed(self):
        # Represents a legacy, unverified marketing claim already in the DB.
        HomeAIMetric.objects.create(sort_order=0, value="99.9%", label="uptime")
        call_command("set_truthful_stats", stdout=StringIO())
        self.assertFalse(HomeAIMetric.objects.exists())
