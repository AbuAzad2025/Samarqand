from __future__ import annotations

from django.conf import settings
from django.db import models

from ._formatting import admin_change_url as _admin_change_url
from ._formatting import format_choice as _format_choice
from ._formatting import format_datetime as _format_datetime
from ._formatting import format_file_size as _format_file_size


class EmailMessage(models.Model):
    FOLDER_INBOX = "inbox"
    FOLDER_SENT = "sent"
    FOLDER_DRAFTS = "drafts"
    FOLDER_TRASH = "trash"
    FOLDER_CHOICES = [
        (FOLDER_INBOX, "الوارد"),
        (FOLDER_SENT, "المرسل"),
        (FOLDER_DRAFTS, "المسودات"),
        (FOLDER_TRASH, "سلة المهملات"),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_emails",
        verbose_name="المرسل",
    )
    recipients = models.JSONField(
        default=list, blank=True, verbose_name="المستلمون"
    )
    cc = models.JSONField(default=list, blank=True, verbose_name="CC")
    bcc = models.JSONField(default=list, blank=True, verbose_name="BCC")
    subject = models.CharField(
        max_length=512, blank=True, verbose_name="الموضوع"
    )
    body = models.TextField(blank=True, verbose_name="المحتوى")
    folder = models.CharField(
        max_length=16,
        choices=FOLDER_CHOICES,
        default=FOLDER_INBOX,
        verbose_name="المجلد",
    )
    is_read = models.BooleanField(default=False, verbose_name="مقروء")
    is_starred = models.BooleanField(default=False, verbose_name="مميز")
    is_draft = models.BooleanField(default=False, verbose_name="مسودة")
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
        verbose_name="الرسالة الأصلية",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="تاريخ الإنشاء"
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "رسالة بريد"
        verbose_name_plural = "رسائل البريد"

    def __str__(self) -> str:
        return self.subject_display

    @property
    def subject_display(self) -> str:
        return self.subject or f"رسالة #{self.pk}"

    @property
    def folder_label(self) -> str:
        return _format_choice(self, "folder")

    @property
    def created_at_ar(self) -> str:
        return _format_datetime(self.created_at)

    @property
    def updated_at_ar(self) -> str:
        return _format_datetime(self.updated_at)

    @property
    def recipients_display(self) -> str:
        if not isinstance(self.recipients, list) or not self.recipients:
            return "—"
        return "، ".join(str(item) for item in self.recipients)

    def get_absolute_url(self) -> str:
        return _admin_change_url(self)


class EmailAttachment(models.Model):
    message = models.ForeignKey(
        EmailMessage,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="الرسالة",
    )
    document = models.ForeignKey(
        "wagtaildocs.Document",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="الملف",
    )
    filename = models.CharField(
        max_length=512, blank=True, verbose_name="اسم الملف"
    )
    file_size = models.PositiveIntegerField(default=0, verbose_name="الحجم")
    content_type = models.CharField(
        max_length=128, blank=True, verbose_name="نوع المحتوى"
    )

    class Meta:
        verbose_name = "مرفق بريد"
        verbose_name_plural = "مرفقات البريد"

    def __str__(self) -> str:
        return self.filename or f"مرفق #{self.pk}"

    @property
    def size_display(self) -> str:
        return _format_file_size(self.file_size)
