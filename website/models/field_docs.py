"""
Field documentation models for Samarqand Contracting Company.

Project site records for ISO quality and project management:
- CorrespondenceRegister: incoming/outgoing letters
- MeetingMinutes + MeetingActionItem
- DailySiteReport: daily site activity
- MaterialDeliveryNote + MaterialDeliveryNoteItem: GRN
- RFI: Request For Information
- NCR: Non-Conformance Report
- Submittal: material samples, shop drawings, certificates
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import models

from .operations import InventoryItem
from .operations import PurchaseOrder
from .pages import ProjectPage


class CorrespondenceRegister(models.Model):
    DIRECTION_INCOMING = "incoming"
    DIRECTION_OUTGOING = "outgoing"
    DIRECTION_CHOICES = [
        (DIRECTION_INCOMING, "وارد"),
        (DIRECTION_OUTGOING, "صادر"),
    ]

    STATUS_PENDING_REPLY = "pending_reply"
    STATUS_REPLIED = "replied"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_PENDING_REPLY, "بانتظار الرد"),
        (STATUS_REPLIED, "تم الرد"),
        (STATUS_CLOSED, "مغلق"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="correspondence",
            verbose_name="المشروع",
        )
    )
    direction: models.CharField = models.CharField(
        max_length=16, choices=DIRECTION_CHOICES, verbose_name="الاتجاه"
    )
    reference_number: models.CharField = models.CharField(
        max_length=64, verbose_name="رقم المرجع"
    )
    date: models.DateField = models.DateField(verbose_name="التاريخ")
    from_entity: models.CharField = models.CharField(
        max_length=255, verbose_name="من"
    )
    to_entity: models.CharField = models.CharField(
        max_length=255, verbose_name="إلى"
    )
    subject: models.CharField = models.CharField(
        max_length=255, verbose_name="الموضوع"
    )
    description: models.TextField = models.TextField(
        blank=True, verbose_name="الوصف"
    )
    document_file: models.FileField = models.FileField(
        upload_to="correspondence/", blank=True, verbose_name="الملف"
    )
    received_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="استلم بواسطة",
        )
    )
    response_due_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ استحقاق الرد"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_REPLY,
        verbose_name="الحالة",
    )
    responded_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الرد"
    )
    response_ref: models.CharField = models.CharField(
        max_length=64, blank=True, verbose_name="رقم الرد"
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "مراسلة"
        verbose_name_plural = "سجل المراسلات"

    def __str__(self) -> str:
        return f"{self.reference_number} — {self.subject}"


class MeetingMinutes(models.Model):
    MEETING_SITE = "site"
    MEETING_PROGRESS = "progress"
    MEETING_TECHNICAL = "technical"
    MEETING_COORDINATION = "coordination"
    MEETING_SAFETY = "safety"
    MEETING_CHOICES = [
        (MEETING_SITE, "موقع"),
        (MEETING_PROGRESS, "تقدم أعمال"),
        (MEETING_TECHNICAL, "فني"),
        (MEETING_COORDINATION, "تنسيق"),
        (MEETING_SAFETY, "سلامة"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_REVIEWED = "reviewed"
    STATUS_APPROVED = "approved"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة"),
        (STATUS_REVIEWED, "مراجعة"),
        (STATUS_APPROVED, "معتمد"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="meeting_minutes",
            verbose_name="المشروع",
        )
    )
    meeting_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم الاجتماع"
    )
    meeting_date: models.DateField = models.DateField(
        verbose_name="تاريخ الاجتماع"
    )
    meeting_type: models.CharField = models.CharField(
        max_length=16, choices=MEETING_CHOICES, verbose_name="نوع الاجتماع"
    )
    location: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="المكان"
    )
    chairperson: models.CharField = models.CharField(
        max_length=255, verbose_name="رئيس الاجتماع"
    )
    attendees: models.TextField = models.TextField(verbose_name="الحاضرون")
    apologies: models.TextField = models.TextField(
        blank=True, verbose_name="المعتذرون"
    )
    minutes_by: models.CharField = models.CharField(
        max_length=255, verbose_name="محرر المحضر"
    )
    summary: models.TextField = models.TextField(
        blank=True, verbose_name="الملخص"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name="الحالة",
    )
    document_file: models.FileField = models.FileField(
        upload_to="meeting_minutes/", blank=True, verbose_name="ملف المحضر"
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-meeting_date", "-id"]
        verbose_name = "محضر اجتماع"
        verbose_name_plural = "محاضر الاجتماعات"

    def __str__(self) -> str:
        return f"{self.meeting_number} — {self.project.title}"


class MeetingActionItem(models.Model):
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "مفتوح"),
        (STATUS_IN_PROGRESS, "قيد التنفيذ"),
        (STATUS_COMPLETED, "مكتمل"),
        (STATUS_CLOSED, "مغلق"),
    ]

    meeting: models.ForeignKey["MeetingMinutes", "MeetingMinutes"] = (
        models.ForeignKey(
            MeetingMinutes,
            on_delete=models.CASCADE,
            related_name="action_items",
            verbose_name="الاجتماع",
        )
    )
    item_number: models.CharField = models.CharField(
        max_length=16, verbose_name="رقم البند"
    )
    description: models.TextField = models.TextField(verbose_name="الوصف")
    responsible: models.CharField = models.CharField(
        max_length=255, verbose_name="المسؤول"
    )
    due_date: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="تاريخ الاستحقاق"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_OPEN,
        verbose_name="الحالة",
    )
    completed_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الإكمال"
    )

    class Meta:
        ordering = ["item_number"]
        verbose_name = "بند إجرائي"
        verbose_name_plural = "بنود الإجراءات"

    def __str__(self) -> str:
        return f"{self.item_number} — {self.description[:30]}"


class DailySiteReport(models.Model):
    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="daily_reports",
            verbose_name="المشروع",
        )
    )
    date: models.DateField = models.DateField(verbose_name="التاريخ")
    weather: models.CharField = models.CharField(
        max_length=64, blank=True, verbose_name="الطقس"
    )
    temperature: models.CharField = models.CharField(
        max_length=16, blank=True, verbose_name="درجة الحرارة"
    )
    total_workers: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0, verbose_name="إجمالي العمال"
    )
    workers_breakdown: models.JSONField = models.JSONField(
        default=dict, blank=True, verbose_name="تفصيل العمالة"
    )
    equipment_used: models.TextField = models.TextField(
        blank=True, verbose_name="المعدات المستخدمة"
    )
    equipment_hours: models.JSONField = models.JSONField(
        default=dict, blank=True, verbose_name="ساعات المعدات"
    )
    work_done_summary: models.TextField = models.TextField(
        verbose_name="ملخص الأعمال المنفذة"
    )
    quantities_executed: models.TextField = models.TextField(
        blank=True, verbose_name="الكميات المنفذة"
    )
    materials_received: models.TextField = models.TextField(
        blank=True, verbose_name="المواد المستلمة"
    )
    issues_encountered: models.TextField = models.TextField(
        blank=True, verbose_name="المشاكل"
    )
    delays: models.TextField = models.TextField(
        blank=True, verbose_name="التأخيرات"
    )
    safety_observations: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات السلامة"
    )
    plan_for_next_day: models.TextField = models.TextField(
        verbose_name="خطة اليوم التالي"
    )
    photos: models.ManyToManyField = models.ManyToManyField(
        "wagtailimages.Image",
        blank=True,
        verbose_name="الصور",
    )
    submitted_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="مقدم من",
        )
    )
    submitted_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ التقديم"
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "تقرير يومي"
        verbose_name_plural = "التقارير اليومية"

    def __str__(self) -> str:
        return f"تقرير {self.date} — {self.project.title}"


class MaterialDeliveryNote(models.Model):
    purchase_order: models.ForeignKey[
        "PurchaseOrder | None", "PurchaseOrder | None"
    ] = models.ForeignKey(
        PurchaseOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="delivery_notes",
        verbose_name="أمر الشراء",
    )
    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="delivery_notes",
            verbose_name="المشروع",
        )
    )
    delivery_date: models.DateField = models.DateField(
        verbose_name="تاريخ التوصيل"
    )
    supplier_name: models.CharField = models.CharField(
        max_length=255, verbose_name="المورد"
    )
    vehicle_plate: models.CharField = models.CharField(
        max_length=32, blank=True, verbose_name="رقم اللوحة"
    )
    driver_name: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="اسم السائق"
    )
    notes: models.TextField = models.TextField(
        blank=True, verbose_name="ملاحظات"
    )
    received_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="استلم بواسطة",
        )
    )
    created_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )

    class Meta:
        ordering = ["-delivery_date", "-id"]
        verbose_name = "مذكرة استلام مواد"
        verbose_name_plural = "مذكرات استلام المواد"

    def __str__(self) -> str:
        return f"GRN {self.id} — {self.supplier_name}"


class MaterialDeliveryNoteItem(models.Model):
    note: models.ForeignKey["MaterialDeliveryNote", "MaterialDeliveryNote"] = (
        models.ForeignKey(
            MaterialDeliveryNote,
            on_delete=models.CASCADE,
            related_name="items",
            verbose_name="مذكرة الاستلام",
        )
    )
    inventory_item: models.ForeignKey[
        "InventoryItem | None", "InventoryItem | None"
    ] = models.ForeignKey(
        InventoryItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="delivery_items",
        verbose_name="بند المخزون",
    )
    description: models.CharField = models.CharField(
        max_length=255, verbose_name="الوصف"
    )
    quantity: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=3, verbose_name="الكمية"
    )
    unit: models.CharField = models.CharField(
        max_length=32, verbose_name="وحدة القياس"
    )
    unit_price: models.DecimalField = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="سعر الوحدة"
    )
    total: models.DecimalField = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="الإجمالي"
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "بند مذكرة استلام"
        verbose_name_plural = "بنود مذكرات الاستلام"

    def save(self, *args: Any, **kwargs: Any) -> None:
        from decimal import Decimal

        self.total = (self.quantity * self.unit_price).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class RFI(models.Model):
    CATEGORY_DESIGN = "design"
    CATEGORY_SPECIFICATION = "specification"
    CATEGORY_SITE_CONDITION = "site_condition"
    CATEGORY_MATERIAL = "material"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = [
        (CATEGORY_DESIGN, "تصميم"),
        (CATEGORY_SPECIFICATION, "مواصفات"),
        (CATEGORY_SITE_CONDITION, "ظروف الموقع"),
        (CATEGORY_MATERIAL, "مواد"),
        (CATEGORY_OTHER, "أخرى"),
    ]

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "منخفض"),
        (PRIORITY_MEDIUM, "متوسط"),
        (PRIORITY_HIGH, "عالي"),
        (PRIORITY_URGENT, "عاجل"),
    ]

    STATUS_OPEN = "open"
    STATUS_ANSWERED = "answered"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "مفتوح"),
        (STATUS_ANSWERED, "تم الرد"),
        (STATUS_CLOSED, "مغلق"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="rfis",
            verbose_name="المشروع",
        )
    )
    rfi_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم RFI"
    )
    subject: models.CharField = models.CharField(
        max_length=255, verbose_name="الموضوع"
    )
    question: models.TextField = models.TextField(verbose_name="السؤال")
    category: models.CharField = models.CharField(
        max_length=32, choices=CATEGORY_CHOICES, verbose_name="التصنيف"
    )
    priority: models.CharField = models.CharField(
        max_length=16,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_MEDIUM,
        verbose_name="الأولوية",
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_OPEN,
        verbose_name="الحالة",
    )
    submitted_to: models.CharField = models.CharField(
        max_length=255, verbose_name="مقدم إلى"
    )
    submitted_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="مقدم من",
        )
    )
    submitted_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ التقديم"
    )
    response: models.TextField = models.TextField(
        blank=True, verbose_name="الرد"
    )
    responded_by: models.CharField = models.CharField(
        max_length=255, blank=True, verbose_name="مجيب من"
    )
    responded_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الرد"
    )
    days_to_respond: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0, verbose_name="أيام للرد"
    )
    document_file: models.FileField = models.FileField(
        upload_to="rfis/", blank=True, verbose_name="الملف"
    )

    class Meta:
        ordering = ["-submitted_at", "-id"]
        verbose_name = "طلب معلومات"
        verbose_name_plural = "طلبات المعلومات"

    def __str__(self) -> str:
        return f"{self.rfi_number} — {self.subject}"


class NCR(models.Model):
    SEVERITY_MINOR = "minor"
    SEVERITY_MAJOR = "major"
    SEVERITY_CRITICAL = "critical"
    SEVERITY_CHOICES = [
        (SEVERITY_MINOR, "بسيط"),
        (SEVERITY_MAJOR, "كبير"),
        (SEVERITY_CRITICAL, "حرج"),
    ]

    STATUS_OPEN = "open"
    STATUS_ACTION_TAKEN = "action_taken"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "مفتوح"),
        (STATUS_ACTION_TAKEN, "تم اتخاذ إجراء"),
        (STATUS_CLOSED, "مغلق"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="ncrs",
            verbose_name="المشروع",
        )
    )
    ncr_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم NCR"
    )
    date: models.DateField = models.DateField(verbose_name="التاريخ")
    location: models.CharField = models.CharField(
        max_length=255, verbose_name="الموقع"
    )
    severity: models.CharField = models.CharField(
        max_length=16, choices=SEVERITY_CHOICES, verbose_name="الخطورة"
    )
    description: models.TextField = models.TextField(verbose_name="الوصف")
    clause_ref: models.CharField = models.CharField(
        max_length=64, blank=True, verbose_name="مرجع البند"
    )
    status: models.CharField = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_OPEN,
        verbose_name="الحالة",
    )
    raised_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="سجل بواسطة",
        )
    )
    corrective_action: models.TextField = models.TextField(
        blank=True, verbose_name="الإجراء التصحيحي"
    )
    action_deadline: models.DateField = models.DateField(
        null=True, blank=True, verbose_name="موعد الإجراء"
    )
    closed_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="أغلق بواسطة",
        )
    )
    closed_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الإغلاق"
    )
    photos: models.ManyToManyField = models.ManyToManyField(
        "wagtailimages.Image",
        blank=True,
        verbose_name="الصور",
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "مخالفة جودة"
        verbose_name_plural = "مخالفات الجودة"

    def __str__(self) -> str:
        return f"{self.ncr_number} — {self.location}"


class Submittal(models.Model):
    CATEGORY_MATERIAL_SAMPLE = "material_sample"
    CATEGORY_SHOP_DRAWING = "shop_drawing"
    CATEGORY_METHOD_STATEMENT = "method_statement"
    CATEGORY_TEST_REPORT = "test_report"
    CATEGORY_CERTIFICATE = "certificate"
    CATEGORY_CHOICES = [
        (CATEGORY_MATERIAL_SAMPLE, "عينة مادة"),
        (CATEGORY_SHOP_DRAWING, "رسم ورشة"),
        (CATEGORY_METHOD_STATEMENT, "ميثاق عمل"),
        (CATEGORY_TEST_REPORT, "تقرير اختبار"),
        (CATEGORY_CERTIFICATE, "شهادة"),
    ]

    STATUS_SUBMITTED = "submitted"
    STATUS_UNDER_REVIEW = "under_review"
    STATUS_APPROVED = "approved"
    STATUS_APPROVED_WITH_COMMENTS = "approved_with_comments"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_SUBMITTED, "مرسل"),
        (STATUS_UNDER_REVIEW, "قيد المراجعة"),
        (STATUS_APPROVED, "معتمد"),
        (STATUS_APPROVED_WITH_COMMENTS, "معتمد بملاحظات"),
        (STATUS_REJECTED, "مرفوض"),
    ]

    project: models.ForeignKey["ProjectPage", "ProjectPage"] = (
        models.ForeignKey(
            ProjectPage,
            on_delete=models.CASCADE,
            related_name="submittals",
            verbose_name="المشروع",
        )
    )
    submittal_number: models.CharField = models.CharField(
        max_length=32, verbose_name="رقم المستند"
    )
    title: models.CharField = models.CharField(
        max_length=255, verbose_name="العنوان"
    )
    category: models.CharField = models.CharField(
        max_length=32, choices=CATEGORY_CHOICES, verbose_name="التصنيف"
    )
    status: models.CharField = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_SUBMITTED,
        verbose_name="الحالة",
    )
    submitted_to: models.CharField = models.CharField(
        max_length=255, verbose_name="مقدم إلى"
    )
    submitted_by: models.ForeignKey["Any | None", "Any | None"] = (
        models.ForeignKey(
            settings.AUTH_USER_MODEL,
            null=True,
            blank=True,
            on_delete=models.SET_NULL,
            related_name="+",
            verbose_name="مقدم من",
        )
    )
    submitted_at: models.DateTimeField = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ التقديم"
    )
    response: models.TextField = models.TextField(
        blank=True, verbose_name="الرد"
    )
    responded_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True, verbose_name="تاريخ الرد"
    )
    document_file: models.FileField = models.FileField(
        upload_to="submittals/", blank=True, verbose_name="الملف"
    )

    class Meta:
        ordering = ["-submitted_at", "-id"]
        verbose_name = "مستند تسليم"
        verbose_name_plural = "مستندات التسليم"

    def __str__(self) -> str:
        return f"{self.submittal_number} — {self.title}"
