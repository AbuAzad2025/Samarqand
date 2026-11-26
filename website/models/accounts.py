"""
Accounting models for Samarqand Contracting Company.

Designed for Palestinian construction companies:
- Multi-currency: ILS (primary), USD, JOD
- VAT 16% and withholding tax (10% supplies / 5% services)
- Project-based cost tracking
- Double-entry journal with debit=credit validation
- Checks lifecycle (pending/cleared/bounced/cancelled)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db import transaction
from django.utils import timezone

from .pages import ProjectPage


class Account(models.Model):
    TYPE_ASSET = "asset"
    TYPE_LIABILITY = "liability"
    TYPE_EQUITY = "equity"
    TYPE_INCOME = "income"
    TYPE_EXPENSE = "expense"
    TYPE_CHOICES = [
        (TYPE_ASSET, "أصل"),
        (TYPE_LIABILITY, "خصم"),
        (TYPE_EQUITY, "حقوق ملكية"),
        (TYPE_INCOME, "إيراد"),
        (TYPE_EXPENSE, "مصروف"),
    ]

    code: models.CharField = models.CharField(
        max_length=20, unique=True, verbose_name="رقم الحساب"
    )
    name: models.CharField = models.CharField(
        max_length=255, verbose_name="اسم الحساب"
    )
    name_ar: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="الاسم بالعربي"
    )
    account_type: models.CharField = models.CharField(
        max_length=16, choices=TYPE_CHOICES, verbose_name="نوع الحساب"
    )
    parent: models.ForeignKey["Account | None", "Account | None"] = (
        models.ForeignKey(
            "self",
            null=True,
            blank=True,
            on_delete=models.CASCADE,
            related_name="children",
            verbose_name="حساب أبوي",
        )
    )
    is_active: models.BooleanField = models.BooleanField(
        default=True, verbose_name="نشط"
    )
    is_control: models.BooleanField = models.BooleanField(
        default=False, verbose_name="حساب رقابي"
    )
    description: models.TextField = models.TextField(
        blank=True, verbose_name="وصف"
    )
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0, verbose_name="ترتيب"
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["code"]
        verbose_name = "حساب"
        verbose_name_plural = "شجرة الحسابات"

    def __str__(self) -> str:
        label = self.name_ar or self.name
        return f"{self.code} — {label}"

    def clean(self) -> None:
        if self.parent and self.parent.pk == self.pk:
            raise ValidationError("لا يمكن للحساب أن يكون أباً لنفسه.")

    def balance(self, as_of: date | None = None) -> Decimal:
        qs = JournalEntryLine.objects.filter(
            account=self,
            entry__is_posted=True,
        )
        if as_of:
            qs = qs.filter(entry__date__lte=as_of)
        total_debit = qs.aggregate(models.Sum("debit"))[
            "debit__sum"
        ] or Decimal("0")
        total_credit = qs.aggregate(models.Sum("credit"))[
            "credit__sum"
        ] or Decimal("0")
        if self.account_type in (
            Account.TYPE_ASSET,
            Account.TYPE_EXPENSE,
        ):
            return total_debit - total_credit
        return total_credit - total_debit


class JournalEntry(models.Model):
    TYPE_JOURNAL = "journal"
    TYPE_RECEIPT = "receipt"
    TYPE_PAYMENT = "payment"
    TYPE_CONTRACT = "contract"
    TYPE_PURCHASE = "purchase"
    TYPE_PAYROLL = "payroll"
    TYPE_CHECK = "check"
    TYPE_TAX = "tax"
    TYPE_CHOICES = [
        (TYPE_JOURNAL, "قيد يومية"),
        (TYPE_RECEIPT, "سند قبض"),
        (TYPE_PAYMENT, "سند صرف"),
        (TYPE_CONTRACT, "مستخلص عقد"),
        (TYPE_PURCHASE, "شراء"),
        (TYPE_PAYROLL, "رواتب"),
        (TYPE_CHECK, "شيك"),
        (TYPE_TAX, "ضريبة"),
    ]

    number: models.CharField = models.CharField(
        max_length=32, unique=True, verbose_name="رقم القيد"
    )
    date: models.DateField = models.DateField(verbose_name="تاريخ القيد")
    description: models.TextField = models.TextField(
        blank=True, verbose_name="شرح القيد"
    )
    entry_type: models.CharField = models.CharField(
        max_length=16,
        choices=TYPE_CHOICES,
        default=TYPE_JOURNAL,
        verbose_name="نوع القيد",
    )
    ref_number: models.CharField = models.CharField(
        max_length=64, blank=True, verbose_name="رقم المرجع"
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            ProjectPage,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="journal_entries",
            verbose_name="المشروع",
        )
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
    is_posted: models.BooleanField = models.BooleanField(
        default=False, verbose_name="مرحل"
    )
    posted_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الترحيل"
    )
    posted_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="رحّل بواسطة",
        )
    )
    total_debit: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي مدين",
    )
    total_credit: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="إجمالي دائن",
    )
    source_type: models.CharField = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="مصدر القيد",
        help_text="اسم الموديل المرتبط بهذا القيد",
    )
    source_id: models.PositiveIntegerField = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="معرّف المصدر"
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "قيد يومية"
        verbose_name_plural = "القيود اليومية"

    def __str__(self) -> str:
        return self.number

    def clean(self) -> None:
        if self.is_posted and self.total_debit != self.total_credit:
            raise ValidationError(
                "القيد غير متوازن: إجمالي المدين يجب أن يساوي إجمالي الدائن."
            )

    def recalculate_totals(self) -> None:
        lines = self.lines.all()
        self.total_debit = sum((line.debit for line in lines), Decimal("0"))
        self.total_credit = sum((line.credit for line in lines), Decimal("0"))

    @transaction.atomic
    def post(self, user: Any | None = None) -> None:
        self.recalculate_totals()
        if self.total_debit != self.total_credit:
            raise ValidationError("لا يمكن ترحيل قيد غير متوازن.")
        if self.total_debit == 0:
            raise ValidationError("لا يمكن ترحيل قيد فارغ.")
        self.is_posted = True
        self.posted_at = timezone.now()
        if user:
            self.posted_by = user
        self.save()

    @transaction.atomic
    def unpost(self) -> None:
        self.is_posted = False
        self.posted_at = None
        self.posted_by = None
        self.save()

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.recalculate_totals()
        super().save(*args, **kwargs)


class JournalEntryLine(models.Model):
    entry: models.ForeignKey["JournalEntry", "JournalEntry"] = (
        models.ForeignKey(
            JournalEntry,
            on_delete=models.CASCADE,
            related_name="lines",
            verbose_name="القيد",
        )
    )
    account: models.ForeignKey["Account", "Account"] = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        verbose_name="الحساب",
    )
    description: models.TextField = models.TextField(
        blank=True, verbose_name="البيان"
    )
    debit: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="مدين",
    )
    credit: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="دائن",
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            ProjectPage,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="journal_entry_lines",
            verbose_name="المشروع",
        )
    )
    contact_type: models.CharField = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="نوع الطرف",
        help_text="client, supplier, subcontractor, worker",
    )
    contact_id: models.PositiveIntegerField = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="معرّف الطرف"
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "بند قيد"
        verbose_name_plural = "بنود القيد"

    def __str__(self) -> str:
        return f"{self.account.code} — مدين {self.debit} / دائن {self.credit}"

    def clean(self) -> None:
        if self.debit < 0 or self.credit < 0:
            raise ValidationError("المبالغ المدينة والدائنة يجب أن تكون موجبة.")
        if self.debit > 0 and self.credit > 0:
            raise ValidationError("لا يمكن أن يحتوي البند على مدين ودائن معاً.")


class BankAccount(models.Model):
    CURRENCY_ILS = "ILS"
    CURRENCY_USD = "USD"
    CURRENCY_JOD = "JOD"
    CURRENCY_CHOICES = [
        (CURRENCY_ILS, "شيكل (₪)"),
        (CURRENCY_USD, "دولار ($)"),
        (CURRENCY_JOD, "دينار أردني (JD)"),
    ]

    account: models.OneToOneField["Account"] = models.OneToOneField(
        Account,
        on_delete=models.PROTECT,
        verbose_name="الحساب المحاسبي",
    )
    bank_name: models.CharField = models.CharField(
        max_length=255, verbose_name="اسم البنك"
    )
    branch: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="الفرع"
    )
    account_number: models.CharField = models.CharField(
        max_length=64, verbose_name="رقم الحساب"
    )
    iban: models.CharField = models.CharField(
        max_length=34, blank=True, verbose_name="IBAN"
    )
    currency: models.CharField = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default=CURRENCY_ILS,
        verbose_name="العملة",
    )
    opening_balance: models.DecimalField = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="الرصيد الافتتاحي",
    )
    opening_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ الافتتاح"
    )
    is_active: models.BooleanField = models.BooleanField(
        default=True, verbose_name="نشط"
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )

    class Meta:
        ordering = ["bank_name", "account_number"]
        verbose_name = "حساب بنكي"
        verbose_name_plural = "الحسابات البنكية"

    def __str__(self) -> str:
        return f"{self.bank_name} — {self.account_number} ({self.currency})"

    def book_balance(self, as_of: date | None = None) -> Decimal:
        qs = JournalEntryLine.objects.filter(
            account=self.account,
            entry__is_posted=True,
        )
        if as_of:
            qs = qs.filter(entry__date__lte=as_of)
        total_debit = qs.aggregate(models.Sum("debit"))[
            "debit__sum"
        ] or Decimal("0")
        total_credit = qs.aggregate(models.Sum("credit"))[
            "credit__sum"
        ] or Decimal("0")
        return self.opening_balance + total_debit - total_credit


class Check(models.Model):
    DIRECTION_ISSUED = "issued"
    DIRECTION_RECEIVED = "received"
    DIRECTION_CHOICES = [
        (DIRECTION_ISSUED, "صادر"),
        (DIRECTION_RECEIVED, "وارد"),
    ]

    STATUS_PENDING = "pending"
    STATUS_CLEARED = "cleared"
    STATUS_BOUNCED = "bounced"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "تحت التحصيل"),
        (STATUS_CLEARED, "صرف"),
        (STATUS_BOUNCED, "مرتجع"),
        (STATUS_CANCELLED, "ملغي"),
    ]

    direction: models.CharField = models.CharField(
        max_length=16,
        choices=DIRECTION_CHOICES,
        verbose_name="الاتجاه",
    )
    check_number: models.CharField = models.CharField(
        max_length=64, verbose_name="رقم الشيك"
    )
    bank_name: models.CharField = models.CharField(
        max_length=255, verbose_name="اسم البنك"
    )
    account: models.ForeignKey["BankAccount | None", "BankAccount | None"] = (
        models.ForeignKey(
            BankAccount,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="checks",
            verbose_name="الحساب البنكي",
        )
    )
    issue_date: models.DateField = models.DateField(
        verbose_name="تاريخ الإصدار"
    )
    maturity_date: models.DateField = models.DateField(
        verbose_name="تاريخ الاستحقاق"
    )
    amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="المبلغ"
    )
    currency: models.CharField = models.CharField(
        max_length=3,
        choices=BankAccount.CURRENCY_CHOICES,
        default=BankAccount.CURRENCY_ILS,
        verbose_name="العملة",
    )
    payee: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="المستفيد"
    )
    payer: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="الدافع"
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            ProjectPage,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="checks",
            verbose_name="المشروع",
        )
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        JournalEntry,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="checks",
        verbose_name="القيد المحاسبي",
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="الحالة",
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )
    cleared_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ الصرف"
    )
    image_front: models.ImageField = models.ImageField(
        upload_to="checks/",
        null=True,
        blank=True,
        verbose_name="صورة الشيك",
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-issue_date", "-id"]
        verbose_name = "شيك"
        verbose_name_plural = "الشيكات"

    def __str__(self) -> str:
        direction = (
            "صادر" if self.direction == Check.DIRECTION_ISSUED else "وارد"
        )
        return (
            f"{direction} {self.check_number} — {self.amount} {self.currency}"
        )

    def clean(self) -> None:
        if (
            self.maturity_date
            and self.issue_date
            and self.maturity_date < self.issue_date
        ):
            raise ValidationError(
                "تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإصدار."
            )

    @transaction.atomic
    def mark_cleared(
        self, cleared_date: date | None = None
    ) -> JournalEntry | None:
        if self.status != Check.STATUS_PENDING:
            raise ValidationError("يمكن صرف الشيكات تحت التحصيل فقط.")
        self.status = Check.STATUS_CLEARED
        self.cleared_date = cleared_date or timezone.now().date()
        self.save()
        return self._create_clearing_entry()

    @transaction.atomic
    def mark_bounced(self) -> None:
        if self.status != Check.STATUS_PENDING:
            raise ValidationError("يمكن إرجاع الشيكات تحت التحصيل فقط.")
        self.status = Check.STATUS_BOUNCED
        self.cleared_date = None
        self.save()

    @transaction.atomic
    def mark_cancelled(self) -> None:
        if self.status != Check.STATUS_PENDING:
            raise ValidationError("يمكن إلغاء الشيكات تحت التحصيل فقط.")
        self.status = Check.STATUS_CANCELLED
        self.cleared_date = None
        self.save()

    def _create_clearing_entry(self) -> JournalEntry | None:
        from website.models import Account

        cash_equivalent = Account.objects.filter(
            code=(
                "1104" if self.direction == Check.DIRECTION_RECEIVED else "2103"
            )
        ).first()
        bank_account = self.account.account if self.account else None
        if not cash_equivalent or not bank_account:
            return None

        entry = JournalEntry.objects.create(
            number=_next_entry_number(),
            date=self.cleared_date or timezone.now().date(),
            description=f"صرف شيك {self.check_number}",
            entry_type=JournalEntry.TYPE_CHECK,
            ref_number=self.check_number,
            project=self.project,
        )
        if self.direction == Check.DIRECTION_RECEIVED:
            JournalEntryLine.objects.create(
                entry=entry,
                account=bank_account,
                debit=self.amount,
                credit=Decimal("0"),
                project=self.project,
            )
            JournalEntryLine.objects.create(
                entry=entry,
                account=cash_equivalent,
                debit=Decimal("0"),
                credit=self.amount,
                project=self.project,
            )
        else:
            JournalEntryLine.objects.create(
                entry=entry,
                account=cash_equivalent,
                debit=self.amount,
                credit=Decimal("0"),
                project=self.project,
            )
            JournalEntryLine.objects.create(
                entry=entry,
                account=bank_account,
                debit=Decimal("0"),
                credit=self.amount,
                project=self.project,
            )
        entry.post()
        self.journal_entry = entry
        self.save()
        return entry


class TaxRecord(models.Model):
    TYPE_WITHHOLDING_SUPPLIES = "wht_supplies"
    TYPE_WITHHOLDING_SERVICES = "wht_services"
    TYPE_VAT = "vat"
    TYPE_CHOICES = [
        (TYPE_WITHHOLDING_SUPPLIES, "ضريبة خصم — توريدات (10%)"),
        (TYPE_WITHHOLDING_SERVICES, "ضريبة خصم — خدمات (5%)"),
        (TYPE_VAT, "ضريبة قيمة مضافة (16%)"),
    ]

    RATES = {
        TYPE_WITHHOLDING_SUPPLIES: Decimal("0.10"),
        TYPE_WITHHOLDING_SERVICES: Decimal("0.05"),
        TYPE_VAT: Decimal("0.16"),
    }

    tax_type: models.CharField = models.CharField(
        max_length=24, choices=TYPE_CHOICES, verbose_name="نوع الضريبة"
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            ProjectPage,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="tax_records",
            verbose_name="المشروع",
        )
    )
    transaction_date: models.DateField = models.DateField(
        verbose_name="تاريخ العملية"
    )
    description: models.TextField = models.TextField(
        blank=True, verbose_name="البيان"
    )
    gross_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="المبلغ الإجمالي"
    )
    tax_rate: models.DecimalField = models.DecimalField(
        max_digits=6, decimal_places=4, verbose_name="نسبة الضريبة"
    )
    tax_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="مبلغ الضريبة"
    )
    net_amount: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="الصافي"
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        JournalEntry,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tax_records",
        verbose_name="القيد المحاسبي",
    )
    paid: models.BooleanField = models.BooleanField(
        default=False, verbose_name="مدفوعة"
    )
    paid_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ الدفع"
    )
    return_period: models.CharField = models.CharField(
        max_length=7,
        blank=True,
        verbose_name="الفترة الضريبية",
        help_text="YYYY-MM",
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-transaction_date", "-id"]
        verbose_name = "سجل ضريبي"
        verbose_name_plural = "السجلات الضريبية"

    def __str__(self) -> str:
        return f"{self.get_tax_type_display()} — {self.tax_amount} ({self.return_period})"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.tax_rate:
            self.tax_rate = TaxRecord.RATES.get(self.tax_type, Decimal("0"))
        self.tax_amount = (self.gross_amount * self.tax_rate).quantize(
            Decimal("0.01")
        )
        if self.tax_type == TaxRecord.TYPE_VAT:
            self.net_amount = self.gross_amount + self.tax_amount
        else:
            self.net_amount = self.gross_amount - self.tax_amount
        if not self.return_period and self.transaction_date:
            self.return_period = self.transaction_date.strftime("%Y-%m")
        super().save(*args, **kwargs)


def create_journal_entry_from_source(
    source_obj: Any,
    description: str,
    entry_type: str,
    lines: list[tuple[Account, Decimal, Decimal]],
    project: ProjectPage | None = None,
    entry_date: date | None = None,
) -> JournalEntry:
    entry = JournalEntry.objects.create(
        number=_next_entry_number(),
        date=entry_date or timezone.now().date(),
        description=description,
        entry_type=entry_type,
        ref_number=str(source_obj.pk),
        project=project,
        source_type=source_obj.__class__.__name__,
        source_id=source_obj.pk,
    )
    for account, debit, credit in lines:
        JournalEntryLine.objects.create(
            entry=entry,
            account=account,
            debit=debit,
            credit=credit,
            project=project,
        )
    entry.post()
    return entry


def _next_entry_number() -> str:
    prefix = timezone.now().strftime("JE-%Y%m%d-")
    last = (
        JournalEntry.objects.filter(number__startswith=prefix)
        .order_by("-number")
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.number.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"
