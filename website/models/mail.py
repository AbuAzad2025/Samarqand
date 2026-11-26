from __future__ import annotations

from django.conf import settings
from django.db import models


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
        return self.subject or f"رسالة #{self.pk}"


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
