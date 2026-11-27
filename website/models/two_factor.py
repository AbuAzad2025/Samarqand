"""Optional TOTP second factor for control-panel accounts."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from ._formatting import format_bool as _format_bool
from ._formatting import format_datetime as _format_datetime


class TotpProfile(models.Model):
    user: models.OneToOneField = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="totp_profile",
    )
    secret: models.CharField = models.CharField(max_length=64)
    enabled: models.BooleanField = models.BooleanField(default=False)
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    enabled_at: models.DateTimeField = models.DateTimeField(
        null=True, blank=True
    )

    class Meta:
        verbose_name = "مصادقة ثنائية"
        verbose_name_plural = "المصادقة الثنائية"

    def __str__(self) -> str:
        return f"{self.user} ({self.status_label})"

    @property
    def status_label(self) -> str:
        return "مفعلة" if self.enabled else "غير مفعلة"

    @property
    def enabled_label(self) -> str:
        return _format_bool(self.enabled)

    @property
    def created_at_ar(self) -> str:
        return _format_datetime(self.created_at)

    @property
    def enabled_at_ar(self) -> str:
        return _format_datetime(self.enabled_at)
