from __future__ import annotations

import email as email_lib
import imaplib
import logging
import re
from email.header import decode_header
from email.utils import parsedate_to_datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils.timezone import is_aware
from django.utils.timezone import make_aware
from django.utils.timezone import now

from website.models import EmailMessage

logger = logging.getLogger(__name__)
User = get_user_model()


def _decode_str(val: bytes | str | None) -> str:
    if val is None:
        return ""
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    parts = decode_header(val)
    pieces: list[str] = []
    for part, charset in parts:
        if isinstance(part, bytes):
            ch = charset or "utf-8"
            try:
                pieces.append(part.decode(ch, errors="replace"))
            except LookupError, ValueError:
                pieces.append(part.decode("utf-8", errors="replace"))
        else:
            pieces.append(part)
    return " ".join(pieces)


def _find_user_by_email(address: str) -> object | None:
    addr_lower = address.strip().lower()
    try:
        return User.objects.get(email__iexact=addr_lower)
    except User.DoesNotExist:
        return None


class Command(BaseCommand):
    help = "يجلب رسائل البريد الإلكتروني من IMAP وينشئ رسائل داخلية"

    def add_arguments(self, parser):
        parser.add_argument("--host", default=settings.IMAP_HOST or "")
        parser.add_argument(
            "--port", type=int, default=settings.IMAP_PORT or 993
        )
        parser.add_argument("--user", default=settings.IMAP_USER or "")
        parser.add_argument("--password", default=settings.IMAP_PASSWORD or "")
        parser.add_argument("--ssl", default=True, action="store_true")
        parser.add_argument("--no-ssl", dest="ssl", action="store_false")
        parser.add_argument("--folder", default="INBOX")
        parser.add_argument("--seen", default=False, action="store_true")

    def handle(self, *args, **options):
        host = options["host"]
        port = options["port"]
        user = options["user"]
        password = options["password"]
        folder = options["folder"]
        mark_seen = options["seen"]

        if not host or not user or not password:
            self.stderr.write(
                self.style.ERROR(
                    "IMAP not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD env vars."
                )
            )
            return

        try:
            if options["ssl"]:
                conn = imaplib.IMAP4_SSL(host, port)
            else:
                conn = imaplib.IMAP4(host, port)
            conn.login(user, password)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"IMAP connection failed: {e}"))
            return

        try:
            conn.select(folder)
            search_criteria = "UNSEEN" if not mark_seen else "ALL"
            _typ, data = conn.search(None, search_criteria)
            msg_ids = data[0].split() if data[0] else []
            self.stdout.write(f"Found {len(msg_ids)} messages in {folder}")
            imported_message_ids: set[str] = set()

            for mid in msg_ids:
                _typ, raw = conn.fetch(mid, "(RFC822)")
                if not raw or not raw[0]:
                    continue
                raw_bytes = raw[0][1]
                parsed = email_lib.message_from_bytes(raw_bytes)

                subject = _decode_str(parsed.get("Subject"))
                from_header = _decode_str(parsed.get("From"))
                to_header = _decode_str(parsed.get("To"))
                cc_header = _decode_str(parsed.get("Cc"))
                date_header = parsed.get("Date")
                message_id = str(parsed.get("Message-ID") or "").strip()
                if message_id and message_id in imported_message_ids:
                    continue

                from_addr = _extract_email(from_header)
                to_addrs = [
                    _extract_email(a)
                    for a in f"{to_header},{cc_header}".split(",")
                    if a.strip()
                ]

                body_text = _get_body(parsed)

                sender_user = (
                    _find_user_by_email(from_addr) if from_addr else None
                )
                if not sender_user:
                    logger.info(
                        "Skipping email from unknown sender: %s", from_addr
                    )
                    continue

                inbox_users: list[object] = []
                for t_addr in to_addrs:
                    u = _find_user_by_email(t_addr)
                    if u:
                        inbox_users.append(u)

                if not inbox_users:
                    logger.info(
                        "Skipping email with no known recipients: %s", to_addrs
                    )
                    continue

                created_time = now()
                if date_header:
                    try:
                        dt = parsedate_to_datetime(date_header)
                        if dt:
                            created_time = (
                                make_aware(dt) if not is_aware(dt) else dt
                            )
                    except Exception:
                        pass

                for inbox_user in inbox_users:
                    imported = EmailMessage.objects.create(
                        sender=sender_user,
                        recipients=[inbox_user.id],
                        subject=subject,
                        body=body_text,
                        folder=EmailMessage.FOLDER_INBOX,
                        is_read=False,
                        is_starred=False,
                    )
                    # created_at has auto_now_add, so set the original date
                    # with an explicit UPDATE after insertion.
                    EmailMessage.objects.filter(pk=imported.pk).update(
                        created_at=created_time
                    )
                if message_id:
                    imported_message_ids.add(message_id)

                if not mark_seen:
                    conn.store(mid, "+FLAGS", "\\Seen")

                self.stdout.write(f"  Imported: {subject[:60]}")
        finally:
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass


_email_re = re.compile(r"<([^>]+)>")


def _extract_email(header: str) -> str:
    h = header.strip()
    m = _email_re.search(h)
    if m:
        return m.group(1).strip().lower()
    if "@" in h:
        return h.strip().lower()
    return h


def _decode_payload(payload: object, charset: str) -> str:
    if not isinstance(payload, bytes):
        return ""
    try:
        return payload.decode(charset, errors="replace")
    except LookupError, ValueError:
        return payload.decode("utf-8", errors="replace")


def _get_body(parsed: email_lib.message.Message) -> str:
    if parsed.is_multipart():
        for part in parsed.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    return _decode_payload(payload, charset)
        return ""
    payload = parsed.get_payload(decode=True)
    if isinstance(payload, bytes):
        charset = parsed.get_content_charset() or "utf-8"
        return _decode_payload(payload, charset)
    return ""
