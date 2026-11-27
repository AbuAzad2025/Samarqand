"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import re
from functools import wraps
from typing import Any

from django.db import transaction
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import JsonResponse
from django.utils.text import slugify
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST
from wagtail.models import Page

from website.models import ArticlePage
from website.models import CertificationPage
from website.models import CompanySettings
from website.models import ContactPage
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import ProjectPage
from website.models import QuoteRequestPage
from website.models import RFQDocument
from website.models import ServicePage
from website.models import TeamMember
from website.models import Testimonial

logger = logging.getLogger(__name__)


from .common import *

# ---------------------------------------------------------------------------
# Strict input validation. Every rejection uses a short Arabic message with no
# internal details (no exception text, SQL, model names or file paths).
# ---------------------------------------------------------------------------

_api_error_base = _api_error

_MAX_SHORT = 255
_MAX_LONG = 20000
_MAX_LIST = 500
_MAX_SORT_ORDER = 1_000_000
_MAX_PK = 9_223_372_036_854_775_807

_SAFE_MESSAGES: dict[str, str] = {
    "unauthorized": "يرجى تسجيل الدخول أولاً.",
    "forbidden": "لا تملك صلاحية لتنفيذ هذا الإجراء.",
    "not_found": "العنصر المطلوب غير موجود.",
    "site_not_found": "تعذّر تحديد الموقع.",
    "invalid_input": "البيانات المدخلة غير صالحة. يرجى مراجعتها والمحاولة مجدداً.",
    "missing_name": "يرجى إدخال الاسم.",
    "missing_title": "يرجى إدخال العنوان.",
    "missing_text": "يرجى إدخال النص.",
    "missing_label": "يرجى إدخال التسمية.",
    "missing_value": "يرجى إدخال القيمة.",
    "invalid_sortOrder": "الترتيب المدخل غير صالح.",
    "invalid_rating": "التقييم المدخل غير صالح.",
    "invalid_image": "الصورة المحددة غير صالحة.",
    "invalid_ids": "قائمة العناصر غير صالحة.",
    "invalid_issuedYear": "سنة الإصدار غير صالحة.",
    "services_index_missing": "قسم الخدمات غير متاح حالياً.",
    "articles_index_missing": "قسم المقالات غير متاح حالياً.",
    "invalid_parentId": "الصفحة الأم المحددة غير صالحة.",
    "missing_parentId": "يرجى تحديد الصفحة الأم.",
    "parent_not_found": "الصفحة الأم غير موجودة.",
    "invalid_type": "نوع الصفحة غير صالح.",
    "type_not_allowed_here": "لا يمكن إنشاء هذا النوع من الصفحات هنا.",
    "confirm_required": "يرجى تأكيد الحذف قبل المتابعة.",
    "has_children": "لا يمكن حذف صفحة تحتوي على صفحات فرعية دون تأكيد إضافي.",
    "invalid_slug": "الرابط المختصر غير صالح.",
}


def _err(
    code: str,
    *,
    status: int = 400,
    message: str | None = None,
    details: dict[str, Any] | None = None,
) -> JsonResponse:
    safe = (
        message or _SAFE_MESSAGES.get(code) or _SAFE_MESSAGES["invalid_input"]
    )
    return _api_error_base(code, status=status, message=safe, details=details)


class _InputError(Exception):
    """A validation failure whose message is safe to display to an admin."""

    def __init__(self, message: str, code: str = "invalid_input") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def _validated(view_func: Any) -> Any:
    @wraps(view_func)
    def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:
        try:
            return view_func(request, *args, **kwargs)
        except _InputError as exc:
            return _err(exc.code, message=exc.message)

    return _wrapped


def _text(value: Any, label: str, *, max_len: int = _MAX_SHORT) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.")
    result = value.strip()
    if len(result) > max_len:
        raise _InputError(f"يجب ألا يتجاوز {label} {max_len} حرفاً.")
    return result


def _long_text(value: Any, label: str) -> str:
    return _text(value, label, max_len=_MAX_LONG)


def _bool(value: Any, label: str, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise _InputError(f"قيمة {label} غير صالحة.")


def _integer(
    value: Any, label: str, *, low: int, high: int, code: str = "invalid_input"
) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        raise _InputError(f"يرجى إدخال {label} بشكل صحيح.", code)
    if number < low or number > high:
        raise _InputError(f"يجب أن يكون {label} بين {low} و {high}.", code)
    return number


_SLUG_RE = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")


def _slug(value: Any, *, fallback: str = "page") -> str:
    if value is None:
        raw = ""
    elif isinstance(value, str):
        raw = value.strip()
    else:
        raise _InputError("الرابط المختصر غير صالح.")
    if not raw:
        return fallback
    if len(raw) > 60:
        raise _InputError("الرابط المختصر طويل جداً.")
    result = slugify(raw)[:60].strip("-")
    if not result or not _SLUG_RE.fullmatch(result):
        raise _InputError(
            "الرابط المختصر غير صالح؛ استخدم حروفاً لاتينية وأرقاماً وشرطة."
        )
    return result


def _image(value: Any) -> Any:
    """Resolve an image id, or None when the field is being cleared/omitted."""
    if value is None or value == "":
        return None
    pk = _integer(value, "الصورة", low=1, high=_MAX_PK)
    try:
        from wagtail.images import get_image_model

        ImageModel = get_image_model()
        img = ImageModel.objects.filter(pk=pk).first()
    except Exception:
        img = None
    if not img:
        raise _InputError("الصورة المحددة غير صالحة.", "invalid_image")
    return img


def _id_list(value: Any) -> list[int]:
    if not isinstance(value, list) or not value or len(value) > _MAX_LIST:
        raise _InputError("قائمة العناصر غير صالحة.", "invalid_ids")
    cleaned: list[int] = []
    seen: set[int] = set()
    for item in value:
        if isinstance(item, bool):
            raise _InputError("قائمة العناصر غير صالحة.", "invalid_ids")
        try:
            pk = int(str(item).strip())
        except (TypeError, ValueError):
            raise _InputError("قائمة العناصر غير صالحة.", "invalid_ids")
        if pk < 1 or pk > _MAX_PK or pk in seen:
            raise _InputError("قائمة العناصر غير صالحة.", "invalid_ids")
        cleaned.append(pk)
        seen.add(pk)
    return cleaned


_CONFIRM_KEYS = (
    "confirm",
    "confirmed",
    "confirmDelete",
    "confirm_delete",
    "confirmation",
)
_CHILDREN_KEYS = (
    "includeChildren",
    "include_children",
    "deleteDescendants",
    "withChildren",
)


def _is_true(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "ok"}
    return False


def _require_confirmation(data: dict[str, Any]) -> None:
    """The UI asks the user to confirm; never ignore an explicit rejection."""
    for key in _CONFIRM_KEYS:
        if key in data and not _is_true(data.get(key)):
            raise _InputError(
                "يرجى تأكيد الحذف قبل المتابعة.", "confirm_required"
            )


def _require_children_confirmation(data: dict[str, Any], page: Any) -> None:
    """An explicit refusal to delete a page's subtree must be honoured.

    Wagtail's delete() already removes the subtree atomically, so no orphaned
    child pages remain; this only prevents overriding a "do not include
    children" instruction coming from the UI.
    """
    for key in _CHILDREN_KEYS:
        if key in data and not _is_true(data.get(key)):
            raise _InputError(
                "لا يمكن حذف الصفحات الفرعية دون تأكيد إضافي.", "has_children"
            )


def admin_team(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in TeamMember.objects.select_related("image"):
        items.append(
            {
                "id": m.id,
                "sortOrder": m.sort_order,
                "name": m.name,
                "position": m.position,
                "specialization": m.specialization,
                "experience": m.experience,
                "bio": m.bio,
                "imageId": getattr(m.image, "id", None),
                "imageUrl": _image_url(request, m.image),
                "imageThumbUrl": _image_rendition_url(
                    request, m.image, "fill-256x256|jpegquality-70"
                ),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_team_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = _text(data.get("name"), "الاسم")
    if not name:
        return _err("missing_name", status=400)

    img = None
    image_id_raw = data.get("imageId")
    if image_id_raw is not None and image_id_raw != "":
        image_id = _integer(image_id_raw, "الصورة", low=1, high=_MAX_PK)
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=image_id).first()
        except Exception:
            img = None
        if not img:
            raise _InputError("الصورة المحددة غير صالحة.", "invalid_image")

    last = TeamMember.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    m = TeamMember.objects.create(
        sort_order=sort_order,
        name=name,
        position=_text(data.get("position"), "المنصب"),
        specialization=_text(data.get("specialization"), "التخصص"),
        experience=_text(data.get("experience"), "الخبرة"),
        bio=_long_text(data.get("bio"), "نبذة"),
        image=img,
    )
    return _api_ok({"id": m.id})


@require_POST
@_validated
def admin_team_update(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _err("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        m.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )

    if data.get("name") is not None:
        name = _text(data.get("name"), "الاسم")
        if not name:
            return _err("missing_name", status=400)
        m.name = name

    for key, attr, label in [
        ("position", "position", "المنصب"),
        ("specialization", "specialization", "التخصص"),
        ("experience", "experience", "الخبرة"),
        ("bio", "bio", "نبذة"),
    ]:
        if data.get(key) is not None:
            if key == "bio":
                setattr(m, attr, _long_text(data.get(key), label))
            else:
                setattr(m, attr, _text(data.get(key), label))

    if data.get("imageId") is not None:
        image_id_raw = data.get("imageId")
        if image_id_raw is None or image_id_raw == "":
            m.image = None
        else:
            image_id = _integer(image_id_raw, "الصورة", low=1, high=_MAX_PK)
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=image_id).first()
            except Exception:
                img = None
            if not img:
                raise _InputError("الصورة المحددة غير صالحة.", "invalid_image")
            m.image = img

    m.save()
    return _api_ok(
        {
            "imageUrl": _image_url(request, m.image),
            "imageId": getattr(m.image, "id", None),
        }
    )


@require_POST
@_validated
def admin_team_delete(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    m.delete()
    return _api_ok()


@require_POST
@_validated
def admin_team_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    members = TeamMember.objects.filter(pk__in=cleaned)
    by_id = {m.id: m for m in members}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            m = by_id.get(mid)
            if not m:
                continue
            m.sort_order = idx
            m.save(update_fields=["sort_order"])
    return _api_ok()


def admin_testimonials(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for t in Testimonial.objects.all():
        items.append(
            {
                "id": t.id,
                "sortOrder": t.sort_order,
                "name": t.name,
                "project": t.project,
                "text": t.text,
                "rating": int(t.rating or 0),
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_testimonials_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = _text(data.get("name"), "الاسم")
    text = _long_text(data.get("text"), "النص")
    if not name:
        return _err("missing_name", status=400)
    if not text:
        return _err("missing_text", status=400)

    rating_raw = data.get("rating")
    rating = 5
    if rating_raw is not None and rating_raw != "":
        rating = _integer(rating_raw, "التقييم", low=1, high=5)

    last = Testimonial.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    t = Testimonial.objects.create(
        sort_order=sort_order,
        name=name,
        project=_text(data.get("project"), "المشروع"),
        text=text,
        rating=rating,
    )
    return _api_ok({"id": t.id})


@require_POST
@_validated
def admin_testimonials_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _err("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        t.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )

    if data.get("name") is not None:
        name = _text(data.get("name"), "الاسم")
        if not name:
            return _err("missing_name", status=400)
        t.name = name

    if data.get("text") is not None:
        text = _long_text(data.get("text"), "النص")
        if not text:
            return _err("missing_text", status=400)
        t.text = text

    if data.get("project") is not None:
        t.project = _text(data.get("project"), "المشروع")

    rating_raw = data.get("rating")
    if rating_raw is not None:
        t.rating = _integer(rating_raw, "التقييم", low=1, high=5)

    t.save()
    return _api_ok()


@require_POST
@_validated
def admin_testimonials_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    t.delete()
    return _api_ok()


@require_POST
@_validated
def admin_testimonials_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = Testimonial.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


def admin_home_trust_badges(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for b in HomeTrustBadge.objects.all():
        items.append(
            {
                "id": b.id,
                "sortOrder": b.sort_order,
                "title": b.title,
                "description": b.description,
                "iconClass": b.icon_class,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_home_trust_badges_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان")
    if not title:
        return _err("missing_title", status=400)
    last = HomeTrustBadge.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    b = HomeTrustBadge.objects.create(
        sort_order=sort_order,
        title=title,
        description=_text(data.get("description"), "الوصف"),
        icon_class=_text(data.get("iconClass"), "الأيقونة", max_len=64)
        or "fas fa-shield-alt",
    )
    return _api_ok({"id": b.id}, status=201)


@require_POST
@_validated
def admin_home_trust_badges_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _err("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        b.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )
    if data.get("title") is not None:
        title = _text(data.get("title"), "العنوان")
        if not title:
            return _err("missing_title", status=400)
        b.title = title
    if data.get("description") is not None:
        b.description = _text(data.get("description"), "الوصف")
    if data.get("iconClass") is not None:
        b.icon_class = _text(data.get("iconClass"), "الأيقونة", max_len=64)
    b.save()
    return _api_ok()


@require_POST
@_validated
def admin_home_trust_badges_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    b.delete()
    return _api_ok()


@require_POST
@_validated
def admin_home_trust_badges_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = HomeTrustBadge.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_stats(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for s in HomeStat.objects.all():
        items.append(
            {
                "id": s.id,
                "sortOrder": s.sort_order,
                "label": s.label,
                "value": s.value,
                "iconClass": s.icon_class,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_home_stats_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    label = _text(data.get("label"), "التسمية")
    value = _text(data.get("value"), "القيمة", max_len=64)
    if not label:
        return _err("missing_label", status=400)
    if not value:
        return _err("missing_value", status=400)
    last = HomeStat.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    s = HomeStat.objects.create(
        sort_order=sort_order,
        label=label,
        value=value,
        icon_class=_text(data.get("iconClass"), "الأيقونة", max_len=64)
        or "fas fa-building",
    )
    return _api_ok({"id": s.id})


@require_POST
@_validated
def admin_home_stats_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _err("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        s.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )
    if data.get("label") is not None:
        label = _text(data.get("label"), "التسمية")
        if not label:
            return _err("missing_label", status=400)
        s.label = label
    if data.get("value") is not None:
        value = _text(data.get("value"), "القيمة", max_len=64)
        if not value:
            return _err("missing_value", status=400)
        s.value = value
    if data.get("iconClass") is not None:
        s.icon_class = _text(data.get("iconClass"), "الأيقونة", max_len=64)
    s.save()
    return _api_ok()


@require_POST
@_validated
def admin_home_stats_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    s.delete()
    return _api_ok()


@require_POST
@_validated
def admin_home_stats_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = HomeStat.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_timeline(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for st in HomeTimelineStep.objects.all():
        items.append(
            {
                "id": st.id,
                "sortOrder": st.sort_order,
                "title": st.title,
                "description": st.description,
                "iconClass": st.icon_class,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_home_timeline_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان")
    if not title:
        return _err("missing_title", status=400)
    last = HomeTimelineStep.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    st = HomeTimelineStep.objects.create(
        sort_order=sort_order,
        title=title,
        description=_text(data.get("description"), "الوصف"),
        icon_class=_text(data.get("iconClass"), "الأيقونة", max_len=64)
        or "fas fa-file-search",
    )
    return _api_ok({"id": st.id})


@require_POST
@_validated
def admin_home_timeline_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _err("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        st.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )
    if data.get("title") is not None:
        title = _text(data.get("title"), "العنوان")
        if not title:
            return _err("missing_title", status=400)
        st.title = title
    if data.get("description") is not None:
        st.description = _text(data.get("description"), "الوصف")
    if data.get("iconClass") is not None:
        st.icon_class = _text(data.get("iconClass"), "الأيقونة", max_len=64)
    st.save()
    return _api_ok()


@require_POST
@_validated
def admin_home_timeline_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    st.delete()
    return _api_ok()


@require_POST
@_validated
def admin_home_timeline_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = HomeTimelineStep.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_ai_features(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for f in HomeAIFeature.objects.all():
        items.append(
            {
                "id": f.id,
                "sortOrder": f.sort_order,
                "title": f.title,
                "description": f.description,
                "badgeText": f.badge_text,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_home_ai_features_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان")
    if not title:
        return _err("missing_title", status=400)
    last = HomeAIFeature.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    f = HomeAIFeature.objects.create(
        sort_order=sort_order,
        title=title,
        description=_text(data.get("description"), "الوصف"),
        badge_text=_text(data.get("badgeText"), "الشارة", max_len=16) or "AI",
    )
    return _api_ok({"id": f.id})


@require_POST
@_validated
def admin_home_ai_features_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _err("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        f.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )
    if data.get("title") is not None:
        title = _text(data.get("title"), "العنوان")
        if not title:
            return _err("missing_title", status=400)
        f.title = title
    if data.get("description") is not None:
        f.description = _text(data.get("description"), "الوصف")
    if data.get("badgeText") is not None:
        f.badge_text = _text(data.get("badgeText"), "الشارة", max_len=16)
    f.save()
    return _api_ok()


@require_POST
@_validated
def admin_home_ai_features_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    f.delete()
    return _api_ok()


@require_POST
@_validated
def admin_home_ai_features_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = HomeAIFeature.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


@require_GET
def admin_home_ai_metrics(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in HomeAIMetric.objects.all():
        items.append(
            {
                "id": m.id,
                "sortOrder": m.sort_order,
                "value": m.value,
                "label": m.label,
            }
        )
    return _api_ok({"items": items})


@require_POST
@_validated
def admin_home_ai_metrics_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    value = _text(data.get("value"), "القيمة", max_len=64)
    label = _text(data.get("label"), "التسمية")
    if not value:
        return _err("missing_value", status=400)
    if not label:
        return _err("missing_label", status=400)
    last = HomeAIMetric.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    m = HomeAIMetric.objects.create(
        sort_order=sort_order, value=value, label=label
    )
    return _api_ok({"id": m.id})


@require_POST
@_validated
def admin_home_ai_metrics_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _err("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        m.sort_order = _integer(
            sort_order_raw, "الترتيب", low=0, high=_MAX_SORT_ORDER
        )
    if data.get("value") is not None:
        value = _text(data.get("value"), "القيمة", max_len=64)
        if not value:
            return _err("missing_value", status=400)
        m.value = value
    if data.get("label") is not None:
        label = _text(data.get("label"), "التسمية")
        if not label:
            return _err("missing_label", status=400)
        m.label = label
    m.save()
    return _api_ok()


@require_POST
@_validated
def admin_home_ai_metrics_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    m.delete()
    return _api_ok()


@require_POST
@_validated
def admin_home_ai_metrics_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    cleaned = _id_list(data.get("ids"))
    items = HomeAIMetric.objects.filter(pk__in=cleaned)
    by_id = {i.id: i for i in items}
    with transaction.atomic():
        for idx, mid in enumerate(cleaned):
            i = by_id.get(mid)
            if not i:
                continue
            i.sort_order = idx
            i.save(update_fields=["sort_order"])
    return _api_ok()


def admin_services(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return _api_ok({"items": []})
    pages = ServicePage.objects.child_of(idx).select_related("cover_image")
    items: list[dict[str, Any]] = []
    for p in pages:
        cover = getattr(p, "cover_image", None)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(
                    getattr(p, "first_published_at", "") or ""
                ),
                "coverUrl": _image_url(request, cover),
                "coverThumbUrl": _image_rendition_url(
                    request, cover, "fill-640x360|jpegquality-70"
                ),
                "shortDescription": getattr(p, "short_description", "") or "",
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_service_detail(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = (
        ServicePage.objects.filter(pk=service_id)
        .select_related("cover_image")
        .first()
    )
    if not page:
        return _err("not_found", status=404)
    cover = getattr(page, "cover_image", None)
    return _api_ok(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "firstPublishedAt": str(
                getattr(page, "first_published_at", "") or ""
            ),
            "shortDescription": getattr(page, "short_description", "") or "",
            "coverImageId": getattr(cover, "id", None),
            "coverUrl": _image_url(request, cover),
            "coverThumbUrl": _image_rendition_url(
                request, cover, "fill-640x360|jpegquality-70"
            ),
            "bodyHtml": _streamfield_first_html(getattr(page, "body", None)),
        }
    )


@require_POST
@_validated
def admin_service_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return _err("services_index_missing", status=400)
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان") or "Ø®Ø¯Ù…Ø©"
    base_slug = _slug(data.get("slug") or title, fallback="service")
    page = ServicePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        short_description=_text(data.get("shortDescription"), "وصف مختصر"),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(
                page.body, _long_text(body_html, "المحتوى")
            ),
        )

    img = _image(data.get("coverImageId"))
    if img and hasattr(page, "cover_image"):
        setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if _bool(data.get("live"), "الحالة", default=True):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
@_validated
def admin_service_update(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        title = _text(data.get("title"), "العنوان")
        if not title:
            raise _InputError("يرجى إدخال العنوان.", "missing_title")
        page.title = title
    if data.get("shortDescription") is not None:
        page.short_description = _text(
            data.get("shortDescription"), "وصف مختصر"
        )

    if data.get("slug") is not None:
        new_slug = _slug(data.get("slug"), fallback="")
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(
                page.body, _long_text(data.get("bodyHtml"), "المحتوى")
            ),
        )

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        setattr(page, "cover_image", _image(data.get("coverImageId")))

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
@_validated
def admin_service_publish(
    request: HttpRequest, service_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
@_validated
def admin_service_unpublish(
    request: HttpRequest, service_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
@_validated
def admin_service_delete(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)
    _require_confirmation(data)
    _require_children_confirmation(data, page)
    page.delete()
    return _api_ok()


def admin_pages_tree(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    parent_id_raw = request.GET.get("parentId")
    parent_id = None
    if parent_id_raw:
        try:
            parent_id = int(str(parent_id_raw))
        except Exception:
            parent_id = None

    parent: Page | None = None
    if parent_id:
        parent = (
            Page.objects.filter(pk=parent_id)
            .select_related("content_type")
            .first()
        )
    if not parent:
        parent = _site_root(request)
    if not parent:
        return _err("site_not_found", status=400)

    children = list(
        Page.objects.child_of(parent)
        .order_by("path")
        .select_related("content_type")
    )
    # One query for every grandchild instead of one "hasChildren" query per
    # child. Paths of direct descendants are prefixed by the parent path.
    descendant_paths: set[str] = set()
    if children:
        descendant_paths = set(
            Page.objects.filter(
                depth=parent.depth + 2, path__startswith=parent.path
            ).values_list("path", flat=True)
        )
    items: list[dict[str, Any]] = []
    for p in children:
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "type": _page_type_label(p),
                "typeName": _page_type_name(p),
                "url": getattr(p, "url", "") or "",
                "parentId": parent.id,
                "hasChildren": any(
                    path.startswith(p.path) for path in descendant_paths
                ),
                "depth": int(getattr(p, "depth", 0) or 0),
            }
        )
    return _api_ok(
        {
            "parent": {
                "id": parent.id,
                "title": parent.title,
                "slug": parent.slug,
                "type": _page_type_label(parent),
                "typeName": _page_type_name(parent),
                "url": getattr(parent, "url", "") or "",
            },
            "items": items,
        }
    )


@require_GET
def admin_pages_allowed_types(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    parent_id_raw = request.GET.get("parentId")
    if not parent_id_raw:
        return _err("missing_parentId", status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return _err("invalid_parentId", status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _err("not_found", status=404)

    allowed = _allowed_page_models()
    items: list[dict[str, Any]] = []
    try:
        models = parent.get_allowed_subpage_models()
    except Exception:
        models = []
    for m in models:
        label = str(getattr(m._meta, "label_lower", "") or "")
        if label not in allowed:
            continue
        items.append(
            {
                "type": label,
                "typeName": str(
                    getattr(m._meta, "verbose_name", "") or m.__name__
                ),
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_page_detail(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = (
        Page.objects.filter(pk=page_id)
        .specific()
        .select_related("content_type")
        .first()
    )
    if not page:
        return _err("not_found", status=404)

    body_html = ""
    if hasattr(page, "body"):
        body_html = _streamfield_first_html(getattr(page, "body", None))
    parent = page.get_parent()

    data: dict[str, Any] = {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "live": bool(getattr(page, "live", False)),
        "type": _page_type_label(page),
        "typeName": _page_type_name(page),
        "url": getattr(page, "url", "") or "",
        "parentId": parent.id if parent else None,
        "searchDescription": str(getattr(page, "search_description", "") or ""),
        "bodyHtml": body_html,
    }

    if isinstance(page, ServicePage):
        data["shortDescription"] = page.short_description
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)
        data["coverThumbUrl"] = _image_rendition_url(
            request, cover, "fill-640x360|jpegquality-70"
        )

    if isinstance(page, ProjectPage):
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)
        data["coverThumbUrl"] = _image_rendition_url(
            request, cover, "fill-640x360|jpegquality-70"
        )
        data["shortDescription"] = page.short_description
        data["clientName"] = page.client_name
        data["projectLocation"] = page.project_location
        data["completionYear"] = page.completion_year
        data["executingAgency"] = page.executing_agency
        data["projectOwner"] = page.project_owner
        data["funder"] = page.funder
        data["supervisor"] = page.supervisor
        data["companyRole"] = page.company_role
        data["scopeOfWork"] = str(getattr(page, "scope_of_work", "") or "")

    if isinstance(page, CertificationPage):
        data["issuer"] = page.issuer
        data["certificateId"] = page.certificate_id
        data["issuedYear"] = page.issued_year

    if isinstance(page, ArticlePage):
        cover = getattr(page, "cover_image", None)
        data["coverImageId"] = getattr(cover, "id", None)
        data["coverUrl"] = _image_url(request, cover)
        data["coverThumbUrl"] = _image_rendition_url(
            request, cover, "fill-640x360|jpegquality-70"
        )

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        data["toAddress"] = str(getattr(page, "to_address", "") or "")
        data["subject"] = str(getattr(page, "subject", "") or "")
        data["replyAddress"] = str(getattr(page, "reply_address", "") or "")

    return _api_ok(data)


@require_POST
@_validated
def admin_page_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    parent_id_raw = data.get("parentId")
    type_raw = _text(data.get("type"), "نوع الصفحة")
    title = _text(data.get("title"), "العنوان") or "ØµÙØ­Ø©"
    live = _bool(data.get("live"), "الحالة", default=True)

    if parent_id_raw is None or parent_id_raw == "":
        return _err("invalid_parentId", status=400)
    parent_id = _integer(
        parent_id_raw,
        "الصفحة الأم",
        low=1,
        high=_MAX_PK,
        code="invalid_parentId",
    )

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _err("parent_not_found", status=404)

    allowed = _allowed_page_models()
    Model = allowed.get(type_raw)
    if not Model:
        return _err("invalid_type", status=400)

    try:
        allowed_models = parent.get_allowed_subpage_models()
    except Exception:
        allowed_models = []
    if Model not in allowed_models:
        return _err("type_not_allowed_here", status=400)

    base_slug = _slug(data.get("slug") or title, fallback="page")
    page = Model(title=title, slug=_unique_child_slug(parent, base_slug))

    parent.add_child(instance=page)
    if live:
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
@_validated
def admin_page_update(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        title = _text(data.get("title"), "العنوان")
        if not title:
            raise _InputError("يرجى إدخال العنوان.", "missing_title")
        page.title = title

    if data.get("slug") is not None:
        new_slug = _slug(data.get("slug"), fallback="")
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("searchDescription") is not None and hasattr(
        page, "search_description"
    ):
        setattr(
            page,
            "search_description",
            _text(data.get("searchDescription"), "وصف البحث"),
        )

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(
                page.body, _long_text(data.get("bodyHtml"), "المحتوى")
            ),
        )

    if isinstance(page, ServicePage):
        if data.get("shortDescription") is not None:
            page.short_description = _text(
                data.get("shortDescription"), "وصف مختصر"
            )
        if data.get("coverImageId") is not None and hasattr(
            page, "cover_image"
        ):
            setattr(page, "cover_image", _image(data.get("coverImageId")))

    if isinstance(page, CertificationPage):
        if data.get("issuer") is not None:
            page.issuer = _text(data.get("issuer"), "جهة الإصدار")
        if data.get("certificateId") is not None:
            page.certificate_id = _text(
                data.get("certificateId"), "رقم الشهادة"
            )
        if data.get("issuedYear") is not None:
            val = data.get("issuedYear")
            if val is None or val == "":
                page.issued_year = None
            else:
                page.issued_year = _integer(
                    val,
                    "سنة الإصدار",
                    low=1900,
                    high=2100,
                    code="invalid_issuedYear",
                )

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        if data.get("toAddress") is not None:
            setattr(
                page,
                "to_address",
                _text(data.get("toAddress"), "البريد المستلم"),
            )
        if data.get("subject") is not None:
            setattr(page, "subject", _text(data.get("subject"), "العنوان"))
        if data.get("replyAddress") is not None:
            setattr(
                page,
                "reply_address",
                _text(data.get("replyAddress"), "بريد الرد"),
            )

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
@_validated
def admin_page_publish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
@_validated
def admin_page_unpublish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
@_validated
def admin_page_delete(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)
    _require_confirmation(data)
    _require_children_confirmation(data, page)
    page.delete()
    return _api_ok()


def admin_articles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _api_ok({"items": []})
    pages = ArticlePage.objects.child_of(idx).select_related("cover_image")
    items: list[dict[str, Any]] = []
    for p in pages:
        cover = getattr(p, "cover_image", None)
        items.append(
            {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "live": bool(getattr(p, "live", False)),
                "firstPublishedAt": str(
                    getattr(p, "first_published_at", "") or ""
                ),
                "coverUrl": _image_url(request, cover),
                "searchDescription": str(
                    getattr(p, "search_description", "") or ""
                ),
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_article_detail(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = (
        ArticlePage.objects.filter(pk=article_id)
        .select_related("cover_image")
        .first()
    )
    if not page:
        return _err("not_found", status=404)
    cover = getattr(page, "cover_image", None)
    return _api_ok(
        {
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "live": bool(getattr(page, "live", False)),
            "firstPublishedAt": str(
                getattr(page, "first_published_at", "") or ""
            ),
            "searchDescription": str(
                getattr(page, "search_description", "") or ""
            ),
            "coverImageId": getattr(cover, "id", None),
            "coverUrl": _image_url(request, cover),
            "bodyHtml": _streamfield_first_html(getattr(page, "body", None)),
        }
    )


@require_POST
@_validated
def admin_article_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _err("articles_index_missing", status=400)
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان") or "Ù…Ù‚Ø§Ù„"
    base_slug = _slug(data.get("slug") or title, fallback="article")
    page = ArticlePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        search_description=_text(data.get("searchDescription"), "وصف البحث"),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None:
        page.body = _replace_streamfield_html(
            page.body, _long_text(body_html, "المحتوى")
        )

    img = _image(data.get("coverImageId"))
    if img and hasattr(page, "cover_image"):
        setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if _bool(data.get("live"), "الحالة", default=True):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
@_validated
def admin_article_update(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)

    for key, attr, label in [
        ("title", "title", "العنوان"),
        ("searchDescription", "search_description", "وصف البحث"),
    ]:
        if data.get(key) is None:
            continue
        value = _text(data.get(key), label)
        if key == "title" and not value:
            raise _InputError("يرجى إدخال العنوان.", "missing_title")
        setattr(page, attr, value)

    if data.get("slug") is not None:
        new_slug = _slug(data.get("slug"), fallback="")
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None:
        page.body = _replace_streamfield_html(
            page.body, _long_text(data.get("bodyHtml"), "المحتوى")
        )

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        setattr(page, "cover_image", _image(data.get("coverImageId")))

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
@_validated
def admin_article_publish(
    request: HttpRequest, article_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
@_validated
def admin_article_unpublish(
    request: HttpRequest, article_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _err("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return _api_ok()


@require_POST
@_validated
def admin_article_delete(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).first()
    if not page:
        return _err("not_found", status=404)
    data = _read_json(request)
    _require_confirmation(data)
    _require_children_confirmation(data, page)
    page.delete()
    return _api_ok()


def admin_rfq_documents(request: HttpRequest) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for d in RFQDocument.objects.all()[:200]:
        items.append(
            {
                "id": d.id,
                "title": d.title,
                "number": d.number,
                "templateKey": d.template_key,
                "currency": d.currency,
                "createdAt": d.created_at.isoformat() if d.created_at else "",
                "updatedAt": d.updated_at.isoformat() if d.updated_at else "",
            }
        )
    return _api_ok({"items": items})


@require_GET
def admin_rfq_document_detail(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _err("not_found", status=404)
    return _api_ok(
        {
            "id": d.id,
            "title": d.title,
            "number": d.number,
            "templateKey": d.template_key,
            "currency": d.currency,
            "data": d.data if isinstance(d.data, dict) else {},
            "createdAt": d.created_at.isoformat() if d.created_at else "",
            "updatedAt": d.updated_at.isoformat() if d.updated_at else "",
        }
    )


@require_POST
@_validated
def admin_rfq_document_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = _text(data.get("title"), "العنوان")
    template_key = _text(data.get("templateKey"), "مفتاح النموذج", max_len=64)
    currency = _text(data.get("currency") or "ILS", "العملة", max_len=8).upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise _InputError("العملة المحددة غير صالحة.")
    payload = data.get("data")
    if payload is None:
        payload_dict: dict[str, Any] = {}
    elif isinstance(payload, dict):
        payload_dict = payload
    else:
        raise _InputError("بيانات النموذج غير صالحة.")

    d = RFQDocument.objects.create(
        title=title,
        template_key=template_key,
        currency=currency,
        number=_rfq_number(),
        data=payload_dict,
        created_by=(
            getattr(request, "user", None)
            if getattr(request, "user", None)
            else None
        ),
    )
    return _api_ok({"id": d.id})


@require_POST
@_validated
def admin_rfq_document_update(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _err("not_found", status=404)

    data = _read_json(request)
    if data.get("title") is not None:
        d.title = _text(data.get("title"), "العنوان")
    if data.get("templateKey") is not None:
        d.template_key = _text(
            data.get("templateKey"), "مفتاح النموذج", max_len=64
        )
    if data.get("currency") is not None:
        currency = _text(
            data.get("currency") or "ILS", "العملة", max_len=8
        ).upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise _InputError("العملة المحددة غير صالحة.")
        d.currency = currency
    if data.get("data") is not None:
        payload = data.get("data")
        if not isinstance(payload, dict):
            raise _InputError("بيانات النموذج غير صالحة.")
        d.data = payload
    d.save()
    return _api_ok()


@require_POST
@_validated
def admin_rfq_document_delete(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _err("not_found", status=404)
    _require_confirmation(_read_json(request))
    d.delete()
    return _api_ok()


@require_POST
@_validated
def admin_rfq_document_pdf(request: HttpRequest, doc_id: int) -> HttpResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _err("not_found", status=404)
    site = _get_site(request)
    company = CompanySettings.for_site(site) if site else None
    payload = d.data if isinstance(d.data, dict) else {}
    items = _rfq_extract_items(payload)
    subtotal, discount, tax, total = _rfq_totals(payload)

    vendor = payload.get("vendor")
    vendor_name = vendor.get("name") if isinstance(vendor, dict) else ""
    rfq = payload.get("rfq")
    subject = rfq.get("subject") if isinstance(rfq, dict) else ""
    due_date = rfq.get("dueDate") if isinstance(rfq, dict) else ""

    company_name = getattr(company, "name", "") if company else ""
    company_email = getattr(company, "email", "") if company else ""
    company_phone = getattr(company, "phone_1", "") if company else ""
    company_address = getattr(company, "address", "") if company else ""

    lines: list[str] = []
    lines.append(company_name or "Company")
    if company_phone or company_email:
        lines.append(f"Phone: {company_phone} | Email: {company_email}")
    if company_address:
        lines.append(f"Address: {company_address}")
    lines.append("")
    lines.append(f"RFQ: {d.number or d.id}")
    if d.title:
        lines.append(f"Title: {d.title}")
    if subject:
        lines.append(f"Subject: {subject}")
    if due_date:
        lines.append(f"Due: {due_date}")
    if vendor_name:
        lines.append(f"Vendor: {vendor_name}")
    if d.currency:
        lines.append(f"Currency: {d.currency}")
    lines.append("")
    lines.append("Items:")
    for idx, it in enumerate(items[:25], start=1):
        desc = str(it.get("description") or "")
        unit = str(it.get("unit") or "")
        qty = it.get("qty") or 0
        unit_price = it.get("unitPrice") or 0
        lines.append(
            f"{idx}. {desc} | qty={qty} {unit} | unit_price={unit_price}"
        )
    if len(items) > 25:
        lines.append(f"... ({len(items) - 25} more)")
    lines.append("")
    lines.append(f"Subtotal: {subtotal:.2f} {d.currency}")
    lines.append(f"Discount: {discount:.2f} {d.currency}")
    lines.append(f"Tax: {tax:.2f} {d.currency}")
    lines.append(f"Total: {total:.2f} {d.currency}")

    logo = _company_logo_as_jpeg(company)
    if logo:
        logo_jpeg, logo_w, logo_h = logo
        pdf_bytes = _arabic_pdf_from_lines(
            lines, logo_jpeg=logo_jpeg, logo_px=(logo_w, logo_h)
        )
    else:
        pdf_bytes = _arabic_pdf_from_lines(lines)
    filename = _pdf_sanitize_text(d.number or f"rfq-{d.id}") or f"rfq-{d.id}"
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return resp
