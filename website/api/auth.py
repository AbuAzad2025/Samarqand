"""API views for Samarqand Contracting Company."""

from __future__ import annotations

import logging
import time

from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from website.models import TotpProfile
from website.models import Worker

from .two_factor import verify_totp

logger = logging.getLogger(__name__)

# One generic response for every credential failure, whether or not the
# supplied username exists, is active or is allowed to use the control panel.
_GENERIC_LOGIN_FAILURE_MESSAGE = (
    "تعذّر تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور ثم حاول مرة أخرى."
)
# Short, uniform floor for credential checks; longer waits are enforced by
# the lockout below (via Retry-After), not by blocking a server worker.
_LOGIN_UNIFORM_DELAY_SECONDS = 0.05


from .common import *


def csrf_failure(
    request: HttpRequest, reason: str = ""
) -> JsonResponse | HttpResponse:
    if str(getattr(request, "path", "") or "").startswith("/api/"):
        # Django's reason may reveal trusted origins/configuration. Keep it in
        # the server log only and always return the same opaque message.
        if reason:
            safe_reason = (
                str(reason)[:200].replace("\r", " ").replace("\n", " ")
            )
            logger.warning("CSRF failure on %s: %s", request.path, safe_reason)
        msg = "فشل التحقق الأمني. حدّث الصفحة ثم أعد المحاولة."
        return _api_error("csrf_failed", status=403, message=msg)
    return HttpResponse(
        "CSRF Failed", status=403, content_type="text/plain; charset=utf-8"
    )


def auth_access(request: HttpRequest) -> JsonResponse:
    return _api_ok(
        {"canUseRestrictedTools": _can_use_restricted_tools(request)}
    )


@require_POST
def auth_login(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="auth_login", limit=12, window_seconds=300
    )
    if limited:
        return limited
    data = _read_json(request)
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    code = str(data.get("code") or "").strip()

    locked = _check_failure_lock(request, "auth_login", username)
    if locked:
        return locked

    # Spend the same bounded time on every credential check so a missing
    # account cannot be identified by timing. The floor is tiny and capped;
    # longer waits are enforced by lockout + Retry-After, never by sleeping
    # a server worker for a meaningful duration.
    started = time.monotonic()
    user = authenticate(request, username=username, password=password)
    remaining = _LOGIN_UNIFORM_DELAY_SECONDS - (time.monotonic() - started)
    if remaining > 0:
        time.sleep(remaining)

    if (
        not user
        or not getattr(user, "is_active", False)
        or not getattr(user, "is_staff", False)
    ):
        _record_failure(request, "auth_login", username)
        return _api_error(
            "invalid_credentials",
            status=401,
            message=_GENERIC_LOGIN_FAILURE_MESSAGE,
        )
    # Valid credentials: reset only this account's failure counter, never the
    # source-IP counter (which also protects other accounts).
    _clear_failures(request, "auth_login", username, subject_only=True)

    profile = TotpProfile.objects.filter(user=user, enabled=True).first()
    if profile:
        if not code:
            return _api_error("two_factor_required", status=401)
        profile_locked = _check_failure_lock(
            request, "totp_login", str(profile.pk)
        )
        if profile_locked:
            return profile_locked
        if not verify_totp(
            profile.secret,
            code,
            request=request,
            profile=profile,
            purpose="login",
        ):
            return _api_error("invalid_code", status=401)
    django_login(request, user)
    return _api_ok()


@ensure_csrf_cookie
def auth_me(request: HttpRequest) -> JsonResponse:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_ok(
            {
                "authenticated": False,
                "username": "",
                "isStaff": False,
                "isSuperuser": False,
                "role": "anonymous",
                "groups": [],
                "workerId": 0,
            }
        )
    try:
        groups = list(user.groups.values_list("name", flat=True))
    except Exception:
        groups = []
    worker_id = 0
    try:
        linked = (
            Worker.objects.filter(user=user)
            .values_list("id", flat=True)
            .first()
        )
        worker_id = int(linked or 0)
    except Exception:
        worker_id = 0
    return _api_ok(
        {
            "authenticated": True,
            "username": getattr(user, "username", "") or "",
            "isStaff": bool(getattr(user, "is_staff", False)),
            "isSuperuser": bool(getattr(user, "is_superuser", False)),
            "role": _user_role(user),
            "groups": groups,
            "workerId": worker_id,
        }
    )


@require_POST
def auth_logout(request: HttpRequest) -> JsonResponse:
    django_logout(request)
    return _api_ok()


@require_POST
def auth_change_password(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="auth_change_password", limit=12, window_seconds=600
    )
    if limited:
        return limited
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return _api_error("unauthorized", status=401)
    if not getattr(user, "is_staff", False):
        return _api_error("forbidden", status=403)

    locked = _check_failure_lock(request, "auth_change_password", str(user.pk))
    if locked:
        return locked

    data = _read_json(request)
    old_password = str(data.get("oldPassword") or "")
    new_password = str(data.get("newPassword") or "")

    if not old_password or not new_password:
        return _api_error("missing_fields", status=400)

    if not user.check_password(old_password):
        _record_failure(request, "auth_change_password", str(user.pk))
        return _api_error("invalid_old_password", status=400)
    _clear_failures(
        request, "auth_change_password", str(user.pk), subject_only=True
    )

    user.set_password(new_password)
    user.save()
    django_login(request, user)
    return _api_ok()


@require_POST
def admin_client_errors(request: HttpRequest) -> JsonResponse:
    limited = _check_rate_limit(
        request, scope="admin_client_errors", limit=60, window_seconds=300
    )
    if limited:
        return limited
    forbidden = _require_staff(request)
    if forbidden:
        return forbidden
    data = _read_json(request)
    message = str(data.get("message") or "").strip()
    if not message:
        return _api_error("missing_fields", status=400)
    route = str(data.get("route") or "").strip()
    stack = str(data.get("stack") or "").strip()
    component_stack = str(data.get("componentStack") or "").strip()
    ua = str(request.META.get("HTTP_USER_AGENT") or "").strip()

    user = getattr(request, "user", None)
    logger.error(
        "Client runtime error",
        extra={
            "path": str(getattr(request, "path", "") or ""),
            "route": route,
            "message": message,
            "stack": stack,
            "componentStack": component_stack,
            "userAgent": ua,
            "userId": (
                getattr(user, "id", None)
                if user and getattr(user, "is_authenticated", False)
                else None
            ),
            "username": (
                getattr(user, "username", None)
                if user and getattr(user, "is_authenticated", False)
                else None
            ),
        },
    )
    return _api_ok()
