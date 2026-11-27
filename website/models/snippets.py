"""
Snippet models for Samarqand Contracting Company.
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from wagtail.admin.panels import FieldPanel
from wagtail.images import get_image_model_string
from wagtail.snippets.models import register_snippet

from ._formatting import to_arabic_digits as _to_arabic_digits


@register_snippet
class HomeAIFeature(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    badge_text: models.CharField = models.CharField(max_length=16, default="AI")

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("badge_text"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ميزة AI"
        verbose_name_plural = "ميزات AI"

    def __str__(self) -> str:
        return self.title


@register_snippet
class HomeAIMetric(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    value: models.CharField = models.CharField(max_length=64)
    label: models.CharField = models.CharField(max_length=255)

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("value"),
        FieldPanel("label"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "مؤشر AI"
        verbose_name_plural = "مؤشرات AI"

    def __str__(self) -> str:
        return self.label

    @property
    def value_ar(self) -> str:
        """Digit-only metric values are rendered with Arabic-Indic digits."""
        return _to_arabic_digits(self.value)


@register_snippet
class HomeTrustBadge(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-shield-alt"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ميزة ثقة"
        verbose_name_plural = "ميزات الثقة"

    def __str__(self) -> str:
        return self.title


@register_snippet
class HomeStat(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    label: models.CharField = models.CharField(max_length=255)
    value: models.CharField = models.CharField(max_length=64)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-building"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("label"),
        FieldPanel("value"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "إحصائية"
        verbose_name_plural = "إحصاءات"

    def __str__(self) -> str:
        return self.label

    @property
    def value_ar(self) -> str:
        return _to_arabic_digits(self.value)


@register_snippet
class HomeTimelineStep(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=255, blank=True)
    icon_class: models.CharField = models.CharField(
        max_length=64, default="fas fa-file-search"
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("icon_class"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "خطوة عمل"
        verbose_name_plural = "خطوات العمل"

    def __str__(self) -> str:
        return self.title


@register_snippet
class TeamMember(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    name: models.CharField = models.CharField(max_length=255)
    position: models.CharField = models.CharField(max_length=255, blank=True)
    specialization: models.CharField = models.CharField(
        max_length=255, blank=True
    )
    experience: models.CharField = models.CharField(max_length=255, blank=True)
    bio: models.TextField = models.TextField(blank=True)
    image: Any = models.ForeignKey(
        get_image_model_string(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("name"),
        FieldPanel("position"),
        FieldPanel("specialization"),
        FieldPanel("experience"),
        FieldPanel("bio"),
        FieldPanel("image"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "عضو فريق"
        verbose_name_plural = "فريق العمل"

    def __str__(self) -> str:
        return self.name

    @property
    def experience_ar(self) -> str:
        return _to_arabic_digits(self.experience)


@register_snippet
class Testimonial(models.Model):
    sort_order: models.PositiveIntegerField = models.PositiveIntegerField(
        default=0
    )
    name: models.CharField = models.CharField(max_length=255)
    project: models.CharField = models.CharField(max_length=255, blank=True)
    text: models.TextField = models.TextField()
    rating: models.PositiveSmallIntegerField = models.PositiveSmallIntegerField(
        default=5
    )

    panels = [
        FieldPanel("sort_order"),
        FieldPanel("name"),
        FieldPanel("project"),
        FieldPanel("text"),
        FieldPanel("rating"),
    ]

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "رأي عميل"
        verbose_name_plural = "آراء العملاء"

    def __str__(self) -> str:
        return self.name

    @property
    def rating_ar(self) -> str:
        return _to_arabic_digits(self.rating)

    def clean(self) -> None:
        try:
            value = int(self.rating)
        except (TypeError, ValueError):
            raise ValidationError(
                {"rating": "التقييم يجب أن يكون رقماً صحيحاً."}
            ) from None
        if value < 0 or value > 5:
            raise ValidationError({"rating": "التقييم يجب أن يكون بين ٠ و ٥."})
