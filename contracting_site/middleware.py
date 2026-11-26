from __future__ import annotations

import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseNotFound
from django.http import JsonResponse


class BlockStaticDirectoryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        static_url = getattr(settings, "STATIC_URL", "/static/") or "/static/"
        path = getattr(request, "path_info", "") or ""
        if static_url and path.startswith(static_url) and path.endswith("/"):
            return HttpResponseNotFound()
        return self.get_response(request)


class AdminApiRateLimitMiddleware:
    """Bound every /api/admin/* request, including endpoints without a
    per-view rate limit.  Uses the same cache backend as the API helpers.
    """

    LIMIT = 600
    WINDOW_SECONDS = 60

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _ip(request) -> str:
        remote = str(request.META.get("REMOTE_ADDR") or "").strip() or "unknown"
        trusted = set(getattr(settings, "TRUSTED_PROXY_IPS", None) or [])
        forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
        if trusted and remote in trusted and forwarded:
            return forwarded.split(",")[0].strip() or remote
        return remote

    def __call__(self, request):
        if not request.path_info.startswith("/api/admin/"):
            return self.get_response(request)

        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            ident = f"u:{user.id}"
        else:
            ident = f"ip:{self._ip(request)}"
        bucket = int(time.time() // self.WINDOW_SECONDS)
        key = f"rl:admin_api:{ident}:{bucket}"
        try:
            added = cache.add(key, 1, timeout=self.WINDOW_SECONDS)
            count = 1 if added else cache.incr(key)
        except Exception:
            return JsonResponse(
                {
                    "ok": False,
                    "error": {
                        "code": "rate_limit_unavailable",
                        "message": "تعذّر التحقق من حد الطلبات.",
                    },
                },
                status=503,
            )
        if count > self.LIMIT:
            return JsonResponse(
                {
                    "ok": False,
                    "error": {
                        "code": "rate_limited",
                        "message": "تم تجاوز الحد المسموح من الطلبات.",
                    },
                },
                status=429,
            )
        return self.get_response(request)
