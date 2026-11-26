"""
BOQ (Bill of Quantities) models for Samarqand Contracting Company.

Project-based cost control:
- ProjectBOQItem: contract bill of quantities per project
- PaymentApplication: periodic payment certificates / مستخلصات
- PaymentApplicationItem: line items per payment application
- VariationOrder: change orders / أوامر تغييرية
- VariationOrderItem: line items per variation order
- FinalAccount: project final account / الحساب الختامي
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db import transaction

from .accounts import Account
from .accounts import JournalEntry
from .accounts import create_journal_entry_from_source
from .pages import ProjectPage


class ProjectBOQItem(models.Model):
    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="boq_items",
            verbose_name="المشروع",
        )
    )
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0, verbose_name="ترتيب"
    )
    item_code: models.CharField = models.CharField(
        max_length=32, blank=True, verbose_name="رقم البند"
    )
    description: models.TextField = models.TextField(verbose_name="وصف البند")
    unit: models.CharField = models.CharField(
        max_length=32, verbose_name="وحدة القياس"
    )
    quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3, verbose_name="الكمية بالعقد"
    )
    unit_price: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="سعر الوحدة"
    )
    total_price: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="الإجمالي"
    )
    account: models.ForeignKey["Account | None", "Account | None"] = (
        models.ForeignKey(
            "Account",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="boq_items",
            verbose_name="الحساب المحاسبي",
        )
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["project", "sort_order", "id"]
        verbose_name = "بند كميات"
        verbose_name_plural = "بنود الكميات"

    def __str__(self) -> str:
        return f"{self.item_code or self.pk} — {self.description[:40]}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.total_price = (self.quantity * self.unit_price).quantize(
            Decimal("0.01")
        )
        super().save(*args, **kwargs)

    def executed_quantity(self) -> Decimal:
        total = PaymentApplicationItem.objects.filter(
            boq_item=self,
            payment__status__in=(
                PaymentApplication.STATUS_SUBMITTED,
                PaymentApplication.STATUS_APPROVED,
                PaymentApplication.STATUS_PAID,
            ),
        ).aggregate(models.Sum("current_quantity"))["current_quantity__sum"]
        return total or Decimal("0")

    def remaining_quantity(self) -> Decimal:
        return self.quantity - self.executed_quantity()


class PaymentApplication(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_PAID = "paid"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_SUBMITTED, "مرسل للاستشاري"),
        (STATUS_APPROVED, "معتمد"),
        (STATUS_PAID, "مدفوع"),
        (STATUS_REJECTED, "مرفوض"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="payment_applications",
            verbose_name="المشروع",
        )
    )
    application_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم المستخلص"
    )
    application_date: models.DateField = models.DateField(
        verbose_name="تاريخ المستخلص"
    )
    period_from: models.DateField = models.DateField(
        blank=True, null=True, verbose_name="من"
    )
    period_to: models.DateField = models.DateField(
        blank=True, null=True, verbose_name="إلى"
    )
    total_works_done: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي الأعمال",
    )
    previous_applications_total: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي سابق",
    )
    current_due: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="مستحق الحالي",
    )
    retention_percent: models.DecimalField = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10"),
        verbose_name="% حبس ضمان",
    )
    retention_amount: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="مبلغ الحبس",
    )
    withholding_tax_percent: models.DecimalField = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10"),
        verbose_name="% ضريبة خصم",
    )
    withholding_tax_amount: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="مبلغ الضريبة",
    )
    previous_deductions: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="خصومات سابقة",
    )
    net_amount: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="الصافي",
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name="الحالة",
    )
    submitted_to_consultant: models.BooleanField = models.BooleanField(
        default=False, verbose_name="مرسل للاستشاري"
    )
    consultant_approved: models.BooleanField = models.BooleanField(
        default=False, verbose_name="معتمد من الاستشاري"
    )
    consultant_notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات الاستشاري"
    )
    created_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="أنشئ بواسطة",
        )
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        "JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payment_applications",
        verbose_name="القيد المحاسبي",
    )

    class Meta:
        ordering = ["-application_date", "-id"]
        verbose_name = "مستخلص"
        verbose_name_plural = "المستخلصات"

    def __str__(self) -> str:
        return f"{self.application_number} — {self.project.title}"

    def recalculate(self) -> None:
        # A new application has no pk and therefore no related items yet.
        # Initialise totals here; the caller re-saves after adding items.
        if self.pk is None:
            self.total_works_done = Decimal("0")
            self.current_due = Decimal("0")
            self.retention_amount = Decimal("0")
            self.withholding_tax_amount = Decimal("0")
            self.net_amount = Decimal("0")
            return
        total_done = Decimal("0")
        current_due = Decimal("0")
        for item in self.items.select_related("boq_item"):
            total_done += item.total_amount
            current_due += item.current_amount
        self.total_works_done = total_done
        self.current_due = current_due
        self.retention_amount = (
            self.current_due * (self.retention_percent or Decimal("0")) / 100
        ).quantize(Decimal("0.01"))
        self.withholding_tax_amount = (
            self.current_due
            * (self.withholding_tax_percent or Decimal("0"))
            / 100
        ).quantize(Decimal("0.01"))
        self.net_amount = (
            self.current_due
            - self.retention_amount
            - self.withholding_tax_amount
            - self.previous_deductions
        )

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.recalculate()
        super().save(*args, **kwargs)

    @transaction.atomic
    def generate_journal_entry(self) -> "JournalEntry":
        from website.models import Account

        if self.journal_entry:
            return self.journal_entry
        if self.status not in (
            PaymentApplication.STATUS_APPROVED,
            PaymentApplication.STATUS_PAID,
        ):
            raise ValidationError("المستخلص يجب أن يكون معتمداً أو مدفوعاً.")
        if self.net_amount <= 0:
            raise ValidationError("صافي المستخلص يجب أن يكون أكبر من صفر.")
        ar_account = Account.objects.filter(code="1105").first()
        revenue_account = Account.objects.filter(code="4101").first()
        retention_account = Account.objects.filter(code="2106").first()
        tax_account = Account.objects.filter(code="2105").first()
        if not ar_account or not revenue_account:
            raise ValidationError(
                "حسابات الذمم المدينة أو الإيرادات غير موجودة."
            )
        if self.retention_amount and not retention_account:
            raise ValidationError("حساب الاستقطاعات (2106) غير موجود.")
        if self.withholding_tax_amount and not tax_account:
            raise ValidationError("حساب ضريبة الاستقطاع (2105) غير موجود.")
        # `net_amount` already subtracts retention, withholding tax AND
        # previous deductions.  Crediting the full `current_due` as revenue
        # therefore left the entry unbalanced whenever previous deductions
        # existed.  Reduce the credit by the same amount so debits == credits:
        #   net + retention + tax == current_due - previous_deductions
        revenue_amount = self.current_due - self.previous_deductions
        if revenue_amount <= 0:
            raise ValidationError("مبلغ الإيراد يجب أن يكون أكبر من صفر.")
        lines: list[tuple[Account, Decimal, Decimal]] = [
            (ar_account, self.net_amount, Decimal("0")),
            (revenue_account, Decimal("0"), revenue_amount),
        ]
        if self.retention_amount:
            lines.append(
                (retention_account, self.retention_amount, Decimal("0"))
            )
        if self.withholding_tax_amount:
            lines.append(
                (tax_account, self.withholding_tax_amount, Decimal("0"))
            )
        entry = create_journal_entry_from_source(
            source_obj=self,
            description=f"مستخلص {self.application_number} — {self.project.title}",
            entry_type="contract",
            lines=lines,
            project=self.project,
            entry_date=self.application_date,
        )
        self.journal_entry = entry
        self.save()
        return entry


class PaymentApplicationItem(models.Model):
    payment: models.ForeignKey["PaymentApplication", "PaymentApplication"] = (
        models.ForeignKey(
            PaymentApplication,
            on_delete=models.CASCADE,
            related_name="items",
            verbose_name="المستخلص",
        )
    )
    boq_item: models.ForeignKey["ProjectBOQItem", "ProjectBOQItem"] = (
        models.ForeignKey(
            ProjectBOQItem,
            on_delete=models.CASCADE,
            related_name="payment_items",
            verbose_name="بند الكميات",
        )
    )
    contracted_quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3, verbose_name="كمية العقد"
    )
    previously_done_quantity: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        verbose_name="منجز سابقاً",
    )
    current_quantity: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        verbose_name="الكمية الحالية",
    )
    total_done_quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3, verbose_name="الإجمالي المنجز"
    )
    done_percent: models.DecimalField = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="% الإنجاز"
    )
    unit_price: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="سعر الوحدة"
    )
    total_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="إجمالي البند"
    )
    previously_certified: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="معتمد سابقاً",
    )
    current_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="المبلغ الحالي"
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "بند مستخلص"
        verbose_name_plural = "بنود المستخلص"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.total_done_quantity = (
            self.previously_done_quantity + self.current_quantity
        )
        if self.contracted_quantity:
            self.done_percent = (
                self.total_done_quantity / self.contracted_quantity * 100
            ).quantize(Decimal("0.01"))
        else:
            self.done_percent = Decimal("0")
        self.total_amount = (
            self.total_done_quantity * self.unit_price
        ).quantize(Decimal("0.01"))
        self.current_amount = (
            self.total_amount - self.previously_certified
        ).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class VariationOrder(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_IMPLEMENTED = "implemented"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_SUBMITTED, "مرسل"),
        (STATUS_APPROVED, "معتمد"),
        (STATUS_REJECTED, "مرفوض"),
        (STATUS_IMPLEMENTED, "منفذ"),
    ]

    REASON_CLIENT_REQUEST = "client_request"
    REASON_DESIGN_CHANGE = "design_change"
    REASON_SITE_CONDITION = "site_condition"
    REASON_ERROR = "error"
    REASON_OTHER = "other"
    REASON_CHOICES = [
        (REASON_CLIENT_REQUEST, "طلب العميل"),
        (REASON_DESIGN_CHANGE, "تغيير تصميم"),
        (REASON_SITE_CONDITION, "ظروف الموقع"),
        (REASON_ERROR, "خطأ"),
        (REASON_OTHER, "أخرى"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="variation_orders",
            verbose_name="المشروع",
        )
    )
    variation_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم أمر التغيير"
    )
    title: models.CharField = models.CharField(
        max_length=255, verbose_name="العنوان"
    )
    reason: models.CharField = models.CharField(
        max_length=32, choices=REASON_CHOICES, verbose_name="السبب"
    )
    description: models.TextField = models.TextField(verbose_name="الوصف")
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name="الحالة",
    )
    cost_impact: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="الأثر المالي",
    )
    schedule_impact_days: models.IntegerField = models.IntegerField(
        default=0, verbose_name="تأثير الجدولة (يوم)"
    )
    submitted_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="مقدم الطلب",
        )
    )
    submitted_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ التقديم"
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="معتمد من",
        )
    )
    approved_at: models.DateTimeField = models.DateTimeField(
        blank=True, null=True, verbose_name="تاريخ الاعتماد"
    )
    document_file: models.FileField = models.FileField(
        upload_to="variations/", blank=True, verbose_name="ملف التغيير"
    )

    class Meta:
        ordering = ["-submitted_at", "-id"]
        verbose_name = "أمر تغييري"
        verbose_name_plural = "أوامر تغييرية"

    def __str__(self) -> str:
        return f"{self.variation_number} — {self.title}"


class VariationOrderItem(models.Model):
    variation: models.ForeignKey["VariationOrder", "VariationOrder"] = (
        models.ForeignKey(
            VariationOrder,
            on_delete=models.CASCADE,
            related_name="items",
            verbose_name="أمر التغيير",
        )
    )
    boq_item: models.ForeignKey[
        "ProjectBOQItem | None", "ProjectBOQItem | None"
    ] = models.ForeignKey(
        ProjectBOQItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="variation_items",
        verbose_name="بند الكميات",
    )
    description: models.TextField = models.TextField(verbose_name="الوصف")
    unit: models.CharField = models.CharField(
        max_length=32, verbose_name="وحدة القياس"
    )
    quantity_change: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3, verbose_name="التغيير في الكمية"
    )
    unit_price: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="سعر الوحدة"
    )
    total: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="الإجمالي"
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "بند أمر تغييري"
        verbose_name_plural = "بنود أوامر تغييرية"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.total = (self.quantity_change * self.unit_price).quantize(
            Decimal("0.01")
        )
        super().save(*args, **kwargs)


class FinalAccount(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_AGREED = "agreed"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_SUBMITTED, "مرسل"),
        (STATUS_AGREED, "متفق عليه"),
        (STATUS_CLOSED, "مغلق"),
    ]

    project: models.OneToOneField["ProjectPage"] = models.OneToOneField(
        ProjectPage,
        on_delete=models.CASCADE,
        related_name="final_account",
        verbose_name="المشروع",
    )
    contract_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="قيمة العقد"
    )
    total_variations: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي التغييرات",
    )
    revised_contract_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="قيمة العقد المعدلة"
    )
    total_previous_applications: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي المستخلصات السابقة",
    )
    total_retention_released: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="حبس ضمان منصرف",
    )
    total_withholding_tax: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي ضريبة الخصم",
    )
    net_due: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="المبلغ المتبقي"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name="الحالة",
    )
    closed_at: models.DateTimeField = models.DateTimeField(
        blank=True, null=True, verbose_name="تاريخ الإغلاق"
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "حساب ختامي"
        verbose_name_plural = "الحسابات الختامية"

    def __str__(self) -> str:
        return f"حساب ختامي — {self.project.title}"

    def recalculate(self) -> None:
        self.revised_contract_amount = (
            self.contract_amount + self.total_variations
        )
        paid = PaymentApplication.objects.filter(
            project=self.project,
            status=PaymentApplication.STATUS_PAID,
        ).aggregate(models.Sum("net_amount"))["net_amount__sum"] or Decimal("0")
        self.total_previous_applications = paid
        # `paid` is the sum of net_amount, i.e. cash already received AFTER
        # retention and withholding tax were deducted.  Subtracting the tax
        # here is therefore NOT a double deduction: it accounts for the part
        # of the gross contract that went to the tax authorities, while
        # retention still held remains payable to the contractor.  See
        # website/tests/test_final_account.py for the worked example.
        self.net_due = (
            self.revised_contract_amount
            - paid
            - self.total_retention_released
            - self.total_withholding_tax
        )

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.recalculate()
        super().save(*args, **kwargs)
