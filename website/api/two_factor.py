"""TOTP second-factor endpoints (RFC 6238, standard library only)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
import struct
import time
from typing import Any

from django.http import HttpRequest
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.views.decorators.http import require_POST

from website.models import TotpProfile

from .common import *

logger = logging.getLogger(__name__)

_TOTP_STEP_SECONDS = 30
# A single adjacent step in each direction is enough for clock skew; never
# let a caller widen the acceptance window from request data.
_TOTP_MAX_WINDOW = 1
_TOTP_FAILURE_LIMIT = 5
_TOTP_FAILURE_WINDOW = 300
_TOTP_LOCK_BASE_SECONDS = 30
_TOTP_LOCK_MAX_SECONDS = 300


def _b32_decode(secret: str) -> bytes:
    value = secret.strip().upper()
    value += "=" * ((8 - len(value) % 8) % 8)
    return base64.b32decode(value, casefold=True)


def _hotp(secret: str, counter: int) -> str:
    digest = hmac.new(
        _b32_decode(secret), counter.to_bytes(8, "big"), hashlib.sha1
    ).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1000000:06d}"


def verify_totp(
    secret: str,
    code: str,
    window: int = 1,
    *,
    profile: TotpProfile | None = None,
    purpose: str = "",
    request: HttpRequest | None = None,
) -> bool:
    """Verify a 6-digit RFC 6238 code with strict expiry and replay checks.

    Throttling/replay tracking is enabled when ``request``, ``profile`` and
    ``purpose`` are supplied; the plain ``verify_totp(secret, code)`` form
    stays side-effect free for callers that only need a pure check.
    """
    candidate = str(code or "").strip()
    # isdigit() also accepts Unicode digits (e.g. Arabic-Indic); TOTP codes
    # are ASCII only, so reject anything else before any comparison.
    if (
        len(candidate) != 6
        or not candidate.isascii()
        or not candidate.isdigit()
    ):
        return False
    try:
        bounded_window = max(0, min(_TOTP_MAX_WINDOW, int(window)))
    except (TypeError, ValueError):
        return False

    throttled = request is not None and profile is not None and bool(purpose)
    scope = f"totp:{purpose or 'verify'}"
    subject = str(getattr(profile, "pk", "") or "")
    if throttled and _check_failure_lock(request, scope, subject):
        return False

    try:
        step = int(time.time()) // _TOTP_STEP_SECONDS
        expected = [
            _hotp(secret, step + delta)
            for delta in range(-bounded_window, bounded_window + 1)
        ]
    except Exception:
        logger.warning(
            "TOTP verification rejected because the secret is invalid"
        )
        if throttled:
            _record_failure(
                request,
                scope,
                subject,
                limit=_TOTP_FAILURE_LIMIT,
                window_seconds=_TOTP_FAILURE_WINDOW,
                base_lock_seconds=_TOTP_LOCK_BASE_SECONDS,
                max_lock_seconds=_TOTP_LOCK_MAX_SECONDS,
            )
        return False

    matched_step: int | None = None
    for index, value in enumerate(expected):
        if hmac.compare_digest(value, candidate):
            matched_step = step + index - bounded_window
            break
    if matched_step is None:
        if throttled:
            _record_failure(
                request,
                scope,
                subject,
                limit=_TOTP_FAILURE_LIMIT,
                window_seconds=_TOTP_FAILURE_WINDOW,
                base_lock_seconds=_TOTP_LOCK_BASE_SECONDS,
                max_lock_seconds=_TOTP_LOCK_MAX_SECONDS,
            )
        return False

    if throttled:
        # A code step must never authenticate twice. The purpose keeps setup
        # confirmation, disabling and login independent of one another.
        fingerprint = _identifier_digest(f"{subject}:{secret}:{purpose}")
        replay_key = f"totp:used:{fingerprint}:{matched_step}"
        replay_timeout = (2 * bounded_window + 2) * _TOTP_STEP_SECONDS
        if not _claim_once(replay_key, replay_timeout):
            _record_failure(
                request,
                scope,
                subject,
                limit=_TOTP_FAILURE_LIMIT,
                window_seconds=_TOTP_FAILURE_WINDOW,
                base_lock_seconds=_TOTP_LOCK_BASE_SECONDS,
                max_lock_seconds=_TOTP_LOCK_MAX_SECONDS,
            )
            return False
        _clear_failures(request, scope, subject, subject_only=True)
    return True


def _profile_for(user: Any) -> TotpProfile | None:
    return TotpProfile.objects.filter(user=user).first()


@require_GET
def auth_2fa_status(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    profile = _profile_for(request.user)
    return _api_ok(
        {
            "enabled": bool(profile and profile.enabled),
            "hasPendingSecret": bool(profile and not profile.enabled),
        }
    )


@require_POST
def auth_2fa_setup(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(
        request, scope="auth_2fa_setup", limit=10, window_seconds=600
    )
    if limited:
        return limited
    secret = (
        base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
    )
    profile, _ = TotpProfile.objects.update_or_create(
        user=request.user,
        defaults={"secret": secret, "enabled": False, "enabled_at": None},
    )
    label = f"SamarQand:{request.user.username}"
    otpauth = (
        f"otpauth://totp/{label}?secret={secret}"
        "&issuer=SamarQand&algorithm=SHA1&digits=6&period=30"
    )
    return _api_ok({"secret": profile.secret, "otpauthUrl": otpauth})


@require_POST
def auth_2fa_confirm(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(
        request, scope="auth_2fa_confirm", limit=10, window_seconds=600
    )
    if limited:
        return limited
    profile = _profile_for(request.user)
    if not profile or profile.enabled:
        return _api_error("no_pending_setup", status=400)
    locked = _check_failure_lock(request, "totp:confirm", str(profile.pk))
    if locked:
        return locked
    code = str(_read_json(request).get("code") or "").strip()
    if not verify_totp(
        profile.secret,
        code,
        request=request,
        profile=profile,
        purpose="confirm",
    ):
        return _api_error(
            "invalid_code",
            status=400,
            message="رمز المصادقة غير صحيح أو منتهي الصلاحية.",
        )
    profile.enabled = True
    profile.enabled_at = timezone.now()
    profile.save(update_fields=["enabled", "enabled_at"])
    return _api_ok()


@require_POST
def auth_2fa_disable(request: HttpRequest) -> JsonResponse:
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    limited = _check_rate_limit(
        request, scope="auth_2fa_disable", limit=10, window_seconds=600
    )
    if limited:
        return limited
    profile = _profile_for(request.user)
    if not profile or not profile.enabled:
        return _api_error("not_enabled", status=400)
    locked = _check_failure_lock(request, "totp:disable", str(profile.pk))
    if locked:
        return locked
    code = str(_read_json(request).get("code") or "").strip()
    if not verify_totp(
        profile.secret,
        code,
        request=request,
        profile=profile,
        purpose="disable",
    ):
        return _api_error(
            "invalid_code",
            status=400,
            message="رمز المصادقة غير صحيح أو منتهي الصلاحية.",
        )
    profile.enabled = False
    profile.enabled_at = None
    profile.save(update_fields=["enabled", "enabled_at"])
    return _api_ok()
