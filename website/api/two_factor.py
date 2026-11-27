"""TOTP second-factor endpoints (RFC 6238, standard library only)."""

from __future__ import annotations

import base64
import hashlib
import hmac
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


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    candidate = str(code or "").strip()
    if not candidate.isdigit() or len(candidate) != 6:
        return False
    step = int(time.time()) // 30
    return any(
        hmac.compare_digest(_hotp(secret, step + delta), candidate)
        for delta in range(-window, window + 1)
    )


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
    code = str(_read_json(request).get("code") or "").strip()
    if not verify_totp(profile.secret, code):
        return _api_error("invalid_code", status=400)
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
    code = str(_read_json(request).get("code") or "").strip()
    if not verify_totp(profile.secret, code):
        return _api_error("invalid_code", status=400)
    profile.enabled = False
    profile.enabled_at = None
    profile.save(update_fields=["enabled", "enabled_at"])
    return _api_ok()
