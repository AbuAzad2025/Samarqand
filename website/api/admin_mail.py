from __future__ import annotations

import logging
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


from .common import *


def _dispatch_smtp(msg: EmailMessage) -> None:
    if not _SMTP_ENABLED:
        return
    sender_user = msg.sender
    if not sender_user or not sender_user.email:
        return
    to_emails: list[str] = []
    for rid in msg.recipients or []:
        try:
            u = User.objects.get(id=int(rid))
            if u.email:
                to_emails.append(u.email)
        except (ValueError, User.DoesNotExist):
            pass
    if not to_emails:
        return
    cc_emails: list[str] = []
    for rid in msg.cc or []:
        try:
            u = User.objects.get(id=int(rid))
            if u.email:
                cc_emails.append(u.email)
        except (ValueError, User.DoesNotExist):
            pass
    bcc_emails: list[str] = []
    for rid in msg.bcc or []:
        try:
            u = User.objects.get(id=int(rid))
            if u.email:
                bcc_emails.append(u.email)
        except (ValueError, User.DoesNotExist):
            pass
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
        "bcc": msg.bcc,
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


@require_GET
def admin_mail_folders(request: HttpRequest) -> JsonResponse:
    fb = _require_mail_access(request)
    if fb:
        return fb
    user: Any = request.user
    folders = [
        {
            "key": EmailMessage.FOLDER_INBOX,
            "label": "الوارد",
            "count": EmailMessage.objects.filter(
                recipients__contains=[user.id],
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
            )
            .exclude(sender=user)
            .count(),
            "unread": EmailMessage.objects.filter(
                recipients__contains=[user.id],
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
            .filter(
                models.Q(sender=user) | models.Q(recipients__contains=[user.id])
            )
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
    folder = str(request.GET.get("folder") or EmailMessage.FOLDER_INBOX).strip()
    search = str(request.GET.get("search") or "").strip()
    page_num = int(request.GET.get("page") or 1)
    page_size = int(request.GET.get("pageSize") or 50)
    if page_size > 200:
        page_size = 200
    if page_num < 1:
        page_num = 1

    if folder == EmailMessage.FOLDER_INBOX:
        qs = EmailMessage.objects.filter(
            recipients__contains=[user.id],
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
        ).filter(
            models.Q(sender=user) | models.Q(recipients__contains=[user.id])
        )
    else:
        qs = EmailMessage.objects.none()

    qs = qs.select_related("sender")
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
    subject = str(data.get("subject") or "").strip()
    body = str(data.get("body") or "").strip()
    recipients = list(data.get("recipients") or [])
    cc = list(data.get("cc") or [])
    bcc = list(data.get("bcc") or [])
    parent_id = data.get("parentId")
    save_as_draft = bool(data.get("saveAsDraft"))
    attachment_ids = list(data.get("attachmentIds") or [])

    if not subject and not save_as_draft:
        return _api_error("missing_subject", status=400)
    if not recipients and not cc and not bcc and not save_as_draft:
        return _api_error("missing_recipients", status=400)

    valid_recipients = []
    for rid in recipients:
        try:
            u = User.objects.get(id=int(rid))
            if u.id != user.id:
                valid_recipients.append(u.id)
        except (ValueError, User.DoesNotExist):
            pass

    valid_cc = []
    for rid in cc:
        try:
            u = User.objects.get(id=int(rid))
            if u.id != user.id:
                valid_cc.append(u.id)
        except (ValueError, User.DoesNotExist):
            pass

    valid_bcc = []
    for rid in bcc:
        try:
            u = User.objects.get(id=int(rid))
            valid_bcc.append(u.id)
        except (ValueError, User.DoesNotExist):
            pass

    if not valid_recipients and not valid_cc and not save_as_draft:
        return _api_error("invalid_recipients", status=400)

    parent = None
    if parent_id:
        try:
            parent = EmailMessage.objects.get(id=int(parent_id))
        except (ValueError, EmailMessage.DoesNotExist):
            pass

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

    # If sending (not draft), create inbox copies for recipients + dispatch SMTP
    if not save_as_draft:
        for recipient_id in valid_recipients:
            EmailMessage.objects.create(
                sender=user,
                recipients=[recipient_id],
                cc=valid_cc,
                bcc=valid_bcc,
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
        msg.subject = str(data["subject"] or "").strip()
    if "body" in data:
        msg.body = str(data["body"] or "").strip()
    if "recipients" in data:
        valid = []
        for rid in data["recipients"]:
            try:
                u = User.objects.get(id=int(rid))
                valid.append(u.id)
            except (ValueError, User.DoesNotExist):
                pass
        msg.recipients = valid
    if "cc" in data:
        valid = []
        for rid in data["cc"]:
            try:
                u = User.objects.get(id=int(rid))
                valid.append(u.id)
            except (ValueError, User.DoesNotExist):
                pass
        msg.cc = valid
    if "bcc" in data:
        valid = []
        for rid in data["bcc"]:
            try:
                u = User.objects.get(id=int(rid))
                valid.append(u.id)
            except (ValueError, User.DoesNotExist):
                pass
        msg.bcc = valid
    send_now = bool(data.get("sendNow"))
    if send_now:
        msg.folder = EmailMessage.FOLDER_SENT
        msg.is_draft = False
        # Create inbox copies
        for recipient_id in msg.recipients:
            EmailMessage.objects.create(
                sender=user,
                recipients=[recipient_id],
                cc=msg.cc,
                bcc=msg.bcc,
                subject=msg.subject,
                body=msg.body,
                folder=EmailMessage.FOLDER_INBOX,
                is_draft=False,
                parent=msg.parent,
            )
    msg.save()
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
    search = str(request.GET.get("search") or "").strip()
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
    from wagtail.documents import get_document_model

    Document = get_document_model()
    doc = Document.objects.create(
        title=file.name,
        file=file,
        uploaded_by_user=request.user,
    )
    attach = EmailAttachment.objects.create(
        message=None,
        document=doc,
        filename=file.name or "",
        file_size=file.size or 0,
        content_type=file.content_type or "",
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
