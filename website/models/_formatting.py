"""Safe Arabic display helpers shared by the model modules.

Everything in this module is a plain function (or a string constant).  No
Django field, model, manager, Meta option or mixin is defined here, so adding
or using these helpers can never change migration state.

Formatting helpers are deliberately forgiving: malformed, missing or
unexpected values render as ``—`` instead of raising an exception that could
reach a template, an API response or the admin.  Validation helpers, on the
other hand, raise ``django.core.exceptions.ValidationError`` with Arabic
messages so that Django forms can display them as normal field errors.
"""

from __future__ import annotations

from datetime import date
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.urls import NoReverseMatch
from django.urls import reverse
from django.utils.dateparse import parse_date
from django.utils.dateparse import parse_datetime

EMPTY_VALUE = "—"

_WESTERN_TO_ARABIC = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
_ARABIC_TO_WESTERN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_ARABIC_MONTHS = (
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
)


def to_arabic_digits(value: Any) -> str:
    """Convert western digits in *value* to Arabic-Indic digits safely."""
    if value is None:
        return EMPTY_VALUE
    return str(value).translate(_WESTERN_TO_ARABIC)


def _to_decimal(value: Any) -> Decimal:
    """Return a finite Decimal, accepting Arabic digits and numeric strings."""
    if value is None or isinstance(value, bool) or value == "":
        raise ValueError("empty value")
    if isinstance(value, Decimal):
        result = value
    else:
        text = (
            str(value)
            .strip()
            .translate(_ARABIC_TO_WESTERN)
            .replace("٫", ".")
            .replace("٬", "")
        )
        if not text:
            raise ValueError("empty value")
        result = Decimal(text)
    if not result.is_finite():
        raise ValueError("non-finite value")
    return result


def format_number(
    value: Any, decimals: int | None = 2, grouping: bool = True
) -> str:
    """Format a number for display, e.g. ``1,234.50`` -> ``١٬٢٣٤٫٥٠``.

    ``decimals=None`` keeps the value's own precision.  Invalid or empty
    values return ``—`` and never raise.
    """
    try:
        number = _to_decimal(value)
        if decimals is None:
            spec = "f"
        else:
            spec = f".{max(0, int(decimals))}f"
        if grouping:
            spec = "," + spec
        return (
            format(number, spec)
            .replace(",", "٬")
            .replace(".", "٫")
            .translate(_WESTERN_TO_ARABIC)
        )
    except Exception:
        return EMPTY_VALUE


def format_integer(value: Any, grouping: bool = True) -> str:
    """Format an integer without decimal places."""
    return format_number(value, decimals=0, grouping=grouping)


def format_percent(
    value: Any, *, as_fraction: bool = False, decimals: int | None = None
) -> str:
    """Format a percentage, e.g. ``12.5`` -> ``١٢٫٥٪``.

    Set ``as_fraction=True`` when the stored value is a ratio such as
    ``0.16`` (meaning 16%).
    """
    try:
        number = _to_decimal(value)
    except Exception:
        return EMPTY_VALUE
    if as_fraction:
        number *= 100
    text = format_number(number, decimals=decimals)
    if decimals is None and "٫" in text:
        text = text.rstrip("٠").rstrip("٫")
    return EMPTY_VALUE if text == EMPTY_VALUE else f"{text}٪"


def _coerce_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    parsed = parse_date(text)
    if parsed is not None:
        return parsed
    parsed_datetime = parse_datetime(text)
    return parsed_datetime.date() if parsed_datetime is not None else None


def format_date(value: Any, style: str = "numeric") -> str:
    """Format a date as ``yyyy/mm/dd`` (default) or ``d MMMM yyyy``."""
    parsed = _coerce_date(value)
    if parsed is None:
        return EMPTY_VALUE
    if style == "long":
        text = f"{parsed.day} {_ARABIC_MONTHS[parsed.month - 1]} {parsed.year}"
    elif style == "short":
        text = (
            f"{parsed.day} {_ARABIC_MONTHS[parsed.month - 1][:4]} {parsed.year}"
        )
    else:
        text = f"{parsed.year:04d}/{parsed.month:02d}/{parsed.day:02d}"
    return text.translate(_WESTERN_TO_ARABIC)


def format_datetime(value: Any, style: str = "numeric") -> str:
    """Format a datetime as ``yyyy/mm/dd hh:mm`` (safe for dates too)."""
    if value is None or value == "":
        return EMPTY_VALUE
    parsed: datetime | None = None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime(value.year, value.month, value.day)
    else:
        text = str(value).strip()
        try:
            parsed = parse_datetime(text)
        except Exception:
            parsed = None
        if parsed is None:
            day = parse_date(text)
            if day is not None:
                parsed = datetime(day.year, day.month, day.day)
    if parsed is None:
        return EMPTY_VALUE
    text = f"{format_date(parsed, style=style)} {parsed.hour:02d}:{parsed.minute:02d}"
    return text.translate(_WESTERN_TO_ARABIC)


def format_choice(instance: Any, field_name: str) -> str:
    """Return the Arabic ``get_FOO_display()`` label, safely."""
    display = getattr(instance, f"get_{field_name}_display", None)
    if callable(display):
        try:
            label = display()
        except Exception:
            label = None
        if label not in (None, ""):
            return str(label)
    value = getattr(instance, field_name, None)
    return EMPTY_VALUE if value in (None, "") else str(value)


def format_url(value: Any) -> str:
    """Render an optional link without producing a broken empty href."""
    if value is None:
        return EMPTY_VALUE
    text = str(value).strip()
    return text or EMPTY_VALUE


def format_bool(value: Any) -> str:
    """Arabic yes/no label for a boolean-like value."""
    return "نعم" if value else "لا"


def related_label(instance: Any, field_name: str, attr: str = "name") -> str:
    """Display a related object's label without raising on unsaved/missing rows."""
    if not getattr(instance, f"{field_name}_id", None):
        return EMPTY_VALUE
    try:
        related = getattr(instance, field_name)
        value = getattr(related, attr, None)
    except Exception:
        return EMPTY_VALUE
    return EMPTY_VALUE if value in (None, "") else str(value)


def format_file_size(value: Any) -> str:
    """Human-readable Arabic file size, e.g. ``١٫٢ كيلوبايت``."""
    try:
        size = int(value or 0)
    except (TypeError, ValueError):
        return EMPTY_VALUE
    if size < 0:
        return EMPTY_VALUE
    for limit, unit in (
        (1024**3, "جيجابايت"),
        (1024**2, "ميجابايت"),
        (1024, "كيلوبايت"),
    ):
        if size >= limit:
            return f"{format_number(Decimal(size) / Decimal(limit), decimals=1)} {unit}"
    return f"{format_integer(size)} بايت"


def admin_change_url(instance: Any) -> str:
    """Canonical admin edit URL; ``""`` when there is no saved instance/route."""
    pk = getattr(instance, "pk", None)
    if not pk:
        return ""
    try:
        meta = instance._meta
        return reverse(
            f"admin:{meta.app_label}_{meta.model_name}_change", args=[pk]
        )
    except (NoReverseMatch, AttributeError, TypeError):
        return ""


def validate_percent(value: Any, field_name: str, label: str) -> None:
    """Reject percentages outside 0-100 with an Arabic field error."""
    if value in (None, ""):
        return
    try:
        number = _to_decimal(value)
    except Exception:
        raise ValidationError(
            {field_name: f"{label} يجب أن يكون رقماً صحيحاً."}
        ) from None
    if number < 0 or number > 100:
        raise ValidationError(
            {field_name: f"{label} يجب أن يكون بين ٠٪ و ١٠٠٪."}
        )


def validate_date_range(
    start: Any,
    end: Any,
    end_field: str,
    start_label: str = "تاريخ البداية",
    end_label: str = "تاريخ النهاية",
) -> None:
    """Reject reversed date ranges with an Arabic field error."""
    first = _coerce_date(start)
    last = _coerce_date(end)
    if first is not None and last is not None and last < first:
        raise ValidationError(
            {end_field: f"{end_label} يجب أن يكون بعد {start_label}."}
        )
