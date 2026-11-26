"""Accounting API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
from datetime import date
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import Account
from website.models import BankAccount
from website.models import Check
from website.models import ContractPayment
from website.models import JournalEntry
from website.models import JournalEntryLine
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import TaxRecord
from website.models import WorkerPayrollEntry
from website.models.accounts import _next_entry_number

logger = logging.getLogger(__name__)

from .common import *


@require_GET
def admin_accounts_accounts(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for acc in Account.objects.all():
        items.append(
            {
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "nameAr": acc.name_ar,
                "accountType": acc.account_type,
                "parentId": acc.parent_id,
                "isActive": acc.is_active,
                "isControl": acc.is_control,
                "description": acc.description,
                "sortOrder": acc.sort_order,
                "balance": float(acc.balance()),
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_accounts_accounts_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    code = str(data.get("code") or "").strip()
    name = str(data.get("name") or "").strip()
    if not code or not name:
        return _api_error("missing_code_or_name", status=400)
    if Account.objects.filter(code=code).exists():
        return _api_error("code_exists", status=400)
    account_type = str(data.get("accountType") or "").strip()
    if account_type not in dict(Account.TYPE_CHOICES):
        return _api_error("invalid_account_type", status=400)
    parent_id = data.get("parentId")
    parent = None
    if parent_id:
        parent = Account.objects.filter(pk=int(parent_id)).first()
        if not parent:
            return _api_error("parent_not_found", status=404)
        parent.is_control = True
        parent.save()
    acc = Account.objects.create(
        code=code,
        name=name,
        name_ar=str(data.get("nameAr") or "").strip(),
        account_type=account_type,
        parent=parent,
        is_active=bool(data.get("isActive", True)),
        is_control=bool(data.get("isControl", False)),
        description=str(data.get("description") or "").strip(),
        sort_order=int(data.get("sortOrder") or 0),
    )
    _audit_ops(
        request,
        action="account_create",
        entity_type="account",
        entity_id=str(acc.id),
        after={"code": acc.code, "name": acc.name},
    )
    return _api_ok({"id": acc.id})


@require_POST
def admin_accounts_accounts_update(
    request: HttpRequest, account_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    acc = Account.objects.filter(pk=account_id).first()
    if not acc:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    code = str(data.get("code") or "").strip()
    name = str(data.get("name") or "").strip()
    if not code or not name:
        return _api_error("missing_code_or_name", status=400)
    if Account.objects.filter(code=code).exclude(pk=acc.pk).exists():
        return _api_error("code_exists", status=400)
    account_type = str(data.get("accountType") or "").strip()
    if account_type not in dict(Account.TYPE_CHOICES):
        return _api_error("invalid_account_type", status=400)
    before = {"code": acc.code, "name": acc.name}
    acc.code = code
    acc.name = name
    acc.name_ar = str(data.get("nameAr") or "").strip()
    acc.account_type = account_type
    acc.is_active = bool(data.get("isActive", acc.is_active))
    acc.is_control = bool(data.get("isControl", acc.is_control))
    acc.description = str(data.get("description") or "").strip()
    acc.sort_order = int(data.get("sortOrder") or acc.sort_order)
    parent_id = data.get("parentId")
    if parent_id is not None:
        parent = (
            Account.objects.filter(pk=int(parent_id)).first()
            if parent_id
            else None
        )
        if parent_id and not parent:
            return _api_error("parent_not_found", status=404)
        if parent and parent.pk == acc.pk:
            return _api_error("self_parent", status=400)
        acc.parent = parent
        if parent:
            parent.is_control = True
            parent.save()
    acc.save()
    _audit_ops(
        request,
        action="account_update",
        entity_type="account",
        entity_id=str(acc.id),
        before=before,
        after={"code": acc.code, "name": acc.name},
    )
    return _api_ok({"id": acc.id})


@require_POST
def admin_accounts_accounts_delete(
    request: HttpRequest, account_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    acc = Account.objects.filter(pk=account_id).first()
    if not acc:
        return _api_error("not_found", status=404)
    if acc.children.exists():
        return _api_error("has_children", status=400)
    if JournalEntryLine.objects.filter(account=acc).exists():
        return _api_error("has_transactions", status=400)
    _audit_ops(
        request,
        action="account_delete",
        entity_type="account",
        entity_id=str(acc.id),
        before={"code": acc.code, "name": acc.name},
    )
    acc.delete()
    return _api_ok()


@require_GET
def admin_accounts_journal_entries(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entries: list[dict[str, Any]] = []
    qs = JournalEntry.objects.all()
    from_date = request.GET.get("from")
    to_date = request.GET.get("to")
    entry_type = request.GET.get("type")
    is_posted = request.GET.get("posted")
    project_id = request.GET.get("projectId")
    if from_date:
        qs = qs.filter(date__gte=_to_date(from_date))
    if to_date:
        qs = qs.filter(date__lte=_to_date(to_date))
    if entry_type:
        qs = qs.filter(entry_type=entry_type)
    if is_posted is not None:
        qs = qs.filter(is_posted=is_posted.lower() == "true")
    if project_id:
        qs = qs.filter(project_id=int(project_id))
    for entry in qs[:500]:
        entries.append(
            {
                "id": entry.id,
                "number": entry.number,
                "date": _to_iso(entry.date),
                "description": entry.description,
                "entryType": entry.entry_type,
                "refNumber": entry.ref_number,
                "projectId": entry.project_id,
                "projectTitle": entry.project.title if entry.project else None,
                "isPosted": entry.is_posted,
                "totalDebit": float(entry.total_debit),
                "totalCredit": float(entry.total_credit),
                "createdAt": _to_iso(entry.created_at),
            }
        )
    return _api_ok({"items": entries})


@require_GET
def admin_accounts_journal_entries_detail(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entry = (
        JournalEntry.objects.filter(pk=entry_id)
        .prefetch_related("lines")
        .first()
    )
    if not entry:
        return _api_error("not_found", status=404)
    lines: list[dict[str, Any]] = []
    for line in entry.lines.all():
        lines.append(
            {
                "id": line.id,
                "accountId": line.account_id,
                "accountCode": line.account.code,
                "accountName": line.account.name,
                "description": line.description,
                "debit": float(line.debit),
                "credit": float(line.credit),
                "projectId": line.project_id,
                "contactType": line.contact_type,
                "contactId": line.contact_id,
            }
        )
    return _api_ok(
        {
            "id": entry.id,
            "number": entry.number,
            "date": _to_iso(entry.date),
            "description": entry.description,
            "entryType": entry.entry_type,
            "refNumber": entry.ref_number,
            "projectId": entry.project_id,
            "projectTitle": entry.project.title if entry.project else None,
            "isPosted": entry.is_posted,
            "totalDebit": float(entry.total_debit),
            "totalCredit": float(entry.total_credit),
            "sourceType": entry.source_type,
            "sourceId": entry.source_id,
            "lines": lines,
        }
    )


@require_POST
def admin_accounts_journal_entries_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    entry_date = _to_date(data.get("date"))
    if not entry_date:
        return _api_error("missing_date", status=400)
    description = str(data.get("description") or "").strip()
    entry_type = str(data.get("entryType") or JournalEntry.TYPE_JOURNAL).strip()
    if entry_type not in dict(JournalEntry.TYPE_CHOICES):
        return _api_error("invalid_entry_type", status=400)
    project_id = data.get("projectId")
    project = None
    if project_id:
        project = ProjectPage.objects.filter(pk=int(project_id)).first()
        if not project:
            return _api_error("project_not_found", status=404)
    lines_data = data.get("lines", [])
    if not isinstance(lines_data, list) or len(lines_data) < 2:
        return _api_error("invalid_lines", status=400)
    error, new_lines = _validate_entry_lines(lines_data)
    if error:
        return error
    with transaction.atomic():
        entry = JournalEntry.objects.create(
            number=data.get("number") or _next_entry_number(),
            date=entry_date,
            description=description,
            entry_type=entry_type,
            ref_number=str(data.get("refNumber") or "").strip(),
            project=project,
            created_by=request.user if request.user.is_authenticated else None,
        )
        for line in new_lines:
            line.entry = entry
        JournalEntryLine.objects.bulk_create(new_lines)
        entry.recalculate_totals()
        entry.save()
    _audit_ops(
        request,
        action="journal_entry_create",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number, "debit": float(entry.total_debit)},
    )
    return _api_ok({"id": entry.id})


@require_POST
def admin_accounts_journal_entries_update(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entry = JournalEntry.objects.filter(pk=entry_id).first()
    if not entry:
        return _api_error("not_found", status=404)
    if entry.is_posted:
        return _api_error("posted_entry_cannot_edit", status=400)
    data = _read_json(request)
    entry_date = _to_date(data.get("date"))
    if entry_date:
        entry.date = entry_date
    entry.description = str(data.get("description") or "").strip()
    entry_type = str(data.get("entryType") or entry.entry_type).strip()
    if entry_type not in dict(JournalEntry.TYPE_CHOICES):
        return _api_error("invalid_entry_type", status=400)
    entry.entry_type = entry_type
    entry.ref_number = str(data.get("refNumber") or "").strip()
    project_id = data.get("projectId")
    if project_id is not None:
        project = (
            ProjectPage.objects.filter(pk=int(project_id)).first()
            if project_id
            else None
        )
        if project_id and not project:
            return _api_error("project_not_found", status=404)
        entry.project = project
    lines_data = data.get("lines")
    if lines_data is not None:
        if not isinstance(lines_data, list) or len(lines_data) < 2:
            return _api_error("invalid_lines", status=400)
        # Validate every line BEFORE touching the existing ones.  The previous
        # implementation deleted the lines first, so a failed balance check
        # left the entry with no lines and stale totals (silent corruption).
        error, new_lines = _validate_entry_lines(lines_data)
        if error:
            return error
        with transaction.atomic():
            entry.lines.all().delete()
            for line in new_lines:
                line.entry = entry
            JournalEntryLine.objects.bulk_create(new_lines)
    entry.recalculate_totals()
    entry.save()
    _audit_ops(
        request,
        action="journal_entry_update",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number, "debit": float(entry.total_debit)},
    )
    return _api_ok({"id": entry.id})


@require_POST
def admin_accounts_journal_entries_delete(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entry = JournalEntry.objects.filter(pk=entry_id).first()
    if not entry:
        return _api_error("not_found", status=404)
    if entry.is_posted:
        return _api_error("posted_entry_cannot_delete", status=400)
    _audit_ops(
        request,
        action="journal_entry_delete",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        before={"number": entry.number},
    )
    entry.delete()
    return _api_ok()


@require_POST
def admin_accounts_journal_entries_post(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entry = JournalEntry.objects.filter(pk=entry_id).first()
    if not entry:
        return _api_error("not_found", status=404)
    if entry.is_posted:
        return _api_error("already_posted", status=400)
    try:
        entry.post(user=request.user if request.user.is_authenticated else None)
    except Exception as exc:
        return _fail(exc, "journal_post_failed", "Operation failed")
    _audit_ops(
        request,
        action="journal_entry_post",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number},
    )
    return _api_ok({"id": entry.id})


@require_POST
def admin_accounts_journal_entries_unpost(
    request: HttpRequest, entry_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    entry = JournalEntry.objects.filter(pk=entry_id).first()
    if not entry:
        return _api_error("not_found", status=404)
    if not entry.is_posted:
        return _api_error("not_posted", status=400)
    entry.unpost()
    _audit_ops(
        request,
        action="journal_entry_unpost",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number},
    )
    return _api_ok({"id": entry.id})


def _validate_entry_lines(
    lines_data: list[dict[str, Any]],
) -> tuple[JsonResponse | None, list[JournalEntryLine]]:
    """Build and validate journal lines *without writing them*.

    Callers persist the returned (unsaved) objects only after the balance
    check has passed, so a rejected edit can never destroy the old lines.
    """
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    new_lines: list[JournalEntryLine] = []
    for line_data in lines_data:
        account_id = line_data.get("accountId")
        account = (
            Account.objects.filter(pk=int(account_id)).first()
            if account_id
            else None
        )
        if not account:
            return _api_error("account_not_found", status=400), []
        debit = _to_dec(line_data.get("debit")) or Decimal("0")
        credit = _to_dec(line_data.get("credit")) or Decimal("0")
        if debit < 0 or credit < 0:
            return _api_error("negative_amount", status=400), []
        if debit > 0 and credit > 0:
            return _api_error("both_sides", status=400), []
        project_id = line_data.get("projectId")
        project = None
        if project_id:
            project = ProjectPage.objects.filter(pk=int(project_id)).first()
            if not project:
                return _api_error("project_not_found", status=404), []
        new_lines.append(
            JournalEntryLine(
                account=account,
                description=str(line_data.get("description") or "").strip(),
                debit=debit,
                credit=credit,
                project=project,
                contact_type=str(line_data.get("contactType") or "").strip(),
                contact_id=line_data.get("contactId"),
            )
        )
        total_debit += debit
        total_credit += credit
    if total_debit != total_credit:
        return _api_error("unbalanced_entry", status=400), []
    if total_debit == 0:
        return _api_error("empty_entry", status=400), []
    return None, new_lines


@require_GET
def admin_accounts_bank_accounts(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    for ba in BankAccount.objects.select_related("account"):
        items.append(
            {
                "id": ba.id,
                "accountId": ba.account_id,
                "accountCode": ba.account.code,
                "accountName": ba.account.name,
                "bankName": ba.bank_name,
                "branch": ba.branch,
                "accountNumber": ba.account_number,
                "iban": ba.iban,
                "currency": ba.currency,
                "openingBalance": float(ba.opening_balance),
                "openingDate": _to_iso(ba.opening_date),
                "bookBalance": float(ba.book_balance()),
                "isActive": ba.is_active,
                "notes": ba.notes,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_accounts_bank_accounts_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    account_id = data.get("accountId")
    account = (
        Account.objects.filter(pk=int(account_id)).first()
        if account_id
        else None
    )
    if not account:
        return _api_error("account_not_found", status=404)
    bank_name = str(data.get("bankName") or "").strip()
    account_number = str(data.get("accountNumber") or "").strip()
    if not bank_name or not account_number:
        return _api_error("missing_bank_or_number", status=400)
    currency = str(data.get("currency") or BankAccount.CURRENCY_ILS).strip()
    if currency not in dict(BankAccount.CURRENCY_CHOICES):
        return _api_error("invalid_currency", status=400)
    if BankAccount.objects.filter(
        account_number=account_number, bank_name=bank_name
    ).exists():
        return _api_error("bank_account_exists", status=400)
    ba = BankAccount.objects.create(
        account=account,
        bank_name=bank_name,
        branch=str(data.get("branch") or "").strip(),
        account_number=account_number,
        iban=str(data.get("iban") or "").strip(),
        currency=currency,
        opening_balance=_to_dec(data.get("openingBalance")) or Decimal("0"),
        opening_date=_to_date(data.get("openingDate")),
        is_active=bool(data.get("isActive", True)),
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="bank_account_create",
        entity_type="bank_account",
        entity_id=str(ba.id),
        after={"bank": ba.bank_name, "number": ba.account_number},
    )
    return _api_ok({"id": ba.id})


@require_POST
def admin_accounts_bank_accounts_update(
    request: HttpRequest, bank_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ba = BankAccount.objects.filter(pk=bank_id).first()
    if not ba:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    bank_name = str(data.get("bankName") or "").strip()
    account_number = str(data.get("accountNumber") or "").strip()
    if not bank_name or not account_number:
        return _api_error("missing_bank_or_number", status=400)
    currency = str(data.get("currency") or ba.currency).strip()
    if currency not in dict(BankAccount.CURRENCY_CHOICES):
        return _api_error("invalid_currency", status=400)
    if (
        BankAccount.objects.filter(
            account_number=account_number, bank_name=bank_name
        )
        .exclude(pk=ba.pk)
        .exists()
    ):
        return _api_error("bank_account_exists", status=400)
    ba.bank_name = bank_name
    ba.branch = str(data.get("branch") or "").strip()
    ba.account_number = account_number
    ba.iban = str(data.get("iban") or "").strip()
    ba.currency = currency
    ba.opening_balance = (
        _to_dec(data.get("openingBalance")) or ba.opening_balance
    )
    ba.opening_date = _to_date(data.get("openingDate")) or ba.opening_date
    ba.is_active = bool(data.get("isActive", ba.is_active))
    ba.notes = str(data.get("notes") or "").strip()
    ba.save()
    _audit_ops(
        request,
        action="bank_account_update",
        entity_type="bank_account",
        entity_id=str(ba.id),
        after={"bank": ba.bank_name, "number": ba.account_number},
    )
    return _api_ok({"id": ba.id})


@require_POST
def admin_accounts_bank_accounts_delete(
    request: HttpRequest, bank_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ba = BankAccount.objects.filter(pk=bank_id).first()
    if not ba:
        return _api_error("not_found", status=404)
    if Check.objects.filter(account=ba).exists():
        return _api_error("has_checks", status=400)
    _audit_ops(
        request,
        action="bank_account_delete",
        entity_type="bank_account",
        entity_id=str(ba.id),
        before={"bank": ba.bank_name, "number": ba.account_number},
    )
    ba.delete()
    return _api_ok()


@require_GET
def admin_accounts_checks(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    qs = Check.objects.select_related("account", "account__account", "project")
    direction = request.GET.get("direction")
    status = request.GET.get("status")
    if direction:
        qs = qs.filter(direction=direction)
    if status:
        qs = qs.filter(status=status)
    for ch in qs[:500]:
        items.append(
            {
                "id": ch.id,
                "direction": ch.direction,
                "checkNumber": ch.check_number,
                "bankName": ch.bank_name,
                "accountId": ch.account_id,
                "accountName": ch.account.bank_name if ch.account else None,
                "issueDate": _to_iso(ch.issue_date),
                "maturityDate": _to_iso(ch.maturity_date),
                "amount": float(ch.amount),
                "currency": ch.currency,
                "payee": ch.payee,
                "payer": ch.payer,
                "projectId": ch.project_id,
                "projectTitle": ch.project.title if ch.project else None,
                "status": ch.status,
                "clearedDate": _to_iso(ch.cleared_date),
                "notes": ch.notes,
                "journalEntryId": ch.journal_entry_id,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_accounts_checks_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    direction = str(data.get("direction") or "").strip()
    if direction not in dict(Check.DIRECTION_CHOICES):
        return _api_error("invalid_direction", status=400)
    check_number = str(data.get("checkNumber") or "").strip()
    bank_name = str(data.get("bankName") or "").strip()
    if not check_number or not bank_name:
        return _api_error("missing_check_or_bank", status=400)
    issue_date = _to_date(data.get("issueDate"))
    maturity_date = _to_date(data.get("maturityDate"))
    if not issue_date or not maturity_date:
        return _api_error("missing_dates", status=400)
    if maturity_date < issue_date:
        return _api_error("invalid_maturity", status=400)
    amount = _to_dec(data.get("amount"))
    if not amount or amount <= 0:
        return _api_error("invalid_amount", status=400)
    account_id = data.get("accountId")
    account = (
        BankAccount.objects.filter(pk=int(account_id)).first()
        if account_id
        else None
    )
    project_id = data.get("projectId")
    project = None
    if project_id:
        project = ProjectPage.objects.filter(pk=int(project_id)).first()
        if not project:
            return _api_error("project_not_found", status=404)
    currency = str(data.get("currency") or BankAccount.CURRENCY_ILS).strip()
    if currency not in dict(BankAccount.CURRENCY_CHOICES):
        return _api_error("invalid_currency", status=400)
    ch = Check.objects.create(
        direction=direction,
        check_number=check_number,
        bank_name=bank_name,
        account=account,
        issue_date=issue_date,
        maturity_date=maturity_date,
        amount=amount,
        currency=currency,
        payee=str(data.get("payee") or "").strip(),
        payer=str(data.get("payer") or "").strip(),
        project=project,
        status=Check.STATUS_PENDING,
        notes=str(data.get("notes") or "").strip(),
    )
    _audit_ops(
        request,
        action="check_create",
        entity_type="check",
        entity_id=str(ch.id),
        after={"number": ch.check_number, "amount": float(ch.amount)},
    )
    return _api_ok({"id": ch.id})


@require_POST
def admin_accounts_checks_update(
    request: HttpRequest, check_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ch = Check.objects.filter(pk=check_id).first()
    if not ch:
        return _api_error("not_found", status=404)
    if ch.status != Check.STATUS_PENDING:
        return _api_error("only_pending_editable", status=400)
    data = _read_json(request)
    check_number = str(data.get("checkNumber") or "").strip()
    bank_name = str(data.get("bankName") or "").strip()
    if not check_number or not bank_name:
        return _api_error("missing_check_or_bank", status=400)
    ch.check_number = check_number
    ch.bank_name = bank_name
    ch.issue_date = _to_date(data.get("issueDate")) or ch.issue_date
    ch.maturity_date = _to_date(data.get("maturityDate")) or ch.maturity_date
    if ch.maturity_date < ch.issue_date:
        return _api_error("invalid_maturity", status=400)
    amount = _to_dec(data.get("amount"))
    if amount is not None:
        if amount <= 0:
            return _api_error("invalid_amount", status=400)
        ch.amount = amount
    account_id = data.get("accountId")
    if account_id is not None:
        ch.account = (
            BankAccount.objects.filter(pk=int(account_id)).first()
            if account_id
            else None
        )
    project_id = data.get("projectId")
    if project_id is not None:
        ch.project = (
            ProjectPage.objects.filter(pk=int(project_id)).first()
            if project_id
            else None
        )
    ch.currency = str(data.get("currency") or ch.currency).strip()
    ch.payee = str(data.get("payee") or "").strip()
    ch.payer = str(data.get("payer") or "").strip()
    ch.notes = str(data.get("notes") or "").strip()
    ch.save()
    _audit_ops(
        request,
        action="check_update",
        entity_type="check",
        entity_id=str(ch.id),
        after={"number": ch.check_number, "amount": float(ch.amount)},
    )
    return _api_ok({"id": ch.id})


@require_POST
def admin_accounts_checks_delete(
    request: HttpRequest, check_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ch = Check.objects.filter(pk=check_id).first()
    if not ch:
        return _api_error("not_found", status=404)
    if ch.status != Check.STATUS_PENDING:
        return _api_error("only_pending_deletable", status=400)
    _audit_ops(
        request,
        action="check_delete",
        entity_type="check",
        entity_id=str(ch.id),
        before={"number": ch.check_number, "amount": float(ch.amount)},
    )
    ch.delete()
    return _api_ok()


@require_POST
def admin_accounts_checks_clear(
    request: HttpRequest, check_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ch = Check.objects.filter(pk=check_id).first()
    if not ch:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    cleared_date = _to_date(data.get("clearedDate")) or timezone.now().date()
    try:
        entry = ch.mark_cleared(cleared_date)
    except Exception as exc:
        return _fail(exc, "check_clear_failed", "Operation failed")
    _audit_ops(
        request,
        action="check_clear",
        entity_type="check",
        entity_id=str(ch.id),
        after={"status": ch.status, "entry": entry.number if entry else None},
    )
    return _api_ok({"id": ch.id, "journalEntryId": entry.id if entry else None})


@require_POST
def admin_accounts_checks_bounce(
    request: HttpRequest, check_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ch = Check.objects.filter(pk=check_id).first()
    if not ch:
        return _api_error("not_found", status=404)
    try:
        ch.mark_bounced()
    except Exception as exc:
        return _fail(exc, "check_bounce_failed", "Operation failed")
    _audit_ops(
        request,
        action="check_bounce",
        entity_type="check",
        entity_id=str(ch.id),
        after={"status": ch.status},
    )
    return _api_ok({"id": ch.id})


@require_POST
def admin_accounts_checks_cancel(
    request: HttpRequest, check_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    ch = Check.objects.filter(pk=check_id).first()
    if not ch:
        return _api_error("not_found", status=404)
    try:
        ch.mark_cancelled()
    except Exception as exc:
        return _fail(exc, "check_cancel_failed", "Operation failed")
    _audit_ops(
        request,
        action="check_cancel",
        entity_type="check",
        entity_id=str(ch.id),
        after={"status": ch.status},
    )
    return _api_ok({"id": ch.id})


@require_GET
def admin_accounts_tax_records(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    items: list[dict[str, Any]] = []
    qs = TaxRecord.objects.select_related("project")
    tax_type = request.GET.get("type")
    period = request.GET.get("period")
    paid = request.GET.get("paid")
    if tax_type:
        qs = qs.filter(tax_type=tax_type)
    if period:
        qs = qs.filter(return_period=period)
    if paid is not None:
        qs = qs.filter(paid=paid.lower() == "true")
    for tr in qs[:500]:
        items.append(
            {
                "id": tr.id,
                "taxType": tr.tax_type,
                "projectId": tr.project_id,
                "projectTitle": tr.project.title if tr.project else None,
                "transactionDate": _to_iso(tr.transaction_date),
                "description": tr.description,
                "grossAmount": float(tr.gross_amount),
                "taxRate": float(tr.tax_rate),
                "taxAmount": float(tr.tax_amount),
                "netAmount": float(tr.net_amount),
                "paid": tr.paid,
                "paidDate": _to_iso(tr.paid_date),
                "returnPeriod": tr.return_period,
            }
        )
    return _api_ok({"items": items})


@require_POST
def admin_accounts_tax_records_create(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    tax_type = str(data.get("taxType") or "").strip()
    if tax_type not in dict(TaxRecord.TYPE_CHOICES):
        return _api_error("invalid_tax_type", status=400)
    transaction_date = _to_date(data.get("transactionDate"))
    if not transaction_date:
        return _api_error("missing_date", status=400)
    gross_amount = _to_dec(data.get("grossAmount"))
    if gross_amount is None or gross_amount <= 0:
        return _api_error("invalid_gross_amount", status=400)
    project_id = data.get("projectId")
    project = None
    if project_id:
        project = ProjectPage.objects.filter(pk=int(project_id)).first()
        if not project:
            return _api_error("project_not_found", status=404)
    tax_rate = _to_dec(data.get("taxRate"))
    if tax_rate is None:
        tax_rate = TaxRecord.RATES.get(tax_type, Decimal("0"))
    tr = TaxRecord.objects.create(
        tax_type=tax_type,
        project=project,
        transaction_date=transaction_date,
        description=str(data.get("description") or "").strip(),
        gross_amount=gross_amount,
        tax_rate=tax_rate,
        paid=bool(data.get("paid", False)),
        paid_date=_to_date(data.get("paidDate")),
        return_period=str(data.get("returnPeriod") or "").strip()
        or transaction_date.strftime("%Y-%m"),
    )
    _audit_ops(
        request,
        action="tax_record_create",
        entity_type="tax_record",
        entity_id=str(tr.id),
        after={"type": tr.tax_type, "amount": float(tr.tax_amount)},
    )
    return _api_ok({"id": tr.id})


@require_POST
def admin_accounts_tax_records_update(
    request: HttpRequest, tax_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    tr = TaxRecord.objects.filter(pk=tax_id).first()
    if not tr:
        return _api_error("not_found", status=404)
    data = _read_json(request)
    tax_type = str(data.get("taxType") or tr.tax_type).strip()
    if tax_type not in dict(TaxRecord.TYPE_CHOICES):
        return _api_error("invalid_tax_type", status=400)
    tr.tax_type = tax_type
    transaction_date = (
        _to_date(data.get("transactionDate")) or tr.transaction_date
    )
    tr.transaction_date = transaction_date
    tr.description = str(data.get("description") or "").strip()
    gross_amount = _to_dec(data.get("grossAmount"))
    if gross_amount is not None:
        if gross_amount <= 0:
            return _api_error("invalid_gross_amount", status=400)
        tr.gross_amount = gross_amount
    tax_rate = _to_dec(data.get("taxRate"))
    if tax_rate is not None:
        tr.tax_rate = tax_rate
    tr.paid = bool(data.get("paid", tr.paid))
    tr.paid_date = _to_date(data.get("paidDate")) or tr.paid_date
    tr.return_period = str(
        data.get("returnPeriod") or ""
    ).strip() or transaction_date.strftime("%Y-%m")
    project_id = data.get("projectId")
    if project_id is not None:
        tr.project = (
            ProjectPage.objects.filter(pk=int(project_id)).first()
            if project_id
            else None
        )
    tr.save()
    _audit_ops(
        request,
        action="tax_record_update",
        entity_type="tax_record",
        entity_id=str(tr.id),
        after={"type": tr.tax_type, "amount": float(tr.tax_amount)},
    )
    return _api_ok({"id": tr.id})


@require_POST
def admin_accounts_tax_records_delete(
    request: HttpRequest, tax_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    tr = TaxRecord.objects.filter(pk=tax_id).first()
    if not tr:
        return _api_error("not_found", status=404)
    _audit_ops(
        request,
        action="tax_record_delete",
        entity_type="tax_record",
        entity_id=str(tr.id),
        before={"type": tr.tax_type, "amount": float(tr.tax_amount)},
    )
    tr.delete()
    return _api_ok()


@require_GET
def admin_accounts_reports_trial_balance(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    as_of = _to_date(request.GET.get("asOf")) or timezone.now().date()
    items: list[dict[str, Any]] = []
    for acc in Account.objects.filter(is_active=True):
        balance = acc.balance(as_of=as_of)
        items.append(
            {
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "nameAr": acc.name_ar,
                "accountType": acc.account_type,
                "balance": float(balance),
            }
        )
    return _api_ok({"asOf": _to_iso(as_of), "items": items})


@require_GET
def admin_accounts_reports_balance_sheet(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    as_of = _to_date(request.GET.get("asOf")) or timezone.now().date()
    assets = Decimal("0")
    liabilities = Decimal("0")
    equity = Decimal("0")
    income = Decimal("0")
    expenses = Decimal("0")
    for acc in Account.objects.filter(is_active=True):
        balance = acc.balance(as_of=as_of)
        if acc.account_type == Account.TYPE_ASSET:
            assets += balance
        elif acc.account_type == Account.TYPE_LIABILITY:
            liabilities += balance
        elif acc.account_type == Account.TYPE_EQUITY:
            equity += balance
        elif acc.account_type == Account.TYPE_INCOME:
            income += balance
        elif acc.account_type == Account.TYPE_EXPENSE:
            expenses += balance
    # Current-period profit is part of equity; without it the balance sheet
    # can never balance once income/expense entries are posted.
    retained_earnings = income - expenses
    return _api_ok(
        {
            "asOf": _to_iso(as_of),
            "assets": float(assets),
            "liabilities": float(liabilities),
            "equity": float(equity),
            "retainedEarnings": float(retained_earnings),
            "liabilitiesAndEquity": float(
                liabilities + equity + retained_earnings
            ),
        }
    )


@require_GET
def admin_accounts_reports_income_statement(
    request: HttpRequest,
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    from_date = _to_date(request.GET.get("from"))
    to_date = _to_date(request.GET.get("to")) or timezone.now().date()
    if not from_date:
        from_date = date(to_date.year, 1, 1)
    income = Decimal("0")
    expenses = Decimal("0")
    for acc in Account.objects.filter(is_active=True):
        balance = acc.balance(as_of=to_date)
        if from_date:
            # balance() uses <= as_of, so use the previous day to avoid
            # excluding entries dated exactly at the period start.
            opening = acc.balance(as_of=from_date - timedelta(days=1))
            balance = balance - opening
        if acc.account_type == Account.TYPE_INCOME:
            income += balance
        elif acc.account_type == Account.TYPE_EXPENSE:
            expenses += balance
    net_profit = income - expenses
    return _api_ok(
        {
            "from": _to_iso(from_date),
            "to": _to_iso(to_date),
            "income": float(income),
            "expenses": float(expenses),
            "netProfit": float(net_profit),
        }
    )


@require_GET
def admin_accounts_reports_project_pl(
    request: HttpRequest, project_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    project = ProjectPage.objects.filter(pk=project_id).first()
    if not project:
        return _api_error("project_not_found", status=404)
    from_date = _to_date(request.GET.get("from"))
    to_date = _to_date(request.GET.get("to")) or timezone.now().date()
    income = Decimal("0")
    expenses = Decimal("0")
    qs = JournalEntryLine.objects.filter(entry__is_posted=True).filter(
        Q(project=project) | Q(entry__project=project)
    )
    if from_date:
        qs = qs.filter(entry__date__gte=from_date)
    if to_date:
        qs = qs.filter(entry__date__lte=to_date)
    for line in qs.select_related("account"):
        if line.account.account_type == Account.TYPE_INCOME:
            income += line.credit - line.debit
        elif line.account.account_type == Account.TYPE_EXPENSE:
            expenses += line.debit - line.credit
    return _api_ok(
        {
            "projectId": project.id,
            "projectTitle": project.title,
            "from": _to_iso(from_date),
            "to": _to_iso(to_date),
            "income": float(income),
            "expenses": float(expenses),
            "netProfit": float(income - expenses),
        }
    )


@require_GET
def admin_accounts_lookup(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    accounts = [
        {"id": a.id, "code": a.code, "name": a.name, "nameAr": a.name_ar}
        for a in Account.objects.filter(is_active=True)
    ]
    banks = [
        {"id": b.id, "bankName": b.bank_name, "accountNumber": b.account_number}
        for b in BankAccount.objects.filter(is_active=True)
    ]
    projects = [
        {"id": p["id"], "title": p["title"]}
        for p in ProjectPage.objects.live().values("id", "title")
    ]
    return _api_ok(
        {
            "accounts": accounts,
            "bankAccounts": banks,
            "projects": projects,
        }
    )


@require_POST
def admin_accounts_generate_from_contract_payment(
    request: HttpRequest, payment_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    payment = ContractPayment.objects.filter(pk=payment_id).first()
    if not payment:
        return _api_error("not_found", status=404)
    try:
        entry = payment.generate_journal_entry()
    except Exception as exc:
        return _fail(exc, "journal_generation_failed", "Operation failed")
    _audit_ops(
        request,
        action="journal_entry_generate_from_contract_payment",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number, "paymentId": payment.id},
    )
    return _api_ok({"journalEntryId": entry.id, "number": entry.number})


@require_POST
def admin_accounts_generate_from_purchase_order(
    request: HttpRequest, order_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    order = PurchaseOrder.objects.filter(pk=order_id).first()
    if not order:
        return _api_error("not_found", status=404)
    try:
        entry = order.generate_journal_entry()
    except Exception as exc:
        return _fail(exc, "payroll_journal_failed", "Operation failed")
    _audit_ops(
        request,
        action="journal_entry_generate_from_purchase_order",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number, "orderId": order.id},
    )
    return _api_ok({"journalEntryId": entry.id, "number": entry.number})


@require_POST
def admin_accounts_generate_from_payroll(
    request: HttpRequest, payroll_id: int
) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    payroll = WorkerPayrollEntry.objects.filter(pk=payroll_id).first()
    if not payroll:
        return _api_error("not_found", status=404)
    try:
        entry = payroll.generate_journal_entry()
    except Exception as exc:
        return _fail(exc, "pending_entry_failed", "Operation failed")
    _audit_ops(
        request,
        action="journal_entry_generate_from_payroll",
        entity_type="journal_entry",
        entity_id=str(entry.id),
        after={"number": entry.number, "payrollId": payroll.id},
    )
    return _api_ok({"journalEntryId": entry.id, "number": entry.number})


@require_GET
def admin_accounts_pending_entries(request: HttpRequest) -> JsonResponse:
    forbidden = _require_accounting(request)
    if forbidden:
        return forbidden
    payments: list[dict[str, Any]] = []
    for p in ContractPayment.objects.filter(
        status=ContractPayment.STATUS_PAID, journal_entry__isnull=True
    ).select_related("contract", "contract__project"):
        payments.append(
            {
                "id": p.id,
                "type": "contract_payment",
                "title": p.title,
                "amount": float(p.paid_amount or 0),
                "date": _to_iso(p.paid_date),
                "projectTitle": (
                    p.contract.project.title
                    if p.contract and p.contract.project
                    else None
                ),
            }
        )
    orders: list[dict[str, Any]] = []
    for o in PurchaseOrder.objects.filter(
        status=PurchaseOrder.STATUS_RECEIVED, journal_entry__isnull=True
    ).select_related("project"):
        orders.append(
            {
                "id": o.id,
                "type": "purchase_order",
                "number": o.number,
                "amount": float(o.total_amount or 0),
                "date": _to_iso(o.date),
                "projectTitle": o.project.title if o.project else None,
            }
        )
    payrolls: list[dict[str, Any]] = []
    for pr in WorkerPayrollEntry.objects.filter(
        status=WorkerPayrollEntry.STATUS_PAID, journal_entry__isnull=True
    ).select_related("worker"):
        payrolls.append(
            {
                "id": pr.id,
                "type": "payroll",
                "workerName": pr.worker.name,
                "amount": float(pr.amount or 0),
                "date": _to_iso(pr.paid_at),
                "period": f"{pr.year}/{pr.month}",
            }
        )
    return _api_ok(
        {
            "contractPayments": payments,
            "purchaseOrders": orders,
            "payrolls": payrolls,
        }
    )
