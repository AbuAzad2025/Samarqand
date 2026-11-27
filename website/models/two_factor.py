"""Optional TOTP second factor for control-panel accounts."""

from __future__ import annotations

from django.conf import settings
from django.db import models


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
        return f"{self.user} ({'مفعلة' if self.enabled else 'غير مفعلة'})"
