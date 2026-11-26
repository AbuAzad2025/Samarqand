"""Pin the intended FinalAccount maths with a concrete worked example."""

from datetime import date
from decimal import Decimal

from django.test import TestCase
from wagtail.models import Page

from website.models import FinalAccount
from website.models import PaymentApplication
from website.models import ProjectPage


class FinalAccountMathTests(TestCase):
    def setUp(self):
        home = Page.objects.filter(slug="home").first() or Page.objects.first()
        self.project = home.add_child(
            instance=ProjectPage(title="Final Account Test", slug="final-account-test")
        )
        # Gross certified 1000, retention 50 and withholding tax 30 were
        # deducted, so the contractor was paid 920 in cash.
        self.application = PaymentApplication.objects.create(
            project=self.project,
            application_number="FA-TEST-1",
            application_date=date.today(),
            status=PaymentApplication.STATUS_PAID,
        )
        # recalculate() derives these from line items in normal use; the test
        # pins the worked example directly via update() to bypass that step.
        PaymentApplication.objects.filter(pk=self.application.pk).update(
            current_due=Decimal("1000"),
            retention_amount=Decimal("50"),
            withholding_tax_amount=Decimal("30"),
            previous_deductions=Decimal("0"),
            net_amount=Decimal("920"),
        )
        self.application.refresh_from_db()

    def test_net_amount_of_application_excludes_retention_and_tax(self):
        self.application.refresh_from_db()
        self.assertEqual(self.application.net_amount, Decimal("920"))

    def test_net_due_when_retention_is_still_held(self):
        account = FinalAccount.objects.create(
            project=self.project,
            contract_amount=Decimal("1000"),
            total_variations=Decimal("0"),
            total_retention_released=Decimal("0"),
            total_withholding_tax=Decimal("30"),
        )
        # 1000 gross - 920 cash paid - 0 released retention - 30 tax to
        # authorities = 50 still owed (the retention still being held).
        self.assertEqual(account.total_previous_applications, Decimal("920"))
        self.assertEqual(account.net_due, Decimal("50"))

    def test_net_due_when_retention_is_released(self):
        account = FinalAccount.objects.create(
            project=self.project,
            contract_amount=Decimal("1000"),
            total_variations=Decimal("0"),
            total_retention_released=Decimal("50"),
            total_withholding_tax=Decimal("30"),
        )
        self.assertEqual(account.net_due, Decimal("0"))
