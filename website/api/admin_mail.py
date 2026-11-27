from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db import models
from django.http import HttpRequest
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import EmailAttachment
from website.models import EmailMessage

User = get_user_model()

_SMTP_ENABLED = bool(settings.EMAIL_HOST and settings.EMAIL_HOST_USER)


from .admin_accounts import _bounded_search
from .admin_accounts import _clean_text
from .admin_accounts import _safe_int
from .admin_accounts import _valid_email
from .common import *

# Hard ceilings for internal mail.  A single request must never be able to
# turn into a company-wide (or larger) broadcast.
_MAIL_RECIPIENT_LIMIT = 50
_MAIL_SUBJECT_MAX = 200
_MAIL_BODY_MAX = 20000
_MAIL_ATTACHMENT_LIMIT = 20


def _allowed_mail_domains(sender: Any) -> set[str]:
    """Domains allowed as mail recipients.

    Administrators may configure ``settings.MAIL_ALLOWED_DOMAINS``.  When it is
    not configured we fall back to the sender's own email domain, so internal
    mail can only ever go to addresses belonging to the same organisation.
    """
    raw = getattr(settings, "MAIL_ALLOWED_DOMAINS", None) or []
    if isinstance(raw, str):
        raw = [raw]
    domains = {
        str(d).strip().lower().lstrip("@") for d in raw if str(d).strip()
    }
    if not domains and sender and getattr(sender, "email", ""):
        domain = str(sender.email).strip().lower().partition("@")[2]
        if domain:
            domains.add(domain)
    return {d for d in domains if d}


def _email_domain_allowed(email: str, domains: set[str]) -> bool:
    if not domains:
        return True
    return email.partition("@")[2].lower() in domains


def _resolve_recipient_ids(
    raw_ids: Any,
    sender: Any,
    *,
    exclude_sender: bool = True,
) -> tuple[list[int] | None, str | None]:
    """Resolve user IDs to active staff accounts with a valid, allowed email.

    Returns ``(ids, None)`` on success or ``(None, error_code)`` on failure.
    Duplicates are removed, the sender is excluded, and the total is capped.
    Every requested ID must resolve, otherwise the whole request is rejected
    (no silent partial/broadcast sends).
    """
    if raw_ids is None:
        return [], None
    if not isinstance(raw_ids, (list, tuple)):
        return None, "invalid_recipients"
    sender_id = getattr(sender, "id", None)
    ids: list[int] = []
    seen: set[int] = set()
    for raw in raw_ids:
        uid = _safe_int(raw, 0)
        if not uid or uid in seen:
            continue
        seen.add(uid)
        if exclude_sender and uid == sender_id:
            continue
        if len(ids) >= _MAIL_RECIPIENT_LIMIT:
            return None, "too_many_recipients"
        ids.append(uid)
    if not ids:
        return [], None
    domains = _allowed_mail_domains(sender)
    allowed_ids: set[int] = set()
    for u in User.objects.filter(
        id__in=ids, is_active=True, is_staff=True
    ).only("id", "email"):
        email = str(getattr(u, "email", "") or "").strip()
        if _valid_email(email) and _email_domain_allowed(email, domains):
            allowed_ids.add(u.id)
    if len(allowed_ids) != len(ids):
        return None, "invalid_recipients"
    return ids, None


def _recipient_error(code: str) -> JsonResponse:
    messages = {
        "too_many_recipients": "عدد المستلمين يتجاوز الحد المسموح (50).",
        "invalid_recipients": "بعض المستلمين غير صالحين أو خارج النطاق المسموح.",
    }
    return _api_error(
        code,
        status=400,
        message=messages.get(code, "بيانات المستلمين غير صالحة."),
    )


def _dispatch_smtp(msg: EmailMessage) -> None:
    if not _SMTP_ENABLED:
        return
    sender_user = msg.sender
    if not sender_user or not sender_user.email:
        return
    domains = _allowed_mail_domains(sender_user)

    # Resolve every recipient in one query, restricted to active staff accounts
    # whose email is valid and inside the allowed domain.  Cap the total so a
    # stored/draft message can never explode into a mass mailing at send time.
    raw_ids = [
        *(msg.recipients or []),
        *(msg.cc or []),
        *(msg.bcc or []),
    ]
    ids: list[int] = []
    seen_ids: set[int] = set()
    for raw in raw_ids:
        rid = _safe_int(raw, 0)
        if not rid or rid in seen_ids or rid == sender_user.id:
            continue
        seen_ids.add(rid)
        if len(ids) >= _MAIL_RECIPIENT_LIMIT:
            break
        ids.append(rid)
    allowed: dict[int, str] = {}
    if ids:
        for u in User.objects.filter(
            id__in=ids, is_active=True, is_staff=True
        ).only("id", "email"):
            email = str(getattr(u, "email", "") or "").strip()
            if _valid_email(email) and _email_domain_allowed(email, domains):
                allowed[u.id] = email

    def _emails_for(raw_list: Any) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for raw in raw_list or []:
            email = allowed.get(_safe_int(raw, 0))
            if not email or email in seen:
                continue
            seen.add(email)
            result.append(email)
        return result

    to_emails = _emails_for(msg.recipients)
    if not to_emails:
        return
    cc_emails = _emails_for(msg.cc)
    bcc_emails = _emails_for(msg.bcc)
    try:
        html = render_to_string(
            "email/internal_message.html",
            {
                "sender_name": sender_user.get_full_name()
                or sender_user.username,
                "sender_email": sender_user.email,
                "subject": msg.subject or "(بدون موضوع)",
                "body": msg.body,
            },
        )
        email = EmailMultiAlternatives(
            subject=msg.subject or "(بدون موضوع)",
            body=msg.body,
            from_email=sender_user.email,
            to=to_emails,
            cc=cc_emails,
            bcc=bcc_emails,
            reply_to=[sender_user.email],
        )
        email.attach_alternative(html, "text/html")
        for attachment in msg.attachments.select_related("document").all():
            document = getattr(attachment, "document", None)
            file_field = getattr(document, "file", None)
            file_path = getattr(file_field, "path", None)
            if not file_path or not os.path.exists(file_path):
                continue
            try:
                email.attach_file(
                    file_path,
                    mimetype=attachment.content_type or None,
                )
            except Exception:
                logger.exception(
                    "Failed to attach document for mail #%s", msg.id
                )
        email.send(fail_silently=False)
        logger.info("SMTP mail #%s dispatched to %s", msg.id, to_emails)
    except Exception:
        logger.exception("SMTP dispatch failed for mail #%s", msg.id)


def _user_to_dict(u) -> dict[str, Any]:
    return {
        "id": u.id,
        "username": u.username,
        "fullName": getattr(u, "get_full_name", lambda: "")() or u.username,
    }


def _msg_to_dict(msg: EmailMessage, *, user_id: int) -> dict[str, Any]:
    sender_name = ""
    if msg.sender_id:
        try:
            sender_name = msg.sender.get_full_name() or msg.sender.username
        except Exception:
            sender_name = str(msg.sender_id)
    is_incoming = (
        msg.sender_id != user_id and msg.folder == EmailMessage.FOLDER_INBOX
    )
    return {
        "id": msg.id,
        "senderId": msg.sender_id,
        "senderName": sender_name,
        "recipients": msg.recipients,
        "cc": msg.cc,
        # BCC is only visible to the sender, never to other recipients.
        "bcc": msg.bcc if msg.sender_id == user_id else [],
        "subject": msg.subject,
        "body": msg.body,
        "folder": msg.folder,
        "isRead": msg.is_read,
        "isStarred": msg.is_starred,
        "isDraft": msg.is_draft,
        "isIncoming": is_incoming,
        "parentId": msg.parent_id,
        "createdAt": _to_iso(msg.created_at),
        "updatedAt": _to_iso(msg.updated_at),
        "attachments": [
            {
                "id": a.id,
                "filename": a.filename,
                "fileSize": a.file_size,
                "contentType": a.content_type,
                "documentId": a.document_id,
            }
            for a in msg.attachments.all()
        ],
    }


def _require_mail_access(request: HttpRequest) -> JsonResponse | None:
    # Reading company mail is not a generic staff privilege.
    return _require_ops_rule(
        request,
        "mail_access",
        default_allowed_roles={"manager", "registrar"},
    )


def _recipient_message_pks(user_id: int) -> list[int]:
    """Portable replacement for JSONField's ``contains`` lookup.

    ``contains`` on a JSON list only works on PostgreSQL, while local
    development uses SQLite. Resolve membership in Python instead.
    """
    pks: list[int] = []
    for msg in EmailMessage.objects.only("pk", "recipients"):
        recipients = msg.recipients or []
        if user_id in recipients or str(user_id) in {
            str(value) for value in recipients
        }:
            pks.append(msg.pk)
    return pks


@require_GET
def admin_mail_folders(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    recipient_pks = _recipient_message_pks(user.id)
    folders = [
        {
            "key": EmailMessage.FOLDER_INBOX,
            "label": "الوارد",
            "count": EmailMessage.objects.filter(
                pk__in=recipient_pks,
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
            )
            .exclude(sender=user)
            .count(),
            "unread": EmailMessage.objects.filter(
                pk__in=recipient_pks,
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
                is_read=False,
            )
            .exclude(sender=user)
            .count(),
        },
        {
            "key": EmailMessage.FOLDER_SENT,
            "label": "المرسل",
            "count": EmailMessage.objects.filter(
                sender=user, folder=EmailMessage.FOLDER_SENT, is_draft=False
            ).count(),
            "unread": 0,
        },
        {
            "key": EmailMessage.FOLDER_DRAFTS,
            "label": "المسودات",
            "count": EmailMessage.objects.filter(
                sender=user, folder=EmailMessage.FOLDER_DRAFTS, is_draft=True
            ).count(),
            "unread": 0,
        },
        {
            "key": EmailMessage.FOLDER_TRASH,
            "label": "سلة المهملات",
            "count": EmailMessage.objects.filter(
                folder=EmailMessage.FOLDER_TRASH,
                is_draft=False,
            )
            .filter(models.Q(sender=user) | models.Q(pk__in=recipient_pks))
            .count(),
            "unread": 0,
        },
    ]
    return _api_ok({"folders": folders})


@require_GET
def admin_mail_messages(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    folder = str(
        request.GET.get("folder") or EmailMessage.FOLDER_INBOX
    ).strip()[:32]
    search = _bounded_search(request.GET.get("search"), 120)
    recipient_pks = _recipient_message_pks(user.id)
    page_num = _safe_int(request.GET.get("page"), 1)
    page_size = _safe_int(request.GET.get("pageSize"), 50)
    if page_size > 200:
        page_size = 200
    if page_size < 1:
        page_size = 50
    if page_num < 1:
        page_num = 1

    if folder == EmailMessage.FOLDER_INBOX:
        qs = EmailMessage.objects.filter(
            pk__in=recipient_pks,
            folder=EmailMessage.FOLDER_INBOX,
            is_draft=False,
        ).exclude(sender=user)
    elif folder == EmailMessage.FOLDER_SENT:
        qs = EmailMessage.objects.filter(
            sender=user, folder=EmailMessage.FOLDER_SENT, is_draft=False
        )
    elif folder == EmailMessage.FOLDER_DRAFTS:
        qs = EmailMessage.objects.filter(
            sender=user, folder=EmailMessage.FOLDER_DRAFTS, is_draft=True
        )
    elif folder == EmailMessage.FOLDER_TRASH:
        qs = EmailMessage.objects.filter(
            folder=EmailMessage.FOLDER_TRASH, is_draft=False
        ).filter(models.Q(sender=user) | models.Q(pk__in=recipient_pks))
    else:
        qs = EmailMessage.objects.none()

    # ``_msg_to_dict`` reads every message's attachments; prefetch them to
    # avoid one query per row in the paginated list.
    qs = qs.select_related("sender").prefetch_related("attachments")
    if search:
        qs = qs.filter(
            models.Q(subject__icontains=search)
            | models.Q(body__icontains=search)
        )
    total = qs.count()
    qs = qs.order_by("-created_at")
    offset = (page_num - 1) * page_size
    items = [
        _msg_to_dict(m, user_id=user.id)
        for m in qs[offset : offset + page_size]
    ]
    return _api_ok(
        {
            "items": items,
            "total": total,
            "page": page_num,
            "pageSize": page_size,
        }
    )


@require_GET
def admin_mail_message_detail(
    request: HttpRequest, msg_id: int
) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = (
            EmailMessage.objects.select_related("sender", "parent")
            .prefetch_related("attachments")
            .get(id=msg_id)
        )
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if (
        msg.sender_id != user.id
        and user.id not in msg.recipients
        and user.id not in msg.cc
    ):
        return _api_error("forbidden", status=403)
    if (
        msg.sender_id != user.id
        and not msg.is_read
        and msg.folder == EmailMessage.FOLDER_INBOX
    ):
        msg.is_read = True
        msg.save(update_fields=["is_read"])
    result = _msg_to_dict(msg, user_id=user.id)
    if msg.parent_id:
        try:
            parent = EmailMessage.objects.get(id=msg.parent_id)
            result["parent"] = _msg_to_dict(parent, user_id=user.id)
        except EmailMessage.DoesNotExist:
            result["parent"] = None
    return _api_ok({"message": result})


@require_POST
def admin_mail_messages_send(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    data = _read_json(request)
    subject = _clean_text(data.get("subject"), _MAIL_SUBJECT_MAX) or ""
    body = _clean_text(data.get("body"), _MAIL_BODY_MAX) or ""
    recipients = data.get("recipients") or []
    cc = data.get("cc") or []
    bcc = data.get("bcc") or []
    parent_id = data.get("parentId")
    save_as_draft = bool(data.get("saveAsDraft"))
    raw_attachment_ids = data.get("attachmentIds") or []

    if not subject and not save_as_draft:
        return _api_error(
            "missing_subject", status=400, message="الموضوع مطلوب."
        )
    if (
        not isinstance(recipients, list)
        or not isinstance(cc, list)
        or not isinstance(bcc, list)
    ):
        return _recipient_error("invalid_recipients")
    if not recipients and not cc and not bcc and not save_as_draft:
        return _api_error(
            "missing_recipients",
            status=400,
            message="يجب تحديد مستلم واحد على الأقل.",
        )

    valid_recipients, error = _resolve_recipient_ids(recipients, user)
    if error:
        return _recipient_error(error)
    valid_cc, error = _resolve_recipient_ids(cc, user)
    if error:
        return _recipient_error(error)
    valid_bcc, error = _resolve_recipient_ids(bcc, user)
    if error:
        return _recipient_error(error)

    # The limit applies to the message as a whole, not to each field separately.
    if len({*valid_recipients, *valid_cc, *valid_bcc}) > _MAIL_RECIPIENT_LIMIT:
        return _recipient_error("too_many_recipients")
    if not valid_recipients and not valid_cc and not save_as_draft:
        return _recipient_error("invalid_recipients")

    if not isinstance(raw_attachment_ids, list):
        return _api_error(
            "invalid_attachment_ids", status=400, message="المرفقات غير صالحة."
        )
    attachment_ids = [
        _safe_int(aid, 0)
        for aid in raw_attachment_ids[:_MAIL_ATTACHMENT_LIMIT]
        if _safe_int(aid, 0)
    ]

    parent = None
    parent_pk = _safe_int(parent_id, 0)
    if parent_pk:
        parent = EmailMessage.objects.filter(pk=parent_pk).first()

    folder = (
        EmailMessage.FOLDER_DRAFTS
        if save_as_draft
        else EmailMessage.FOLDER_SENT
    )
    msg = EmailMessage.objects.create(
        sender=user,
        recipients=valid_recipients,
        cc=valid_cc,
        bcc=valid_bcc,
        subject=subject,
        body=body,
        folder=folder,
        is_draft=save_as_draft,
        parent=parent,
    )

    if attachment_ids:
        EmailAttachment.objects.filter(
            id__in=attachment_ids, message__isnull=True
        ).update(message=msg)

    # If sending (not draft), create inbox copies for To and CC recipients.
    if not save_as_draft:
        inbox_recipient_ids = [
            rid
            for rid in dict.fromkeys([*valid_recipients, *valid_cc])
            if rid != user.id
        ]
        for recipient_id in inbox_recipient_ids:
            EmailMessage.objects.create(
                sender=user,
                recipients=[recipient_id],
                cc=valid_cc,
                bcc=[],
                subject=subject,
                body=body,
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
                is_read=False,
                parent=parent,
            )

        _audit_ops(
            request,
            action="mail_send",
            entity_type="mail",
            entity_id=str(msg.id),
            after={"subject": subject, "recipients": valid_recipients},
        )

        _dispatch_smtp(msg)

    return _api_ok({"message": _msg_to_dict(msg, user_id=user.id)})


@require_POST
def admin_mail_messages_update(
    request: HttpRequest, msg_id: int
) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id, sender=user, is_draft=True)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    if "subject" in data:
        msg.subject = _clean_text(data["subject"], _MAIL_SUBJECT_MAX) or ""
    if "body" in data:
        msg.body = _clean_text(data["body"], _MAIL_BODY_MAX) or ""

    # Validate all recipient fields before the draft is turned into a sent
    # message, otherwise an invalid/stale ID could silently become a broadcast.
    for field in ("recipients", "cc", "bcc"):
        if field in data:
            valid, error = _resolve_recipient_ids(data[field], user)
            if error:
                return _recipient_error(error)
            setattr(msg, field, valid)
    if len({*msg.recipients, *msg.cc, *msg.bcc}) > _MAIL_RECIPIENT_LIMIT:
        return _recipient_error("too_many_recipients")

    send_now = bool(data.get("sendNow"))
    if send_now and not msg.recipients and not msg.cc:
        return _recipient_error("invalid_recipients")
    if send_now:
        msg.folder = EmailMessage.FOLDER_SENT
        msg.is_draft = False
        for recipient_id in [
            rid
            for rid in dict.fromkeys([*msg.recipients, *msg.cc])
            if rid != user.id
        ]:
            EmailMessage.objects.create(
                sender=user,
                recipients=[recipient_id],
                cc=msg.cc,
                bcc=[],
                subject=msg.subject,
                body=msg.body,
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
                parent=msg.parent,
            )
    msg.save()
    if send_now:
        _audit_ops(
            request,
            action="mail_send_now",
            entity_type="mail",
            entity_id=str(msg.id),
            after={"subject": msg.subject, "recipients": msg.recipients},
        )
        _dispatch_smtp(msg)
    return _api_ok({"message": _msg_to_dict(msg, user_id=user.id)})


@require_POST
def admin_mail_messages_delete(
    request: HttpRequest, msg_id: int
) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if (
        msg.sender_id != user.id
        and user.id not in msg.recipients
        and user.id not in msg.cc
    ):
        return _api_error("forbidden", status=403)
    if msg.sender_id == user.id and msg.folder == EmailMessage.FOLDER_SENT:
        # For sent messages, just hide it
        msg.delete()
        return _api_ok({"deleted": True})
    msg.folder = EmailMessage.FOLDER_TRASH
    msg.save(update_fields=["folder"])
    return _api_ok({"deleted": True})


@require_POST
def admin_mail_messages_hard_delete(
    request: HttpRequest, msg_id: int
) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(
            id=msg_id, folder=EmailMessage.FOLDER_TRASH
        )
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if msg.sender_id != user.id and user.id not in msg.recipients:
        return _api_error("forbidden", status=403)
    msg.delete()
    return _api_ok({"deleted": True})


@require_POST
def admin_mail_messages_star(request: HttpRequest, msg_id: int) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if msg.sender_id != user.id and user.id not in msg.recipients:
        return _api_error("forbidden", status=403)
    msg.is_starred = not msg.is_starred
    msg.save(update_fields=["is_starred"])
    return _api_ok({"isStarred": msg.is_starred})


@require_POST
def admin_mail_messages_read(request: HttpRequest, msg_id: int) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if msg.sender_id != user.id and user.id not in msg.recipients:
        return _api_error("forbidden", status=403)
    msg.is_read = True
    msg.save(update_fields=["is_read"])
    return _api_ok({"isRead": True})


@require_POST
def admin_mail_messages_unread(
    request: HttpRequest, msg_id: int
) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if msg.sender_id != user.id and user.id not in msg.recipients:
        return _api_error("forbidden", status=403)
    msg.is_read = False
    msg.save(update_fields=["is_read"])
    return _api_ok({"isRead": False})


@require_POST
def admin_mail_messages_move(request: HttpRequest, msg_id: int) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    try:
        msg = EmailMessage.objects.get(id=msg_id)
    except EmailMessage.DoesNotExist:
        return _api_error("not_found", status=404)
    if msg.sender_id != user.id and user.id not in msg.recipients:
        return _api_error("forbidden", status=403)
    data = _read_json(request)
    folder = str(data.get("folder") or "").strip()
    valid_folders = {f[0] for f in EmailMessage.FOLDER_CHOICES}
    if folder not in valid_folders:
        return _api_error("invalid_folder", status=400)
    msg.folder = folder
    msg.is_draft = folder == EmailMessage.FOLDER_DRAFTS
    msg.save(update_fields=["folder", "is_draft"])
    return _api_ok({"folder": folder})


@require_GET
def admin_mail_users(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    search = _bounded_search(request.GET.get("search"), 120)
    qs = User.objects.filter(is_active=True, is_staff=True)
    if search:
        qs = qs.filter(
            models.Q(username__icontains=search)
            | models.Q(first_name__icontains=search)
            | models.Q(last_name__icontains=search)
            | models.Q(email__icontains=search)
        )
    users = [_user_to_dict(u) for u in qs.order_by("username")[:50]]
    return _api_ok({"users": users})


@require_POST
def admin_mail_attachments_upload(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    file = request.FILES.get("file")
    if not file:
        return _api_error("missing_file", status=400)
    max_bytes = 20 * 1024 * 1024
    if file.size > max_bytes:
        return _api_error("file_too_large", status=400)
    from wagtail.documents import get_document_model

    Document = get_document_model()
    safe_name = _clean_text(file.name, 255) or "attachment"
    doc = Document.objects.create(
        title=safe_name,
        file=file,
        uploaded_by_user=request.user,
    )
    attach = EmailAttachment.objects.create(
        message=None,
        document=doc,
        filename=safe_name,
        file_size=file.size or 0,
        content_type=_clean_text(file.content_type, 128) or "",
    )
    return _api_ok(
        {
            "attachment": {
                "id": attach.id,
                "filename": attach.filename,
                "fileSize": attach.file_size,
                "contentType": attach.content_type,
                "documentId": attach.document_id,
                "url": doc.url if hasattr(doc, "url") else doc.file.url,
            }
        }
    )
