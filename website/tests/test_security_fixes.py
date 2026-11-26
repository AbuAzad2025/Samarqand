"""Regression tests for the P0/P1 security hardening."""

import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import RequestFactory
from django.test import TestCase

from website.api.admin_mail import _require_mail_access
from website.api.auth import csrf_failure
from website.api.common import _check_rate_limit
from website.models import Account
from website.models import JournalEntry
from website.models import JournalEntryLine


class SecurityRegressionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username="sec_admin",
            email="sec@example.test",
            password="a-long-test-password",
        )
        self.client.force_login(self.user)

    def test_admin_users_rejects_get(self):
        response = self.client.get("/api/admin/users")
        self.assertEqual(response.status_code, 405)

    def test_mail_access_denied_for_guest(self):
        guest = get_user_model().objects.create_user(
            username="sec_guest", password="a-long-test-password"
        )
        guest.is_staff = True
        group, _ = Group.objects.get_or_create(name="Guests")
        guest.groups.add(group)
        guest.save()
        request = RequestFactory().get("/api/admin/mail/messages")
        request.user = guest
        response = _require_mail_access(request)
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 403)

    def test_rate_limit_fails_closed(self):
        request = RequestFactory().get("/api/auth/login")
        with patch(
            "website.api.common.cache.add", side_effect=Exception("cache down")
        ):
            response = _check_rate_limit(
                request, scope="test", limit=5, window_seconds=60
            )
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 503)

    def test_csrf_failure_is_json_for_api(self):
        request = RequestFactory().post("/api/auth/login")
        response = csrf_failure(request, reason="bad token")
        self.assertEqual(response.status_code, 403)
        body = json.loads(response.content)
        self.assertEqual(body["error"]["code"], "csrf_failed")

    def test_unbalanced_journal_update_preserves_existing_lines(self):
        account = Account.objects.filter(code="1105").first()
        self.assertIsNotNone(account)
        entry = JournalEntry.objects.create(
            number="SEC-TEST-1",
            date=date.today(),
            description="security regression",
            entry_type=JournalEntry.TYPE_JOURNAL,
        )
        JournalEntryLine.objects.create(
            entry=entry,
            account=account,
            debit=Decimal("100"),
            credit=Decimal("0"),
        )
        JournalEntryLine.objects.create(
            entry=entry,
            account=account,
            debit=Decimal("0"),
            credit=Decimal("100"),
        )

        payload = {
            "lines": [{"accountId": account.id, "debit": "50", "credit": "0"}]
        }
        response = self.client.post(
            f"/api/admin/accounts/journal-entries/{entry.id}/update",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(entry.lines.count(), 2)
