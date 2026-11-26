"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
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


def admin_team(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for m in TeamMember.objects.all():
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
def admin_team_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)

    image_id_raw = data.get("imageId")
    image_id: int | None = None
    if isinstance(image_id_raw, int):
        image_id = image_id_raw
    elif isinstance(image_id_raw, str) and image_id_raw.strip():
        try:
            image_id = int(image_id_raw)
        except Exception:
            image_id = None

    img = None
    if image_id is not None:
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=image_id).first()
        except Exception:
            img = None

    last = TeamMember.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    m = TeamMember.objects.create(
        sort_order=sort_order,
        name=name,
        position=str(data.get("position") or ""),
        specialization=str(data.get("specialization") or ""),
        experience=str(data.get("experience") or ""),
        bio=str(data.get("bio") or ""),
        image=img,
    )
    return _api_ok({"id": m.id})


@require_POST
def admin_team_update(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return _api_error("missing_name", status=400)
        m.name = name

    for key, attr in [
        ("position", "position"),
        ("specialization", "specialization"),
        ("experience", "experience"),
        ("bio", "bio"),
    ]:
        if data.get(key) is not None:
            setattr(m, attr, str(data.get(key) or ""))

    if data.get("imageId") is not None:
        image_id_raw = data.get("imageId")
        image_id: int | None = None
        if isinstance(image_id_raw, int):
            image_id = image_id_raw
        elif isinstance(image_id_raw, str) and image_id_raw.strip():
            try:
                image_id = int(image_id_raw)
            except Exception:
                image_id = None

        if image_id is None:
            m.image = None
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=image_id).first()
            except Exception:
                img = None
            if not img:
                return _api_error("invalid_image", status=400)
            m.image = img

    m.save()
    return _api_ok(
        {
            "imageUrl": _image_url(request, m.image),
            "imageId": getattr(m.image, "id", None),
        }
    )


@require_POST
def admin_team_delete(request: HttpRequest, member_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = TeamMember.objects.filter(pk=member_id).first()
    if not m:
        return _api_error("not_found", status=404)
    m.delete()
    return _api_ok()


@require_POST
def admin_team_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue

    if not cleaned:
        return _api_error("invalid_ids", status=400)

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
def admin_testimonials_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    name = str(data.get("name") or "").strip()
    text = str(data.get("text") or "").strip()
    if not name:
        return _api_error("missing_name", status=400)
    if not text:
        return _api_error("missing_text", status=400)

    rating_raw = data.get("rating")
    rating = 5
    if rating_raw is not None and rating_raw != "":
        try:
            rating = int(rating_raw)
        except Exception:
            return _api_error("invalid_rating", status=400)
        rating = max(1, min(5, rating))

    last = Testimonial.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0

    t = Testimonial.objects.create(
        sort_order=sort_order,
        name=name,
        project=str(data.get("project") or ""),
        text=text,
        rating=rating,
    )
    return _api_ok({"id": t.id})


@require_POST
def admin_testimonials_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            t.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)

    if data.get("name") is not None:
        name = str(data.get("name") or "").strip()
        if not name:
            return _api_error("missing_name", status=400)
        t.name = name

    if data.get("text") is not None:
        text = str(data.get("text") or "").strip()
        if not text:
            return _api_error("missing_text", status=400)
        t.text = text

    if data.get("project") is not None:
        t.project = str(data.get("project") or "")

    rating_raw = data.get("rating")
    if rating_raw is not None:
        try:
            rating = int(rating_raw)
        except Exception:
            return _api_error("invalid_rating", status=400)
        t.rating = max(1, min(5, rating))

    t.save()
    return _api_ok()


@require_POST
def admin_testimonials_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    t = Testimonial.objects.filter(pk=item_id).first()
    if not t:
        return _api_error("not_found", status=404)
    t.delete()
    return _api_ok()


@require_POST
def admin_testimonials_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
def admin_home_trust_badges_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeTrustBadge.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    b = HomeTrustBadge.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-shield-alt")
        or "fas fa-shield-alt",
    )
    return _api_ok({"id": b.id}, status=201)


@require_POST
def admin_home_trust_badges_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            b.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        b.title = title
    if data.get("description") is not None:
        b.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        b.icon_class = str(data.get("iconClass") or "")
    b.save()
    return _api_ok()


@require_POST
def admin_home_trust_badges_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    b = HomeTrustBadge.objects.filter(pk=item_id).first()
    if not b:
        return _api_error("not_found", status=404)
    b.delete()
    return _api_ok()


@require_POST
def admin_home_trust_badges_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
def admin_home_stats_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    label = str(data.get("label") or "").strip()
    value = str(data.get("value") or "").strip()
    if not label:
        return _api_error("missing_label", status=400)
    if not value:
        return _api_error("missing_value", status=400)
    last = HomeStat.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    s = HomeStat.objects.create(
        sort_order=sort_order,
        label=label,
        value=value,
        icon_class=str(data.get("iconClass") or "fas fa-building")
        or "fas fa-building",
    )
    return _api_ok({"id": s.id})


@require_POST
def admin_home_stats_update(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            s.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return _api_error("missing_label", status=400)
        s.label = label
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return _api_error("missing_value", status=400)
        s.value = value
    if data.get("iconClass") is not None:
        s.icon_class = str(data.get("iconClass") or "")
    s.save()
    return _api_ok()


@require_POST
def admin_home_stats_delete(request: HttpRequest, item_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    s = HomeStat.objects.filter(pk=item_id).first()
    if not s:
        return _api_error("not_found", status=404)
    s.delete()
    return _api_ok()


@require_POST
def admin_home_stats_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
def admin_home_timeline_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeTimelineStep.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    st = HomeTimelineStep.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        icon_class=str(data.get("iconClass") or "fas fa-file-search")
        or "fas fa-file-search",
    )
    return _api_ok({"id": st.id})


@require_POST
def admin_home_timeline_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            st.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        st.title = title
    if data.get("description") is not None:
        st.description = str(data.get("description") or "")
    if data.get("iconClass") is not None:
        st.icon_class = str(data.get("iconClass") or "")
    st.save()
    return _api_ok()


@require_POST
def admin_home_timeline_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    st = HomeTimelineStep.objects.filter(pk=item_id).first()
    if not st:
        return _api_error("not_found", status=404)
    st.delete()
    return _api_ok()


@require_POST
def admin_home_timeline_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
def admin_home_ai_features_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    if not title:
        return _api_error("missing_title", status=400)
    last = HomeAIFeature.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    f = HomeAIFeature.objects.create(
        sort_order=sort_order,
        title=title,
        description=str(data.get("description") or ""),
        badge_text=str(data.get("badgeText") or "AI") or "AI",
    )
    return _api_ok({"id": f.id})


@require_POST
def admin_home_ai_features_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            f.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("title") is not None:
        title = str(data.get("title") or "").strip()
        if not title:
            return _api_error("missing_title", status=400)
        f.title = title
    if data.get("description") is not None:
        f.description = str(data.get("description") or "")
    if data.get("badgeText") is not None:
        f.badge_text = str(data.get("badgeText") or "")
    f.save()
    return _api_ok()


@require_POST
def admin_home_ai_features_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    f = HomeAIFeature.objects.filter(pk=item_id).first()
    if not f:
        return _api_error("not_found", status=404)
    f.delete()
    return _api_ok()


@require_POST
def admin_home_ai_features_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
def admin_home_ai_metrics_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    value = str(data.get("value") or "").strip()
    label = str(data.get("label") or "").strip()
    if not value:
        return _api_error("missing_value", status=400)
    if not label:
        return _api_error("missing_label", status=400)
    last = HomeAIMetric.objects.order_by("-sort_order", "-id").first()
    sort_order = int(getattr(last, "sort_order", 0) or 0) + 1 if last else 0
    m = HomeAIMetric.objects.create(
        sort_order=sort_order, value=value, label=label
    )
    return _api_ok({"id": m.id})


@require_POST
def admin_home_ai_metrics_update(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    sort_order_raw = data.get("sortOrder")
    if sort_order_raw is not None:
        try:
            m.sort_order = int(sort_order_raw)
        except Exception:
            return _api_error("invalid_sortOrder", status=400)
    if data.get("value") is not None:
        value = str(data.get("value") or "").strip()
        if not value:
            return _api_error("missing_value", status=400)
        m.value = value
    if data.get("label") is not None:
        label = str(data.get("label") or "").strip()
        if not label:
            return _api_error("missing_label", status=400)
        m.label = label
    m.save()
    return _api_ok()


@require_POST
def admin_home_ai_metrics_delete(
    request: HttpRequest, item_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    m = HomeAIMetric.objects.filter(pk=item_id).first()
    if not m:
        return _api_error("not_found", status=404)
    m.delete()
    return _api_ok()


@require_POST
def admin_home_ai_metrics_reorder(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    ids = data.get("ids")
    if not isinstance(ids, list):
        return _api_error("invalid_ids", status=400)
    cleaned: list[int] = []
    for x in ids:
        try:
            cleaned.append(int(x))
        except Exception:
            continue
    if not cleaned:
        return _api_error("invalid_ids", status=400)
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
    pages = Page.objects.child_of(idx).type(ServicePage).specific()
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
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
def admin_service_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _services_index(request)
    if not idx:
        return _api_error("services_index_missing", status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "Ø®Ø¯Ù…Ø©"
    base_slug = slugify(str(data.get("slug") or title)) or "service"
    page = ServicePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        short_description=str(data.get("shortDescription") or ""),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(page.body, str(body_html or "")),
        )

    cover_image_id = data.get("coverImageId")
    if cover_image_id not in {None, ""} and hasattr(page, "cover_image"):
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=int(str(cover_image_id))).first()
        except Exception:
            img = None
        if img:
            setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if bool(data.get("live", True)):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
def admin_service_update(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        page.title = str(data.get("title") or "")
    if data.get("shortDescription") is not None:
        page.short_description = str(data.get("shortDescription") or "")

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(
                page.body, str(data.get("bodyHtml") or "")
            ),
        )

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        val = data.get("coverImageId")
        if val in {"", None}:
            setattr(page, "cover_image", None)
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(val))).first()
            except Exception:
                img = None
            if not img:
                return _api_error("invalid_image", status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_service_publish(
    request: HttpRequest, service_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_service_unpublish(
    request: HttpRequest, service_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_service_delete(request: HttpRequest, service_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ServicePage.objects.filter(pk=service_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
        parent = Page.objects.filter(pk=parent_id).first()
    if not parent:
        parent = _site_root(request)
    if not parent:
        return _api_error("site_not_found", status=400)

    children = Page.objects.child_of(parent).order_by("path")
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
                "parentId": p.get_parent().id if p.get_parent() else None,
                "hasChildren": bool(p.get_children().exists()),
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
        return _api_error("missing_parentId", status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return _api_error("invalid_parentId", status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _api_error("not_found", status=404)

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
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)

    body_html = ""
    if hasattr(page, "body"):
        body_html = _streamfield_first_html(getattr(page, "body", None))

    data: dict[str, Any] = {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "live": bool(getattr(page, "live", False)),
        "type": _page_type_label(page),
        "typeName": _page_type_name(page),
        "url": getattr(page, "url", "") or "",
        "parentId": page.get_parent().id if page.get_parent() else None,
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
def admin_page_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    parent_id_raw = data.get("parentId")
    type_raw = str(data.get("type") or "").strip()
    title = str(data.get("title") or "").strip() or "ØµÙØ­Ø©"
    slug_raw = str(data.get("slug") or title).strip()
    live = bool(data.get("live", True))

    if parent_id_raw in {None, ""}:
        return _api_error("invalid_parentId", status=400)
    try:
        parent_id = int(str(parent_id_raw))
    except Exception:
        return _api_error("invalid_parentId", status=400)

    parent = Page.objects.filter(pk=parent_id).specific().first()
    if not parent:
        return _api_error("parent_not_found", status=404)

    allowed = _allowed_page_models()
    Model = allowed.get(type_raw)
    if not Model:
        return _api_error("invalid_type", status=400)

    try:
        allowed_models = parent.get_allowed_subpage_models()
    except Exception:
        allowed_models = []
    if Model not in allowed_models:
        return _api_error("type_not_allowed_here", status=400)

    base_slug = slugify(slug_raw) or "page"
    page = Model(title=title, slug=_unique_child_slug(parent, base_slug))

    parent.add_child(instance=page)
    if live:
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
def admin_page_update(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    if data.get("title") is not None:
        page.title = str(data.get("title") or "")

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("searchDescription") is not None and hasattr(
        page, "search_description"
    ):
        setattr(
            page, "search_description", str(data.get("searchDescription") or "")
        )

    if data.get("bodyHtml") is not None and hasattr(page, "body"):
        setattr(
            page,
            "body",
            _replace_streamfield_html(
                page.body, str(data.get("bodyHtml") or "")
            ),
        )

    if isinstance(page, ServicePage):
        if data.get("shortDescription") is not None:
            page.short_description = str(data.get("shortDescription") or "")
        if data.get("coverImageId") is not None and hasattr(
            page, "cover_image"
        ):
            val = data.get("coverImageId")
            if val in {"", None}:
                setattr(page, "cover_image", None)
            else:
                try:
                    from wagtail.images import get_image_model

                    ImageModel = get_image_model()
                    img = ImageModel.objects.filter(pk=int(str(val))).first()
                except Exception:
                    img = None
                if not img:
                    return _api_error("invalid_image", status=400)
                setattr(page, "cover_image", img)

    if isinstance(page, CertificationPage):
        if data.get("issuer") is not None:
            page.issuer = str(data.get("issuer") or "")
        if data.get("certificateId") is not None:
            page.certificate_id = str(data.get("certificateId") or "")
        if data.get("issuedYear") is not None:
            val = data.get("issuedYear")
            if val in {"", None}:
                page.issued_year = None
            else:
                try:
                    page.issued_year = int(str(val))
                except Exception:
                    return _api_error("invalid_issuedYear", status=400)

    if isinstance(page, (ContactPage, QuoteRequestPage)):
        if data.get("toAddress") is not None:
            setattr(page, "to_address", str(data.get("toAddress") or ""))
        if data.get("subject") is not None:
            setattr(page, "subject", str(data.get("subject") or ""))
        if data.get("replyAddress") is not None:
            setattr(page, "reply_address", str(data.get("replyAddress") or ""))

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_page_publish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_page_unpublish(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save(update_fields=["live"])
    return _api_ok()


@require_POST
def admin_page_delete(request: HttpRequest, page_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = Page.objects.filter(pk=page_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.delete()
    return _api_ok()


def admin_articles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _api_ok({"items": []})
    pages = Page.objects.child_of(idx).type(ArticlePage).specific()
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
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
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
def admin_article_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    idx = _articles_index(request)
    if not idx:
        return _api_error("articles_index_missing", status=400)
    data = _read_json(request)
    title = str(data.get("title") or "").strip() or "Ù…Ù‚Ø§Ù„"
    base_slug = slugify(str(data.get("slug") or title)) or "article"
    page = ArticlePage(
        title=title,
        slug=_unique_child_slug(idx, base_slug),
        search_description=str(data.get("searchDescription") or ""),
    )

    body_html = data.get("bodyHtml")
    if body_html is not None:
        page.body = _replace_streamfield_html(page.body, str(body_html or ""))

    cover_image_id = data.get("coverImageId")
    if cover_image_id not in {None, ""}:
        try:
            from wagtail.images import get_image_model

            ImageModel = get_image_model()
            img = ImageModel.objects.filter(pk=int(str(cover_image_id))).first()
        except Exception:
            img = None
        if img and hasattr(page, "cover_image"):
            setattr(page, "cover_image", img)

    idx.add_child(instance=page)
    if bool(data.get("live", True)):
        page.save_revision().publish()
    else:
        page.save_revision().save()
    return _api_ok({"id": page.id})


@require_POST
def admin_article_update(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    data = _read_json(request)

    for key, attr in [
        ("title", "title"),
        ("searchDescription", "search_description"),
    ]:
        if data.get(key) is None:
            continue
        setattr(page, attr, str(data.get(key) or ""))

    if data.get("slug") is not None:
        new_slug = slugify(str(data.get("slug") or ""))[:60]
        if new_slug:
            parent = page.get_parent()
            page.slug = _unique_child_slug(parent, new_slug)

    if data.get("bodyHtml") is not None:
        page.body = _replace_streamfield_html(
            page.body, str(data.get("bodyHtml") or "")
        )

    if data.get("coverImageId") is not None and hasattr(page, "cover_image"):
        val = data.get("coverImageId")
        if val in {"", None}:
            setattr(page, "cover_image", None)
        else:
            try:
                from wagtail.images import get_image_model

                ImageModel = get_image_model()
                img = ImageModel.objects.filter(pk=int(str(val))).first()
            except Exception:
                img = None
            if not img:
                return _api_error("invalid_image", status=400)
            setattr(page, "cover_image", img)

    page.save_revision().publish() if page.live else page.save_revision().save()
    return _api_ok()


@require_POST
def admin_article_publish(
    request: HttpRequest, article_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    page.save_revision().publish()
    return _api_ok()


@require_POST
def admin_article_unpublish(
    request: HttpRequest, article_id: int
) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).specific().first()
    if not page:
        return _api_error("not_found", status=404)
    try:
        page.unpublish()
    except Exception:
        page.live = False
        page.save()
    return _api_ok()


@require_POST
def admin_article_delete(request: HttpRequest, article_id: int) -> JsonResponse:
    forbidden = _require_manager(request)
    if forbidden:
        return forbidden
    page = ArticlePage.objects.filter(pk=article_id).first()
    if not page:
        return _api_error("not_found", status=404)
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
        return _api_error("not_found", status=404)
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
def admin_rfq_document_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    title = str(data.get("title") or "").strip()
    template_key = str(data.get("templateKey") or "").strip()
    currency = str(data.get("currency") or "ILS").strip()[:8] or "ILS"
    payload = data.get("data")
    payload_dict = payload if isinstance(payload, dict) else {}

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
def admin_rfq_document_update(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)

    data = _read_json(request)
    if data.get("title") is not None:
        d.title = str(data.get("title") or "").strip()
    if data.get("templateKey") is not None:
        d.template_key = str(data.get("templateKey") or "").strip()
    if data.get("currency") is not None:
        d.currency = str(data.get("currency") or "ILS").strip()[:8] or "ILS"
    if data.get("data") is not None:
        payload = data.get("data")
        d.data = payload if isinstance(payload, dict) else {}
    d.save()
    return _api_ok()


@require_POST
def admin_rfq_document_delete(
    request: HttpRequest, doc_id: int
) -> JsonResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)
    d.delete()
    return _api_ok()


@require_POST
def admin_rfq_document_pdf(request: HttpRequest, doc_id: int) -> HttpResponse:
    forbidden = _require_rfq_management(request)
    if forbidden:
        return forbidden
    d = RFQDocument.objects.filter(pk=doc_id).first()
    if not d:
        return _api_error("not_found", status=404)
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
