"""
Operations / business models for Samarqand Contracting Company.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db import models

from website.constants import ACCOUNT_CODES

from .accounts import Account
from .accounts import BankAccount
from .accounts import JournalEntry
from .pages import ProjectPage


class RFQDocument(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    title: models.CharField = models.CharField(max_length=255, blank=True)
    template_key: models.CharField = models.CharField(max_length=64, blank=True)
    currency: models.CharField = models.CharField(max_length=8, default="ILS")
    number: models.CharField = models.CharField(max_length=32, blank=True)
    data: models.JSONField = models.JSONField(default=dict, blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "طلب عرض سعر (RFQ)"
        verbose_name_plural = "طلبات عروض الأسعار (RFQ)"

    def __str__(self) -> str:
        return self.title or self.number or str(self.pk or "")


class CompanyDocument(models.Model):
    CATEGORY_TEMPLATE = "template"
    CATEGORY_LETTERHEAD = "letterhead"
    CATEGORY_INVOICE = "invoice"
    CATEGORY_RECEIPT = "receipt"
    CATEGORY_COMPANY_DOCUMENT = "company_document"
    CATEGORY_COMPANY_CERTIFICATE = "company_certificate"
    CATEGORY_CHOICES = [
        (CATEGORY_TEMPLATE, "قوالب"),
        (CATEGORY_LETTERHEAD, "ترويسات"),
        (CATEGORY_INVOICE, "فواتير"),
        (CATEGORY_RECEIPT, "سندات قبض"),
        (CATEGORY_COMPANY_DOCUMENT, "مستندات الشركة"),
        (CATEGORY_COMPANY_CERTIFICATE, "وثائق الشركة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    category: models.CharField = models.CharField(
        max_length=32, choices=CATEGORY_CHOICES
    )
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    document: Any = models.ForeignKey(
        "wagtaildocs.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    uploaded_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["category", "sort_order", "id"]
        verbose_name = "مستند الشركة"
        verbose_name_plural = "مستندات الشركة"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")


class Client(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "عميل"
        verbose_name_plural = "العملاء"

    def __str__(self) -> str:
        return self.name


class ClientContactLog(models.Model):
    KIND_CALL = "call"
    KIND_VISIT = "visit"
    KIND_EMAIL = "email"
    KIND_WHATSAPP = "whatsapp"
    KIND_OTHER = "other"
    KIND_CHOICES = [
        (KIND_CALL, "مكالمة"),
        (KIND_VISIT, "زيارة"),
        (KIND_EMAIL, "بريد"),
        (KIND_WHATSAPP, "واتساب"),
        (KIND_OTHER, "أخرى"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    client: models.ForeignKey["Client", "Client"] = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="contact_logs"
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_CALL
    )
    subject: models.CharField = models.CharField(max_length=255, blank=True)
    body: models.TextField = models.TextField(blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "سجل تواصل"
        verbose_name_plural = "سجل التواصل"

    def __str__(self) -> str:
        return self.subject or f"{self.get_kind_display()} - {self.client.name}"


class Supplier(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    category: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "مورد"
        verbose_name_plural = "الموردون"

    def __str__(self) -> str:
        return self.name


class Subcontractor(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    specialty: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    email: models.EmailField = models.EmailField(blank=True)
    address: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "مقاول فرعي"
        verbose_name_plural = "المقاولون الفرعيون"

    def __str__(self) -> str:
        return self.name


class ProjectContract(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_CLOSED = "closed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_ACTIVE, "ساري"),
        (STATUS_CLOSED, "مغلق"),
        (STATUS_CANCELLED, "ملغي"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="contracts",
        )
    )
    client: models.ForeignKey["Client | None", "Client | None"] = (
        models.ForeignKey(
            Client,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="contracts",
        )
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    number: models.CharField = models.CharField(max_length=64, blank=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)
    document_file: models.FileField = models.FileField(
        upload_to="contracts/", blank=True
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "عقد"
        verbose_name_plural = "العقود"

    def __str__(self) -> str:
        return self.title or self.number or str(self.pk or "")


class ContractAddendum(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    contract: models.ForeignKey["ProjectContract", "ProjectContract"] = (
        models.ForeignKey(
            ProjectContract, on_delete=models.CASCADE, related_name="addendums"
        )
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    amount_delta: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    notes: models.TextField = models.TextField(blank=True)
    document_file: models.FileField = models.FileField(
        upload_to="contracts/addendums/", blank=True
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "ملحق عقد"
        verbose_name_plural = "ملاحق العقود"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")


class ContractPayment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PARTIAL = "partial"
    STATUS_PAID = "paid"
    STATUS_OVERDUE = "overdue"
    STATUS_CHOICES = [
        (STATUS_PENDING, "معلق"),
        (STATUS_PARTIAL, "جزئي"),
        (STATUS_PAID, "مدفوع"),
        (STATUS_OVERDUE, "متأخر"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    contract: models.ForeignKey["ProjectContract", "ProjectContract"] = (
        models.ForeignKey(
            ProjectContract, on_delete=models.CASCADE, related_name="payments"
        )
    )
    title: models.CharField = models.CharField(max_length=255, blank=True)
    due_date: models.DateField = models.DateField(blank=True, null=True)
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    paid_amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    paid_date: models.DateField = models.DateField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    notes: models.TextField = models.TextField(blank=True)
    bank_account: models.ForeignKey[
        "BankAccount | None", "BankAccount | None"
    ] = models.ForeignKey(
        "BankAccount",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contract_payments",
        verbose_name="حساب الدفع",
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        "JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contract_payments",
        verbose_name="القيد المحاسبي",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "دفعة/مستخلص"
        verbose_name_plural = "الدفعات/المستخلصات"

    def __str__(self) -> str:
        return self.title or str(self.pk or "")

    def generate_journal_entry(self) -> "JournalEntry":
        from decimal import Decimal

        from website.models import Account
        from website.models import BankAccount
        from website.models.accounts import create_journal_entry_from_source

        if self.journal_entry:
            return self.journal_entry
        if self.status != ContractPayment.STATUS_PAID or not self.paid_amount:
            raise ValueError("الدفعة يجب أن تكون مدفوعة ولها مبلغ مدفوع.")
        amount = self.paid_amount or Decimal("0")
        if amount <= 0:
            raise ValueError("مبلغ الدفعة يجب أن يكون أكبر من صفر.")
        bank_account = self.bank_account
        if not bank_account:
            bank_account = BankAccount.objects.filter(is_active=True).first()
        if not bank_account:
            raise ValueError("لا يوجد حساب بنكي نشط لإنشاء القيد.")
        revenue_account = Account.objects.filter(
            code=ACCOUNT_CODES["contract_revenue"]
        ).first()
        if not revenue_account:
            raise ValueError("حساب إيرادات العقود (4101) غير موجود.")
        entry = create_journal_entry_from_source(
            source_obj=self,
            description=f"تحصيل دفعة/مستخلص: {self.title or self.pk}",
            entry_type="contract",
            lines=[
                (bank_account.account, amount, Decimal("0")),
                (revenue_account, Decimal("0"), amount),
            ],
            project=self.contract.project if self.contract else None,
            entry_date=self.paid_date,
        )
        self.journal_entry = entry
        self.save()
        return entry


class PurchaseOrder(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_SENT, "مرسل"),
        (STATUS_RECEIVED, "مستلم"),
        (STATUS_CANCELLED, "ملغي"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    supplier: models.ForeignKey["Supplier | None", "Supplier | None"] = (
        models.ForeignKey(
            Supplier,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="purchase_orders",
        )
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="purchase_orders",
        )
    )
    number: models.CharField = models.CharField(max_length=64, blank=True)
    date: models.DateField = models.DateField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    total_amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)
    expense_account: models.ForeignKey["Account | None", "Account | None"] = (
        models.ForeignKey(
            "Account",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="purchase_orders",
            verbose_name="حساب المصروف",
        )
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        "JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="purchase_orders",
        verbose_name="القيد المحاسبي",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "أمر شراء"
        verbose_name_plural = "أوامر الشراء"

    def __str__(self) -> str:
        return self.number or str(self.pk or "")

    def generate_journal_entry(self) -> "JournalEntry":
        from decimal import Decimal

        from website.models import Account
        from website.models.accounts import create_journal_entry_from_source

        if self.journal_entry:
            return self.journal_entry
        if self.status != PurchaseOrder.STATUS_RECEIVED:
            raise ValueError("أمر الشراء يجب أن يكون في حالة مستلم.")
        amount = self.total_amount or Decimal("0")
        if amount <= 0:
            raise ValueError("مبلغ أمر الشراء يجب أن يكون أكبر من صفر.")
        expense_account = (
            self.expense_account or Account.objects.filter(code="5101").first()
        )
        payable_account = Account.objects.filter(code="2101").first()
        if not expense_account:
            raise ValueError("حساب المواد (5101) غير موجود.")
        if not payable_account:
            raise ValueError("حساب ذمم دائنة - موردين (2101) غير موجود.")
        entry = create_journal_entry_from_source(
            source_obj=self,
            description=f"استلام أمر شراء: {self.number or self.pk}",
            entry_type="purchase",
            lines=[
                (expense_account, amount, Decimal("0")),
                (payable_account, Decimal("0"), amount),
            ],
            project=self.project,
            entry_date=self.date,
        )
        self.journal_entry = entry
        self.save()
        return entry


class InventoryItem(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    sku: models.CharField = models.CharField(max_length=64, blank=True)
    name: models.CharField = models.CharField(max_length=255)
    unit: models.CharField = models.CharField(max_length=32, blank=True)
    current_qty: models.DecimalField = models.DecimalField(
        default=0, max_digits=14, decimal_places=3
    )
    reorder_level: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=14, decimal_places=3
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "صنف مخزون"
        verbose_name_plural = "المخزون"

    def __str__(self) -> str:
        return self.name


class InventoryTransaction(models.Model):
    KIND_IN = "in"
    KIND_OUT = "out"
    KIND_ADJUST = "adjust"
    KIND_CHOICES = [
        (KIND_IN, "إدخال"),
        (KIND_OUT, "إخراج"),
        (KIND_ADJUST, "تسوية"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    item: models.ForeignKey["InventoryItem", "InventoryItem"] = (
        models.ForeignKey(
            InventoryItem, on_delete=models.CASCADE, related_name="transactions"
        )
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="inventory_transactions",
        )
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_IN
    )
    quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3
    )
    unit_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    date: models.DateField = models.DateField(blank=True, null=True)
    reference: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)
    created_by: Any = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-id"]
        verbose_name = "حركة مخزون"
        verbose_name_plural = "حركات المخزون"

    def __str__(self) -> str:
        return self.reference or str(self.pk or "")


class Equipment(models.Model):
    STATUS_AVAILABLE = "available"
    STATUS_ON_SITE = "on_site"
    STATUS_MAINTENANCE = "maintenance"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "متاح"),
        (STATUS_ON_SITE, "على الموقع"),
        (STATUS_MAINTENANCE, "صيانة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    code: models.CharField = models.CharField(max_length=64, blank=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_AVAILABLE
    )
    hourly_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "معدة"
        verbose_name_plural = "المعدات"

    def __str__(self) -> str:
        return self.name


class Vehicle(models.Model):
    VEHICLE_TRUCK = "truck"
    VEHICLE_PICKUP = "pickup"
    VEHICLE_SEDAN = "sedan"
    VEHICLE_BUS = "bus"
    VEHICLE_FORKLIFT = "forklift"
    VEHICLE_TRAILER = "trailer"
    VEHICLE_HEAVY = "heavy_equipment"
    VEHICLE_CHOICES = [
        (VEHICLE_TRUCK, "شاحنة"),
        (VEHICLE_PICKUP, "بيك أب"),
        (VEHICLE_SEDAN, "سيدان"),
        (VEHICLE_BUS, "باص"),
        (VEHICLE_FORKLIFT, "رافعة شوكية"),
        (VEHICLE_TRAILER, "مقطورة"),
        (VEHICLE_HEAVY, "معدات ثقيلة"),
    ]

    STATUS_AVAILABLE = "available"
    STATUS_IN_USE = "in_use"
    STATUS_MAINTENANCE = "maintenance"
    STATUS_OUT_OF_SERVICE = "out_of_service"
    STATUS_RETIRED = "retired"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "متاحة"),
        (STATUS_IN_USE, "قيد الاستخدام"),
        (STATUS_MAINTENANCE, "صيانة"),
        (STATUS_OUT_OF_SERVICE, "خارج الخدمة"),
        (STATUS_RETIRED, "تقاعد"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    name: models.CharField = models.CharField(max_length=255)
    plate_number: models.CharField = models.CharField(
        max_length=32, unique=True
    )
    vehicle_type: models.CharField = models.CharField(
        max_length=32, choices=VEHICLE_CHOICES, default=VEHICLE_TRUCK
    )
    brand: models.CharField = models.CharField(max_length=128, blank=True)
    model_name: models.CharField = models.CharField(max_length=128, blank=True)
    year: models.PositiveIntegerField = models.PositiveIntegerField(
        null=True, blank=True
    )
    color: models.CharField = models.CharField(max_length=64, blank=True)
    chassis_number: models.CharField = models.CharField(
        max_length=64, blank=True
    )
    engine_number: models.CharField = models.CharField(
        max_length=64, blank=True
    )
    status: models.CharField = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=STATUS_AVAILABLE
    )
    assigned_to: models.ForeignKey["Worker | None", "Worker | None"] = (
        models.ForeignKey(
            "website.Worker",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="assigned_vehicles",
        )
    )
    current_project: models.ForeignKey[
        "ProjectPage | None", "ProjectPage | None"
    ] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="vehicles",
    )
    insurance_expiry: models.DateField = models.DateField(null=True, blank=True)
    registration_expiry: models.DateField = models.DateField(
        null=True, blank=True
    )
    fuel_type: models.CharField = models.CharField(max_length=32, blank=True)
    tank_capacity_liters: models.DecimalField = models.DecimalField(
        null=True, blank=True, max_digits=8, decimal_places=1
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "مركبة"
        verbose_name_plural = "المركبات"

    def __str__(self) -> str:
        return f"{self.name} ({self.plate_number})"


class FuelLog(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    vehicle: models.ForeignKey["Vehicle", "Vehicle"] = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name="fuel_logs"
    )
    date: models.DateField = models.DateField()
    liters: models.DecimalField = models.DecimalField(
        max_digits=10, decimal_places=2
    )
    cost: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2
    )
    odometer_km: models.PositiveIntegerField = models.PositiveIntegerField(
        null=True, blank=True
    )
    station: models.CharField = models.CharField(max_length=255, blank=True)
    filled_by: models.ForeignKey["Worker | None", "Worker | None"] = (
        models.ForeignKey(
            "website.Worker",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
        )
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "تعبئة وقود"
        verbose_name_plural = "تعبيئة الوقود"

    def __str__(self) -> str:
        return f"{self.vehicle.plate_number} - {self.date.isoformat()}"


class VehicleMaintenance(models.Model):
    MAINTENANCE_OIL = "oil_change"
    MAINTENANCE_TIRES = "tires"
    MAINTENANCE_REPAIR = "repair"
    MAINTENANCE_INSPECTION = "inspection"
    MAINTENANCE_INSURANCE = "insurance"
    MAINTENANCE_REGISTRATION = "registration"
    MAINTENANCE_OTHER = "other"
    MAINTENANCE_CHOICES = [
        (MAINTENANCE_OIL, "تغيير زيت"),
        (MAINTENANCE_TIRES, "إطارات"),
        (MAINTENANCE_REPAIR, "إصلاح"),
        (MAINTENANCE_INSPECTION, "فحص"),
        (MAINTENANCE_INSURANCE, "تأمين"),
        (MAINTENANCE_REGISTRATION, "ترخيص"),
        (MAINTENANCE_OTHER, "أخرى"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    vehicle: models.ForeignKey["Vehicle", "Vehicle"] = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name="maintenance_logs"
    )
    date: models.DateField = models.DateField()
    maintenance_type: models.CharField = models.CharField(
        max_length=32, choices=MAINTENANCE_CHOICES, default=MAINTENANCE_OTHER
    )
    description: models.TextField = models.TextField(blank=True)
    cost: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0")
    )
    odometer_km: models.PositiveIntegerField = models.PositiveIntegerField(
        null=True, blank=True
    )
    next_due_date: models.DateField = models.DateField(null=True, blank=True)
    garage: models.CharField = models.CharField(max_length=255, blank=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "صيانة مركبة"
        verbose_name_plural = "صيانات المركبات"

    def __str__(self) -> str:
        return f"{self.vehicle.plate_number} - {self.maintenance_type}"


class Worker(models.Model):
    KIND_WORKER = "worker"
    KIND_EMPLOYEE = "employee"
    KIND_CHOICES = [
        (KIND_WORKER, "عامل"),
        (KIND_EMPLOYEE, "موظف"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    user: Any = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_worker",
    )
    name: models.CharField = models.CharField(max_length=255)
    role: models.CharField = models.CharField(max_length=255, blank=True)
    phone: models.CharField = models.CharField(max_length=64, blank=True)
    time_clock_id: models.CharField = models.CharField(
        max_length=64, blank=True, null=True, unique=True
    )
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_WORKER
    )
    daily_cost: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    monthly_salary: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    active: models.BooleanField = models.BooleanField(default=True)
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "موظف/عامل"
        verbose_name_plural = "الموظفون/العمال"

    def __str__(self) -> str:
        return self.name


class WorkerAttendance(models.Model):
    STATUS_PRESENT = "present"
    STATUS_ABSENT = "absent"
    STATUS_HALF_DAY = "half_day"
    STATUS_LEAVE = "leave"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "حاضر"),
        (STATUS_ABSENT, "غائب"),
        (STATUS_HALF_DAY, "نصف يوم"),
        (STATUS_LEAVE, "إجازة"),
    ]
    STATE_DRAFT = "draft"
    STATE_REVIEW = "review"
    STATE_APPROVED = "approved"
    STATE_LOCKED = "locked"
    STATE_CHOICES = [
        (STATE_DRAFT, "مسودة"),
        (STATE_REVIEW, "قيد المراجعة"),
        (STATE_APPROVED, "معتمد"),
        (STATE_LOCKED, "مقفول"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker, on_delete=models.CASCADE, related_name="attendance"
    )
    date: models.DateField = models.DateField()
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PRESENT
    )
    hours: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=5, decimal_places=2
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="worker_attendance",
        )
    )
    notes: models.TextField = models.TextField(blank=True)
    state: models.CharField = models.CharField(
        max_length=16, choices=STATE_CHOICES, default=STATE_DRAFT
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
        )
    )
    approved_at: models.DateTimeField = models.DateTimeField(
        blank=True, null=True
    )
    locked_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
        )
    )
    locked_at: models.DateTimeField = models.DateTimeField(
        blank=True, null=True
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "دوام"
        verbose_name_plural = "الدوام"
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "date"], name="uniq_worker_attendance_per_day"
            )
        ]

    def __str__(self) -> str:
        return f"{self.worker.name} - {self.date.isoformat()}"


class WorkerPayrollEntry(models.Model):
    KIND_SALARY = "salary"
    KIND_ADVANCE = "advance"
    KIND_BONUS = "bonus"
    KIND_DEDUCTION = "deduction"
    KIND_CHOICES = [
        (KIND_SALARY, "راتب"),
        (KIND_ADVANCE, "سلفة"),
        (KIND_BONUS, "مكافأة"),
        (KIND_DEDUCTION, "خصم"),
    ]
    SOURCE_MANUAL = "manual"
    SOURCE_AUTO_ATTENDANCE = "auto_attendance"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "يدوي"),
        (SOURCE_AUTO_ATTENDANCE, "تلقائي من الدوام"),
    ]
    STATUS_DRAFT = "draft"
    STATUS_APPROVED = "approved"
    STATUS_PAID = "paid"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_APPROVED, "معتمد"),
        (STATUS_PAID, "مدفوع"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker, on_delete=models.CASCADE, related_name="payroll_entries"
    )
    year: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField()
    month: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField()
    kind: models.CharField = models.CharField(
        max_length=16, choices=KIND_CHOICES, default=KIND_SALARY
    )
    amount: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    date: models.DateField = models.DateField(blank=True, null=True)
    notes: models.TextField = models.TextField(blank=True)
    source: models.CharField = models.CharField(
        max_length=32, choices=SOURCE_CHOICES, default=SOURCE_MANUAL
    )
    source_meta: models.JSONField = models.JSONField(blank=True, null=True)
    status: models.CharField = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
        )
    )
    approved_at: models.DateTimeField = models.DateTimeField(
        blank=True, null=True
    )
    paid_at: models.DateTimeField = models.DateTimeField(blank=True, null=True)
    bank_account: models.ForeignKey[
        "BankAccount | None", "BankAccount | None"
    ] = models.ForeignKey(
        "BankAccount",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payroll_entries",
        verbose_name="حساب الدفع",
    )
    journal_entry: models.ForeignKey[
        "JournalEntry | None", "JournalEntry | None"
    ] = models.ForeignKey(
        "JournalEntry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payroll_entries",
        verbose_name="القيد المحاسبي",
    )
    overtime_amount: models.DecimalField = models.DecimalField(
        blank=True,
        null=True,
        max_digits=12,
        decimal_places=2,
        verbose_name="مبلغ الساعات الإضافية",
    )
    deductions: models.JSONField = models.JSONField(
        default=dict, blank=True, verbose_name="الخصومات"
    )
    allowances: models.JSONField = models.JSONField(
        default=dict, blank=True, verbose_name="البدلات"
    )
    net_salary: models.DecimalField = models.DecimalField(
        blank=True,
        null=True,
        max_digits=12,
        decimal_places=2,
        verbose_name="صافي الراتب",
    )

    class Meta:
        ordering = ["-year", "-month", "-id"]
        verbose_name = "دفعة رواتب"
        verbose_name_plural = "دفعات الرواتب"

    def __str__(self) -> str:
        return f"{self.worker.name} - {self.year}/{self.month}"

    def calculate_net_salary(self) -> "Decimal":
        from decimal import Decimal

        base = self.amount or Decimal("0")
        overtime = self.overtime_amount or Decimal("0")
        allowances_total = Decimal("0")
        if isinstance(self.allowances, dict):
            for v in self.allowances.values():
                try:
                    allowances_total += Decimal(str(v or 0))
                except Exception:
                    pass
        deductions_total = Decimal("0")
        if isinstance(self.deductions, dict):
            for v in self.deductions.values():
                try:
                    deductions_total += Decimal(str(v or 0))
                except Exception:
                    pass
        return base + overtime + allowances_total - deductions_total

    def generate_journal_entry(self) -> "JournalEntry":
        from decimal import Decimal

        from website.models import Account
        from website.models import BankAccount
        from website.models.accounts import create_journal_entry_from_source

        if self.journal_entry:
            return self.journal_entry
        if self.status != WorkerPayrollEntry.STATUS_PAID or not self.paid_at:
            raise ValueError("دفعة الراتب يجب أن تكون في حالة مدفوعة.")
        amount = self.calculate_net_salary()
        if amount <= 0:
            raise ValueError("صافي الراتب يجب أن يكون أكبر من صفر.")
        bank_account = self.bank_account
        if not bank_account:
            bank_account = BankAccount.objects.filter(is_active=True).first()
        if not bank_account:
            raise ValueError("لا يوجد حساب بنكي نشط لإنشاء القيد.")
        expense_code = "5201" if self.kind == "salary" else "5103"
        expense_account = Account.objects.filter(code=expense_code).first()
        if not expense_account:
            raise ValueError(f"حساب المصروف ({expense_code}) غير موجود.")
        entry = create_journal_entry_from_source(
            source_obj=self,
            description=f"دفع راتب: {self.worker.name} - {self.year}/{self.month}",
            entry_type="payroll",
            lines=[
                (expense_account, amount, Decimal("0")),
                (bank_account.account, Decimal("0"), amount),
            ],
            project=None,
            entry_date=self.paid_at.date(),
        )
        self.journal_entry = entry
        self.save()
        return entry


class LeaveRequest(models.Model):
    LEAVE_ANNUAL = "annual"
    LEAVE_SICK = "sick"
    LEAVE_EMERGENCY = "emergency"
    LEAVE_MATERNITY = "maternity"
    LEAVE_HAJJ = "hajj"
    LEAVE_UNPAID = "unpaid"
    LEAVE_CHOICES = [
        (LEAVE_ANNUAL, "إجازة سنوية"),
        (LEAVE_SICK, "إجازة مرضية"),
        (LEAVE_EMERGENCY, "إجازة طارئة"),
        (LEAVE_MATERNITY, "إجازة أمومة"),
        (LEAVE_HAJJ, "إجازة حج"),
        (LEAVE_UNPAID, "إجازة بدون راتب"),
    ]

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "معلقة"),
        (STATUS_APPROVED, "معتمدة"),
        (STATUS_REJECTED, "مرفوضة"),
        (STATUS_CANCELLED, "ملغاة"),
    ]

    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker,
        on_delete=models.CASCADE,
        related_name="leave_requests",
        verbose_name="الموظف",
    )
    leave_type: models.CharField = models.CharField(
        max_length=16, choices=LEAVE_CHOICES, verbose_name="نوع الإجازة"
    )
    start_date: models.DateField = models.DateField(
        verbose_name="تاريخ البداية"
    )
    end_date: models.DateField = models.DateField(verbose_name="تاريخ النهاية")
    total_days: models.PositiveIntegerField = models.PositiveIntegerField(
        verbose_name="عدد الأيام"
    )
    reason: models.TextField = models.TextField(
        blank=True, verbose_name="السبب"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name="الحالة",
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="اعتمدت بواسطة",
        )
    )
    approved_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الاعتماد"
    )
    created_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="أنشئت بواسطة",
        )
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-start_date", "-id"]
        verbose_name = "طلب إجازة"
        verbose_name_plural = "طلبات الإجازات"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.start_date and self.end_date:
            delta = (self.end_date - self.start_date).days
            self.total_days = max(1, delta + 1)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.worker.name} — {self.get_leave_type_display()}"


class EmployeeContract(models.Model):
    CONTRACT_FULL_TIME = "full_time"
    CONTRACT_PART_TIME = "part_time"
    CONTRACT_FIXED_TERM = "fixed_term"
    CONTRACT_SEASONAL = "seasonal"
    CONTRACT_CHOICES = [
        (CONTRACT_FULL_TIME, "دوام كامل"),
        (CONTRACT_PART_TIME, "دوام جزئي"),
        (CONTRACT_FIXED_TERM, "عقد محدد المدة"),
        (CONTRACT_SEASONAL, "عقد موسمي"),
    ]

    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker,
        on_delete=models.CASCADE,
        related_name="contracts",
        verbose_name="الموظف",
    )
    contract_number: models.CharField = models.CharField(
        max_length=64, verbose_name="رقم العقد"
    )
    contract_type: models.CharField = models.CharField(
        max_length=16, choices=CONTRACT_CHOICES, verbose_name="نوع العقد"
    )
    start_date: models.DateField = models.DateField(
        verbose_name="تاريخ البداية"
    )
    end_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ النهاية"
    )
    basic_salary: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="الراتب الأساسي"
    )
    transportation_allowance: models.DecimalField = models.DecimalField(
        default=0, max_digits=12, decimal_places=2, verbose_name="بدل المواصلات"
    )
    housing_allowance: models.DecimalField = models.DecimalField(
        default=0, max_digits=12, decimal_places=2, verbose_name="بدل السكن"
    )
    position: models.CharField = models.CharField(
        max_length=255, verbose_name="المنصب"
    )
    department: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="القسم"
    )
    probation_period_days: models.PositiveIntegerField = (
        models.PositiveIntegerField(
            default=90, verbose_name="فترة التجربة (يوم)"
        )
    )
    is_active: models.BooleanField = models.BooleanField(
        default=True, verbose_name="نشط"
    )
    document_file: models.FileField = models.FileField(
        upload_to="contracts/employee/", blank=True, verbose_name="ملف العقد"
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-start_date", "-id"]
        verbose_name = "عقد موظف"
        verbose_name_plural = "عقود الموظفين"

    def __str__(self) -> str:
        return f"{self.contract_number} — {self.worker.name}"


class OvertimeRecord(models.Model):
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker,
        on_delete=models.CASCADE,
        related_name="overtime",
        verbose_name="الموظف",
    )
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="overtime_records",
            verbose_name="المشروع",
        )
    )
    date: models.DateField = models.DateField(verbose_name="التاريخ")
    hours: models.DecimalField = models.DecimalField(
        max_digits=5, decimal_places=2, verbose_name="عدد الساعات"
    )
    multiplier: models.DecimalField = models.DecimalField(
        default=1.5, max_digits=3, decimal_places=2, verbose_name="معامل الساعة"
    )
    hourly_rate: models.DecimalField = models.DecimalField(
        blank=True,
        null=True,
        max_digits=12,
        decimal_places=2,
        verbose_name="سعر الساعة",
    )
    amount: models.DecimalField = models.DecimalField(
        blank=True,
        null=True,
        max_digits=12,
        decimal_places=2,
        verbose_name="المبلغ",
    )
    approved: models.BooleanField = models.BooleanField(
        default=False, verbose_name="معتمد"
    )
    approved_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="اعتمدت بواسطة",
        )
    )
    approved_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الاعتماد"
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "سجل ساعات إضافية"
        verbose_name_plural = "سجلات الساعات الإضافية"

    def save(self, *args: Any, **kwargs: Any) -> None:
        from decimal import Decimal

        rate = self.hourly_rate or Decimal("0")
        hours = self.hours or Decimal("0")
        mult = self.multiplier or Decimal("1")
        self.amount = (rate * hours * mult).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.worker.name} — {self.date}"


class SocialSecurityRecord(models.Model):
    worker: models.ForeignKey["Worker", "Worker"] = models.ForeignKey(
        Worker,
        on_delete=models.CASCADE,
        related_name="social_security",
        verbose_name="الموظف",
    )
    year: models.PositiveIntegerField = models.PositiveIntegerField(
        verbose_name="السنة"
    )
    month: models.PositiveIntegerField = models.PositiveIntegerField(
        verbose_name="الشهر"
    )
    gross_salary: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="الراتب الإجمالي"
    )
    employee_share: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="حصة الموظف"
    )
    employer_share: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="حصة الشركة"
    )
    total: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="الإجمالي"
    )
    paid: models.BooleanField = models.BooleanField(
        default=False, verbose_name="مدفوع"
    )
    paid_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ الدفع"
    )

    class Meta:
        ordering = ["-year", "-month", "-id"]
        verbose_name = "سجل تأمين اجتماعي"
        verbose_name_plural = "سجلات التأمين الاجتماعي"

    def save(self, *args: Any, **kwargs: Any) -> None:
        from decimal import Decimal

        self.total = (self.employee_share or Decimal("0")) + (
            self.employer_share or Decimal("0")
        )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.worker.name} — {self.year}/{self.month}"


class ResourceAssignment(models.Model):
    RESOURCE_WORKER = "worker"
    RESOURCE_EQUIPMENT = "equipment"
    RESOURCE_CHOICES = [
        (RESOURCE_WORKER, "عامل"),
        (RESOURCE_EQUIPMENT, "معدة"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    project: models.ForeignKey["ProjectPage | None", "ProjectPage | None"] = (
        models.ForeignKey(
            "website.ProjectPage",
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="resource_assignments",
        )
    )
    resource_type: models.CharField = models.CharField(
        max_length=16, choices=RESOURCE_CHOICES, default=RESOURCE_WORKER
    )
    worker: models.ForeignKey["Worker | None", "Worker | None"] = (
        models.ForeignKey(
            Worker,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="assignments",
        )
    )
    equipment: models.ForeignKey["Equipment | None", "Equipment | None"] = (
        models.ForeignKey(
            Equipment,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="assignments",
        )
    )
    start_date: models.DateField = models.DateField(blank=True, null=True)
    end_date: models.DateField = models.DateField(blank=True, null=True)
    hours_per_day: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=6, decimal_places=2
    )
    cost_override: models.DecimalField = models.DecimalField(
        blank=True, null=True, max_digits=12, decimal_places=2
    )
    notes: models.TextField = models.TextField(blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "تعيين مورد"
        verbose_name_plural = "تعيينات الموارد"

    def __str__(self) -> str:
        return str(self.pk or "")


class OpsAuditLog(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    actor: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    role: models.CharField = models.CharField(max_length=32, blank=True)
    action: models.CharField = models.CharField(max_length=64)
    entity_type: models.CharField = models.CharField(max_length=64, blank=True)
    entity_id: models.CharField = models.CharField(max_length=64, blank=True)
    before: models.JSONField = models.JSONField(blank=True, null=True)
    after: models.JSONField = models.JSONField(blank=True, null=True)
    meta: models.JSONField = models.JSONField(blank=True, null=True)
    ip: models.CharField = models.CharField(max_length=64, blank=True)
    user_agent: models.CharField = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "سجل تدقيق"
        verbose_name_plural = "سجل التدقيق"

    def __str__(self) -> str:
        return f"{self.action} - {self.entity_type}:{self.entity_id}"


class OpsPermissionRule(models.Model):
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    code: models.CharField = models.CharField(max_length=64, unique=True)
    allowed_roles: models.JSONField = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["code", "id"]
        verbose_name = "قاعدة صلاحية"
        verbose_name_plural = "قواعد الصلاحيات"

    def __str__(self) -> str:
        return self.code


class OpsTimeclockImportRun(models.Model):
    SOURCE_MANUAL = "manual"
    SOURCE_FOLDER = "folder"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "يدوي"),
        (SOURCE_FOLDER, "مجلد"),
    ]

    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    actor: models.ForeignKey["Any | None", "Any | None"] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    role: models.CharField = models.CharField(max_length=32, blank=True)
    source: models.CharField = models.CharField(
        max_length=16, choices=SOURCE_CHOICES, default=SOURCE_MANUAL
    )
    dry_run: models.BooleanField = models.BooleanField(default=False)
    default_project: models.ForeignKey[
        "ProjectPage | None", "ProjectPage | None"
    ] = models.ForeignKey(
        "website.ProjectPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    items_count: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    created_count: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    updated_count: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    error_count: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    errors: models.JSONField = models.JSONField(blank=True, null=True)
    results: models.JSONField = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "استيراد ساعة دوام"
        verbose_name_plural = "استيرادات ساعة الدوام"

    def __str__(self) -> str:
        return f"{self.created_at.isoformat()} - {self.source}"
